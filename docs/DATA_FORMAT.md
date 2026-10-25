# Your data is yours: Zenith open data v1

Implemented on 9 October 2026. All conversion happens locally. No upload, account or network service is involved. The app's **Data** view exports and previews imports. The code has TypeScript, fallback unit-test and local-bundle evidence; real browser, desktop, Vitest, Vite and third-party calendar checks remain open. The popup still has its own independent store; this format describes the full app.

## Full JSON backup

The lossless envelope is versioned. This example is **invented sample data**:

```json
{
  "format": "zenith",
  "version": 1,
  "exportedAt": "2026-10-09T07:00:00.000Z",
  "records": {
    "toggl_zen_decks": "[]",
    "toggl_zen_logs": "[]",
    "toggl_zen_journals": "[]",
    "toggl_zen_reminders": "[]",
    "toggl_zen_active": "{\"taskIds\":[],\"deckIds\":[],\"startedAt\":null}",
    "zenith.features.v1": "{\"version\":1,\"progress\":false,\"goals\":{}}",
    "zenith.pomodoro.v1": "null"
  }
}
```

`records` maps original storage keys to their **original string values**, including whitespace and unknown supported-namespace preference values. Parse a value a second time to read its JSON. The envelope does not rewrite or flatten cards. Keys beginning `toggl_zen_` or `zenith.` are included, except the popup's `zenith.popup.*`. Unrelated site storage is excluded. Zen preferences (including custom quotes and uploaded wallpaper data), tutorial and notification preferences are included when present. A full backup can be large and contains private journals and images.

Missing optional records get defaults when the app opens. Full v1 import requires decks, logs and journals. It rejects malformed data, future envelope/feature/runtime versions, foreign keys, duplicate IDs or journal targets, missing journal/reminder targets, invalid timestamps and negative durations **before writing**. Historical logs may refer to removed cards. Extra entity and v1 feature properties are preserved. An export can still back up unreadable settings verbatim; the current app cannot import them until the format is supported or repaired.

Pre-export legacy snapshots `{decks, logs, journals, active?, reminders?, features?}` are accepted and mapped to the existing keys. Old `{taskId, deckId, startedAt}` active sessions are read through the existing additive migration. No old key is renamed. The migration fixture in `apps/app/src/lib/zen/fixtures/current-build-export.json` is invented, not a captured export from a deployed build.

## Records and units

Schemas are in `apps/app/src/lib/zen/dataFormat.ts`, `features.ts` and `pomodoro.ts`; app entity types are in `types.ts` and `useReminders.ts`.

| Record | Value |
| --- | --- |
| `toggl_zen_decks` | Array of `{id,name,color,tasks}`; each task has `{id,deckId,name,tag,totalSeconds,createdAt}`, optional `checklist`, `mode` (`stopwatch`/`countdown`) and `targetSeconds`. |
| `toggl_zen_logs` | Array of `{id,taskId,taskName,deckName,deckColor,duration,startedAt,endedAt,hasJournal}`. |
| `toggl_zen_journals` | Array of `{id,taskId,taskName,deckId,deckName,deckColor?,logId,body,wordCount,createdAt,updatedAt}`. Nullable targets; one journal per card or deck. |
| `toggl_zen_active` | `{taskIds,deckIds,startedAt}`; parallel ID arrays, `null` start when idle. |
| `toggl_zen_reminders` | `{id,targetType,targetId,label,deckName?,deckColor?,fireAt,repeat,weekday?,enabled,notify,sound,createdAt,lastFiredAt?}` per reminder. |
| `zenith.features.v1` | `version:1`; `progress`, `goals` keyed `task:<id>`/`deck:<id>` with `{period:day/week/total,seconds}`; `companion` with enabled, phrases and card metadata; `rewards` with recap/affirmations/milestones, editable pack and seen acknowledgements; `pomodoro` with enabled, focus/break/long-break minutes and autoStart. Defaults off; additive migration supplies new fields. |
| `zenith.pomodoro.v1` | `null` or `{version:1,phase:focus/break/longBreak,completed,taskIds,startedAt,deadline}`. Waiting timestamps are both null; a running deadline follows its start. |

Durations and goals use **seconds**; Pomodoro settings use **minutes**. Dates use Unix **milliseconds**. IDs are opaque strings. A task's lifetime total is not recomputed from history (history can be deleted independently). A multi-card session records one log and the duration for each card. Repeating reminders use local wall-clock hours/minutes from `fireAt`; `weekday` is 0=Sunday through 6=Saturday. Day/week progress follows local midnight and Monday boundaries.

## CSV time entries v1

UTF-8, optional BOM on import, RFC-style quoting, CRLF export, quoted commas/newlines and doubled quotes. Header:

```text
zenithCsvVersion,id,taskId,taskName,deckName,deckColor,duration,startedAt,endedAt,hasJournal
```

