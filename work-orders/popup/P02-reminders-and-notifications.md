# P02 — Reminders and native notifications

State: Not started

## Goal

A reminder fires on time even when the pop-up is hidden, and says so with a system notification a person can act on.

## Scope

- Move the reminder check into a place that keeps running while the window is hidden (the Rust side, or a window that is hidden rather than suspended), and prove it keeps running.
- Native notifications through `tauri-plugin-notification`, with a permission prompt that explains itself the first time.
- Daily, weekdays, weekly, and one-off reminders behave as in the web app; a missed one fires once on wake, not many times.
- Sound is optional and off by default.

## Done when

- A reminder set for two minutes ahead fires with the window hidden and the machine idle. (Check by hand and record it.)
