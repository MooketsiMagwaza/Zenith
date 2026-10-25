use super::*;
use tokio::{io::AsyncWriteExt, net::TcpListener};

struct Reject;
impl Validator for Reject {
    fn validate(&self, _: DeviceId, _: &Change) -> Result<()> {
        Err(Error::Invalid("host shape"))
    }
}
fn instance() -> (tempfile::TempDir, Arc<Engine>) {
    let dir = tempfile::tempdir().unwrap();
    let e = Arc::new(Engine::open(dir.path()).unwrap());
    (dir, e)
}
fn pin(a: &Engine, b: &Engine) {
    a.store
        .lock()
        .unwrap()
        .pin(b.identity().certificate().as_ref())
        .unwrap();
}
async fn raw(
    a: Arc<Engine>,
    b: Arc<Engine>,
) -> (
    tokio_rustls::client::TlsStream<TcpStream>,
    tokio::task::JoinHandle<Result<()>>,
) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let id = b.identity().id();
    let task = tokio::spawn(async move {
        accept(b, listener.accept().await.unwrap().0, Arc::new(Reject)).await
    });
    let io = TlsConnector::from(tls::client(a, id).unwrap())
        .connect(
            rustls::pki_types::ServerName::try_from("zenith.local").unwrap(),
            TcpStream::connect(addr).await.unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(
        io.get_ref().1.protocol_version(),
        Some(rustls::ProtocolVersion::TLSv1_3)
    );
    (io, task)
}
async fn greeting(io: &mut tokio_rustls::client::TlsStream<TcpStream>, id: DeviceId, head: u64) {
    assert!(matches!(
        codec::read(io).await.unwrap().0,
        Message::Hello { .. }
    ));
    codec::write(
        io,
        &Message::Hello {
            version: 1,
            capabilities: 0,
            device: id,
        },
    )
    .await
    .unwrap();
    assert!(matches!(
        codec::read(io).await.unwrap().0,
        Message::Summary { .. }
    ));
    codec::write(io, &Message::Summary { head, cursor: 0 })
        .await
        .unwrap();
}
#[tokio::test]
async fn malformed_unknown_oversized_and_newer_messages_are_refused_over_tls() {
    let (_da, a) = instance();
    let (_db, b) = instance();
    pin(&a, &b);
    pin(&b, &a);
    for (body, oversized) in [
        (vec![255], false),
        (vec![0], false),
        (vec![5, 0], false),
        (vec![], false),
        (vec![], true),
    ] {
        let (mut io, task) = raw(a.clone(), b.clone()).await;
        codec::read(&mut io).await.unwrap();
        io.write_u32(if oversized {
            u32::MAX
        } else {
            body.len() as u32
        })
        .await
        .unwrap();
        if !oversized {
            io.write_all(&body).await.unwrap();
        }
        io.flush().await.unwrap();
        assert!(task.await.unwrap().is_err());
    }
    let (mut io, task) = raw(a.clone(), b.clone()).await;
    codec::read(&mut io).await.unwrap();
    codec::write(
        &mut io,
        &Message::Hello {
            version: 2,
            capabilities: 0,
            device: a.identity().id(),
        },
    )
    .await
    .unwrap();
    assert!(matches!(
        task.await.unwrap(),
        Err(Error::ProtocolVersion(2))
    ));
    assert_eq!(b.status().unwrap().changes, 0);
}
#[tokio::test]
async fn validation_and_forged_ack_never_advance_cursor() {
    let (_da, a) = instance();
    let (_db, b) = instance();
    pin(&a, &b);
    pin(&b, &a);
    b.push_local_change(vec![7]).unwrap();
    for invalid in 0..7 {
        let (mut io, task) = raw(a.clone(), b.clone()).await;
        greeting(&mut io, a.identity().id(), 1).await;
        let mut change = Change::new(vec![1]).unwrap();
        let message = match invalid {
            0 => Message::Ack {
                sequence: 1,
                id: [0; 32],
            },
            1 => {
                change.payload[0] = 2;
                Message::Change {
                    sequence: 1,
                    change,
                }
            }
            2 => Message::Change {
                sequence: 2,
                change,
            },
            3 => Message::Change {
                sequence: 1,
                change,
            },
            4 => {
                change.version = 2;
                Message::Change {
                    sequence: 1,
                    change,
                }
            }
            5 => Message::CaughtUp { through: 9 },
            _ => Message::Summary { head: 1, cursor: 0 },
        };
        codec::write(&mut io, &message).await.unwrap();
        assert!(task.await.unwrap().is_err());
        assert_eq!(b.list_peers().unwrap()[0].cursor, 0);
        assert_eq!(b.status().unwrap().changes, 1);
    }
}
#[tokio::test]
async fn unknown_revoked_and_wrong_destination_fail_tls() {
    let (_da, a) = instance();
    let (_db, b) = instance();
    let (_dc, c) = instance();
    pin(&a, &b);
    for paired in [false, true] {
        if paired {
            pin(&b, &a);
            b.revoke_peer(a.identity().id()).unwrap();
        }
        let (io, task) = raw(a.clone(), b.clone()).await;
        // TLS 1.3 initiator can finish before server processes client Finished;
        // the acceptor must fail the handshake, with no hello or data access.
        assert!(task.await.unwrap().is_err());
        drop(io);
        assert_eq!(b.status().unwrap().changes, 0);
    }
    pin(&b, &a);
    pin(&a, &c);
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let eb = b.clone();
    let task = tokio::spawn(async move {
        accept(eb, listener.accept().await.unwrap().0, Arc::new(Reject)).await
    });
    assert!(
        connect(a.clone(), c.identity().id(), addr, Arc::new(Reject))
            .await
            .is_err()
    );
    assert!(task.await.unwrap().is_err());
}
#[test]
fn codec_roundtrip_boundaries_rate_and_backoff() {
    let messages = [
        Message::Hello {
            version: 1,
            capabilities: 0,
            device: DeviceId([1; 32]),
        },
        Message::Summary { head: 3, cursor: 2 },
        Message::Change {
            sequence: 3,
            change: Change::new(vec![1; crate::MAX_CHANGE_BYTES]).unwrap(),
        },
        Message::Ack {
            sequence: 3,
            id: [1; 32],
        },
        Message::CaughtUp { through: 3 },
        Message::Ping,
    ];
    for m in messages {
        let b = m.encode();
        assert_eq!(Message::decode(&b).unwrap(), m);
        if !matches!(m, Message::Change { .. }) {
            for len in 0..b.len() {
                assert!(Message::decode(&b[..len]).is_err());
            }
            let mut extra = b.clone();
            extra.push(0);
            assert!(Message::decode(&extra).is_err());
        }
    }
    assert!(Message::decode(&vec![2; MAX_FRAME_BYTES + 1]).is_err());
    let mut budget = PeerBudget::new();
    assert!(budget.charge(16_777_216).is_ok());
    assert!(matches!(budget.charge(100_000), Err(Error::RateLimited)));
    budget.at = Instant::now() - Duration::from_secs(1);
    assert!(budget.charge(8_000_000).is_ok());
    for failures in 0..20 {
        let d = backoff(failures);
        assert!(d >= Duration::from_millis(125));
        assert!(d <= Duration::from_secs(30));
    }
}
#[tokio::test]
async fn global_admission_precedes_handshake_and_releases_on_cancel() {
    let (_dir, engine) = instance();
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mut sockets = Vec::new();
    let mut tasks = Vec::new();
    for _ in 0..MAX_CONNECTIONS {
        sockets.push(
            TcpStream::connect(listener.local_addr().unwrap())
                .await
                .unwrap(),
        );
        let socket = listener.accept().await.unwrap().0;
        let e = engine.clone();
        tasks.push(tokio::spawn(async move {
            accept(e, socket, Arc::new(Reject)).await
        }));
    }
    tokio::time::timeout(Duration::from_secs(1), async {
        while engine.transport_slots.available_permits() != 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    sockets.push(
        TcpStream::connect(listener.local_addr().unwrap())
            .await
            .unwrap(),
    );
    assert!(matches!(
        accept(
            engine.clone(),
            listener.accept().await.unwrap().0,
            Arc::new(Reject)
        )
        .await,
        Err(Error::Busy)
    ));
    for task in tasks {
        task.abort();
        assert!(task.await.is_err());
    }
    assert_eq!(engine.transport_slots.available_permits(), MAX_CONNECTIONS);
}
#[tokio::test]
async fn maximum_change_codec_roundtrips() {
    let m = Message::Change {
        sequence: 1,
        change: Change::new(vec![9; crate::MAX_CHANGE_BYTES]).unwrap(),
    };
    let (mut a, mut b) = tokio::io::duplex(MAX_FRAME_BYTES + 4);
    codec::write(&mut a, &m).await.unwrap();
    assert_eq!(codec::read(&mut b).await.unwrap().0, m);
}

#[tokio::test]
async fn dropped_partial_frame_and_lost_durable_ack_resume_without_gaps() {
    let (_da, a) = instance();
    let (_db, b) = instance();
    pin(&a, &b);
    pin(&b, &a);
    let (mut io, task) = raw(a.clone(), b.clone()).await;
    greeting(&mut io, a.identity().id(), 1).await;
    let body = Message::Change {
        sequence: 1,
        change: Change::new(vec![42; 1024]).unwrap(),
    }
    .encode();
    io.write_u32(body.len() as u32).await.unwrap();
    io.write_all(&body[..body.len() / 2]).await.unwrap();
    io.flush().await.unwrap();
    drop(io);
    assert!(task.await.unwrap().is_err());
    assert_eq!(b.status().unwrap().changes, 0);
    b.push_local_change(vec![9]).unwrap();
    let (mut io, task) = raw(a.clone(), b.clone()).await;
    greeting(&mut io, a.identity().id(), 0).await;
    let Message::Change { sequence, change } = codec::read(&mut io).await.unwrap().0 else {
        panic!("expected backlog")
    };
    assert_eq!(sequence, 1);
    a.receive_remote_change(b.identity().id(), change.clone())
        .unwrap();
    // Durable receiver storage, but the acknowledgement is lost before send.
    drop(io);
    assert!(task.await.unwrap().is_err());
    assert_eq!(b.list_peers().unwrap()[0].cursor, 0);
    let (mut io, task) = raw(a.clone(), b.clone()).await;
    greeting(&mut io, a.identity().id(), 0).await;
    let Message::Change {
        sequence,
        change: retry,
    } = codec::read(&mut io).await.unwrap().0
    else {
        panic!("expected retry")
    };
    assert_eq!(retry, change);
    a.receive_remote_change(b.identity().id(), retry).unwrap();
    codec::write(
        &mut io,
        &Message::Ack {
            sequence,
            id: change.id,
        },
    )
    .await
    .unwrap();
    assert!(matches!(
        codec::read(&mut io).await.unwrap().0,
        Message::CaughtUp { through: 1 }
    ));
    assert_eq!(a.status().unwrap().changes, 1);
    assert_eq!(b.list_peers().unwrap()[0].cursor, 1);
    drop(io);
    assert!(task.await.unwrap().is_err());
}

#[tokio::test]
async fn per_peer_admission_rate_flood_and_active_revocation() {
    let (_da, a) = instance();
    let (_db, b) = instance();
    pin(&a, &b);
    pin(&b, &a);
    let (mut io, task) = raw(a.clone(), b.clone()).await;
    greeting(&mut io, a.identity().id(), 0).await;
    let (other, duplicate) = raw(a.clone(), b.clone()).await;
    assert!(matches!(duplicate.await.unwrap(), Err(Error::Busy)));
    drop(other);
    b.revoke_peer(a.identity().id()).unwrap();
    assert!(matches!(
        tokio::time::timeout(Duration::from_secs(1), task)
            .await
            .unwrap()
            .unwrap(),
        Err(Error::Unpaired)
    ));
    drop(io);
    pin(&b, &a);
    let (mut io, task) = raw(a.clone(), b.clone()).await;
    greeting(&mut io, a.identity().id(), 0).await;
    // Charge the frame bucket from real authenticated input, not direct calls.
    let flood = [0, 0, 0, 1, 5].repeat(3000);
    let _ = io.write_all(&flood).await;
    let _ = io.flush().await;
    assert!(matches!(
        tokio::time::timeout(Duration::from_secs(2), task)
            .await
            .unwrap()
            .unwrap(),
        Err(Error::RateLimited)
    ));
    assert_eq!(b.status().unwrap().changes, 0);
    // Budget is shared across reconnects rather than renewed by a new session.
    assert!(
        b.transport_peers
            .lock()
            .unwrap()
            .get(&a.identity().id())
            .unwrap()
            .frames
            < 100.0
    );
}

#[tokio::test]
async fn slow_partial_frame_deadline() {
    let (_da, a) = instance();
    let (_db, b) = instance();
    pin(&a, &b);
    pin(&b, &a);
    let (mut io, task) = raw(a.clone(), b.clone()).await;
    codec::read(&mut io).await.unwrap();
    io.write_u32(39).await.unwrap();
    io.write_all(&[0]).await.unwrap();
    io.flush().await.unwrap();
    assert!(matches!(
        tokio::time::timeout(Duration::from_secs(12), task)
            .await
            .unwrap()
            .unwrap(),
        Err(Error::Timeout)
    ));
    assert_eq!(b.status().unwrap().changes, 0);
}

struct Impersonation(Option<Arc<rustls::sign::CertifiedKey>>);
impl std::fmt::Debug for Impersonation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("TestCertificateResolver")
    }
}
impl rustls::client::ResolvesClientCert for Impersonation {
    fn resolve(
        &self,
        _: &[&[u8]],
        _: &[rustls::SignatureScheme],
    ) -> Option<Arc<rustls::sign::CertifiedKey>> {
        self.0.clone()
    }
    fn has_certs(&self) -> bool {
        self.0.is_some()
    }
}
#[tokio::test]
async fn missing_certificate_and_copied_certificate_without_private_key_fail_tls() {
    let (_da, a) = instance();
    let (_db, b) = instance();
    let (_dc, attacker) = instance();
    pin(&a, &b);
    pin(&b, &a);
    for missing in [true, false] {
        let mut config = (*tls::client(a.clone(), b.identity().id()).unwrap()).clone();
        let key =
            rustls::crypto::ring::sign::any_supported_type(&attacker.identity().private_key())
                .unwrap();
        config.client_auth_cert_resolver = Arc::new(Impersonation(if missing {
            None
        } else {
            Some(Arc::new(rustls::sign::CertifiedKey::new(
                vec![a.identity().certificate()],
                key,
            )))
        }));
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let eb = b.clone();
        let task = tokio::spawn(async move {
            accept(eb, listener.accept().await.unwrap().0, Arc::new(Reject)).await
        });
        let result = TlsConnector::from(Arc::new(config))
            .connect(
                rustls::pki_types::ServerName::try_from("zenith.local").unwrap(),
                TcpStream::connect(address).await.unwrap(),
            )
            .await;
        assert!(task.await.unwrap().is_err());
        drop(result);
        assert_eq!(b.status().unwrap().changes, 0);
    }
}
