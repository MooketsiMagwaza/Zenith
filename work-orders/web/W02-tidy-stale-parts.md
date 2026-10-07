# W02 — Remove the stale and unused parts

State: Not started

## Goal

The repository says only what is true. Auth and sync were removed from the app in an earlier commit, but pieces remain.

## Scope

- Delete the "Accounts & cross-device sync" chapter and the matching table-of-contents entry from `apps/web/README.md`, and fix the "no env vars" and storage-key lists so they match the code.
- Delete `apps/web/src/integrations/supabase/` and `apps/web/supabase/`, which no source file imports, and remove `@supabase/supabase-js` and `@lovable.dev/cloud-auth-js` from the dependencies if nothing else uses them.
- Check `apps/web/src/integrations/lovable/` and `.lovable/` the same way, and remove them if unused. (The owner is making a new Lovable link, so the old one no longer matters.)
- Remove `@cloudflare/vite-plugin` if the build does not use it.
- Replace the "Desktop (Electron-ready)" section of `apps/web/README.md` and its table-of-contents entry with a short pointer to the Tauri pop-up in `apps/popup`.
- Note in the commit how much a fresh `npm install` shrinks once the unused packages are gone; with them, resolving the tree from a cold cache took more than twenty minutes on 7 October 2026.

## Done when

- `npm run build` still passes and the app behaves the same in a browser.
- A search of the repository for `supabase` and `lovable` finds only this file, or nothing.
