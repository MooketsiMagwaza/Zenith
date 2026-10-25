# W11 Open data

State: Implemented in code on 9 October 2026; manual/vendor checks open.

## Delivered

`docs/DATA_FORMAT.md` documents a versioned full JSON envelope that preserves original storage strings, entity fields, optional-feature data and Zen preferences. Data view explains ownership and supports export/import for JSON, versioned CSV time entries, Markdown journal bundles and supported timed iCalendar events. Toggl/Clockify detailed CSV imports use labelled invented fixtures and explicit date-order selection. Imports validate and preview before application, start a backup download, merge non-JSON data without removing time/notes, deduplicate imports, reject conflicting IDs and invalidate stale previews. Full JSON is an explicit replacement. Old keys remain unchanged; legacy snapshot and active-session migrations are supported. Additive v1 feature migration preserves extension properties.

Desktop storage writes are serialized and can be flushed; failed writes/flushes trigger rollback. README and marketing features/roadmap now state available formats and validation limits, without claiming universal CSV or calendar support.

## Evidence

App, popup and marketing TypeScript checks pass. Offline fallback runner passes 34 Vitest test bodies: original-string JSON round trips, invented legacy snapshot migration, malformed/future/foreign-record rejection, formula-safe CSV and quoting/newlines, invented Toggl/Clockify fixtures and deduplicated time, Markdown round trips and preserving existing notes, ICS round trips/unsupported-rule rejection, synchronous and asynchronous rollback, extension preservation, plus earlier orders. Both app source graphs bundle through in-process Rollup (installed dependencies and assets external). Git/.codex read-only; `.verification/commit-W11.txt` and per-order snapshots are the commit handoff.

## Open checks and limits

Real Vitest/Vite builds, download/import UI and desktop flush/rollback, real Toggl/Clockify CSVs and calendar clients require checks outside the sandbox. The legacy fixture is invented, not a deployed-build export. UI imports are limited to 50 MB and require idle source/local timers. Markdown import accepts Zenith bundles; iCalendar supports timed UTC/floating events and simple recurrence, not all-day/TZID/alarms/exceptions. JSON is the full fidelity format. Multi-record writes are not crash-atomic; keep the downloaded backup. The full app and popup remain independent stores. Format details state each restriction.
