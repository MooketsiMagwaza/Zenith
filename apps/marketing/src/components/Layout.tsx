import type { ReactNode } from "react";
import { PAGES, REPO_URL, type PageMeta } from "../site";
import { Container, OpenAppButton } from "./ui";

function Wordmark() {
  return (
    <a href="/" className="flex items-center gap-3 rounded-md" aria-label="Zenith, home">
      <img src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 invert" />
      <span className="text-2xl leading-none font-light">
        Zen<span className="italic">ith</span>
      </span>
    </a>
  );
}

function Nav({ current }: { current: PageMeta }) {
  const items = PAGES.filter((p) => p.nav);
  return (
    <nav aria-label="Main">
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1 sm:gap-x-2">
        {items.map((p) => {
          const active = p.id === current.id;
          return (
            <li key={p.id}>
              <a
                href={p.path}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm transition-colors ${
                  active ? "text-gold" : "text-ink hover:text-fg"
                }`}
              >
                {p.nav}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Layout({ page, children }: { page: PageMeta; children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-gold px-4 py-2 text-black focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="border-b border-line/80">
        <Container className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <Wordmark />
            <div className="sm:hidden">
              <OpenAppButton variant="quiet" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Nav current={page} />
            <div className="hidden sm:block">
              <OpenAppButton />
            </div>
          </div>
        </Container>
      </div>
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <footer className="mt-8 border-t border-line/80">
        <Container className="grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-sm text-sm leading-relaxed font-light text-ink">
              Time tracking with intention. Pick one thing, put the time in, write down what happened.
            </p>
          </div>
          <div>
            <p className="micro-caps">Zenith</p>
            <ul className="mt-4 space-y-2 text-sm">
              {PAGES.filter((p) => p.nav).map((p) => (
                <li key={p.id}>
                  <a href={p.path} className="text-ink hover:text-fg">
                    {p.nav}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="micro-caps">This site</p>
            <ul className="mt-4 space-y-2 text-sm font-light text-ink">
              <li>No cookies, no analytics, no trackers.</li>
              <li>No scripts: every page is plain HTML and CSS.</li>
              <li>
                <a href={REPO_URL} className="hover:text-fg">
                  Source on GitHub
                </a>
              </li>
            </ul>
          </div>
        </Container>
        <Container className="pb-10">
          <p className="text-xs text-muted">© 2026 Zenith. All rights reserved.</p>
        </Container>
      </footer>
    </>
  );
}
