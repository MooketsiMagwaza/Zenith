import { Container, OpenAppButton, PageHeader, Rule, Section, Status } from "../components/ui";
import { APP_URL, REPO_URL } from "../site";

type Row = { platform: string; what: string; tone: "ready" | "building" | "planned" | "none"; state: string };

const rows: Row[] = [
  {
    platform: "Web browser",
    what: "The full app, in any current browser on a computer, tablet or phone. You can install it from the browser so it opens in its own window.",
    tone: "ready",
    state: "Available",
  },
  {
    platform: "Windows, macOS, Linux",
    what: "The same app in a desktop window, built with Tauri. It is written and it compiles, but it has not been tested on a real machine yet.",
    tone: "building",
    state: "In development, no installer",
  },
  {
    platform: "Pop-up for the desktop",
    what: "A small always-on-top timer you summon with a keyboard shortcut, for starting and stopping sessions without opening the full app.",
    tone: "building",
    state: "In development, no installer",
  },
  {
    platform: "iPhone, iPad, Android",
    what: "No separate app. The web app works in the phone's browser and can be added to the home screen.",
    tone: "none",
    state: "Use the web app",
  },
];

export function Download() {
  return (
    <>
      <PageHeader eyebrow="Download" title="Zenith runs in your browser today.">
        <p>
          There are no installers yet. The desktop app and the pop-up are being built, and this page will link to
          them when they have been tested and signed. Until then, here is exactly what exists.
        </p>
        <div className="mt-8">
          <OpenAppButton />
        </div>
      </PageHeader>

      <Section id="platforms" eyebrow="Platforms" title="What exists, platform by platform.">
        <ul className="grid gap-4">
          {rows.map((r) => (
            <li
              key={r.platform}
              className="card-soft grid gap-3 p-6 sm:grid-cols-[14rem_1fr_14rem] sm:items-start sm:gap-8 sm:p-7"
            >
              <h3 className="text-lg font-normal text-fg">{r.platform}</h3>
              <p className="text-[15px] leading-relaxed font-light text-ink">{r.what}</p>
              <p className="sm:text-right">
                <Status tone={r.tone}>{r.state}</Status>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Rule />

      <Section
        id="web"
        eyebrow="The web app"
        title={APP_URL ? "Open it, and it is ready." : "Nothing to sign up for, nothing to install."}
        intro={
          APP_URL ? (
            <p>
              Go to{" "}
              <a href={APP_URL} className="text-gold underline">
                {APP_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
              . There is nothing to sign up for. To give it its own window, use your browser's install option: the
              install icon in the address bar in Chrome or Edge on a computer, Install app in the menu on Android, or
              Share and then Add to Home Screen in Safari on an iPhone.
            </p>
          ) : (
            <p>
              The web app's public address is being set up. Until it is published, you can run it on your own
              computer from the source code, as described below. There is nothing to sign up for either way.
            </p>
          )
        }
      />

      <Rule />

      <Section
        id="source"
        eyebrow="From source"
        title="Run it yourself."
        intro={
          <p>
            The code is public on{" "}
            <a href={REPO_URL} className="text-gold underline">
              GitHub
            </a>{" "}
            so you can read it and run it on your own machine. It is not open source: all rights are reserved and no
            licence is granted to reuse it. You need Node.js 20 or later; the desktop window also needs Rust and the
            Tauri prerequisites.
          </p>
        }
      >
        <div className="card-soft overflow-x-auto p-6 sm:p-7">
          <pre className="font-mono text-sm leading-7 text-ink">
            <code>
              {[
                "npm install                 # once, from the repository root",
                "npm run dev                 # the app in your browser",
                "npm run tauri:app -- dev    # the app in a desktop window",
              ].join("\n")}
            </code>
          </pre>
        </div>
      </Section>

      <Container className="pb-16">
        <p className="text-sm text-muted">
          Signed installers with automatic updates are on the{" "}
          <a href="/roadmap/" className="text-gold underline">
            roadmap
          </a>
          .
        </p>
      </Container>
    </>
  );
}
