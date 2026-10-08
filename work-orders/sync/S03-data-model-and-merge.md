# S03 — The data model and the merge library

State: In progress (measured spike committed and passing, 8 October 2026; actual deployed-export check and production lifecycle open)

## Goal

Pick the merge library by measuring, and model Zenith's real data so that edits made on two devices at once converge and nothing is silently lost.

## Scope

- A short spike that models decks, cards, checklists, reminders, preferences, session logs and journals in both **Automerge** and **Yjs (with yrs in Rust)**, and compares them on a realistic year of use: file size, load time, merge time, memory, how well journal text merges, and how much of the JavaScript and Rust sides each needs.
- The rules in `docs/SYNC.md`: library-native causal/conflict registers (superseding HLC), monotonic delete-wins tombstones, append-only logs, native journal text. The delete-versus-edit rule is decided here and tested.
- How the data is split into documents, how history is compacted, and how today's `localStorage` (web) and file (pop-up) data migrate into the first document without loss.
- A decision recorded in `docs/SYNC.md` with the numbers behind it.

## Out of scope

The network (S05), pairing (S04), and any UI (S06).

## Evidence in progress, 8 October 2026

- Added deterministic synthetic year generator: 12 decks, 144 tasks, 432 checklist items, 24 reminders, preferences, 2,190 logs and 365 journals (3,168 records), plus 365 edit batches. Both JS and Rust adapters use this same JSON trace, native CRDT journal text, ID-keyed maps and monotonic tombstones.
- `node --test --test-isolation=none tools/sync-bench/model.test.mjs`: 7 tests passed. Checked six merge orders, duplicate delivery, overlapping journal replacements with Unicode, hidden deleted tasks/children, retained historical logs, and synthetic migration of browser pop-up, Tauri pop-up file and full-app localStorage shapes. Exact original bytes remain in a private migration archive. Corrupt/duplicate/reserved/missing-text inputs fail.
- Node's default test process isolation was denied by the sandbox (`spawn EPERM`); no-isolation mode passed. First baseline build exhausted the disk; cleaned only this clone's generated Cargo artifacts and disabled debug symbols/incremental compilation for subsequent dev/test runs.
- `cargo test -p zenith-sync --offline` (debug symbols/incremental disabled): 11 tests passed (8 S02 + 3 S03). The property test ran 96 cases against both libraries: three partitioned replicas, randomized field/text/delete operations, six possible orders, duplicate delivery, save/load restart and a causally later edit after deletion. Separate checks preserve both overlapping text replacements and expose Automerge's conflicting field values.
- Rust benchmarks, library decision and interoperability measurements are pending. No actual deployed export is available, so the saved-export acceptance check has not passed. No app code is changed.
- The explicit `interop.mjs prepare` -> `cargo run -p zenith-sync --example interop --offline` -> `interop.mjs verify` probe passed for both libraries: equivalent synthetic JS snapshots loaded in Rust, all fields matched, Rust field/text edits loaded back in JS with Unicode intact.
- Expanded randomized operations to checklist, reminder, preferences and new append-only log IDs. The same 11 Rust tests and 7 JS tests passed again. Full-app preference keys and signed migration offsets preserve reported task totals despite historical log discrepancies; unknown/unsynced source values remain in the exact private archive.
- Found that default Rust text offsets differ from JavaScript. Explicit UTF-16 configuration and an insertion/removal after an astral character now pass: 12 Rust tests (8 existing + 4 S03). The cross-runtime probe now also edits after an emoji at JS offset 7. Benchmark numbers will be refreshed against this configuration.

## Done when

- Property-style tests: two replicas make random edits while apart, merge in any order, and end identical.
- A saved export from the current deployed build loads into the new model with every deck, card, journal and log intact. (Run and recorded.)
- The library choice and its numbers are written down.

## Measurement boundary and remaining work

Automerge is selected for retained conflicts/history and one Rust core on both sides; Yjs/yrs was faster and used less JS RSS. Unsplit JS medians: Automerge 77,958 bytes / load 409.54 ms / merge 72.73 ms / RSS delta 175.38 MiB; Yjs 1,271,532 bytes / load 30.51 ms / merge 1.54 ms / RSS delta 38.53 MiB. Native medians: Automerge 72,249 bytes / load 213.28 ms / merge 44.77 ms / build+save allocation peak 151.04 MiB; yrs 1,391,720 bytes / load 34.56 ms / merge 0.78 ms / peak 14.98 MiB. Seven samples each; complete raw reports and 379-document JS results are in `tools/sync-bench/`. Assumed counts, repetitive corpus, memory definitions and effort proxies are documented under Decisions in `docs/SYNC.md`.

`cargo bench -p zenith-sync --bench merge --offline`, both JS library runs, report collector, both JS sharded runs, 12 Rust tests, 7 JS tests and both directions of the explicit interoperability probe passed. `cargo clippy -p zenith-sync --all-targets --offline -- -D warnings` passed. Rust dev/test runs disabled debug symbols/incremental compilation after the first build exhausted the disk. No registry/network workaround was used.

S03 grew beyond a short library swap: two persistence shapes, preference keys, session totals, document creation/history and UTF-16 offsets affect losslessness. Stop at this passing, committed spike boundary under the owner's instruction. The saved-export Done criterion has not passed: no deployed export was supplied. Production migration installation/checkpoint/manifest lifecycle and adversarial model validation remain unimplemented; no app integration is claimed. S04 and S05 remain Not started with no branches/commits/tests or throughput measurements. S07 remains Not started. See [the handoff report](S03-report.md).
