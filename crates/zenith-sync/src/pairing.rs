//! Opt-in SPAKE2 pairing over a separate TCP port. This endpoint never reads
//! the update log. Certificates are public and sent only during pairing.
//! The six-digit code must be copied out of band; never send it in a QR URI
//! intended for network discovery or log it. No security audit is claimed.
use crate::{
    identity::{certificate_fingerprint, certificate_id},
    wire, DeviceId, Engine, Error, Result,
};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use rand::{rngs::OsRng, Rng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use spake2::{Ed25519Group, Identity, Password, Spake2};
use std::{
    net::SocketAddr,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::net::TcpStream;

pub const WINDOW_SECONDS: u64 = 120;
const CAP: usize = 9216;
pub(crate) struct Window {
    pub code: String,
    expires: Instant,
    generation: [u8; 32],
}
impl Window {
    pub(crate) fn new() -> Self {
        Self {
            code: format!("{:06}", OsRng.gen_range(0..1_000_000)),
            expires: Instant::now() + Duration::from_secs(WINDOW_SECONDS),
            generation: OsRng.gen(),
        }
    }
    fn active(&self) -> bool {
        Instant::now() < self.expires
    }
    pub(crate) fn beacon_key(&self) -> Option<[u8; 32]> {
        self.active().then_some(self.generation)
    }
}
pub(crate) fn unix_seconds() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| Error::Invalid("system clock"))?
        .as_secs())
}
#[derive(Serialize, Deserialize)]
struct Greeting {
    version: u16,
    certificate: Vec<u8>,
    nonce: [u8; 32],
}
#[derive(Serialize, Deserialize)]
struct Offer {
    certificate: Vec<u8>,
    message: Vec<u8>,
}

fn validate_certificate(cert: &[u8], local: DeviceId) -> Result<()> {
    if cert.is_empty() || cert.len() > 8192 || certificate_id(cert)? == local {
        return Err(Error::Invalid("pairing certificate"));
    }
    Ok(())
}
fn identities(a: &[u8], b: &[u8], nonce: &[u8; 32]) -> (Identity, Identity) {
    let mut client = b"zenith-pair-v1/client/".to_vec();
    client.extend_from_slice(&certificate_fingerprint(a));
    client.extend_from_slice(nonce);
    let mut server = b"zenith-pair-v1/server/".to_vec();
    server.extend_from_slice(&certificate_fingerprint(b));
    server.extend_from_slice(nonce);
    (Identity::new(&client), Identity::new(&server))
}
struct Keys {
    client: [u8; 32],
    server: [u8; 32],
    discovery: [u8; 32],
}
fn keys(key: &[u8], a: &[u8], b: &[u8], nonce: &[u8; 32], ma: &[u8], mb: &[u8]) -> Result<Keys> {
    let transcript = postcard::to_allocvec(&(
        "zenith-pair-confirm-v1",
        certificate_fingerprint(a),
        certificate_fingerprint(b),
        nonce,
        ma,
        mb,
    ))?;
    let salt = Sha256::digest(transcript);
    let hk = Hkdf::<Sha256>::new(Some(&salt), key);
    let mut output = Keys {
        client: [0; 32],
        server: [0; 32],
        discovery: [0; 32],
    };
    for (label, dest) in [
        (b"client".as_slice(), &mut output.client),
        (b"server".as_slice(), &mut output.server),
        (b"discovery".as_slice(), &mut output.discovery),
    ] {
        hk.expand(label, dest).map_err(|_| Error::Authentication)?;
    }
    Ok(output)
}
fn confirmation(key: &[u8; 32]) -> [u8; 32] {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts 32 bytes");
    mac.update(b"zenith-pair-confirm-v1");
    mac.finalize().into_bytes().into()
}
fn verify(key: &[u8; 32], tag: &[u8; 32]) -> Result<()> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts 32 bytes");
    mac.update(b"zenith-pair-confirm-v1");
    mac.verify_slice(tag).map_err(|_| Error::Authentication)
}

