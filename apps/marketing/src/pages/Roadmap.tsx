import { Container, PageHeader, Rule, Section, Status } from "../components/ui";

type Item = { title: string; body: string };
type Stage = {
  id: string;
  eyebrow: string;
  title: string;
  tone: "ready" | "building" | "planned" | "none";
  label: string;
  items: Item[];
};

const stages: Stage[] = [
  {
    id: "built",
    eyebrow: "Built",
    title: "Working today, in the browser.",
    tone: "ready",
    label: "Done",
    items: [
      { title: "The full app", body: "Decks and cards, sessions, history, journals, reminders, Focus and Zen." },
      { title: "Installable", body: "Add it to a home screen or install it from the browser." },
      { title: "This site", body: "Plain pages with no scripts, no cookies and no tracking." },
    ],
  },
  {
    id: "now",
    eyebrow: "In progress",
    title: "Being built now.",
    tone: "building",
    label: "In progress",
    items: [
      {
        title: "The desktop app",
        body: "The full app in its own window on Windows, macOS and Linux, built with Tauri. It compiles; it still has to be run and tested on real machines.",
      },
      {
        title: "The pop-up",
        body: "A small always-on-top timer with keyboard shortcuts and a tray icon, moved from an earlier Electron prototype to Tauri. It compiles; it has not been tested as a native window yet.",
      },
      {
        title: "One app or two",
        body: "Whether the pop-up becomes a second window of the desktop app or stays separate is still to be decided.",
      },
    ],
  },
  {
    id: "next",
    eyebrow: "Next",
    title: "After that.",
    tone: "planned",
    label: "Planned",
    items: [
      {
        title: "Installers",
        body: "Signed installers for Windows, macOS and Linux, with automatic updates.",
      },
      {
        title: "Native reminders",
        body: "Reminders delivered as system notifications by the desktop apps.",
      },
      {
        title: "One shared core",
        body: "The rules for decks, sessions, journals and reminders in one tested package that every surface uses.",
      },
    ],
  },
  {
    id: "later",
    eyebrow: "Later",
    title: "Sync between your own devices.",
    tone: "planned",
    label: "Designed, not built",
    items: [
      {
        title: "Device to device",
        body: "Your devices find each other on your local network and keep one set of decks, sessions and journals in step. No account, no server, no internet needed.",
      },
      {
        title: "Paired by you",
        body: "You approve each device once with a short code. Connections are encrypted, and a stranger on the same Wi-Fi cannot read or join them.",
      },
      {
        title: "Edits that merge",
        body: "Changes made while devices were apart come together when they meet again, including two edits to the same journal.",
      },
      {
        title: "Off until you turn it on",
        body: "Without sync, every device keeps working on its own, exactly as it does today.",
      },
      {
        title: "Phones and browsers",
        body: "The first version is for desktop devices on one network. Phones and browsers come after that.",
      },
    ],
  },
];

export function Roadmap() {
  return (
    <>
      <PageHeader eyebrow="Roadmap" title="What is built, and what comes next.">
        <p>
          Nothing below the first section exists yet, and none of it has a date. Each piece moves up when it works and
          has been tested, not before.
        </p>
      </PageHeader>

      {stages.map((s, i) => (
        <div key={s.id}>
          {i > 0 ? <Rule /> : null}
          <Section id={s.id} eyebrow={s.eyebrow} title={s.title}>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((it) => (
                <li key={it.title} className="card-soft flex flex-col gap-3 p-6 sm:p-7">
                  <Status tone={s.tone}>{s.label}</Status>
                  <h3 className="text-lg font-normal text-fg">{it.title}</h3>
                  <p className="text-[15px] leading-relaxed font-light text-ink">{it.body}</p>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      ))}

      <Container className="pb-16">
        <p className="text-sm text-muted">Last updated on 8 October 2026.</p>
      </Container>
    </>
  );
}
