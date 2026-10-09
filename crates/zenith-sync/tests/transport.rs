mod network_support;
#[allow(dead_code)]
mod support;
use network_support::{instance, pair};
use rand::{rngs::StdRng, Rng, SeedableRng};
use serde_json::json;
use std::{
    collections::BTreeSet,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    net::TcpListener,
    task::{JoinHandle, JoinSet},
};
use zenith_sync::{
    transport::{self, Validator},
    Change, DeviceId, Engine, Error, Result,
};

// Synthetic fixture shape only, never a production CRDT security validator.
struct Fixture;
impl Validator for Fixture {
    fn validate(&self, _: DeviceId, change: &Change) -> Result<()> {
        if change.payload.len() < 8 {
            return Err(Error::Invalid("fixture shape"));
        }
        Ok(())
    }
}
struct AmFixture;
impl Validator for AmFixture {
    fn validate(&self, _: DeviceId, change: &Change) -> Result<()> {
        let parsed = automerge::Change::from_bytes(change.payload.clone())
            .map_err(|_| Error::Invalid("test Automerge change"))?;
        if parsed.len() > 4096 || parsed.deps().len() > 128 {
            return Err(Error::Invalid("test operation/dependency count"));
        }
        Ok(())
    }
}
struct Node {
    address: SocketAddr,
    task: JoinHandle<()>,
}
impl Node {
    async fn start(engine: Arc<Engine>, validator: Arc<dyn Validator>) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            let mut sessions = JoinSet::new();
            loop {
                tokio::select! {
                    socket = listener.accept() => {
                        let engine = engine.clone(); let validator = validator.clone();
                        let socket = socket.unwrap().0;
                        sessions.spawn(async move { transport::accept(engine, socket, validator).await });
                    },
                    _ = sessions.join_next(), if !sessions.is_empty() => {},
                }
            }
        });
        Self { address, task }
    }
    async fn stop(self) {
        self.task.abort();
        assert!(self.task.await.is_err());
    }
}
fn link(
    a: Arc<Engine>,
    b: &Engine,
    address: SocketAddr,
    validator: Arc<dyn Validator>,
) -> JoinHandle<Result<()>> {
    let id = b.identity().id();
    tokio::spawn(async move { transport::connect(a, id, address, validator).await })
}
async fn cancel(task: JoinHandle<Result<()>>) {
    if task.is_finished() {
        panic!("session ended before cancellation: {:?}", task.await);
    }
    task.abort();
    assert!(task.await.is_err());
}
async fn until(mut condition: impl FnMut() -> bool) {
    tokio::time::timeout(Duration::from_secs(30), async {
        while !condition() {
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("localhost convergence/progress deadline");
}
fn ids(e: &Engine) -> BTreeSet<[u8; 32]> {
    let mut ids = BTreeSet::new();
    let mut cursor = 0;
    loop {
        let rows = e.changes_after(cursor, 128).unwrap();
        if rows.is_empty() {
            return ids;
        }
        cursor = rows.last().unwrap().sequence;
        ids.extend(rows.into_iter().map(|r| r.change.id));
    }
}
fn hydrate(e: &Engine) -> support::Am {
    let mut d = automerge::AutoCommit::new_with_encoding(automerge::TextEncoding::Utf16CodeUnit);
    d.apply_changes(
        e.changes_after(0, 1024)
            .unwrap()
            .into_iter()
            .map(|r| automerge::Change::from_bytes(r.change.payload).unwrap()),
    )
    .unwrap();
    support::Am(d)
}
fn export_changes(e: &Engine, d: &mut support::Am, heads: &[automerge::ChangeHash]) {
    for change in d.0.get_changes(heads) {
        e.push_local_change(change.raw_bytes().to_vec()).unwrap();
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 3)]
async fn three_ports_random_automerge_edits_partition_heal_and_stream() {
    let (_da, a) = instance();
    let (_db, b) = instance();
    let (_dc, c) = instance();
    pair(a.clone(), b.clone()).await;
    pair(b.clone(), c.clone()).await;
    let v: Arc<dyn Validator> = Arc::new(AmFixture);
    let na = Node::start(a.clone(), v.clone()).await;
    let nb = Node::start(b.clone(), v.clone()).await;
    let nc = Node::start(c.clone(), v.clone()).await;
    assert_ne!(na.address.port(), nb.address.port());
    assert_ne!(nb.address.port(), nc.address.port());
    let mut base = support::Am::create(&support::small());
    export_changes(&a, &mut base, &[]);
    let ab = link(a.clone(), &b, nb.address, v.clone());
    let bc = link(b.clone(), &c, nc.address, v.clone());
    until(|| ids(&a) == ids(&b) && ids(&b) == ids(&c)).await;
    cancel(ab).await;
    cancel(bc).await;
    // Ensure accept-side connection permits release before reconnect.
    tokio::time::sleep(Duration::from_millis(30)).await;
    let mut rng = StdRng::seed_from_u64(0x5_2026_1009);
    for round in 0..3 {
        let mut models = [hydrate(&a), hydrate(&b), hydrate(&c)];
        let engines = [&a, &b, &c];
        // A-B can stream while C is isolated; all three continue valid edits.
        let ab = link(a.clone(), &b, nb.address, v.clone());
        for n in 0..15 {
            for actor in 0..3 {
                let edit = match rng.gen_range(0..8) {
                    0 => {
                        json!({"id":"task:t","field":"name","value":format!("{round}-{actor}-{n}")})
                    }
                    1 => {
                        json!({"id":"deck:d","field":"name","value":format!("deck {round}-{actor}-{n}")})
                    }
                    2 => json!({"id":"journal:j","text":format!(" [{round}-{actor}-{n}]🧭")}),
                    3 => json!({"id":"task:t","field":"deleted","value":true}),
                    4 => json!({"id":"checklist:c","field":"done","value":n%2==0}),
                    5 => json!({"id":"reminder:r","field":"label","value":format!("{actor}-{n}")}),
                    6 => json!({"id":"preferences:shared","field":"zenInterval","value":60+n}),
                    _ => {
                        json!({"id":format!("log:{round}-{actor}-{n}"),"create":{"id":format!("{round}-{actor}-{n}"),"kind":"log","taskId":"t","duration":n+1,"deleted":false}})
                    }
                };
                let heads = models[actor].0.get_heads();
                models[actor].edit(&json!([edit]));
                export_changes(engines[actor], &mut models[actor], &heads);
            }
            tokio::time::sleep(Duration::from_millis(3)).await;
        }
        let expected: BTreeSet<_> = engines.iter().flat_map(|e| ids(e)).collect();
        let bc = link(b.clone(), &c, nc.address, v.clone());
        until(|| engines.iter().all(|e| ids(e) == expected)).await;
        let records = hydrate(&a).json();
        assert_eq!(records, hydrate(&b).json());
        assert_eq!(records, hydrate(&c).json());
        assert!(!support::visible(&records, "task:t"));
        assert!(!support::visible(&records, "journal:j"));
        for (id, record) in records.as_object().unwrap() {
            if record["kind"] == "log" {
                assert!(support::visible(&records, id));
            }
        }
        cancel(ab).await;
        cancel(bc).await;
        tokio::time::sleep(Duration::from_millis(30)).await;
    }
    na.stop().await;
    nb.stop().await;
    nc.stop().await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn backlog_dropped_connection_and_both_restarts_resume_durable_cursors() {
    let (da, mut a) = instance();
    let (db, mut b) = instance();
    pair(a.clone(), b.clone()).await;
    let v: Arc<dyn Validator> = Arc::new(Fixture);
    let mut nb = Node::start(b.clone(), v.clone()).await;
    for n in 0u64..1200 {
        let mut p = vec![42; 4096];
        p[..8].copy_from_slice(&n.to_be_bytes());
        a.push_local_change(p).unwrap();
    }
    let ab = link(a.clone(), &b, nb.address, v.clone());
    until(|| b.status().unwrap().changes >= 40).await;
    cancel(ab).await;
    nb.stop().await;
    let persisted = b.status().unwrap().changes;
    let cursor = a.list_peers().unwrap()[0].cursor;
    assert!((40..1200).contains(&persisted));
    assert!(cursor <= persisted);
    until(|| Arc::strong_count(&b) == 1 && Arc::strong_count(&a) == 1).await;
    drop(b);
    b = Arc::new(Engine::open(db.path()).unwrap());
    drop(a);
    a = Arc::new(Engine::open(da.path()).unwrap());
    assert_eq!(a.list_peers().unwrap()[0].cursor, cursor);
    assert_eq!(b.status().unwrap().changes, persisted);
    nb = Node::start(b.clone(), v.clone()).await;
    let ab = link(a.clone(), &b, nb.address, v.clone());
    until(|| b.status().unwrap().changes == 1200 && a.list_peers().unwrap()[0].cursor == 1200)
        .await;
    assert_eq!(ids(&a), ids(&b));
    cancel(ab).await;
    nb.stop().await;
    // Reopen sender to prove its outgoing cursor, not just received blobs, is durable.
    until(|| Arc::strong_count(&b) == 1 && Arc::strong_count(&a) == 1).await;
    let path = da.path().to_path_buf();
    drop(a);
    let restarted = Engine::open(path).unwrap();
    assert_eq!(restarted.list_peers().unwrap()[0].cursor, 1200);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn reconnect_retries_partition_then_catches_up() {
    let (_da, a) = instance();
    let (_db, b) = instance();
    pair(a.clone(), b.clone()).await;
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    drop(listener);
    let id = b.identity().id();
    let e = a.clone();
    let v: Arc<dyn Validator> = Arc::new(Fixture);
    let vv = v.clone();
    let retry = tokio::spawn(async move { transport::reconnect(e, id, address, vv).await });
    a.push_local_change(vec![1; 32]).unwrap();
    tokio::time::sleep(Duration::from_millis(600)).await;
    assert_eq!(b.status().unwrap().changes, 0);
    let listener = TcpListener::bind(address).await.unwrap();
    let eb = b.clone();
    let server =
        tokio::spawn(
            async move { transport::accept(eb, listener.accept().await.unwrap().0, v).await },
        );
    until(|| b.status().unwrap().changes == 1 && a.list_peers().unwrap()[0].cursor == 1).await;
    cancel(retry).await;
    assert!(server.await.unwrap().is_err());
}

/// Repeat sequentially with --nocapture --test-threads=1 for comparable samples.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn measure_empty_catchup_throughput() {
    let (_da, a) = instance();
    let (_db, b) = instance();
    pair(a.clone(), b.clone()).await;
    let v: Arc<dyn Validator> = Arc::new(Fixture);
    let nb = Node::start(b.clone(), v.clone()).await;
    let count = 256u64;
    let size = 64 * 1024;
    for n in 0..count {
        let mut p = vec![42; size];
        p[..8].copy_from_slice(&n.to_be_bytes());
        a.push_local_change(p).unwrap();
    }
    let start = Instant::now();
    let ab = link(a.clone(), &b, nb.address, v);
    until(|| b.status().unwrap().changes == count && a.list_peers().unwrap()[0].cursor == count)
        .await;
    let elapsed = start.elapsed();
    let seconds = elapsed.as_secs_f64();
    println!("S05_MEASUREMENT count={count} payload_bytes={} catchup_ms={:.3} payload_MiB_per_s={:.3} changes_per_s={:.3}",count as usize*size, seconds*1000.0, 16.0/seconds, count as f64/seconds);
    assert_eq!(ids(&a), ids(&b));
    cancel(ab).await;
    nb.stop().await;
}