/// Serve exactly one accepted connection. Host owns the listener and opt-in.
/// One in-flight exchange, 30s total timeout, durable five-attempt budget.
pub async fn accept(engine: &Engine, mut stream: TcpStream) -> Result<DeviceId> {
    let _permit = engine.pairing_slot.try_acquire().map_err(|_| Error::Busy)?;
    let (code, generation) = {
        let guard = engine.pairing.lock().map_err(|_| Error::Poisoned)?;
        let w = guard
            .as_ref()
            .filter(|w| w.active())
            .ok_or(Error::PairingClosed)?;
        engine
            .store
            .lock()
            .map_err(|_| Error::Poisoned)?
            .reserve_pairing(unix_seconds()?)?;
        (w.code.clone(), w.generation)
    };
    tokio::time::timeout(Duration::from_secs(30), async {
        let b = engine.identity().certificate().to_vec();
        let mut nonce = [0; 32];
        OsRng.fill_bytes(&mut nonce);
        wire::write(
            &mut stream,
            &Greeting {
                version: 1,
                certificate: b.clone(),
                nonce,
            },
            CAP,
        )
        .await?;
        let offer: Offer = wire::read(&mut stream, CAP).await?;
        validate_certificate(&offer.certificate, engine.identity().id())?;
        if offer.message.len() != 33 {
            return Err(Error::Authentication);
        }
        let (ia, ib) = identities(&offer.certificate, &b, &nonce);
        let (state, mb) =
            Spake2::<Ed25519Group>::start_b(&Password::new(code.as_bytes()), &ia, &ib);
        let key = state
            .finish(&offer.message)
            .map_err(|_| Error::Authentication)?;
        let keys = keys(&key, &offer.certificate, &b, &nonce, &offer.message, &mb)?;
        wire::write(&mut stream, &mb, CAP).await?;
        let tag: [u8; 32] = wire::read(&mut stream, CAP).await?;
        verify(&keys.client, &tag)?;
        let id = {
            let mut guard = engine.pairing.lock().map_err(|_| Error::Poisoned)?;
            guard
                .as_ref()
                .filter(|w| w.active() && w.generation == generation)
                .ok_or(Error::PairingClosed)?;
            let mut store = engine.store.lock().map_err(|_| Error::Poisoned)?;
            let id = store.pin_paired(&offer.certificate, &keys.discovery)?;
            store.pairing_succeeded()?;
            *guard = None;
            id
        };
        wire::write(&mut stream, &confirmation(&keys.server), CAP).await?;
        Ok(id)
    })
    .await
    .map_err(|_| Error::Timeout)?
}

/// Initiator: code copied from the acceptor's screen. Pins only after the
/// acceptor confirms its key. A dropped final confirmation may require local
/// revocation and retry; distributed atomic pairing is not possible here.
pub async fn connect(engine: &Engine, address: SocketAddr, code: &str) -> Result<DeviceId> {
    if code.len() != 6 || !code.bytes().all(|c| c.is_ascii_digit()) {
        return Err(Error::Invalid("six-digit code"));
    }
    let _permit = engine.pairing_slot.try_acquire().map_err(|_| Error::Busy)?;
    tokio::time::timeout(Duration::from_secs(30), async {
        let mut stream = TcpStream::connect(address).await?;
        let greeting: Greeting = wire::read(&mut stream, CAP).await?;
        if greeting.version != 1 {
            return Err(Error::Invalid("pairing version"));
        }
        validate_certificate(&greeting.certificate, engine.identity().id())?;
        let a = engine.identity().certificate().to_vec();
        let (ia, ib) = identities(&a, &greeting.certificate, &greeting.nonce);
        let (state, ma) =
            Spake2::<Ed25519Group>::start_a(&Password::new(code.as_bytes()), &ia, &ib);
        wire::write(
            &mut stream,
            &Offer {
                certificate: a.clone(),
                message: ma.clone(),
            },
            CAP,
        )
        .await?;
        let mb: Vec<u8> = wire::read(&mut stream, CAP).await?;
        if mb.len() != 33 {
            return Err(Error::Authentication);
        }
        let key = state.finish(&mb).map_err(|_| Error::Authentication)?;
        let keys = keys(&key, &a, &greeting.certificate, &greeting.nonce, &ma, &mb)?;
        wire::write(&mut stream, &confirmation(&keys.client), CAP).await?;
        let tag: [u8; 32] = wire::read(&mut stream, CAP).await?;
        verify(&keys.server, &tag)?;
        engine
            .store
            .lock()
            .map_err(|_| Error::Poisoned)?
            .pin_paired(&greeting.certificate, &keys.discovery)
    })
    .await
    .map_err(|_| Error::Timeout)?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn confirmation_binds_certificates_roles_nonce_and_transcript() {
        let k = keys(b"key", b"a", b"b", &[0; 32], b"ma", b"mb").unwrap();
        assert!(verify(&k.server, &confirmation(&k.client)).is_err());
        for other in [
            keys(b"key", b"attacker", b"b", &[0; 32], b"ma", b"mb"),
            keys(b"key", b"a", b"b", &[1; 32], b"ma", b"mb"),
            keys(b"key", b"a", b"b", &[0; 32], b"old", b"mb"),
        ] {
            assert!(verify(&other.unwrap().client, &confirmation(&k.client)).is_err());
        }
    }
    #[test]
    fn expired_window_and_durable_lock() {
        let mut w = Window::new();
        w.expires = Instant::now();
        assert!(!w.active());
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gate.sqlite");
        let mut store = crate::UpdateStore::open(&path).unwrap();
        for _ in 0..5 {
            store.reserve_pairing(100).unwrap();
        }
        assert!(store.reserve_pairing(399).is_err());
        drop(store);
        let mut store = crate::UpdateStore::open(path).unwrap();
        assert!(store.check_pairing(399).is_err());
        store.reserve_pairing(400).unwrap();
        for _ in 0..4 {
            store.reserve_pairing(400).unwrap();
        }
        assert!(store.check_pairing(699).is_err());
        assert!(store.check_pairing(700).is_ok());
    }
}
