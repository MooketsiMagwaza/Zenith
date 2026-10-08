# S02 — The engine crate: identity and the update store

State: Done (merged in f77ff76; standalone clone baseline rechecked, 8 October 2026; CI not independently verified)

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

## Evidence, 8 October 2026

- Added the root workspace with the specified globs and resolver 2; moved the popup lockfile to root. Release settings are copied to the workspace root; Cargo warns that the unchanged popup-local profile is ignored.
- `cargo test -p zenith-sync`: 8 integration tests passed, 0 failed; no unit/doc tests yet. Tested identity restart stability and distinct installs, corrupt identity and key/cert mismatch refusal, log ordering/de-duplication/restart, independent durable monotonic cursors, revocation, malformed envelopes, newer SQLite schemas, invalid certificates, and unpaired input/one remote notification per unique change.
- `cargo check -p zenith-popup`: passed as a workspace member on Rust 1.97.1 MSVC. No popup source was changed.
- `cargo fmt -p zenith-sync -- --check`: passed. `cargo clippy -p zenith-sync --all-targets -- -D warnings`: passed (same offline registry workaround). The pre-existing popup profile warning remains a Cargo manifest warning, not a crate lint.
- `cargo doc -p zenith-sync --no-deps`: passed, generated crate API documentation (same offline registry workaround). `git diff --check`: passed.
- These runs used `--config target/registry-config.toml --offline`: Cargo's sandboxed Schannel client failed with SEC_E_NO_CREDENTIALS. An uncommitted localhost proxy fetched index metadata and crate archives only from crates.io via Node, then Cargo verified the archives. This is an environment workaround, not a runtime dependency or committed machine configuration.
- Public interface documented in crate rustdoc and `docs/SYNC.md`. Pairing methods explicitly return unavailable until S04; direct pin/receive APIs are trusted-host boundaries, not network authentication.
- No CI, Windows ACL audit, crash/power-loss injection, network or multi-process ownership test was performed. Identities and test certificates are generated only in temporary test directories; no key/certificate fixture is committed.

## Historical Git blocker (resolved)

The checkout's `.git` points to `C:/Users/Nido/Desktop/Projects/Active/zenith/.git/worktrees/zenith-wt-sync`, outside the writable sandbox. `git add` and `git commit` failed creating `index.lock` (Permission denied); the subsequent branch switch failed creating `HEAD.lock`. The failed switch created an empty S03 branch at the original baseline; its reflog and equal tip were checked, and it was deleted without changing any commits. Nothing was committed or pushed. The checkout remains on `feat/sync-engine-skeleton`, with the implementation in its working tree. S03–S05 have not started: the requested commit-then-branch sequence cannot proceed. Resume in this same worktree with Git metadata write access; do not create another repository or rewrite history. The temporary crates.io proxy has been stopped.

The above describes the earlier checkout only. The owner supplied the standalone `zenith-codex-sync` clone on `feat/sync-merge-model`, based on the merged S02 commit f77ff76. `cargo test -p zenith-sync --offline` passed all 8 integration tests here on 8 October 2026 without registry overrides, proxies or network access. S03 proceeds in this clone.
