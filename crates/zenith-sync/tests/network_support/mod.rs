#![allow(dead_code)]
use std::sync::Arc;
use tokio::net::TcpListener;
use zenith_sync::{pairing, Engine};
pub fn instance() -> (tempfile::TempDir, Arc<Engine>) {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(Engine::open(dir.path()).unwrap());
    (dir, engine)
}
pub async fn pair(a: Arc<Engine>, b: Arc<Engine>) {
    let code = b.start_pairing().unwrap().code;
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server =
        tokio::spawn(async move { pairing::accept(&b, listener.accept().await.unwrap().0).await });
    pairing::connect(&a, addr, &code).await.unwrap();
    server.await.unwrap().unwrap();
}
