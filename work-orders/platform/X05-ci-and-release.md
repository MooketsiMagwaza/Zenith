# X05 — CI, container images, and release

State: Not started

## Goal

Every change is tested the same way, and a release is one tag away.

## Scope

- GitHub Actions for the whole monorepo: install once, then lint, test, and build each workspace that changed, plus the Python tests and a `cargo check` for the pop-up.
- Container images for the API and the admin app, with a non-root user, a read-only filesystem, health checks, and a vulnerability scan that fails the build on high severity.
- A release workflow: a version tag builds the images, the web bundle, and the pop-up installers (P03), and writes release notes.
- Dependency updates grouped monthly.

## Done when

- A pull request with a deliberate failure is blocked, and a tag produces every artefact. (Run and recorded.)
