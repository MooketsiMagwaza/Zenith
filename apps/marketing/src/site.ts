/** Site-wide settings and the list of pages. Everything here is read at build time. */

const env = typeof process !== "undefined" ? process.env : {};

/**
 * The public address of the web app. Set ZENITH_APP_URL in the site's build settings once the app
 * is deployed (see docs/DEPLOY.md). Until then, "Open the app" points to the download page,
 * which says how to run it.
 */
export const APP_URL: string | null = env.ZENITH_APP_URL?.trim() || null;

export const REPO_URL = "https://github.com/MooketsiMagwaza/Zenith";

export type PageId = "home" | "features" | "privacy" | "download" | "roadmap" | "404";

export type PageMeta = {
  id: PageId;
  path: string;
  title: string;
  description: string;
  nav?: string;
};

export const PAGES: PageMeta[] = [
  {
    id: "home",
    path: "/",
    title: "Zenith — Time tracking with intention",
    description:
      "A deliberate-practice timer with decks of work, a markdown journal, reminders and a full-screen Zen mode. No account, and your data stays on your device.",
  },
  {
    id: "features",
    path: "/features/",
    nav: "Features",
    title: "Features — Zenith",
    description:
      "Decks and cards, stopwatch and countdown sessions, a journal for every card, a history of every session, reminders, Focus and Zen.",
  },
  {
    id: "privacy",
    path: "/privacy/",
    nav: "Privacy",
    title: "Privacy — Zenith",
    description:
      "Zenith keeps your data on your device. No account, no server, no analytics, and no cookies on this site.",
  },
  {
    id: "download",
    path: "/download/",
    nav: "Download",
    title: "Download — Zenith",
    description:
      "Zenith runs in your browser today. The desktop app and the pop-up are in development, and there are no installers yet.",
  },
  {
    id: "roadmap",
    path: "/roadmap/",
    nav: "Roadmap",
    title: "Roadmap — Zenith",
    description:
      "What is built, what is in progress, and what comes next, including sync between your own devices over the local network.",
  },
  {
    id: "404",
    path: "/404",
    title: "Page not found — Zenith",
    description: "This page does not exist.",
  },
];

export const pageFor = (path: string): PageMeta => {
  const clean = path.endsWith("/") ? path : `${path}/`;
  return PAGES.find((p) => p.path === clean || p.path === path) ?? PAGES[PAGES.length - 1];
};
