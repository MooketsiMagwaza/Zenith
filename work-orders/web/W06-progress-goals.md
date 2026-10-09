# W06 — Progress and goals

State: Done on 9 October 2026 for the code, with the browser, keyboard and desktop checks still open (below)

## Goal

People can set optional targets on a card or a deck and see their progress, quietly.

## What was built

- Optional targets per card and per deck: minutes per day, hours per week, or total hours, stored in a new versioned record, `zenith.features.v1`. Defaults are off, with an explicit switch. No existing storage key was renamed.
- A Progress view to set, edit and remove targets, showing the current period against the target and a Monday-based daily trend. Labelled native progress bars on cards and deck headers when enabled.
- Period maths splits a session across local midnight; total goals use the existing lifetime totals.
- Also fixed: timer switching used stale callbacks and committed inside React state updaters; empty saved decks stay empty; newly created sample decks are labelled and start at zero invented time; existing values are untouched.

Written by a Codex agent (gpt-6.1-sol). Its sandbox could not run the real build, so it used a fallback runner and could not commit; the assistant committed the work and ran the checks below.

## Evidence (9 October 2026, run by the assistant outside the sandbox)

- `npm test -w @zenith/app`: 2 files, 8 tests passed (goal and window maths, and the migration of an old active session).
- `npm run build -w @zenith/app`: passes, with type checking.
- `npm run build -w @zenith/popup`: passes.

## Not verified

- The feature has not been looked at in a browser: phone layout, keyboard traversal, focus rings, contrast, or reduced motion. Nobody has run the desktop window.
- The migration test uses a fixture of invented data in the exact old storage format. It is not a captured export from the previous deployed build (the old app has no export control), so a regression check against real saved data is still open.
- Progress counts committed sessions only, not the interval that is running. Deleted targets are hidden and kept for restoration; permanent cleanup is not built.
