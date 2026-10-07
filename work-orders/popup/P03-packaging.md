# P03 — Installers, signing, and updates

State: Not started

## Goal

Someone can download an installer, run it without a security warning they cannot explain, and receive updates.

## Scope

- `tauri build` produces a Windows installer, and a macOS and Linux build in CI.
- Code signing: a certificate is a purchase and a legal identity, so this waits on the company existing (see Tsela's `docs/COMPANY_STRUCTURE.md`). Until then, unsigned builds say so on the download page.
- Auto-update through the Tauri updater, with a signed update manifest.
- A "launch at login" option, off by default.

## Done when

- A clean Windows machine installs, runs, and updates the app. (Needs a second machine or a clean VM.)
