import { Button, Card, Container, Eyebrow, OpenAppButton, Rule, Section, Shot } from "../components/ui";
import { SHOTS } from "../shots";

const movements = [
  {
    label: "One",
    title: "Pick a card",
    body: "Decks hold your projects. Cards are the work you come back to inside them: research, writing, scales, reps.",
  },
  {
    label: "Two",
    title: "Run a session",
    body: "A stopwatch or a countdown, on one card or several at once. The timer stays at the bottom of the screen until you stop it.",
  },
  {
    label: "Three",
    title: "Write it down",
    body: "Every card and every deck has one markdown journal. Say what happened, what worked, and what to try next time.",
  },
];

const tour = [
  {
    shot: SHOTS.journal,
    eyebrow: "Journal",
    title: "One page per card, written in markdown.",
    body: "Edit, split or preview. It saves as you type and counts your words. A card has exactly one journal, so your notes on a piece of work are always in one place.",
  },
  {
    shot: SHOTS.history,
    eyebrow: "History",
    title: "Every session, grouped by day.",
    body: "Each stopped session becomes a row with its card, deck and length. Days and the week are totalled, and every row opens that card's journal.",
  },
  {
    shot: SHOTS.zen,
    eyebrow: "Zen",
    title: "A screen worth leaving open while you think.",
    body: "A full-screen wallpaper, a greeting for the time of day, and a slowly rotating quote from Musashi, the Stoics, Zen proverbs or Scripture, or your own.",
  },
];

export function Home() {
  return (
    <>
      <header className="glow overflow-hidden">
        <Container className="pt-16 pb-10 text-center sm:pt-28 sm:pb-16">
          <Eyebrow>Time tracking with intention</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-4xl text-[2.6rem] leading-[1.05] font-extralight tracking-tight text-balance sm:text-7xl">
            Pick one thing. Put the time in. Write down what happened.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed font-light text-ink">
            Zenith is a deliberate-practice timer with decks of work, a markdown journal, reminders and a
            full-screen Zen mode, on one quiet black canvas. It runs in your browser, keeps everything on your
            device, and never asks for an account.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <OpenAppButton />
            <Button href="/features/" variant="quiet">
              See what it does
            </Button>
          </div>
        </Container>
        {SHOTS.decks ? (
          <Container className="pb-6">
            <Shot {...SHOTS.decks} />
          </Container>
        ) : null}
      </header>

      <Section
        id="who"
        eyebrow="Who it is for"
        title="For people who treat their work like a craft."
        intro={
          <p>
            Students working through a syllabus, writers with a draft, musicians with a practice list,
            programmers learning something hard. Anyone who wants to see where their hours really went, and
            to think about them afterwards. There are no streaks, no points and no nagging. There is a card, a
            timer and a blank page.
          </p>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {movements.map((m) => (
            <Card key={m.title} label={m.label} title={m.title}>
              {m.body}
            </Card>
          ))}
        </div>
      </Section>

      <Rule />

      {tour.map((t, i) =>
        t.shot ? (
          <section key={t.eyebrow} aria-labelledby={`tour-${i}`} className="py-16 sm:py-24">
            <Container className="grid items-center gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <Eyebrow>{t.eyebrow}</Eyebrow>
                <h2
                  id={`tour-${i}`}
                  className="mt-3 text-3xl leading-tight font-extralight tracking-tight text-balance sm:text-4xl"
                >
                  {t.title}
                </h2>
                <p className="mt-5 text-base leading-relaxed font-light text-ink sm:text-lg">{t.body}</p>
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                <Shot {...t.shot} />
              </div>
            </Container>
          </section>
        ) : null,
      )}

      <Rule />

      <Section
        id="privacy"
        eyebrow="Privacy"
        title="Your data stays on your device."
        intro={
          <p>
            Decks, sessions, journals and reminders are saved in your browser on the device you use. There is
            no account, no server holding your data and no analytics, in the app or on this site.
          </p>
        }
      >
        <Button href="/privacy/" variant="quiet">
          Read exactly what is stored, and where
        </Button>
      </Section>

      <section aria-labelledby="start" className="pb-20">
        <Container>
          <div className="card-soft glow px-6 py-14 text-center sm:px-12">
            <h2 id="start" className="text-3xl font-extralight tracking-tight sm:text-4xl">
              Choose one card, and begin.
            </h2>
            <p className="mx-auto mt-4 max-w-xl font-light text-ink">
              Zenith works in any modern browser, on a computer or a phone. A desktop app is on its way.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <OpenAppButton />
              <Button href="/roadmap/" variant="quiet">
                See the roadmap
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