Every row's `zenithCsvVersion` is `1`. Durations are seconds, timestamps milliseconds, journal flag `true`/`false`. Formula-like text beginning `=`, `+`, `-`, `@`, whitespace controls or `'` gets a leading apostrophe on export to discourage spreadsheet formula evaluation; Zenith's importer removes that escape. CSV contains log fields, not journal bodies, goals, reminders or prior lifetime totals. Import credits only new log IDs, creates missing cards/decks and preserves existing data. A reused ID with different session content is rejected. Preserve the version column for a round trip.

### Toggl and Clockify

Import **detailed time-entry CSV**, not summary reports. Choose the source and the date order explicitly (Y/M/D, D/M/Y or M/D/Y); ambiguous slash dates are never guessed. Column matching ignores case and outer spaces.

Both require `Project`, `Description`, `Start date`, `Start time`, `End date`, `End time`. Toggl requires `Duration`; Clockify accepts `Duration`, `Duration (h)` or `Duration (decimal)`. Durations are `H:MM:SS` or decimal hours. Dates use numeric hyphen/slash forms with four-digit years. Times support `HH:MM[:SS]` and `AM`/`PM`, interpreted in this device's local time zone. Local DST gaps, impossible dates, malformed CSV and unsupported headers are rejected. No vendor network API is used and not every export layout is supported.

Source/project/description determine stable card IDs. Card, timestamps and duration determine stable log IDs, so importing the same fixture twice does not double time. Missing projects/descriptions get plain imported labels. Invented test fixtures are `toggl-invented.csv` and `clockify-invented.csv` in the fixtures directory. Real vendor exports have not been verified.

## Markdown journals v1

`zenith-journals-v1.md` is readable Markdown: a `# Zenith journals` heading and one `##` title per journal. A `<!-- zenith-journal-v1 ... -->` comment contains URI-encoded JSON metadata (all journal fields except `body`, plus `bodyLength`). The body follows exactly; two newlines separate entries. `bodyLength` counts JavaScript UTF-16 code units, preserving Unicode, CRLF and marker-like comments inside the body. Exported metadata is local data, not a remote reference.

Import accepts these bundles, not arbitrary `.md` files without a target. It creates missing targets. Different imported content is appended after a separator to an existing target journal; prior notes are retained. A local import marker deduplicates repeated appends. Use full JSON when you need exact replacement or all preferences.

## iCalendar

RFC 5545 text with CRLF, stable `session-<encoded id>@zenith.local` / `reminder-<encoded id>@zenith.local` UIDs, escaped text and line folding at 75 UTF-8 octets. Sessions and one-off reminders have UTC timestamps. Repeating reminders have **floating local** timestamps and daily, weekdays or weekly recurrence. They follow the viewing calendar's time zone; no IANA time-zone table is included. Export includes sessions and **enabled reminders only**, without calendar alarms. Disabled reminders are retained in full JSON.

`X-ZENITH-*` properties retain target IDs/types, original reminder fire time, duration, deck labels/colours, flags and last-fired state. Standard timestamps have second precision; use JSON for exact timestamp precision and full data. Imported calendars support timed UTC or floating events with UID and DTSTART: events with DTEND become sessions, those without become reminders, unless `X-ZENITH-TYPE` says otherwise. Only the recurrence forms exported here are accepted. All-day events, TZID, time-zone tables, exception dates, recurring sessions, DURATION and VALARM are rejected rather than silently misconverted. Cancelled events are skipped. Other calendar fields are not retained. External events get an imported card. Imported reminders keep the source schedule, so an overdue one-off can fire when Zenith reopens; review the calendar afterwards.

## Applying an import safely

Files are limited to 50 MB in the UI. End the local timer and Pomodoro cycle first. Full backups with live/waiting timers are rejected by the UI: end them on the source device first. Preview the resulting counts; JSON **replaces** Zenith's owned records, other formats **merge**. Changing local data after preview invalidates the preview. Before applying, the app starts a full backup download; check your browser's download folder. Import failures attempt to restore previous records; unrelated storage keys remain untouched. Desktop writes are serialized, flushed and errors surfaced before reload.

The separate storage records are not a crash-atomic database transaction. Keep the downloaded backup, especially before a large desktop import, and do not close the app during import. Real browser download and desktop rollback/window checks remain open.


## Popup pet record v1

The independent popup persists under browser key `zenith.popup.state` or `state` in the desktop store file `zenith-popup.json`. Its existing top-level `version` is an update counter, not a schema version. P05 adds a nested `pet` record with `version:1`, off-by-default `enabled`, `messages`, `celebrations`, `nudges` switches, `reducedMotion`, editable `phrases` and `cards` kind/phrase metadata, local `interactions:{opens,drags}`, nullable millisecond `breakUntil`, `celebrateUntil`, `nudgeUntil`, and `lastMessage`. Schema and migration are in `apps/popup/src/shared/pet.ts` and `migration.ts`. Missing pet data gets quiet defaults without changing old entities. Extra v1 fields are retained; future/unreadable pet data is preserved on unrelated saves and cannot be edited by the current UI. `petReadOnly` is transient. The full app's JSON backup does not include this independent store; no popup export/import control or shared store is claimed.
