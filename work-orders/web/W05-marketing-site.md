# W05 — The marketing site

State: In progress (8 October 2026). The site is built in `apps/marketing` on branch `feat/marketing-site` and its build passes; it is not deployed, because that needs the owner's Netlify login ([`docs/DEPLOY.md`](../../docs/DEPLOY.md)).

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

## What was done

- **`apps/marketing`** (`@zenith/marketing`): React and TypeScript pages, Vite, Tailwind 4. Pages: home (what it is, who it is for, the three movements, a tour of the journal, history and Zen), features, privacy, download, roadmap, and a 404.
- **Static, with no JavaScript.** The pages are rendered to HTML at build time (`vite build`, then `vite build --ssr src/render.tsx`, then `scripts/prerender.mjs`, which fails if the template ever gains a script). No cookies, no analytics, no third-party request: DM Sans is bundled from `@fontsource/dm-sans`. The Netlify headers add a content security policy that allows only the site's own styles, fonts and images.
- **The app's look:** the black canvas, the warm text colours, the gold `#c9a84c` accent and its dim partner, the soft cards and gold rule, micro-caps labels, DM Sans at light weights, and the ensō mark.
- **Real captures:** four 1440 x 900 captures of the app's production build (decks with a running session, a journal in split view, history, Zen), seeded with invented sample data and taken with headless Edge by `scripts/capture-app.mjs`. Each has a descriptive alt text. P04's captures for the portfolio and README are still separate work.
- **Honest content:** the download page lists the web app as available, the desktop app and the pop-up as in development with no installer, and phones as "use the web app". Sync appears only on the roadmap (and as "not built yet" on the privacy page), described as device to device on the local network with no account and no server. The privacy page names the requests the app does make: its own files, and the Zen photographs and curated art from their image hosts (Unsplash, and Medium for one piece) when Zen shows them.
- **The app link:** `ZENITH_APP_URL`, read at build time. Until it is set, the buttons say "Get Zenith" and lead to the download page.
- **Deploying:** `apps/marketing/netlify.toml` for a separate Netlify site with package directory `apps/marketing`, and [`docs/DEPLOY.md`](../../docs/DEPLOY.md) with the exact steps for both sites.
- Root scripts `dev:marketing` and `build:marketing`.

## Evidence (8 October 2026)

- `npm run build -w @zenith/marketing` passes: `tsc` reports no errors, and the six pages render into `dist` (`/`, `/features/`, `/privacy/`, `/download/`, `/roadmap/`, `404.html`).
- No built page has a `<script>`, an inline `style` attribute or an inline event handler; the only external address in the HTML is the link to the GitHub repository.
- Served locally and opened in a Chromium browser: no request left the site's origin, all five font faces loaded from the site, and every image loaded.
- Full-page captures in headless Edge at 1280 and 375 pixels wide: the layout holds, and at 375 nothing is wider than the screen (no sideways scrolling).
- With `ZENITH_APP_URL` set, the buttons link to that address; without it, to `/download/`.
- The dev server (`npm run dev:marketing`) renders the pages.

## Not verified

- The site is **not deployed**, so there is no URL to record yet; the steps are in `docs/DEPLOY.md`. The Netlify package-directory setup follows Netlify's monorepo documentation but has not been run.
- No screen reader or automated accessibility audit was run. The pages use landmarks, a skip link, one `h1` per page, labelled navigation, `aria-current` for the current page, table headers on the privacy table, visible focus rings, 44-pixel tap targets for the navigation and the buttons, and text colours chosen for at least 4.5:1 contrast on black; that is by construction, not by a tool.
- The privacy page's statement that the app's font is bundled is true from W04 on; the copy of the app deployed before W04 still loaded DM Sans from Google Fonts.
