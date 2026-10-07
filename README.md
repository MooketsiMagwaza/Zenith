# Zenith

**Time tracking with intention.** A deliberate-practice timer, a deck and card workspace, a markdown journal, reminders, and a full-screen Zen mode, on one quiet black canvas. Pick one card, run a session, write down what happened.

This repository is a monorepo:

| Path | What it is | State |
| --- | --- | --- |
| [`apps/web`](apps/web) | The basic app: a client-only React single-page app that keeps everything in the browser. Its [README](apps/web/README.md) is the full product specification. | Working |
| [`apps/popup`](apps/popup) | The small pop-up: a frameless, always-on-top [Tauri 2](https://v2.tauri.app/) window with a global shortcut, for starting and stopping sessions without opening the full app. It replaces the earlier Electron prototype (`zenith-agent`). | Being built; see [work orders](work-orders/popup) |
| [`packages/core`](packages) | Shared types, the session and reminder logic, and utilities used by both apps. | Planned; see [work orders](work-orders/web) |
| `apps/api`, `apps/admin`, `ops/` | A sync API with rate limiting, an admin dashboard, and the observability stack (Prometheus, Grafana, Tempo). | Planned; see [work orders](work-orders/platform) |

## Work orders

Every piece of planned work has a work order in [`work-orders/`](work-orders/README.md), one folder per area (`web`, `popup`, `platform`). Each states the goal, what is in and out of scope, and what counts as done, and each is marked honestly: not started, in progress, or done with the evidence.

## Running it

```sh
npm install        # once, from the repository root
npm run dev        # the web app
npm run build      # a production build of the web app
```

The pop-up needs the Rust toolchain and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/):

```sh
npm run tauri:popup -- dev
```

## Privacy

Everything is stored on your device. There is no account, no server, and no analytics today. The planned sync API is optional and will say so wherever it is offered.

## Licence

All rights reserved. No licence is granted to use, copy, modify, or distribute this code.
