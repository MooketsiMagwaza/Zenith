# X05 — CI, container images, and release

State: Not started

## Goal

Every change is tested the same way, and a release is one tag away.

## Scope

- GitHub Actions for the whole monorepo: install once, then lint, test, and build each workspace that changed (the app, the marketing site, the pop-up), plus `cargo check` and `cargo test` for the Tauri shells and the sync engine. (Re-scoped on 7 October 2026; the Python tests apply only if a hosted API is ever built.)
- Container images, with a non-root user, a read-only filesystem, health checks, and a vulnerability scan that fails the build on high severity, only if a hosted relay or showpiece API is built (S09, X01 to X04).
- A release workflow: a version tag builds the web bundle, the marketing site, and the desktop installers (P03), and writes release notes.
- Dependency updates grouped monthly.

## Done when

- A pull request with a deliberate failure is blocked, and a tag produces every artefact. (Run and recorded.)
