# P05 The desktop pet

State: Implemented in code on 9 October 2026 for the existing popup workspace; native/manual checks open.

## Delivered

Opt-in original inline SVG sprout art with CSS idle, focus, break, celebration and reminder-nudge reactions. Separate message, celebration and nudge switches, editable phrases/card kinds, and OS `prefers-reduced-motion` plus a manual still-companion option. Home contains settings and a preview; Show pet on desktop uses the existing minimize shell. The drag handle uses the already-permitted Tauri window dragging API. Clicking the pet restores Home in the popup workspace and shows its full message. No Rust changes, external art or new network calls.

The existing 124-pixel native ball window is reused. Speech has a two-line visual preview, a full accessible label and tooltip, and a full message after opening. Five-minute break stops/logs focus; break time is not logged. Opted-in local open and drag-attempt counters are shown in Home. Future/unreadable pet data stays read-only and is preserved when unrelated data changes. A `pet.version:1` record extends the existing popup state; old entities and keys remain unchanged. Seed deck labels now explicitly say Sample on new installs only. Hidden popup panels are no longer keyboard-focusable. Reminder polling waits for its delivery handler to be registered, retaining the nudge in state even before the UI mounts.

## Evidence

Both apps pass `npx --offline tsc --noEmit -p apps/<app>`. Offline runner passes 41 real Vitest test bodies: additive popup migration (invented legacy fixture), default switches, unreadable/future preservation, phrase construction, all reactions and expiry, real AgentStore break logging, interaction opt-in and one-off reminder deduplication, plus W06-W11 checks. Local source bundles pass for app and popup (installed packages and assets external). Popup now has an explicit Vitest config. Real app Vitest was attempted and failed at startup with `spawn EPERM`; normal Vite and browser driving are unavailable in this sandbox. Handoff notes/snapshots are in `.verification/` because Git/.codex are read-only.

## Open checks / owner choice

Native dragging, click restore, notifications, reduced-motion rendering, contrast, keyboard traversal and real phone/browser layouts have not been exercised. Real Vitest/Vite builds must run outside the sandbox. The pet uses the popup's independent timers/reminders, not the full app's Pomodoro state. The owner's launch-destination question is open: this implementation restores the popup workspace; launching a separate full app or sharing its state needs the existing one-app/two-app decision. Long desktop messages are previewed until opened. Interaction counters count attempts, not confirmed native movements. Popup persistence retains the existing batching/failure behaviour; file-format docs describe the new nested record.
