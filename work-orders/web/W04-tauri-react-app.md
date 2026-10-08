# W04 — One React app, as a web interface and as a Tauri desktop app

State: Not started

## Why

The owner wants Zenith to be a Tauri-based React app with three surfaces: the full app on the desktop, the same app in a browser, and a marketing site. The small pop-up stays. Today the full app is a browser-only app in `apps/web`, and the desktop shell exists only for the pop-up.

## Scope

- Rename `apps/web` to `apps/app` and the package to `@zenith/app`, and update the scripts, the Netlify settings, and every link in the READMEs and work orders.
- Add `apps/app/src-tauri`, a Tauri 2 shell around the same React build, with a normal resizable window and the tray and shortcuts the app needs. The app detects whether it runs in a browser or in Tauri and uses the right storage and window calls, behind one small interface.
- A Cargo workspace at the repository root (`apps/*/src-tauri` and `crates/*`) so the apps and the sync engine share one lockfile and one build cache.
- Keep the browser build deployable: it must still work as a client-only app.
- Decide, with the owner, whether the pop-up becomes a second window of this app (recommended in `docs/SYNC.md`, because both need one store and one engine) or stays a separate app. Record the answer in P01.

## Out of scope

The marketing site (W05), shared core extraction (W01), and sync (S02 to S06).

## Done when

- `npm run build -w @zenith/app` passes, and `cargo check` passes for the desktop shell.
- The desktop shell opens the app and keeps its data across a restart. (Needs a person to run it on Windows; record the result.)
- The old `apps/web` path and the `@zenith/web` name appear nowhere.
