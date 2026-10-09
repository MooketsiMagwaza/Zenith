mod network_support;
use network_support::{instance, pair};
use std::{
    net::{IpAddr, Ipv4Addr},
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream, UdpSocket},
};
use zenith_sync::{
    discovery::{self, Announcement, Mdns},
    pairing, Engine, Error,
};

#[tokio::test]
async fn pair_restart_rotate_recognize_and_revoke() {
    let (da, a) = instance();
    let (db, b) = instance();
    let (_, stranger) = instance();
    assert!(a.announcements(10001, 600).unwrap().is_empty());
    pair(a.clone(), b.clone()).await;
    drop(a);
    drop(b);
    let a = Engine::open(da.path()).unwrap();
    let b = Engine::open(db.path()).unwrap();
    let old = a.announcements(10001, 600).unwrap().pop().unwrap();
    let new = a.announcements(10001, 660).unwrap().pop().unwrap();
    assert_ne!(old.token, new.token);
    assert_eq!(b.recognize(&new, 660).unwrap(), Some(a.identity().id()));
    assert_eq!(stranger.recognize(&new, 660).unwrap(), None);
    assert_eq!(b.recognize(&old, 780).unwrap(), None);
    let mut tampered = new.clone();
    tampered.port += 1;
    assert_eq!(b.recognize(&tampered, 660).unwrap(), None);
    // Localhost UDP uses the exact multicast codec without involving a LAN.
    let sender = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    let receiver = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    discovery::announce(&sender, receiver.local_addr().unwrap(), &new)
        .await
        .unwrap();
    let (received, source) = discovery::receive(&receiver).await.unwrap();
    assert!(source.ip().is_loopback());
    assert_eq!(received, new);
    b.revoke_peer(a.identity().id()).unwrap();
    assert_eq!(b.recognize(&new, 660).unwrap(), None);
    assert!(b.announcements(10002, 660).unwrap().is_empty());
}

#[tokio::test]
async fn wrong_codes_lock_across_windows_and_restart_and_never_read_changes() {
    let (dir, b) = instance();
    let (_, a) = instance();
    b.push_local_change(b"private synthetic update".to_vec())
        .unwrap();
    for _ in 0..5 {
        let code = b.start_pairing().unwrap().code;
        let wrong = if code == "000000" { "000001" } else { "000000" };
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let peer = b.clone();
        let server = tokio::spawn(async move {
            pairing::accept(&peer, listener.accept().await.unwrap().0).await
        });
        assert!(pairing::connect(&a, addr, wrong).await.is_err());
        assert!(matches!(server.await.unwrap(), Err(Error::Authentication)));
        assert!(b.list_peers().unwrap().is_empty());
        assert_eq!(a.status().unwrap().changes, 0);
    }
    assert!(matches!(b.start_pairing(), Err(Error::PairingLocked)));
    drop(b);
    let restarted = Engine::open(dir.path()).unwrap();
    assert!(matches!(
        restarted.start_pairing(),
        Err(Error::PairingLocked)
    ));
}

