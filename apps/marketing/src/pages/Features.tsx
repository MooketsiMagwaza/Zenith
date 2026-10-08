import { Card, OpenAppButton, PageHeader, Rule, Section } from "../components/ui";

type Group = { id: string; eyebrow: string; title: string; items: { title: string; body: string }[] };

const groups: Group[] = [
  {
    id: "decks",
    eyebrow: "Decks and cards",
    title: "Your work, as decks of cards.",
    items: [
      {
        title: "Decks",
        body: "A deck is a project, with a name and a coloured dot. Start with two and add as many as you need.",
      },
      {
        title: "Cards",
        body: "A card is a piece of work you return to, with a tag, a running total of time, and an optional checklist.",
      },
      {
        title: "Stopwatch or countdown",
        body: "Each card counts up or down. The choice is fixed once made, so a card's totals always mean one thing.",
      },
      {
        title: "Undo",
        body: "Deleting a deck takes its cards and journals with it, and one press of Restore puts everything back.",
      },
    ],
  },
  {
    id: "sessions",
    eyebrow: "Sessions",
    title: "A timer that stays out of the way.",
    items: [
      {
        title: "One card or several",
        body: "Ctrl-click or ⌘-click cards across decks and start them together; each one is credited with the session.",
      },
      {
        title: "Never lose a minute",
        body: "Starting something new while a session runs saves the running one first. Sessions under a second are not logged.",
      },
      {
        title: "Focus",
        body: "A full-screen view of the running timer and nothing else. Press Esc to come back.",
      },
      {
        title: "History",
        body: "Every session is logged and grouped by day, with daily and weekly totals and a link to that card's journal.",
      },
    ],
  },
  {
    id: "journal",
    eyebrow: "Journal",
    title: "Write down what happened.",
    items: [
      {
        title: "One journal per card and per deck",
        body: "Notes about a piece of work live in exactly one place, never scattered across dated entries.",
      },
      {
        title: "Markdown, three ways",
        body: "Edit, split or preview. Headings, lists, quotes, code and links, with GitHub-style tables and task lists.",
      },
      {
        title: "Autosave",
        body: "It saves quietly as you type and shows the word and character count.",
      },
    ],
  },
  {
    id: "reminders",
    eyebrow: "Reminders",
    title: "A nudge at the right time.",
    items: [
      {
        title: "Once or on a schedule",
        body: "Remind yourself about a deck or a card once, every day, on weekdays, or once a week.",
      },
      {
        title: "Three signals",
        body: "A message in the app, a system notification if you allow it, and a soft two-tone chime. Open jumps to the card.",
      },
      {
        title: "Honest about limits",
        body: "Reminders fire while Zenith is open. A one-off that was due while it was closed fires when you return; a repeating one missed by more than 90 seconds waits for its next time.",
      },
    ],
  },
  {
    id: "zen",
    eyebrow: "Zen",
    title: "Room to think.",
    items: [
      {
        title: "Wallpapers",
        body: "Pastel colours, gradients, photographs and curated art, or your own image by link or upload.",
      },
      {
        title: "Quotes",
        body: "Musashi's Book of Five Rings, the Stoics, Zen proverbs or Bible verses, plus your own. Rotate every 10 to 60 seconds, or not at all.",
      },
      {
        title: "A greeting",
        body: "Good morning, afternoon or evening, and a kind word for the late night.",
      },
    ],
  },
  {
    id: "everywhere",
    eyebrow: "On any screen",
    title: "The same calm on a phone and on a wide monitor.",
    items: [
      {
        title: "Phones",
        body: "A layout made for small screens, safe areas respected, and a compact menu for the top bar.",
      },
      {
        title: "Install it",
        body: "Add Zenith to your home screen or install it from the browser, and it opens in its own window.",
      },
      {
        title: "Fullscreen and keyboard",
        body: "A fullscreen button, Esc to close anything, and arrow keys through the short tour.",
      },
    ],
  },
];

export function Features() {
  return (
    <>
      <PageHeader eyebrow="Features" title="Everything Zenith does today.">
        <p>
          This page lists only what the app does now, in the browser. What is still being built is on the{" "}
          <a href="/roadmap/" className="text-gold underline">
            roadmap
          </a>
          .
        </p>
        <nav aria-label="On this page" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <li key={g.id}>
                <a
                  href={`#${g.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-sm text-ink hover:border-gold-dim hover:text-gold"
                >
                  {g.eyebrow}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      {groups.map((g, i) => (
        <div key={g.id}>
          {i > 0 ? <Rule /> : null}
          <Section id={g.id} eyebrow={g.eyebrow} title={g.title}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((it) => (
                <Card key={it.title} title={it.title}>
                  {it.body}
                </Card>
              ))}
            </div>
          </Section>
        </div>
      ))}

      <section className="pb-20">
        <div className="mx-auto flex max-w-6xl justify-center px-5 sm:px-8">
          <OpenAppButton />
        </div>
      </section>
    </>
  );
}
