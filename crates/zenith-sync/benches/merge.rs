//! Run the JS generator first, then `cargo bench -p zenith-sync --bench merge --offline`.
#[path = "../tests/support/mod.rs"]
#[allow(dead_code)]
mod support;
use serde_json::{json, Value};
use std::{
    alloc::{GlobalAlloc, Layout, System},
    sync::atomic::{AtomicUsize, Ordering},
    time::Instant,
};

struct Counting;
static LIVE: AtomicUsize = AtomicUsize::new(0);
static PEAK: AtomicUsize = AtomicUsize::new(0);
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, l: Layout) -> *mut u8 {
        let p = System.alloc(l);
        if !p.is_null() {
            let n = LIVE.fetch_add(l.size(), Ordering::Relaxed) + l.size();
            PEAK.fetch_max(n, Ordering::Relaxed);
        }
        p
    }
    unsafe fn dealloc(&self, p: *mut u8, l: Layout) {
        LIVE.fetch_sub(l.size(), Ordering::Relaxed);
        System.dealloc(p, l);
    }
}
#[global_allocator]
static ALLOCATOR: Counting = Counting;
macro_rules! measure {
    ($name:literal, $model:ty, $data:expr) => {{
        let baseline = LIVE.load(Ordering::Relaxed); PEAK.store(baseline, Ordering::Relaxed);
        let t = Instant::now(); let mut d = <$model>::create(&$data["records"]);
        for edits in $data["edits"].as_array().unwrap() { d.edit(edits); }
        let build_ms = t.elapsed().as_secs_f64() * 1000.0;
        let saved = d.save();
        let live_delta = LIVE.load(Ordering::Relaxed).saturating_sub(baseline);
        let peak_delta = PEAK.load(Ordering::Relaxed).saturating_sub(baseline);
        std::fs::write(format!("tools/sync-bench/generated/rust-{}.bin", $name), &saved).unwrap();
        let mut loads = Vec::new(); let mut merges = Vec::new();
        for _ in 0..7 {
            let t = Instant::now(); let loaded = <$model>::load(&saved); loads.push(t.elapsed().as_secs_f64() * 1000.0);
            assert_eq!(loaded.json(), d.json()); drop(loaded);
            let mut a = d.fork(); let mut b = d.fork();
            for n in 0..100 {
                a.edit(&json!([{"id":format!("task:t{n}"), "field":"name", "value":format!("A{n}")},
                    {"id":format!("journal:j{n}"), "text":" ALPHA"}]));
                b.edit(&json!([{"id":format!("task:t{n}"), "field":"name", "value":format!("B{n}")},
                    {"id":format!("journal:j{n}"), "text":" BETA"}]));
            }
            let t = Instant::now(); a.merge(&mut b); merges.push(t.elapsed().as_secs_f64() * 1000.0);
            b.merge(&mut a); assert_eq!(a.json(), b.json());
            let result = a.json(); let text = result["journal:j0"]["content"].as_str().unwrap();
            assert!(text.contains("ALPHA") && text.contains("BETA"));
        }
        json!({"library":$name, "saved_bytes":saved.len(), "build_ms":build_ms,
            "load_ms":stats(loads), "merge_ms":stats(merges), "live_allocation_delta_bytes":live_delta,
            "peak_allocation_delta_bytes":peak_delta, "journal_concurrent_insertions_retained":true})
    }};
}
fn stats(mut samples: Vec<f64>) -> Value {
    let original = samples.clone();
    samples.sort_by(f64::total_cmp);
    json!({"median":samples[3], "min":samples[0], "max":samples[6], "samples":original})
}
fn main() {
    // Cargo runs bench binaries from the package directory, unlike direct execution.
    std::env::set_current_dir(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.."))
        .unwrap();
    let data: Value = serde_json::from_slice(
        &std::fs::read("tools/sync-bench/generated/year.json")
            .expect("run node tools/sync-bench/generate.mjs from the repository root first"),
    )
    .unwrap();
    let results = vec![
        measure!("automerge", support::Am, data),
        measure!("yjs", support::Y, data),
    ];
    let report = json!({"profile":"release opt-level=s, LTO; counting allocator", "samples":7,
        "note":"load includes decode/integrate; merge excludes fork/edit, includes yrs state-vector diff encoding",
        "records":data["records"].as_object().unwrap().len(), "results":results});
    std::fs::write(
        "tools/sync-bench/results-rust.json",
        format!("{}\n", serde_json::to_string_pretty(&report).unwrap()),
    )
    .unwrap();
    println!("{}", serde_json::to_string_pretty(&report).unwrap());
}
