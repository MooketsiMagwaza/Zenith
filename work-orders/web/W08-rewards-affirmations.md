# W08 Rewards and affirmations

State: Implemented in code on 9 October 2026; manual checks open.

## Delivered

Independent off-by-default recap, affirmation and milestone switches in the versioned feature record. A native modal dialog after a committed session, including card duration(s), an editable pack and gentle first-hour / goal-crossing messages. Empty sessions produce no screen. Goal acknowledgements are deduplicated by target, goal value and local period; first hours by card. No streak, loss or penalty messages. Existing app README and marketing home copy now describe optional rewards and quiet defaults.

## Evidence

Both app and popup TypeScript checks pass. Offline fallback runner passes 15 Vitest test bodies, covering quiet defaults, independent switches, first-hour and goal crossing, no repeat acknowledgements, already-met goals and additive migration, plus W06/W07 tests. Both local source graphs bundle through in-process Rollup with packages/assets external. Git and `.codex` are read-only; handoff snapshots and commit notes are in ignored `.verification/`.

## Open checks and limits

Real Vitest/Vite builds, browser/modal keyboard focus and phone layout, desktop window and sounds require checks outside this sandbox. Completion on switching from one card to another is included. At most one most-recent completion dialog is shown at a time. Goal milestones use the period at session completion; a session crossing periods does not retrospectively announce earlier periods. Deduplication metadata is retained for undo and export. No XP or streak system was added.
