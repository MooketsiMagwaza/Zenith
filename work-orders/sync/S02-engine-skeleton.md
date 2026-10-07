# S02 — The engine crate: identity and the update store

State: Not started

## Goal

A Rust library, `crates/zenith-sync`, with a stable interface, a device identity, and a local store of changes, tested without any network.

## Scope

- A Cargo workspace at the repository root that lists `crates/*` and the Tauri shells under `apps/*/src-tauri`.
- Device identity: key pair and self-signed certificate created on first run, stored in the app's data directory, with the device ID derived from the public key.
- The update store: an append-only log of opaque change blobs in SQLite, with a cursor for each peer saying what it has seen.
- The public interface: list peers, start and finish pairing, revoke a peer, push a local change, subscribe to remote changes, report status. Documented in the crate.
- Tests for the store (ordering, de-duplication, cursors) and for the identity (stable across restarts).

## Done when

- `cargo test -p zenith-sync` passes in CI.
- The interface is the one S04 to S06 build on, and a change to it needs a work-order note.
