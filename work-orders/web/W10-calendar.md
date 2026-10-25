# W10 Calendar

State: Implemented in code on 9 October 2026; manual checks open.

Checked by the assistant on 25 October 2026, outside the Codex sandbox: the app tests pass (37 tests across W06 to W11), the pop-up tests pass (7), and the app, pop-up and marketing production builds pass. Not verified: the feature in a browser, on a phone, or in the desktop window (focus rings, contrast, reduced motion, notifications and sounds).

## Delivered

Monday-based month and week views, date navigation, day details, sessions split across local midnight, enabled repeating/one-off reminders, goal progress for the selected date, and click-through to a card/deck. Phone widths use a readable two-column date list. Deleted cards keep history and show a disabled link. Click-through focuses the card and respects reduced motion.

Export of all sessions and enabled reminders as iCalendar: stable UIDs, UTC session and one-off timestamps, floating wall-clock repeating reminders, daily/weekdays/weekly RRULEs, escaped text, CRLF and UTF-8 octet folding. No persistent calendar settings or existing record changes.

## Evidence

Both apps pass TypeScript checks. Offline runner passes 24 test bodies, including calendar grids, reminder start boundaries, recurrence, escaping, UTC timestamps, stable UIDs and multibyte folding. Both local source graphs bundle through in-process Rollup (packages/assets external). Git/.codex read-only; per-order handoff lives in `.verification/`.

## Open checks and limits

Real Vitest/Vite builds, navigation, keyboard/phone layout and calendar-client import need checks outside the sandbox. Repeating reminders are floating local time (they follow the calendar viewer's time zone); no IANA VTIMEZONE database is bundled. Export omits disabled reminders and does not add alarm popups. Total goals always use current lifetime totals; day/week goals use the selected period. The calendar is a viewer, not an appointment editor.
