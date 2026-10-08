import { Container, PageHeader, Rule, Section } from "../components/ui";

const stored = [
  ["Decks and cards", "Names, colours, tags, checklists, timer settings and total time"],
  ["Sessions", "Which card, which deck, when it started and how long it ran"],
  ["Journals", "The markdown you write for each card and deck"],
  ["Reminders", "What each one points to, when it fires, and how it repeats"],
  ["Preferences", "Your quote pack, your own quotes and wallpapers, and whether you have seen the tour"],
];

const requests = [
  ["The app's own files", "From the address that serves Zenith, like any web page."],
  [
    "Zen wallpapers",
    "The photographs and curated art in Zen mode are loaded from their image hosts (Unsplash, and Medium for one piece) when Zen mode shows them. The pastel and gradient wallpapers load nothing.",
  ],
  ["Wallpapers you add by link", "Loaded from the address you gave."],
];

export function Privacy() {
  return (
    <>
      <PageHeader eyebrow="Privacy" title="Your data stays on your device.">
        <p>
          No account, no server that holds your data, no analytics, no advertising. This page says exactly what
          Zenith keeps, where it keeps it, and the few things it fetches.
        </p>
      </PageHeader>

      <Section
        id="stored"
        eyebrow="What is stored"
        title="Everything you make, and nothing about you."
        intro={
          <p>
            In the browser, Zenith saves to the browser's own storage for this site, on the device you are using.
            It is never uploaded. Another browser or another device starts empty. Clearing this site's data in your
            browser deletes it, so there is no copy anywhere else to recover.
          </p>
        }
      >
        <div className="card-soft overflow-hidden">
          <table className="w-full text-left text-[15px]">
            <caption className="sr-only">What Zenith stores on your device</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="micro-caps px-5 py-4 font-normal sm:px-7">
                  Kind
                </th>
                <th scope="col" className="micro-caps px-5 py-4 font-normal sm:px-7">
                  What it holds
                </th>
              </tr>
            </thead>
            <tbody>
              {stored.map(([k, v]) => (
                <tr key={k} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-4 align-top font-normal text-fg sm:px-7">
                    {k}
                  </th>
                  <td className="px-5 py-4 font-light text-ink sm:px-7">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Rule />

      <Section
        id="network"
        eyebrow="What it fetches"
        title="Three kinds of request, and none of them carry your data."
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          {requests.map(([k, v]) => (
            <div key={k} className="card-soft p-6">
              <dt className="text-fg">{k}</dt>
              <dd className="mt-3 text-[15px] leading-relaxed font-light text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 max-w-2xl text-[15px] leading-relaxed font-light text-ink">
          Reminders use your system's notifications only if you allow them, and the chime is made on your device.
          The font is part of the app, so no font service sees your visit.
        </p>
      </Section>

      <Rule />

      <Section
        id="sync"
        eyebrow="Sync"
        title="Not built yet. When it comes, it stays between your devices."
        intro={
          <>
            <p>
              Today each device keeps its own data and nothing moves between them. The plan is sync that works device
              to device on your local network, the way Syncthing and LocalSend do: you pair your own devices once,
              they talk over an encrypted connection, and there is no account and no server in between.
            </p>
            <p className="mt-4">
              It will be off until you turn it on. Until it works and has been tested, it is only on the{" "}
              <a href="/roadmap/" className="text-gold underline">
                roadmap
              </a>
              .
            </p>
          </>
        }
      />

      <Rule />

      <Section
        id="site"
        eyebrow="This website"
        title="No cookies, no analytics, no scripts."
        intro={
          <p>
            These pages are plain HTML and CSS. They set no cookies, run no JavaScript, and contain no analytics or
            tracking code, and the font is served from this site. The company that hosts the pages may keep the
            standard request logs every web server keeps (an address, a time, the page asked for); Zenith adds
            nothing to them and does not look at them.
          </p>
        }
      />

      <Container className="pb-16">
        <p className="text-sm text-muted">Last reviewed on 8 October 2026, against the app as it is today.</p>
      </Container>
    </>
  );
}
