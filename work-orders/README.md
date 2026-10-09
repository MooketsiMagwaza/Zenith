# Work orders

One file per piece of work, in a folder per area. A work order says what the goal is, what is in and out of scope, and what counts as done. States are honest: **Not started**, **In progress**, **Done** (with the evidence), or **Blocked** (with what it waits for).

Update a work order when scope, evidence, or state changes, in the same commit as the change.

## Web (`work-orders/web`)

| ID | Work | State |
| --- | --- | --- |
| [W01](web/W01-extract-core.md) | Extract the shared core into `packages/core` | Not started |
| [W02](web/W02-tidy-stale-parts.md) | Remove the stale and unused parts left by the code generator (first) | Done (one check left for a person: the deployed page source) |
| [W03](web/W03-deploy.md) | Deploy the web app and keep the build green in CI | Not started |
| [W04](web/W04-tauri-react-app.md) | One React app, as a web interface and as a Tauri desktop app (`apps/app`) | In progress (rename, desktop shell and both builds done; a person must run the window; workspace and pop-up question open) |
| [W05](web/W05-marketing-site.md) | The marketing site (`apps/marketing`) | In progress (built and passing; not deployed, which needs the owner: see docs/DEPLOY.md) |
| [W06](web/W06-progress-goals.md) | Progress and goals: optional targets and progress bars | Done in code (tests and builds pass); browser, keyboard and desktop checks open |
| [W07](web/W07-companion.md) | The companion: "time for ..." messages tied to a card | Not started |
| [W08](web/W08-rewards-affirmations.md) | Rewards and affirmation screens (optional, quiet) | Not started |
| [W09](web/W09-pomodoro.md) | A Pomodoro timer | Not started |
| [W10](web/W10-calendar.md) | A calendar of sessions and reminders, with .ics export | Not started |
| [W11](web/W11-open-data.md) | Open data: documented formats, export, import, Toggl and Clockify | Not started |
| [W12](web/W12-open-source.md) | Present Zenith as open source (MIT, chosen 9 October 2026) | Done for the licence and copy; the open-data promise waits for W11 |

## Pop-up (`work-orders/popup`)

| ID | Work | State |
| --- | --- | --- |
| [P01](popup/P01-tauri-pivot.md) | Move the pop-up from Electron to Tauri 2 | In progress (one app or two: open for the owner) |
| [P02](popup/P02-reminders-and-notifications.md) | Reminders and native notifications | Not started |
| [P03](popup/P03-packaging.md) | Installers, signing, and updates | Not started |
| [P04](popup/P04-portfolio-captures.md) | Real captures for the portfolio and README | Not started |
| [P05](popup/P05-desktop-pet.md) | An opt-in desktop pet in the pop-up | Not started |

## Sync (`work-orders/sync`)

Cross-device sync works device to device on the local network, like Syncthing and LocalSend, with no accounts or server. The design is in [`docs/SYNC.md`](../docs/SYNC.md).

| ID | Work | State |
| --- | --- | --- |
| [S01](sync/S01-design.md) | Design the sync, and settle its open questions | In progress |
| [S02](sync/S02-engine-skeleton.md) | The engine crate: identity and the update store | Done (merged; 8 offline tests rechecked) |
| [S03](sync/S03-data-model-and-merge.md) | The data model and the merge library (Automerge or Yjs, by measurement) | In progress (Automerge chosen; spike verified; deployed export/lifecycle open) |
| [S04](sync/S04-discovery-and-pairing.md) | Discovery, pairing and attempt limits | Done for library (merged; 22 localhost tests; real-network checks deferred to S07) |
| [S05](sync/S05-transport-and-protocol.md) | Transport and the sync protocol | In progress (localhost transport verified; 36 tests; production validator open; Git/note-path writes denied) |
| [S06](sync/S06-devices-screen.md) | The Devices screen and sync status | Not started |
| [S07](sync/S07-cross-device-testing.md) | Testing on real devices and bad networks | Not started |
| [S08](sync/S08-web-and-mobile-reach.md) | Phones and browsers (later) | Not started |
| [S09](sync/S09-optional-relay.md) | An optional relay for different networks (later, only if wanted) | Not started |

## Platform (`work-orders/platform`)

Re-scoped on 7 October 2026 around the embedded sync engine. The hosted-API pieces return only if a relay is built (S09) or the owner wants them as a showpiece.

| ID | Work | State |
| --- | --- | --- |
| [X01](platform/X01-api.md) | A sync API with accounts | Superseded by the sync engine (S01 to S09) |
| [X02](platform/X02-rate-limiting.md) | Rate limiting | Re-scoped to pairing and connection limits (S04, S05) |
| [X03](platform/X03-observability.md) | Metrics, traces, logs, and Grafana dashboards | Re-scoped to in-app diagnostics (S06) |
| [X04](platform/X04-admin-dashboard.md) | An admin dashboard | Re-scoped to the Devices screen (S06) |
| [X05](platform/X05-ci-and-release.md) | CI and release | Not started (re-scoped to the apps and crates) |

## Rules of thumb

- Local-first stays the default. Anything that sends data off the device is optional, labelled, and off until the person turns it on.
- No work order is "done" because it builds. Record the check that was run and what it showed.
- Reuse infrastructure patterns freely; write new code for new code. Nothing is copied in from another project without checking who owns it and what licence applies.
