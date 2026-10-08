use zenith_sync::{Change, DeviceId, Engine, Identity, UpdateStore, MAX_CHANGE_BYTES};

#[test]
fn stable_identity_and_distinct_installations() {
    let a = tempfile::tempdir().unwrap();
    let b = tempfile::tempdir().unwrap();
    let first = Identity::load_or_create(a.path()).unwrap();
    let restarted = Identity::load_or_create(a.path()).unwrap();
    assert_eq!(first.id(), restarted.id());
    assert_eq!(first.certificate(), restarted.certificate());
    assert_ne!(first.id(), Identity::load_or_create(b.path()).unwrap().id());
}

#[test]
fn corrupt_identity_fails_closed_without_replacing_it() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("identity.bin");
    std::fs::write(&path, b"broken").unwrap();
    assert!(Identity::load_or_create(dir.path()).is_err());
    assert_eq!(std::fs::read(path).unwrap(), b"broken");
}

#[test]
fn mismatched_key_and_certificate_are_refused() {
    #[derive(serde::Serialize)]
    struct Disk {
        version: u16,
        key: Vec<u8>,
        certificate: Vec<u8>,
    }
    let a_dir = tempfile::tempdir().unwrap();
    let b_dir = tempfile::tempdir().unwrap();
    let a = Identity::load_or_create(a_dir.path()).unwrap();
    let b = Identity::load_or_create(b_dir.path()).unwrap();
    let disk = Disk {
        version: 1,
        key: a.private_key().secret_der().to_vec(),
        certificate: b.certificate().to_vec(),
    };
    std::fs::write(
        a_dir.path().join("identity.bin"),
        postcard::to_allocvec(&disk).unwrap(),
    )
    .unwrap();
    assert!(Identity::load_or_create(a_dir.path()).is_err());
}

#[test]
fn newer_database_and_invalid_peer_certificates_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("future.sqlite");
    let connection = rusqlite::Connection::open(&path).unwrap();
    connection.execute_batch("PRAGMA user_version=99;").unwrap();
    drop(connection);
    assert!(UpdateStore::open(path).is_err());
    let mut store = UpdateStore::memory().unwrap();
    assert!(store.pin(b"not a certificate").is_err());
    assert!(store.pin(&vec![0; 8193]).is_err());
    assert!(store.peers().unwrap().is_empty());
}

#[test]
fn log_orders_deduplicates_and_survives_restart() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("log.sqlite");
    let a = Change::new(vec![1]).unwrap();
    let b = Change::new(vec![2]).unwrap();
    let mut store = UpdateStore::open(&path).unwrap();
    assert_eq!(store.append(&a).unwrap().0.sequence, 1);
    assert!(!store.append(&a).unwrap().1);
    assert_eq!(store.append(&b).unwrap().0.sequence, 2);
    drop(store);
    let store = UpdateStore::open(path).unwrap();
    assert_eq!(store.count().unwrap(), 2);
    assert_eq!(store.after(0, 1).unwrap()[0].change, a);
    assert_eq!(store.after(1, 10).unwrap()[0].change, b);
    assert!(store.after(2, 10).unwrap().is_empty());
}

#[test]
fn peer_cursors_are_durable_independent_monotonic_and_revocable() {
    let dir = tempfile::tempdir().unwrap();
    let a_dir = tempfile::tempdir().unwrap();
    let b_dir = tempfile::tempdir().unwrap();
    let a = Identity::load_or_create(a_dir.path()).unwrap();
    let b = Identity::load_or_create(b_dir.path()).unwrap();
    let path = dir.path().join("log.sqlite");
    let mut store = UpdateStore::open(&path).unwrap();
    store.pin(a.certificate().as_ref()).unwrap();
    store.pin(b.certificate().as_ref()).unwrap();
    for n in 1..=3 {
        store.append(&Change::new(vec![n]).unwrap()).unwrap();
    }
    store.acknowledge(a.id(), 2).unwrap();
    assert!(store.acknowledge(a.id(), 1).is_err());
    assert!(store.acknowledge(a.id(), 4).is_err());
    assert!(store.acknowledge(DeviceId([0; 32]), 1).is_err());
    drop(store);
    let mut store = UpdateStore::open(path).unwrap();
    assert_eq!(store.peer(a.id()).unwrap().unwrap().cursor, 2);
    assert_eq!(store.peer(b.id()).unwrap().unwrap().cursor, 0);
    store.revoke(a.id()).unwrap();
    assert!(store.peer(a.id()).unwrap().is_none());
    assert_eq!(store.count().unwrap(), 3);
}

#[test]
fn invalid_envelopes_never_enter_store() {
    let mut store = UpdateStore::memory().unwrap();
    assert!(Change::new(vec![]).is_err());
    assert!(Change::new(vec![0; MAX_CHANGE_BYTES + 1]).is_err());
    let mut change = Change::new(vec![42]).unwrap();
    change.payload[0] = 0;
    assert!(store.append(&change).is_err());
    change = Change::new(vec![42]).unwrap();
    change.version = 2;
    assert!(store.append(&change).is_err());
    assert_eq!(store.count().unwrap(), 0);
}

#[tokio::test]
async fn engine_rejects_unpaired_input_and_notifies_once() {
    let dir = tempfile::tempdir().unwrap();
    let peer_dir = tempfile::tempdir().unwrap();
    let peer = Identity::load_or_create(peer_dir.path()).unwrap();
    // Pinning is a trusted host boundary until the S04 pairing flow exists.
    let mut store = UpdateStore::open(dir.path().join("updates.sqlite")).unwrap();
    store.pin(peer.certificate().as_ref()).unwrap();
    drop(store);
    let engine = Engine::open(dir.path()).unwrap();
    let mut subscription = engine.subscribe_remote_changes();
    let change = Change::new(vec![99]).unwrap();
    assert!(engine
        .receive_remote_change(DeviceId([0; 32]), change.clone())
        .is_err());
    engine
        .receive_remote_change(peer.id(), change.clone())
        .unwrap();
    engine.receive_remote_change(peer.id(), change).unwrap();
    assert_eq!(subscription.recv().await.unwrap().sequence, 1);
    assert!(subscription.try_recv().is_err());
    assert_eq!(engine.status().unwrap().changes, 1);
    engine.revoke_peer(peer.id()).unwrap();
    assert!(engine
        .receive_remote_change(peer.id(), Change::new(vec![100]).unwrap())
        .is_err());
}
