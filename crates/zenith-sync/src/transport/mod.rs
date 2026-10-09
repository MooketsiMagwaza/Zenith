//! Opt-in pinned TLS replication. Host owns listeners, discovery and shutdown.
//! Dropping an accept/connect/reconnect future closes its connection. A required
//! host validator gates durable receipt; this library cannot inspect opaque CRDTs.
mod codec;
mod tls;

use crate::{identity::certificate_id, Change, DeviceId, Engine, Error, Result};
use codec::Message;
use rand::Rng;
use std::{
    collections::btree_map::Entry,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    io::{AsyncRead, AsyncWrite},
    net::TcpStream,
    sync::mpsc,
};
use tokio_rustls::{TlsAcceptor, TlsConnector};

pub const PROTOCOL_VERSION: u16 = 1;
pub const MAX_FRAME_BYTES: usize = crate::MAX_CHANGE_BYTES + 43;
pub const MAX_CONNECTIONS: usize = 8;
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);
const ACK_TIMEOUT: Duration = Duration::from_secs(10);
const POLL: Duration = Duration::from_millis(100);

/// Must be deterministic, bounded and safe on hostile bytes, and accept retries
/// and dependencies arriving out of order. Return an error before any durable
/// acknowledgement for unsupported schema, shape or resource use. Do not mutate
/// live documents here: the engine's committed log is the recovery source.
/// No permissive default is supplied. Production application validation is open.
pub trait Validator: Send + Sync {
    fn validate(&self, peer: DeviceId, change: &Change) -> Result<()>;
}

pub(crate) struct PeerBudget {
    active: bool,
    at: Instant,
    frames: f64,
    bytes: f64,
}
impl PeerBudget {
    fn new() -> Self {
        Self {
            active: false,
            at: Instant::now(),
            frames: 2048.0,
            bytes: 16_777_216.0,
        }
    }
    fn charge(&mut self, bytes: usize) -> Result<()> {
        let elapsed = self.at.elapsed().as_secs_f64();
        self.at = Instant::now();
        self.frames = (self.frames + elapsed * 512.0).min(2048.0);
        self.bytes = (self.bytes + elapsed * 8_388_608.0).min(16_777_216.0);
        if self.frames < 1.0 || self.bytes < bytes as f64 {
            return Err(Error::RateLimited);
        }
        self.frames -= 1.0;
        self.bytes -= bytes as f64;
        Ok(())
    }
}
struct ActivePeer {
    engine: Arc<Engine>,
    peer: DeviceId,
}
impl ActivePeer {
    fn acquire(engine: Arc<Engine>, peer: DeviceId) -> Result<Self> {
        {
            let mut peers = engine.transport_peers.lock().map_err(|_| Error::Poisoned)?;
            let budget = match peers.entry(peer) {
                Entry::Occupied(e) => e.into_mut(),
                Entry::Vacant(e) => e.insert(PeerBudget::new()),
            };
            if budget.active {
                return Err(Error::Busy);
            }
            budget.charge(0)?;
            budget.active = true;
        }
        Ok(Self { engine, peer })
    }
}
impl Drop for ActivePeer {
    fn drop(&mut self) {
        if let Ok(mut peers) = self.engine.transport_peers.lock() {
            if let Some(budget) = peers.get_mut(&self.peer) {
                budget.active = false;
            }
        }
    }
}

/// Serve one accepted TCP socket. Global admission precedes TLS work; unknown
/// and revoked certificates fail in the TLS verifier, before protocol data.
pub async fn accept(
    engine: Arc<Engine>,
    stream: TcpStream,
    validator: Arc<dyn Validator>,
) -> Result<()> {
    let _slot = engine
        .transport_slots
        .try_acquire()
        .map_err(|_| Error::Busy)?;
    stream.set_nodelay(true)?;
    let io = tokio::time::timeout(
        HANDSHAKE_TIMEOUT,
        TlsAcceptor::from(tls::server(engine.clone())?).accept(stream),
    )
    .await
    .map_err(|_| Error::Timeout)??;
    let connection = io.get_ref().1;
    if connection.protocol_version() != Some(rustls::ProtocolVersion::TLSv1_3)
        || connection.alpn_protocol() != Some(b"zenith-sync/1")
    {
        return Err(Error::Authentication);
    }
    let certificate = connection
        .peer_certificates()
        .and_then(|cs| cs.first())
        .ok_or(Error::Authentication)?
        .to_vec();
    let peer = certificate_id(&certificate)?;
    let _active = ActivePeer::acquire(engine.clone(), peer)?;
    session(&engine, peer, &certificate, io, validator.as_ref()).await
}

