# S06 — The Devices screen and sync status

State: Not started

## Goal

A person can pair, see, and remove devices, and can tell whether sync is working, from inside the app.

## Scope

- A Devices screen in the full app: this device's name and ID, the list of paired devices with last-seen and status, "Add a device" with the QR and code, and "Remove".
- A small sync indicator in both the full app and the pop-up: off, searching, syncing, up to date, or a problem with one plain sentence.
- A sync log panel (recent connections, errors, counts), which is the engine's diagnostics from X03 shown to the owner of the data.
- Sync is a setting. It is off until the person turns it on, and the screen says what leaves the device (changes, to paired devices on the same network only).

## Done when

- A first-time user can pair two devices from the screen alone. (Watched, not assumed.)
- Every state of the indicator has a screenshot, in light and dark.
