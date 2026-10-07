# S08 — Phones and browsers (later)

State: Not started (after S07)

## Goal

Reach devices that cannot run the desktop engine.

## Options to evaluate

- **A local web page.** The desktop app serves the web interface on the local network, as LocalSend does, so a phone's browser can open it, with the pairing step protecting it. Open question: self-signed certificates and browser warnings.
- **Tauri 2 mobile.** iOS and Android builds of the app. iOS needs the local network permission and a Bonjour declaration; both platforms restrict background work, so syncing may only happen while the app is open.
- **Neither.** Keep the web build local only.

## Done when

- A written recommendation with what was tried, what each option costs, and the one chosen.
