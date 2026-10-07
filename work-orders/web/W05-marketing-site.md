# W05 — The marketing site

State: Not started

## Goal

A public site that explains Zenith in a minute and sends people to the app, built as `apps/marketing` in the same monorepo, with React and the same design language as the app.

## Scope

- Pages: a home page (what it is, who it is for, a short product tour), features, privacy ("your data stays on your devices; sync is device to device"), a download page that is honest about which platforms exist, and a roadmap.
- The app's look: one quiet black canvas, the gold accent, the same fonts. Real captures of the app once they exist (P04); until then, no screenshots rather than invented ones.
- Fast and plain: static output, no tracking, no cookie banner needed because nothing is collected, accessible, and good on a phone.
- A link to open the web app, and later to the desktop installers (P03).

## Out of scope

Accounts, a blog, and any claim about sync until S04 and S05 work.

## Done when

- `npm run build -w @zenith/marketing` passes and the site is deployed from the monorepo. (Record the URL.)
- Every claim on the site is something the app does today; the roadmap says what is not built.
