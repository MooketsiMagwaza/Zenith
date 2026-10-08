# Deploying the web app and the marketing site

Two static sites come from this one repository, each as its own Netlify site:

| Site | Folder | Settings file | Builds | Publishes |
| --- | --- | --- | --- | --- |
| The web app | `apps/app` | `netlify.toml` at the root | `npm run build -w @zenith/app` | `apps/app/dist` |
| The marketing site | `apps/marketing` | `apps/marketing/netlify.toml` | `npm run build -w @zenith/marketing` | `apps/marketing/dist` |

Neither needs a server, a database or a secret. The only setting is `ZENITH_APP_URL` on the marketing site, which is the web app's public address.

These steps need your Netlify login, so only you can do them. Merge the open pull requests first, in order (the monorepo, then W02, W04 and W05), so `main` has both sites.

## 1. The web app

If a Netlify site for Zenith already exists, open it and go to step 3 to check its settings; otherwise:

1. In Netlify, choose **Add new project**, then **Import an existing project**, then **GitHub**, and pick `MooketsiMagwaza/Zenith`. Netlify asks for access to the repository the first time.
2. Branch to deploy: `main`. Leave **Base directory** and **Package directory** empty. Leave the build command and publish directory empty too; the root `netlify.toml` sets them.
3. In **Project configuration**, **Build & deploy**, **Build settings**, check that the base directory is empty and the publish directory is either empty or `apps/app/dist`. A site created before the monorepo may still say `dist`; change it, because the app now builds into `apps/app/dist`.
4. Deploy. When it is live, open it and check that the app loads, that a deck you add is still there after a reload, and that **View page source** shows no badge or script from the old code generator (the last check left in W02).
5. Optionally, under **Domain management**, rename the site (for example `zenith-app.netlify.app`) or add your own domain. Write the address down; the marketing site needs it.

## 2. The marketing site

1. Choose **Add new project**, **Import an existing project**, **GitHub**, and the same repository again. This creates a second site.
2. Branch: `main`. Leave **Base directory** empty. Set **Package directory** to `apps/marketing` (this field exists only in the UI; it tells Netlify to read `apps/marketing/netlify.toml`). Leave the build command and publish directory empty; that file sets them.
3. Before or after the first deploy, open **Project configuration**, **Environment variables**, and add `ZENITH_APP_URL` with the web app's address from step 1.5, including `https://`. Then open **Deploys** and choose **Trigger deploy**, **Clear cache and deploy site**, because the address is read when the site is built.
4. Check the live site: every page opens (`/`, `/features/`, `/privacy/`, `/download/`, `/roadmap/`), a wrong address shows the 404 page, **Open the app** goes to the web app, and **View page source** shows no `<script>`.
5. Optionally rename it or add a domain, as in step 1.5.

Without `ZENITH_APP_URL`, the site still builds; its buttons say **Get Zenith** and lead to the download page, which says the app's address is being set up.

## 3. Afterwards

- Record both addresses in [W03](../work-orders/web/W03-deploy.md) and [W05](../work-orders/web/W05-marketing-site.md).
- Every merge to `main` redeploys both sites. Each site rebuilds even when only the other changed; under **Build & deploy**, **Ignore builds**, you can add `git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- apps/marketing` (for the marketing site) to skip builds that do not touch it.
- To roll back, open **Deploys**, pick an earlier deploy, and choose **Publish deploy**.

## Trying a build locally first

```bash
npm install
npm run build -w @zenith/app          # then serve apps/app/dist
ZENITH_APP_URL=https://example.netlify.app npm run build -w @zenith/marketing   # then serve apps/marketing/dist
```

Any static file server works for a look, for example `npx vite preview` inside either folder.
