# S03 merge spike

Synthetic data only; never reads live app data. Windows MSVC and Node 24 were used on 8 October 2026. These tools are independent of the app build. Dependencies were already cached/installed; no registry proxy or network workaround is required or used.

Run from the repository root, one process at a time for timings:

```powershell
node tools/sync-bench/generate.mjs
node --test --test-isolation=none tools/sync-bench/model.test.mjs
$env:CARGO_PROFILE_DEV_DEBUG='0'
$env:CARGO_PROFILE_TEST_DEBUG='0'
$env:CARGO_INCREMENTAL='0'
cargo test -p zenith-sync --offline
node --expose-gc tools/sync-bench/bench.mjs automerge
node --expose-gc tools/sync-bench/bench.mjs yjs
node tools/sync-bench/bench.mjs
cargo bench -p zenith-sync --bench merge --offline
node --expose-gc tools/sync-bench/sharded.mjs automerge
node --expose-gc tools/sync-bench/sharded.mjs yjs
```

Cross-runtime compatibility probe (generate -> load/edit in Rust -> load in JS):

```powershell
node tools/sync-bench/interop.mjs prepare
cargo run -p zenith-sync --example interop --offline
node tools/sync-bench/interop.mjs verify
```

The normal Cargo test suite does not require Node or generated files. The explicit interoperability probe does. `generated/` is ignored; it contains only reproducible synthetic data. The small JSON result reports outside that directory are committed evidence; rerunning overwrites them.

The generator assumes 12 decks, 144 tasks, 3 checklist items per task, 24 reminders, 6 sessions/day and one roughly 150-word journal/day. It imports that final state once and replays 365 daily batches of name, checklist, reminder, preference and journal edits, including 12 tombstones. This is **not** a recording of a real year's individual keystrokes or a real export. Journal prose repeats and compresses particularly well; results are workload-specific. Both adapters use the same trace. The benchmark keeps hidden records to measure retained history.

Unsplit runs measure one document. Sharded runs measure the proposed catalog + monthly logs + individual journals layout. Each reports seven load samples. Merge uses 100 concurrent field and 100 concurrent text edits per side, excludes forks/edits, and includes the native merge/delta work. The sharded merge probe uses just one concurrent insertion on each side of one journal and is a separate workload; do not compare that number to the 100-journal merge as though work were equal. Yjs/Yrs send a state-vector difference; Automerge merges native changes.

Serialized sizes are native saved formats (Automerge compression versus Yjs update v1, no external compression). Load means decode/integrate, not app rendering. JS memory is GC-before/after process RSS and V8 heap delta after building and saving, with the source JSON parsed before baseline. RSS includes WASM/runtime/allocator retention and excludes later merge peaks; V8 heap alone misses Automerge's WASM memory. Rust's counting allocator measures requested live/peak allocation deltas for build+save, excluding source JSON, allocator overhead and OS memory. Memory metrics are **not directly comparable across runtimes**. Wall times include JIT/cold samples and have no statistical significance test.

`migrate.mjs` produces an in-memory candidate and exact source archive for `popup-browser`, `popup-file` (`{"state": ...}`), and `full-localStorage` (an object containing raw localStorage key/value strings). It never switches a live store. Acceptance against a deployed export and atomic installation remain open; see `docs/SYNC.md`. Never put a real source archive/export in this public repository. Duplicate IDs fail rather than discarding a record.
