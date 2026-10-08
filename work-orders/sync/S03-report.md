# Sync engineering handoff — 8 October 2026

Owner: Mooketsi Vincent Magwaza (sole founder). Work stayed in the standalone `zenith-codex-sync` clone. No app source, keys, certificates, secrets, personal data, proxies, pushes or `gh` actions were involved. All fixtures are synthetic. S02 was already merged at f77ff76; 8 baseline tests passed offline.

S03 is **In progress**, stopped at a committed, passing measurement boundary. It proved larger than a library swap because losslessness depends on both persistence formats, noncentral preference keys, session totals, CRDT document bootstrap, history and Unicode offsets. No real deployed export was available. S04/S05 remain **Not started**; no stacked branches were created before S03 acceptance. S07 remains **Not started**.

Branch: `feat/sync-merge-model`. Local commits, in order:

- `d4dc6a5` — reconcile merged S02 evidence and start the spike.
- `b84071d` — dual-library models, generator and synthetic migration fixtures (JS green; Rust adapter API corrections followed in the next commit).
- `ff6ff16` — randomized convergence, corrected native adapters and interoperability probes (11 Rust tests green).
- `2e55f5e` — all record kinds, full preference keys, signed legacy time totals and runnable benchmark documentation (11 Rust / 7 JS tests green).
- `f549479` — explicit UTF-16 Rust offsets and cross-runtime emoji edit probe (12 Rust tests green).
- Final `docs: record measured merge choice and S03 handoff` commit contains the reports and final work-order/design updates; use `git log -1 --oneline` to identify its hash.

The chosen library is Automerge 0.12.0 / JS 3.5.0, because it preserves accessible concurrent field values and history and shares a Rust core. yrs 0.28.0 / Yjs 13.6.33 was materially faster. The synthetic year contains 3,168 records: 12 decks, 144 tasks, 432 checklist items, 24 reminders, shared preferences, 2,190 logs and 365 journals, plus 365 edit batches. Repeated prose exaggerates compressibility; these are assumed usage counts, not actual user data or complete keystroke history.

| Runtime/library | Saved bytes | Median load ms | Median merge ms | Measured memory |
| --- | ---: | ---: | ---: | --- |
| JS Automerge | 77,958 | 409.54 | 72.73 | RSS delta 175.38 MiB |
| JS Yjs | 1,271,532 | 30.51 | 1.54 | RSS delta 38.53 MiB |
| Rust Automerge | 72,249 | 213.28 | 44.77 | build/save peak requested allocation delta 151.04 MiB |
| Rust yrs | 1,391,720 | 34.56 | 0.78 | build/save peak requested allocation delta 14.98 MiB |

Seven timed samples per load/merge. Different memory metrics are not directly comparable. JS sharding into 379 documents measured Automerge 249,691 bytes / load all 217.04 ms / single-journal merge 0.7505 ms / RSS delta 86.88 MiB; Yjs 1,249,592 bytes / load all 47.58 ms / single-journal merge 0.0209 ms / RSS delta 45.54 MiB. The single-journal workload is much smaller than the unsplit 100-journal merge. Raw samples, V8 heap, native live allocation and build times are committed in `tools/sync-bench/results*.json`; reproduction and limits are in its README.

Validation run:

- `cargo test -p zenith-sync --offline`: 12 passing tests (8 S02 + 4 S03), with 96 random three-replica cases against each library covering all record kinds, merge permutations, duplicate delivery, restart, delete-wins and retained logs/text.
- `node --test --test-isolation=none tools/sync-bench/model.test.mjs`: 7 passing tests, including both libraries and three migration source shapes. Default process isolation was denied (`spawn EPERM`); no-isolation mode passed.
- `interop.mjs prepare` -> offline Cargo example -> `interop.mjs verify`: JS snapshots load/edit in Rust and return to JS with exact field equality, Unicode and UTF-16 insertion after emoji, for both libraries.
- Offline native bench, separate sequential JS benches, report collector, both JS sharded probes, format check, Clippy with warnings denied and diff whitespace check passed. The first baseline build filled the disk; cleaned only generated Cargo files in this clone and disabled dev/test debug symbols/incremental compilation. No network workaround was used.

Not verified: actual deployed export, Tauri command/editor integration, production atomic migration or checkpoint installation, migration crash recovery, immutable-log/tombstone enforcement against malicious updates, decompression/dependency/resource limits, minimum Rust 1.90 compiler, CI, real machines, hostile networks, multicast/discovery, pairing, TLS, reconnection, throughput, or catch-up time. No network tests were run, including localhost. Network work remains for S04/S05; any tests there must use multiple localhost ports. Nothing here claims security or readiness for user data.

Largest risks: Automerge's measured transient memory; unbounded S02 log growth; independently recreating existing CRDT containers; imported time double counting/cross-source reconciliation; accidentally dropping orphan/duplicate journals during hydration; malformed updates exceeding decoded resource budgets. Discovery tokens still need a shared-secret scheme; PAKE/TLS/authorization remain unimplemented.

Owner decisions: confirm delete-wins visibility with explicit restore to a new ID; which preferences should roam; one app/process versus two independent apps; first-release desktop scope and deferred relay. A representative deployed export must be tested privately (never committed). Next engineering step is the remaining S03 lifecycle/acceptance work; then commit and create `feat/sync-pairing`, finish S04, and create `feat/sync-transport` from it. Do not skip directly to S05 or mark S07 started.
