# P01 — Move the pop-up from Electron to Tauri 2

State: In progress (the Tauri app and its port of the Electron prototype's behaviour are in this branch; it has not been run as a native window yet)

## Why

The Electron prototype (`zenith-agent`) ships a whole Chromium for a small floating timer, and Electron's binary download is a recurring setup problem. Tauri 2 uses the system webview and a small Rust shell, which suits a window that sits in the corner all day. The owner decided on 7 October 2026 to pivot.

## What the prototype did, and where each part goes

| Electron prototype | Tauri 2 version |
| --- | --- |
| One frameless, transparent, always-on-top 424 x 624 window | The same window in `tauri.conf.json` (`decorations: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `resizable: false`) |
| A main-process store with commands (immer) and a JSON file | The same command reducer, in TypeScript, persisted with `@tauri-apps/plugin-store` |
| `Alt+Space` shows or hides; `Alt+F` opens Focus; `Alt+Z` opens Zen | `tauri-plugin-global-shortcut`, registered in Rust, emitting events to the window |
| Minimise to a floating ball | A `toggle_minimize` Rust command that resizes the window around its centre and remembers where it was |
| Reminders polled in the main process every 15 s | The same check, in the page (`src/bridge/store.ts`); the native notification is sent through `tauri-plugin-notification`, and P02 covers the rest |
| Close hides instead of quitting | Close is intercepted in Rust and hides the window; the tray menu quits (the prototype had no tray, so there was no way to quit) |
| `window.api` over IPC | `window.api` is installed by `src/bridge`, so the views did not change |

## Changes from the prototype

- Deleting a card removed every deck reminder, because the filter kept only task reminders. It now removes only that card's reminders.
- The reminder check rewrote the state file every 15 seconds even when nothing was due. It now writes only when a reminder fires.
- DM Sans is bundled instead of loaded from Google Fonts. The only requests the pop-up can still make are the Zen wallpapers, which are optional images; the content security policy allows images from `https:` for that reason.

## Scope

- `apps/popup`: React and Vite frontend; `src-tauri`: the Rust shell, capabilities, and icons.
- The prototype's views (decks, focus, journal, history, search, Zen) ported with their behaviour.
- Remove the unused leftovers from the prototype instead of porting them (three renderer entry points that nothing loads, and a patch script).

## Out of scope

Packaging and signing (P03); sharing code with the web app (W01); sync (X01).

## Done when

- `cargo check` and `npm run build -w @zenith/popup` pass. **Done on 7 October 2026:** `npm run build -w @zenith/popup` (type-check and Vite build) passed, and `cargo check` finished with no errors or warnings on Rust 1.97 with the MSVC toolchain. On Windows the linker needs a short target directory when the checkout is deeply nested (`CARGO_TARGET_DIR=C:/zt/popup`).
- The window opens frameless, transparent, and on top; the shortcut toggles it; a session survives a restart. (Needs a person to run it on Windows; nothing has verified this yet.)

## Open question for the owner: one app or two

Still open on 8 October 2026; not decided by anyone yet.

Since W04 the full app has its own Tauri shell (`apps/app/src-tauri`, identifier `app.zenith.desktop`), next to this pop-up (`app.zenith.popup`). So there are now two desktop apps, each with its own data file: the app keeps `zenith.json`, the pop-up keeps `zenith-popup.json`, and nothing connects them.

- **One app, two windows.** The pop-up becomes a second window (frameless, on top, with its shortcuts and tray) of the full app. One process, one store, one sync engine later, and starting a session in either window shows in both. It needs the pop-up's views to read the app's data model (which is W01's shared core) and one combined set of capabilities. `docs/SYNC.md` recommends this.
- **Two apps.** They stay separate, can be installed and updated apart, and each stays small. They need a way to share data (a common file with locking, or the sync engine syncing between two apps on one machine), or they stay unaware of each other.

The answer decides whether the full app gets a tray icon and the global shortcuts, and how P03 packages the installers. Record the decision and its date here.
