# Zenith

**Time tracking with intention.** A deliberate-practice timer, a deck and card workspace, a markdown journal, reminders, and a full-screen Zen mode, on one quiet black canvas. Pick one card, run a session, write down what happened.

This repository is a monorepo:

| Path | What it is | State |
| --- | --- | --- |
| [`apps/app`](apps/app) (`@zenith/app`) | The full app: a client-only React single-page app that keeps everything on the device. Its [README](apps/app/README.md) is the full product specification. It is becoming a React app that runs in a browser and as a Tauri desktop app ([W04](work-orders/web/W04-tauri-react-app.md)). | Working in the browser |
| `apps/marketing` | The marketing site. | Planned ([W05](work-orders/web/W05-marketing-site.md)) |
| [`apps/popup`](apps/popup) | The small pop-up: a frameless, always-on-top [Tauri 2](https://v2.tauri.app/) window with a global shortcut, for starting and stopping sessions without opening the full app. It replaces the earlier Electron prototype (`zenith-agent`). | Being built; see [work orders](work-orders/popup) |
| [`packages/core`](packages) | Shared types, the session and reminder logic, and utilities used by both apps. | Planned; see [work orders](work-orders/web) |
| `crates/zenith-sync` | The sync engine: your devices find each other on the local network and keep one set of data in step, like Syncthing and LocalSend, with no account or server. See [the design](docs/SYNC.md). | Designed; see [work orders](work-orders/sync) |

## Work orders

Every piece of planned work has a work order in [`work-orders/`](work-orders/README.md), one folder per area (`web`, `popup`, `sync`, `platform`). Each states the goal, what is in and out of scope, and what counts as done, and each is marked honestly: not started, in progress, or done with the evidence.

## Running it

```sh
npm install        # once, from the repository root
npm run dev        # the app in a browser (same as dev:app)
npm run build      # a production build of the app for the web
```

The pop-up needs the Rust toolchain and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/):

```sh
npm run tauri:popup -- dev
```

## Privacy

Everything is stored on your device. There is no account, no server, and no analytics. The planned device-to-device sync stays on your local network and is off until you turn it on.

## Licence

All rights reserved. No licence is granted to use, copy, modify, or distribute this code.
