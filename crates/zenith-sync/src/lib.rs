//! Local-first change replication. The host supplies an app-private data directory.
//!
//! Changes are opaque: this crate validates envelopes, not application semantics.
//! A host must validate merge-library updates before applying them to its documents.
//! SQLite is the durable source of truth; notifications are hints and can lag.
//! No network services start merely by opening an [`Engine`].

pub mod discovery;
pub mod identity;
pub mod pairing;
pub mod store;
mod wire;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fmt, path::Path, sync::Mutex};
use tokio::sync::broadcast;

pub use identity::Identity;
pub use store::{Peer, StoredChange, UpdateStore};

/// Maximum opaque payload, before any frame overhead.
pub const MAX_CHANGE_BYTES: usize = 256 * 1024;
/// Envelope schema understood by this engine. Independent of the app's schema.
pub const CHANGE_VERSION: u16 = 1;

/// SHA-256 of the certificate's DER SubjectPublicKeyInfo, not its name or serial.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash, Serialize, Deserialize)]
pub struct DeviceId(pub [u8; 32]);

impl fmt::Display for DeviceId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for (i, byte) in self.0.iter().enumerate() {
            if i > 0 && i % 4 == 0 {
                write!(f, "-")?;
            }
            write!(f, "{byte:02X}")?;
        }
        Ok(())
    }
}

/// A content-addressed blob. Identical blobs with the same version collapse.
/// Applications must include their document ID and operation identity in `payload`.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct Change {
    pub version: u16,
    pub id: [u8; 32],
    pub payload: Vec<u8>,
}

impl Change {
    pub fn new(payload: Vec<u8>) -> Result<Self> {
        let change = Self {
            version: CHANGE_VERSION,
            id: Self::digest(CHANGE_VERSION, &payload),
            payload,
        };
        change.validate()?;
        Ok(change)
    }
    fn digest(version: u16, payload: &[u8]) -> [u8; 32] {
        let mut hash = Sha256::new();
        hash.update(b"zenith-change-v1\0");
        hash.update(version.to_be_bytes());
        hash.update(payload);
        hash.finalize().into()
    }
    pub fn validate(&self) -> Result<()> {
        if self.version != CHANGE_VERSION {
            return Err(Error::Version(self.version));
        }
        if self.payload.is_empty() || self.payload.len() > MAX_CHANGE_BYTES {
            return Err(Error::Invalid("change size"));
        }
        if self.id != Self::digest(self.version, &self.payload) {
            return Err(Error::Invalid("change digest"));
        }
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("I/O: {0}")]
    Io(#[from] std::io::Error),
    #[error("SQLite: {0}")]
    Sql(#[from] rusqlite::Error),
    #[error("certificate: {0}")]
    Certificate(#[from] rcgen::Error),
    #[error("encoding: {0}")]
    Encoding(#[from] postcard::Error),
    #[error("invalid {0}")]
    Invalid(&'static str),
    #[error("unsupported change version {0}")]
    Version(u16),
    #[error("peer is not paired")]
    Unpaired,
    #[error("store mutex poisoned")]
    Poisoned,
    #[error("pairing closed or expired")]
    PairingClosed,
    #[error("pairing locked")]
    PairingLocked,
    #[error("connection limit")]
    Busy,
    #[error("authentication failed")]
    Authentication,
    #[error("operation timed out")]
    Timeout,
    #[error("discovery: {0}")]
    Discovery(#[from] mdns_sd::Error),
}
pub type Result<T> = std::result::Result<T, Error>;

/// Status snapshot. Counts are durable; the network lifecycle arrives in S05.
#[derive(Debug, Clone, Eq, PartialEq)]
pub struct Status {
    pub device_id: DeviceId,
    pub peers: usize,
    pub changes: u64,
}

/// Pairing window returned to the host. Copy its code out of band; never log it.
/// Complete the authenticated flow with [`pairing::accept`] / [`pairing::connect`].
pub struct PairingWindow {
    pub code: String,
    pub expires_in_seconds: u64,
}

/// Embedded engine. Methods serialize SQLite access; do not open two engines on
/// the same identity directory. The caller controls opt-in and process ownership.
pub struct Engine {
    identity: Identity,
    store: Mutex<UpdateStore>,
    remote: broadcast::Sender<StoredChange>,
    pub(crate) pairing: Mutex<Option<pairing::Window>>,
    pub(crate) pairing_slot: tokio::sync::Semaphore,
}

impl Engine {
    pub fn open(directory: impl AsRef<Path>) -> Result<Self> {
        let directory = directory.as_ref();
        std::fs::create_dir_all(directory)?;
        let identity = Identity::load_or_create(directory)?;
        let store = UpdateStore::open(directory.join("updates.sqlite"))?;
        let (remote, _) = broadcast::channel(128);
        Ok(Self {
            identity,
            store: Mutex::new(store),
            remote,
            pairing: Mutex::new(None),
            pairing_slot: tokio::sync::Semaphore::new(1),
        })
    }
    pub fn identity(&self) -> &Identity {
        &self.identity
    }
    pub fn list_peers(&self) -> Result<Vec<Peer>> {
        self.store.lock().map_err(|_| Error::Poisoned)?.peers()
    }
    pub fn start_pairing(&self) -> Result<PairingWindow> {
        self.store
            .lock()
            .map_err(|_| Error::Poisoned)?
            .check_pairing(pairing::unix_seconds()?)?;
        let window = pairing::Window::new();
        let result = PairingWindow {
            code: window.code.clone(),
            expires_in_seconds: pairing::WINDOW_SECONDS,
        };
        *self.pairing.lock().map_err(|_| Error::Poisoned)? = Some(window);
        Ok(result)
    }
    pub fn close_pairing(&self) -> Result<()> {
        *self.pairing.lock().map_err(|_| Error::Poisoned)? = None;
        Ok(())
    }
    /// Revocation is local. Every other device must also revoke a lost peer.
    pub fn revoke_peer(&self, peer: DeviceId) -> Result<()> {
        self.store.lock().map_err(|_| Error::Poisoned)?.revoke(peer)
    }
    pub fn push_local_change(&self, payload: Vec<u8>) -> Result<StoredChange> {
        let change = Change::new(payload)?;
        Ok(self
            .store
            .lock()
            .map_err(|_| Error::Poisoned)?
            .append(&change)?
            .0)
    }
    /// S05 calls this only after authenticating a pinned peer. Peer IDs alone are
    /// not proof of authentication; this API is a trusted host boundary.
    pub fn receive_remote_change(&self, peer: DeviceId, change: Change) -> Result<StoredChange> {
        let mut store = self.store.lock().map_err(|_| Error::Poisoned)?;
        if store.peer(peer)?.is_none() {
            return Err(Error::Unpaired);
        }
        let (stored, inserted) = store.append(&change)?;
        if inserted {
            let _ = self.remote.send(stored.clone());
        }
        Ok(stored)
    }
    /// Recover from `RecvError::Lagged` by reading the durable store with a cursor.
    pub fn subscribe_remote_changes(&self) -> broadcast::Receiver<StoredChange> {
        self.remote.subscribe()
    }
    pub fn changes_after(&self, cursor: u64, limit: usize) -> Result<Vec<StoredChange>> {
        self.store
            .lock()
            .map_err(|_| Error::Poisoned)?
            .after(cursor, limit)
    }
    pub fn status(&self) -> Result<Status> {
        let store = self.store.lock().map_err(|_| Error::Poisoned)?;
        Ok(Status {
            device_id: self.identity.id(),
            peers: store.peers()?.len(),
            changes: store.count()?,
        })
    }
}
