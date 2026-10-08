//! Explicit JS/Rust compatibility probe; uses only generated synthetic data.
#[path = "../tests/support/mod.rs"]
#[allow(dead_code)]
mod support;
use serde_json::{json, Value};
use support::{Am, Y};
fn main() {
    let prefix = "tools/sync-bench/generated";
    let expected: Value = serde_json::from_slice(
        &std::fs::read(format!("{prefix}/interop-expected.json"))
            .expect("run node tools/sync-bench/interop.mjs prepare first"),
    )
    .unwrap();
    macro_rules! check {
        ($name:literal, $model:ty) => {{
            let mut d = <$model>::load(&std::fs::read(format!("{prefix}/interop-js-{}.bin", $name)).unwrap());
            assert_eq!(d.json(), expected);
            d.edit(&json!([{"id":"task:t0", "field":"name", "value":"Edited in Rust"},
                {"id":"journal:j0", "at":7, "text":" INDEX"},
                {"id":"journal:j0", "text":" Rust 🧭 café"}]));
            std::fs::write(format!("{prefix}/interop-rust-{}.bin", $name), d.save()).unwrap();
            std::fs::write(format!("{prefix}/interop-rust-{}.json", $name), serde_json::to_vec(&d.json()).unwrap()).unwrap();
            println!("{}: JS snapshot decoded, all fields equal; Rust edits saved", $name);
        }};
    }
    check!("automerge", Am);
    check!("yjs", Y);
}
