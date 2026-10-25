# W07 The companion

State: Implemented in code on 9 October 2026; manual checks open.

Checked by the assistant on 25 October 2026, outside the Codex sandbox: the app tests pass (37 tests across W06 to W11), the pop-up tests pass (7), and the app, pop-up and marketing production builds pass. Not verified: the feature in a browser, on a phone, or in the desktop window (focus rings, contrast, reduced motion, notifications and sounds).

## Delivered

Opt-in companion settings in the additive `zenith.features.v1` record. Seven card kinds, editable kind phrases and per-card overrides, previews using the current title. Existing reminder delivery displays companion wording in-app and uses the native Tauri notification plugin on desktop. Reminder notification/sound switches remain independent. No network calls or existing storage-key changes. Future/unreadable settings remain preserved and editing is disabled. Reminder callbacks now run outside React state updaters.

## Evidence

- Both app and popup: `npx tsc --noEmit -p apps/<app>` passed; final check also uses `--offline`.
- Offline fallback runner: 11 real Vitest test bodies passed (phrase building, literal titles, legacy/default/future-version settings, W06 migration and progress).
- In-process Rollup local source graph check passed for both apps; installed packages and assets external. This is not a Vite build.
- Tools live in ignored `.verification/`: the sandbox marks `.codex` read-only. Git outcome is in the batch report / commit handoff note.

## Open checks

Real Vitest and Vite builds outside this sandbox, a desktop notification, browser/phone layout, keyboard traversal, screen-reader delivery and sounds. Native notifications require previously granted permission and the reminder's notify switch; browser notification clicks can open the target, native clicks are not wired. Card kinds/phrases are separate metadata so legacy cards remain unchanged. Removed targets' metadata stays available for undo.
