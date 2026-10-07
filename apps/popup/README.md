# Zenith pop-up

A small frameless window that stays on top of everything else: a timer for the thing you are working on, a journal, a history of sessions, search, and a Zen view. It is built with Tauri 2 (a Rust shell around the system webview) and React.

State is local. The window keeps one JSON file in the app's data folder through the Tauri store plugin, and nothing is sent anywhere. The only network requests are the optional Zen wallpapers.

## Run it

You need Node 20 or later and the Rust toolchain. On Windows that means the Visual Studio C++ build tools; Tauri's [prerequisites page](https://v2.tauri.app/start/prerequisites/) lists the rest for each system.

From the repository root:

```bash
npm install
npm run tauri:popup -- dev
```

`npm run dev:popup` runs only the page in a browser. It keeps its state in `localStorage` and the window calls (shrink to a ball, shortcuts) are stubbed, which is how the screenshots are taken.

## Keys

| Key | Does |
| --- | --- |
| `Alt+Space` | Show or hide the window |
| `Alt+F` | Open Focus |
| `Alt+Z` | Open Zen |

Double-click the handle at the top to shrink the window to a ball, and double-click the ball to bring it back. Closing the window hides it; the tray icon's menu has Quit.

## Layout

| Path | What it is |
| --- | --- |
| `src/views` | Decks, Focus, History, Home, Journal, Search, Zen |
| `src/bridge` | The state store and its commands, saving, and the window calls. It installs `window.api`, the surface the views use |
| `src/shared` | Types, constants, helpers, and the stylesheet |
| `src-tauri/src/lib.rs` | The window, tray, global shortcuts, and the shrink-to-ball command |
| `src-tauri/tauri.conf.json` | Window settings, content security policy, and bundle settings |
| `src-tauri/capabilities` | What the window is allowed to ask the shell to do |

Work orders for this app are in [`work-orders/popup`](../../work-orders/popup).
