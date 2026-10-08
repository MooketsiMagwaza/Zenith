# W01 — Extract the shared core into `packages/core`

State: Not started

## Goal

The web app and the pop-up run the same rules for decks, cards, sessions, journals, and reminders, from one package, so a fix is made once.

## Scope

- Move the types, the session and reminder logic, the ids, and the quote packs out of `apps/web/src/lib/zen` into `packages/core`, with no React and no browser APIs inside it.
- Keep the web app's hooks as thin wrappers over the core, and keep its `localStorage` keys unchanged so nobody loses data.
- The pop-up (P01) already imports a copy of this logic; switch it to the package.
- Unit tests for the rules that have bitten before: deleting a deck removes its cards and journals with an undo handle; one journal per card or deck; a reminder fires once; a session shorter than a second is not logged.

## Out of scope

Changing how data is stored, or syncing it (see X01).

## Done when

- `packages/core` has tests that run in CI.
- The web app and the pop-up both import it, and the duplicated logic is gone.
- An existing browser's saved data loads unchanged. (Check it against a saved export from the current deployed build.)
