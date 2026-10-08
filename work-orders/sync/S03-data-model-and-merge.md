# S03 — The data model and the merge library

State: In progress (S03 spike started in the standalone clone, 8 October 2026)

## Goal

Pick the merge library by measuring, and model Zenith's real data so that edits made on two devices at once converge and nothing is silently lost.

## Scope

- A short spike that models decks, cards, checklists, reminders, preferences, session logs and journals in both **Automerge** and **Yjs (with yrs in Rust)**, and compares them on a realistic year of use: file size, load time, merge time, memory, how well journal text merges, and how much of the JavaScript and Rust sides each needs.
- The rules in `docs/SYNC.md`: last-writer-wins fields with a hybrid logical clock, tombstones for deletions, append-only logs, text merging for journals. The delete-versus-edit rule is decided here and tested.
- How the data is split into documents, how history is compacted, and how today's `localStorage` (web) and file (pop-up) data migrate into the first document without loss.
- A decision recorded in `docs/SYNC.md` with the numbers behind it.

## Out of scope

The network (S05), pairing (S04), and any UI (S06).

## Evidence in progress, 8 October 2026

- Added deterministic synthetic year generator: 12 decks, 144 tasks, 432 checklist items, 24 reminders, preferences, 2,190 logs and 365 journals (3,168 records), plus 365 edit batches. Both JS and Rust adapters use this same JSON trace, native CRDT journal text, ID-keyed maps and monotonic tombstones.
- `node --test --test-isolation=none tools/sync-bench/model.test.mjs`: 7 tests passed. Checked six merge orders, duplicate delivery, overlapping journal replacements with Unicode, hidden deleted tasks/children, retained historical logs, and synthetic migration of browser pop-up, Tauri pop-up file and full-app localStorage shapes. Exact original bytes remain in a private migration archive. Corrupt/duplicate/reserved/missing-text inputs fail.
- Node's default test process isolation was denied by the sandbox (`spawn EPERM`); no-isolation mode passed. First baseline build exhausted the disk; cleaned only this clone's generated Cargo artifacts and disabled debug symbols/incremental compilation for subsequent dev/test runs.
- Rust convergence and benchmarks are being built offline; library decision and interoperability measurements are pending. No actual deployed export is available, so the saved-export acceptance check has not passed. No app code is changed.

## Done when

- Property-style tests: two replicas make random edits while apart, merge in any order, and end identical.
- A saved export from the current deployed build loads into the new model with every deck, card, journal and log intact. (Run and recorded.)
- The library choice and its numbers are written down.
