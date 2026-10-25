//! Discovery is a hint, never authorization. One directional HMAC token per
//! paired device avoids a group secret retained by revoked peers. Epochs are
//! 60s with +/- one epoch clock tolerance. IPs/timing/counts remain visible.
use crate::{DeviceId, Engine, Error, Result};
use hmac::{Hmac, Mac};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use tokio::net::UdpSocket;

pub const SERVICE: &str = "_zenith-sync._tcp.local.";
pub const MULTICAST_GROUP: Ipv4Addr = Ipv4Addr::new(239, 255, 90, 90);
pub const MULTICAST_PORT: u16 = 45891;
pub const MAX_ANNOUNCEMENT: usize = 128;

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct Announcement {
    pub epoch: u64,
    pub token: [u8; 16],
    pub port: u16,
}
fn mac(secret: &[u8; 32], sender: DeviceId, epoch: u64, port: u16) -> Hmac<Sha256> {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret).expect("HMAC accepts 32 bytes");
    mac.update(b"zenith-discovery-v1\0");
    mac.update(&sender.0);
    mac.update(&epoch.to_be_bytes());
    mac.update(&port.to_be_bytes());
    mac
}
fn announcement(secret: &[u8; 32], sender: DeviceId, epoch: u64, port: u16) -> Announcement {
    let bytes = mac(secret, sender, epoch, port).finalize().into_bytes();
    let mut token = [0; 16];
    token.copy_from_slice(&bytes[..16]);
    Announcement { epoch, token, port }
}
impl Announcement {
    pub fn encode(&self) -> Result<Vec<u8>> {
        self.validate()?;
        Ok(postcard::to_allocvec(self)?)
    }
    pub fn decode(bytes: &[u8]) -> Result<Self> {
        if bytes.len() > MAX_ANNOUNCEMENT {
            return Err(Error::Invalid("announcement size"));
        }
        let (a, tail): (Self, _) = postcard::take_from_bytes(bytes)?;
        if !tail.is_empty() {
            return Err(Error::Invalid("announcement trailing bytes"));
        }
        a.validate()?;
        Ok(a)
    }
    fn validate(&self) -> Result<()> {
        if self.port == 0 {
            return Err(Error::Invalid("announcement port"));
        }
        Ok(())
    }
    /// Names and hostnames rotate with the token; no stable device label.
    pub fn service_info(&self, ip: IpAddr) -> Result<ServiceInfo> {
        self.validate()?;
        let name: String = self.token.iter().map(|b| format!("{b:02x}")).collect();
        let epoch = self.epoch.to_string();
        Ok(ServiceInfo::new(
            SERVICE,
            &name,
            &format!("{name}.local."),
            ip,
            self.port,
            &[("token", name.as_str()), ("epoch", epoch.as_str())][..],
        )?)
    }
}
impl Engine {
    /// The host must refresh advertisements every epoch and when pairing closes
    /// or a peer is revoked. Empty means advertise nothing.
    pub fn announcements(&self, port: u16, unix_seconds: u64) -> Result<Vec<Announcement>> {
        if port == 0 {
            return Err(Error::Invalid("discovery port"));
        }
        let epoch = unix_seconds / 60;
        let keys = self
            .store
            .lock()
            .map_err(|_| Error::Poisoned)?
            .discovery_keys()?;
        let mut result: Vec<_> = keys
            .iter()
            .map(|(_, secret)| announcement(secret, self.identity().id(), epoch, port))
            .collect();
        if let Some(key) = self
            .pairing
            .lock()
            .map_err(|_| Error::Poisoned)?
            .as_ref()
            .and_then(|w| w.beacon_key())
        {
            result.push(announcement(&key, self.identity().id(), epoch, port));
        }
        Ok(result)
    }
    pub fn recognize(&self, a: &Announcement, unix_seconds: u64) -> Result<Option<DeviceId>> {
        a.validate()?;
        if a.epoch.abs_diff(unix_seconds / 60) > 1 {
            return Ok(None);
        }
        for (id, secret) in self
            .store
            .lock()
            .map_err(|_| Error::Poisoned)?
            .discovery_keys()?
        {
            if mac(&secret, id, a.epoch, a.port)
                .verify_truncated_left(&a.token)
                .is_ok()
            {
                return Ok(Some(id));
            }
        }
        Ok(None)
    }
}
/// Numeric IPv4 or bracketed IPv6 and nonzero port. No DNS or external service.
pub fn manual_address(input: &str) -> Result<SocketAddr> {
    let address: SocketAddr = input
        .parse()
        .map_err(|_| Error::Invalid("numeric address:port"))?;
    if address.port() == 0 || address.ip().is_unspecified() || address.ip().is_multicast() {
        return Err(Error::Invalid("manual address"));
    }
    Ok(address)
}
/// Opt-in mDNS lifecycle. Browse events remain hints. Refresh unregisters old
/// names (including revocations); dropping this object shuts the daemon down.
pub struct Mdns {
    daemon: ServiceDaemon,
    names: Vec<String>,
}
impl Mdns {
    pub fn start() -> Result<Self> {
        Ok(Self {
            daemon: ServiceDaemon::new()?,
            names: Vec::new(),
        })
    }
    /// Restrict all mDNS traffic to IPv4 loopback for local integration tests.
    pub fn loopback() -> Result<Self> {
        let mdns = Self::start()?;
        mdns.daemon.disable_interface(mdns_sd::IfKind::All)?;
        mdns.daemon.enable_interface(mdns_sd::IfKind::LoopbackV4)?;
        Ok(mdns)
    }
    pub fn browse(&self) -> Result<mdns_sd::Receiver<mdns_sd::ServiceEvent>> {
        Ok(self.daemon.browse(SERVICE)?)
    }
    pub fn refresh(&mut self, engine: &Engine, ip: IpAddr, port: u16, now: u64) -> Result<()> {
        for name in self.names.drain(..) {
            self.daemon.unregister(&name)?;
        }
        for a in engine.announcements(port, now)? {
            let service = a.service_info(ip)?;
            self.names.push(service.get_fullname().to_string());
            self.daemon.register(service)?;
        }
        Ok(())
    }
    pub fn from_service(info: &mdns_sd::ResolvedService) -> Result<Announcement> {
        let token = info
            .get_property_val_str("token")
            .ok_or(Error::Invalid("DNS-SD token"))?;
        if token.len() != 32 || !token.is_ascii() {
            return Err(Error::Invalid("DNS-SD token"));
        }
        let mut bytes = [0; 16];
        for (i, b) in bytes.iter_mut().enumerate() {
            *b = u8::from_str_radix(&token[i * 2..i * 2 + 2], 16)
                .map_err(|_| Error::Invalid("DNS-SD token"))?;
        }
        let a = Announcement {
            epoch: info
                .get_property_val_str("epoch")
                .ok_or(Error::Invalid("DNS-SD epoch"))?
                .parse()
                .map_err(|_| Error::Invalid("DNS-SD epoch"))?,
            token: bytes,
            port: info.get_port(),
        };
        a.validate()?;
        Ok(a)
    }
}
impl Drop for Mdns {
    fn drop(&mut self) {
        let _ = self.daemon.shutdown();
    }
}

