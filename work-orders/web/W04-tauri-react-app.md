# W04 — One React app, as a web interface and as a Tauri desktop app

State: In progress (8 October 2026). The rename, the desktop shell and the browser-or-desktop interface are on branch `feat/tauri-app`, and both builds pass. Still open: a person must run the desktop window on Windows (below), the root Cargo workspace (another branch), and the owner's answer on the pop-up.

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

## What was done

- **Rename.** `git mv apps/web apps/app`, so history follows; the package is `@zenith/app`. Root scripts: `dev` and `dev:app` (browser), `build` and `build:app`, `tauri:app` (desktop), next to the pop-up's `dev:popup` and `tauri:popup`. `netlify.toml` builds `@zenith/app` and publishes `apps/app/dist`. The links in the READMEs and in W01, W02 and W03 follow.
- **One small interface.** `apps/app/src/lib/platform` is the only code that knows where the app runs (it checks for Tauri's `__TAURI_INTERNALS__`). It exports `storage` (`getItem`, `setItem`, `removeItem`) and `appWindow` (`isFullscreen`, `toggleFullscreen`, `onFullscreenChange`). Every `localStorage` call in the app now goes through `storage`, and the fullscreen button through `appWindow`.
  - Browser: `localStorage` and the Fullscreen API, as before. The Tauri packages are loaded with dynamic imports, so the browser never downloads or runs them.
  - Desktop: `zenith.json` in the app's data folder through the store plugin. It is read once before the first render (`src/main.tsx` waits for it), reads are served from memory so the hooks stay synchronous, and every write goes to the plugin, which writes the file 200 ms after the last change and again on exit. The keys and string values are the same as in the browser.
  - Notifications need no code: the notification plugin implements the Web `Notification` API in the shell. The reminder code now calls `close` only if it exists, because the plugin's notification objects have none.
- **The desktop shell** (`apps/app/src-tauri`), a standalone Cargo package with its own `Cargo.lock`, built on the same pattern as the pop-up's: identifier `app.zenith.desktop`; one ordinary resizable window (1280 x 820, at least 360 x 560, black background so there is no white flash); the store, notification and single-instance plugins (a second launch focuses the open window, so two processes never write one file); capabilities limited to the default core set, `set-fullscreen`, the store and notifications; and a content security policy that allows only the app's own scripts, styles, fonts and connections, plus images from `https:`, `data:` and `blob:` for the Zen wallpapers. The icons are the pop-up's.
- **No tray and no global shortcuts**, on purpose: closing the window quits, as people expect of a normal window, and a global shortcut here would clash with the pop-up's `Alt+Space`. Whether the app gets a tray depends on the pop-up question below.
- **Offline fonts.** DM Sans is bundled from `@fontsource/dm-sans` instead of loaded from Google Fonts, so the desktop window renders offline under its policy and the browser build makes no third-party request on load.
- **Type check.** The app's `build` now runs `tsc --noEmit` before `vite build`, as the pop-up's does. The one existing type error (the router's error component props) is fixed.
- The tutorial's first step says data lives "on your device" instead of "in your browser", since it is true of both surfaces now.

## Evidence (8 October 2026)

- `npm run build -w @zenith/app` passes: `tsc --noEmit` reports no errors and `vite build` finishes. The Tauri code lands in three small separate chunks that only the desktop loads.
- `cargo check` in `apps/app/src-tauri` passes with no warnings or errors (Rust 1.97.1, MSVC toolchain), with the default target directory; `tauri-build` validated the capability file.
- `npx tauri build --debug --no-bundle` in `apps/app` compiled and linked the desktop executable (`target/debug/zenith-app.exe`). It was not started.
- The browser build, served locally and opened in a Chromium browser: it rendered, seeded the two starter decks into `localStorage` under the usual keys, kept an edited deck name across a reload, did not reopen the tutorial after the first visit, loaded DM Sans from its own origin, and made no request to any other origin. The fullscreen button did nothing in that browser pane, and the build from before this change behaved the same there, so the pane blocks fullscreen; it was not checked in a normal browser window.
- `grep -rn "apps/web\|@zenith/web"` finds only this work order's own description of the rename.

## Not verified (needs a person on Windows)

- That `npm run tauri:app -- dev` opens the window, the app renders in it, and a deck added before quitting is there after a restart. Nobody has looked at the desktop window.
- That the fullscreen button makes the desktop window fullscreen and back.
- That a reminder shows a Windows notification, and its chime plays, in the desktop window.
- That a second launch focuses the first window.

## Still open

- **The root Cargo workspace.** Another branch creates it; this shell is a standalone package with its own `Cargo.lock` until then, and should join the workspace when that lands.
- **One app or two** (the pop-up as a second window of this app, or a separate app) is the owner's decision, recorded as open in P01.
- Moving data between the browser and the desktop app. Each keeps its own copy; nothing is copied between them.