async fn raw_read(s: &mut TcpStream) -> Vec<u8> {
    let n = s.read_u32().await.unwrap();
    assert!(n < 10000);
    let mut buf = vec![0; n as usize];
    s.read_exact(&mut buf).await.unwrap();
    buf
}
async fn raw_write(s: &mut TcpStream, bytes: &[u8]) {
    s.write_u32(bytes.len() as u32).await.unwrap();
    s.write_all(bytes).await.unwrap();
}
#[tokio::test]
async fn captured_pairing_transcript_cannot_be_replayed() {
    let (_, a) = instance();
    let (_, b) = instance();
    let code = b.start_pairing().unwrap().code;
    let real = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let real_addr = real.local_addr().unwrap();
    let proxy = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let proxy_addr = proxy.local_addr().unwrap();
    let eb = b.clone();
    let server =
        tokio::spawn(async move { pairing::accept(&eb, real.accept().await.unwrap().0).await });
    let tap = tokio::spawn(async move {
        let mut client = proxy.accept().await.unwrap().0;
        let mut backend = TcpStream::connect(real_addr).await.unwrap();
        let greeting = raw_read(&mut backend).await;
        raw_write(&mut client, &greeting).await;
        let offer = raw_read(&mut client).await;
        raw_write(&mut backend, &offer).await;
        let mb = raw_read(&mut backend).await;
        raw_write(&mut client, &mb).await;
        let tag = raw_read(&mut client).await;
        raw_write(&mut backend, &tag).await;
        let reply = raw_read(&mut backend).await;
        raw_write(&mut client, &reply).await;
        (offer, tag)
    });
    pairing::connect(&a, proxy_addr, &code).await.unwrap();
    server.await.unwrap().unwrap();
    let (offer, tag) = tap.await.unwrap();
    b.revoke_peer(a.identity().id()).unwrap();
    b.start_pairing().unwrap();
    let real = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = real.local_addr().unwrap();
    let eb = b.clone();
    let server =
        tokio::spawn(async move { pairing::accept(&eb, real.accept().await.unwrap().0).await });
    let mut attacker = TcpStream::connect(addr).await.unwrap();
    raw_read(&mut attacker).await;
    raw_write(&mut attacker, &offer).await;
    raw_read(&mut attacker).await;
    raw_write(&mut attacker, &tag).await;
    assert!(matches!(server.await.unwrap(), Err(Error::Authentication)));
    assert!(b.list_peers().unwrap().is_empty());
}

#[tokio::test]
async fn closed_window_and_oversized_pairing_frame_fail_closed() {
    let (_, b) = instance();
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mut client = TcpStream::connect(listener.local_addr().unwrap())
        .await
        .unwrap();
    assert!(matches!(
        pairing::accept(&b, listener.accept().await.unwrap().0).await,
        Err(Error::PairingClosed)
    ));
    b.start_pairing().unwrap();
    assert_eq!(b.announcements(10001, 600).unwrap().len(), 1);
    b.close_pairing().unwrap();
    assert!(b.announcements(10001, 600).unwrap().is_empty());
    drop(client);
    b.start_pairing().unwrap();
    client = TcpStream::connect(listener.local_addr().unwrap())
        .await
        .unwrap();
    let eb = b.clone();
    let server =
        tokio::spawn(async move { pairing::accept(&eb, listener.accept().await.unwrap().0).await });
    raw_read(&mut client).await;
    client.write_u32(u32::MAX).await.unwrap();
    assert!(matches!(
        server.await.unwrap(),
        Err(Error::Invalid("frame size"))
    ));
    assert!(b.list_peers().unwrap().is_empty());
}

#[test]
fn manual_entry_and_malformed_announcements() {
    for address in ["127.0.0.1:12345", "[::1]:12345"] {
        assert!(discovery::manual_address(address).is_ok());
    }
    for address in ["example.com:80", "0.0.0.0:9", "127.0.0.1:0", "239.1.2.3:9"] {
        assert!(discovery::manual_address(address).is_err());
    }
    assert!(Announcement::decode(&[0; 129]).is_err());
    assert!(Announcement::decode(&[]).is_err());
    let a = Announcement {
        epoch: 10,
        token: [1; 16],
        port: 12345,
    };
    let mut bytes = a.encode().unwrap();
    bytes.push(0);
    assert!(Announcement::decode(&bytes).is_err());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn dns_sd_register_and_resolve_on_loopback() {
    let (_, a) = instance();
    let (_, b) = instance();
    pair(a.clone(), b.clone()).await;
    let mut advertiser = Mdns::loopback().unwrap();
    let browser = Mdns::loopback().unwrap();
    let events = browser.browse().unwrap();
    advertiser
        .refresh(&a, IpAddr::V4(Ipv4Addr::LOCALHOST), 10001, 600)
        .unwrap();
    let resolved = tokio::time::timeout(Duration::from_secs(12), async {
        loop {
            if let mdns_sd::ServiceEvent::ServiceResolved(info) = events.recv_async().await.unwrap()
            {
                break info;
            }
        }
    })
    .await
    .expect("mDNS loopback resolution");
    let ann = Mdns::from_service(&resolved).unwrap();
    assert_eq!(b.recognize(&ann, 600).unwrap(), Some(a.identity().id()));
}
