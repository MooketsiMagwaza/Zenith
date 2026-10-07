# S03 — The data model and the merge library

State: Not started

## Goal

Pick the merge library by measuring, and model Zenith's real data so that edits made on two devices at once converge and nothing is silently lost.

## Scope

- A short spike that models decks, cards, checklists, reminders, preferences, session logs and journals in both **Automerge** and **Yjs (with yrs in Rust)**, and compares them on a realistic year of use: file size, load time, merge time, memory, how well journal text merges, and how much of the JavaScript and Rust sides each needs.
- The rules in `docs/SYNC.md`: last-writer-wins fields with a hybrid logical clock, tombstones for deletions, append-only logs, text merging for journals. The delete-versus-edit rule is decided here and tested.
- How the data is split into documents, how history is compacted, and how today's `localStorage` (web) and file (pop-up) data migrate into the first document without loss.
- A decision recorded in `docs/SYNC.md` with the numbers behind it.

## Out of scope

The network (S05), pairing (S04), and any UI (S06).

## Done when

- Property-style tests: two replicas make random edits while apart, merge in any order, and end identical.
- A saved export from the current deployed build loads into the new model with every deck, card, journal and log intact. (Run and recorded.)
- The library choice and its numbers are written down.