/// Dial a numeric/manual/discovered address for one specific pinned peer.
pub async fn connect(
    engine: Arc<Engine>,
    peer: DeviceId,
    address: SocketAddr,
    validator: Arc<dyn Validator>,
) -> Result<()> {
    let _slot = engine
        .transport_slots
        .try_acquire()
        .map_err(|_| Error::Busy)?;
    let certificate = engine
        .list_peers()?
        .into_iter()
        .find(|p| p.id == peer)
        .ok_or(Error::Unpaired)?
        .certificate;
    let _active = ActivePeer::acquire(engine.clone(), peer)?;
    let io = tokio::time::timeout(HANDSHAKE_TIMEOUT, async {
        let stream = TcpStream::connect(address).await?;
        stream.set_nodelay(true)?;
        let name = rustls::pki_types::ServerName::try_from("zenith.local")
            .map_err(|_| Error::Authentication)?;
        Ok::<_, Error>(
            TlsConnector::from(tls::client(engine.clone(), peer)?)
                .connect(name, stream)
                .await?,
        )
    })
    .await
    .map_err(|_| Error::Timeout)??;
    if io.get_ref().1.protocol_version() != Some(rustls::ProtocolVersion::TLSv1_3)
        || io.get_ref().1.alpn_protocol() != Some(b"zenith-sync/1")
    {
        return Err(Error::Authentication);
    }
    session(&engine, peer, &certificate, io, validator.as_ref()).await
}

/// Retry until cancelled (drop the future), revoked, or a permanent protocol /
/// validation error. Equal-jitter exponential backoff: 125ms..30s; healthy sessions
/// of at least 10s reset the exponent. Host updates addresses by restarting this
/// future; assign one dialer per pair to avoid simultaneous-dial collisions.
pub async fn reconnect(
    engine: Arc<Engine>,
    peer: DeviceId,
    address: SocketAddr,
    validator: Arc<dyn Validator>,
) -> Result<()> {
    let mut failures = 0u32;
    loop {
        let start = Instant::now();
        let result = connect(engine.clone(), peer, address, validator.clone()).await;
        match result {
            Err(Error::Io(e)) if e.kind() == std::io::ErrorKind::InvalidData => {
                return Err(Error::Authentication)
            }
            Err(Error::Io(_)) | Err(Error::Timeout) | Err(Error::Busy) => {}
            other => return other,
        }
        if start.elapsed() >= Duration::from_secs(10) {
            failures = 0;
        }
        let delay = backoff(failures);
        failures = failures.saturating_add(1);
        tokio::time::sleep(delay).await;
    }
}
fn backoff(failures: u32) -> Duration {
    let ceiling = (250u64 << failures.min(7)).min(30_000);
    Duration::from_millis(rand::thread_rng().gen_range(ceiling / 2..=ceiling))
}

enum Event {
    Receipt(u64, [u8; 32]),
    Ack(u64, [u8; 32]),
}

