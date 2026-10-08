# Zenith marketing site

The public site: home, features, privacy, download, roadmap and a 404 page. The pages are React components rendered to plain HTML at build time, so the built site has **no JavaScript**, no cookies and no tracking. Styles are Tailwind; DM Sans is bundled from `@fontsource/dm-sans`. It uses the app's look: the black canvas, the warm text colours, the gold accent and the ensō mark.

```bash
npm run dev:marketing     # from the repository root: a dev server with live rendering
npm run build:marketing   # type-check, build the stylesheet, render every page into dist/
```

## How the build works

1. `vite build` builds `index.html` as a template; it carries only the hashed stylesheet and the fonts.
2. `vite build --ssr src/render.tsx` builds the pages for Node.
3. `scripts/prerender.mjs` renders each page in `src/site.ts` into `dist/<page>/index.html` (and `dist/404.html`), and fails if the template ever contains a script.

The dev server is the only place a script runs (`src/dev.tsx`, injected by a plugin in `vite.config.ts`).

## Rules for the content

- Every claim must be true of the app today. What is not built goes on the roadmap page and nowhere else. Sync is described only there, as device to device on the local network with no account.
- Images are real captures of the app, never mock-ups. The four in `public/shots` were taken on 8 October 2026 from the app's production build at 1440 x 900, with invented sample data, by `scripts/capture-app.mjs` (headless Edge). Re-run it after the app's look changes.

## Settings

- `ZENITH_APP_URL` (build time): the web app's public address. When it is set, "Open the app" buttons link there; until then they point to the download page, which says the address is being set up.
- Deploying: see [`docs/DEPLOY.md`](../../docs/DEPLOY.md). `netlify.toml` here is for a Netlify site whose package directory is `apps/marketing`.
