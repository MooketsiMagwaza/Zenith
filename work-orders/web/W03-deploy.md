# W03 — Deploy the web app and keep the build green

State: Not started

## Goal

The web app has a public address that updates on every merge, and a failing build or test blocks the merge.

## Scope

- `netlify.toml` at the repository root builds `@zenith/web` from the workspace and publishes `apps/web/dist`. It was updated for the monorepo layout; the site settings in Netlify still need checking by hand.
- A GitHub Actions workflow that installs once from the root, then lints, tests, and builds the web app, on every pull request.
- A short "deployment" note in the web README: how it is built, where it lives, how to roll back.

## Done when

- A merge to `main` produces a working site, and the workflow has been seen to fail on a deliberate break and pass again.