async fn session<S: AsyncRead + AsyncWrite + Unpin>(
    engine: &Engine,
    peer: DeviceId,
    certificate: &[u8],
    mut io: S,
    validator: &dyn Validator,
) -> Result<()> {
    tls::live_pin(engine, peer, certificate)?;
    codec::write(
        &mut io,
        &Message::Hello {
            version: PROTOCOL_VERSION,
            capabilities: 0,
            device: engine.identity().id(),
        },
    )
    .await?;
    match codec::read(&mut io).await?.0 {
        Message::Hello {
            version,
            capabilities,
            device,
        } => {
            if version != PROTOCOL_VERSION {
                return Err(Error::ProtocolVersion(version));
            }
            if capabilities != 0 || device != peer {
                return Err(Error::Invalid("hello identity/capabilities"));
            }
        }
        _ => return Err(Error::Invalid("expected hello")),
    }
    let (head, cursor) = {
        let store = engine.store.lock().map_err(|_| Error::Poisoned)?;
        (
            store.head()?,
            store.peer(peer)?.ok_or(Error::Unpaired)?.cursor,
        )
    };
    codec::write(&mut io, &Message::Summary { head, cursor }).await?;
    let (remote_head, remote_cursor) = match codec::read(&mut io).await?.0 {
        Message::Summary { head, cursor } if cursor <= head && head <= i64::MAX as u64 => {
            (head, cursor)
        }
        _ => return Err(Error::Invalid("expected valid summary")),
    };
    let (mut reader, mut writer) = tokio::io::split(io);
    let (events, mut incoming) = mpsc::channel(8);
    let receive = async {
        let mut received = remote_cursor;
        let mut streamed = false;
        loop {
            let (message, bytes) = codec::read(&mut reader).await?;
            tls::live_pin(engine, peer, certificate)?;
            engine
                .transport_peers
                .lock()
                .map_err(|_| Error::Poisoned)?
                .get_mut(&peer)
                .ok_or(Error::Unpaired)?
                .charge(bytes)?;
            match message {
                Message::Change { sequence, change } => {
                    if sequence != received + 1
                        || (!streamed && sequence > remote_head)
                        || sequence > i64::MAX as u64
                    {
                        return Err(Error::Invalid("change sequence/phase"));
                    }
                    change.validate()?;
                    validator.validate(peer, &change)?;
                    let id = change.id;
                    engine.receive_remote_change(peer, change)?;
                    received = sequence;
                    events
                        .send(Event::Receipt(sequence, id))
                        .await
                        .map_err(|_| Error::Invalid("session closed"))?;
                }
                Message::Ack { sequence, id } => events
                    .send(Event::Ack(sequence, id))
                    .await
                    .map_err(|_| Error::Invalid("session closed"))?,
                Message::CaughtUp { through }
                    if !streamed && through == remote_head && received == remote_head =>
                {
                    streamed = true
                }
                Message::Ping => {}
                _ => return Err(Error::Invalid("unexpected message/phase")),
            }
        }
    };
    let send = async {
        let mut cursor = cursor;
        let mut pending: Option<(u64, [u8; 32], Instant)> = None;
        let mut streamed = false;
        let mut next_send = Instant::now();
        let mut heartbeat = Instant::now();
        let mut poll = tokio::time::interval(POLL);
        poll.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tokio::select! {
                event = incoming.recv() => match event.ok_or(Error::Invalid("session closed"))? {
                    Event::Receipt(sequence, id) => codec::write(&mut writer, &Message::Ack { sequence, id }).await?,
                    Event::Ack(sequence, id) => {
                        if !pending.is_some_and(|(sent, digest, _)| sent == sequence && digest == id) { return Err(Error::Invalid("unsolicited acknowledgement")); }
                        engine.store.lock().map_err(|_| Error::Poisoned)?.acknowledge(peer, sequence)?;
                        cursor = sequence;
                        pending = None;
                    }
                },
                _ = tokio::time::sleep_until(next_send.into()), if pending.is_none() => {
                    tls::live_pin(engine, peer, certificate)?;
                    if !streamed && cursor == head {
                        codec::write(&mut writer, &Message::CaughtUp { through: head }).await?;
                        streamed = true;
                    }
                    if let Some(row) = engine.changes_after(cursor, 1)?.pop() {
                        let bytes = row.change.payload.len();
                        pending = Some((row.sequence, row.change.id, Instant::now()));
                        codec::write(&mut writer, &Message::Change { sequence: row.sequence, change: row.change }).await?;
                        next_send = Instant::now() + Duration::from_secs_f64((bytes as f64 / 4_194_304.0).max(1.0 / 256.0));
                    } else {
                        next_send = Instant::now() + POLL;
                    }
                },
                _ = poll.tick() => {
                    tls::live_pin(engine, peer, certificate)?;
                    if pending.is_some_and(|(_, _, at)| at.elapsed() >= ACK_TIMEOUT) { return Err(Error::Timeout); }
                    if heartbeat.elapsed() >= Duration::from_secs(2) {
                        codec::write(&mut writer, &Message::Ping).await?;
                        heartbeat = Instant::now();
                    }
                }
            }
        }
    };
    tokio::try_join!(receive, send).map(|_: ((), ())| ())
}

#[cfg(test)]
mod tests;
