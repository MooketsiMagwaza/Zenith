# Work orders

One file per piece of work, in a folder per area. A work order says what the goal is, what is in and out of scope, and what counts as done. States are honest: **Not started**, **In progress**, **Done** (with the evidence), or **Blocked** (with what it waits for).

Update a work order when scope, evidence, or state changes, in the same commit as the change.

## Web (`work-orders/web`)

| ID | Work | State |
| --- | --- | --- |
| [W01](web/W01-extract-core.md) | Extract the shared core into `packages/core` | Not started |
| [W02](web/W02-tidy-stale-parts.md) | Remove the stale accounts chapter, the unused Supabase code, and the leftover config | Not started |
| [W03](web/W03-deploy.md) | Deploy the web app and keep the build green in CI | Not started |

## Pop-up (`work-orders/popup`)

| ID | Work | State |
| --- | --- | --- |
| [P01](popup/P01-tauri-pivot.md) | Move the pop-up from Electron to Tauri 2 | In progress |
| [P02](popup/P02-reminders-and-notifications.md) | Reminders and native notifications | Not started |
| [P03](popup/P03-packaging.md) | Installers, signing, and updates | Not started |
| [P04](popup/P04-portfolio-captures.md) | Real captures for the portfolio and README | Not started |

## Platform (`work-orders/platform`)

| ID | Work | State |
| --- | --- | --- |
| [X01](platform/X01-api.md) | A sync API with accounts | Not started |
| [X02](platform/X02-rate-limiting.md) | Rate limiting | Not started |
| [X03](platform/X03-observability.md) | Metrics, traces, logs, and Grafana dashboards | Not started |
| [X04](platform/X04-admin-dashboard.md) | An admin dashboard | Not started |
| [X05](platform/X05-ci-and-release.md) | CI, container images, and release | Not started |

## Rules of thumb

- Local-first stays the default. Anything that sends data off the device is optional, labelled, and off until the person turns it on.
- No work order is "done" because it builds. Record the check that was run and what it showed.
- Reuse infrastructure patterns freely; write new code for new code. Nothing is copied in from another project without checking who owns it and what licence applies.