/// IPv4 multicast fallback, TTL=1. Explicit interface selection belongs to the
/// host. Never falls back to a public discovery server.
pub fn multicast_socket(interface: Ipv4Addr) -> Result<UdpSocket> {
    let socket = socket2::Socket::new(
        socket2::Domain::IPV4,
        socket2::Type::DGRAM,
        Some(socket2::Protocol::UDP),
    )?;
    socket.set_reuse_address(true)?;
    socket.bind(&SocketAddr::from((Ipv4Addr::UNSPECIFIED, MULTICAST_PORT)).into())?;
    socket.join_multicast_v4(&MULTICAST_GROUP, &interface)?;
    socket.set_multicast_if_v4(&interface)?;
    socket.set_multicast_ttl_v4(1)?;
    socket.set_nonblocking(true)?;
    Ok(UdpSocket::from_std(socket.into())?)
}
pub async fn announce(socket: &UdpSocket, destination: SocketAddr, a: &Announcement) -> Result<()> {
    socket.send_to(&a.encode()?, destination).await?;
    Ok(())
}
pub async fn receive(socket: &UdpSocket) -> Result<(Announcement, SocketAddr)> {
    let mut bytes = [0; MAX_ANNOUNCEMENT + 1];
    let (len, source) = socket.recv_from(&mut bytes).await?;
    Ok((Announcement::decode(&bytes[..len])?, source))
}
