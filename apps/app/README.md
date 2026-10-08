# Zenith

> **Time tracking with intention.** A deliberate-practice timer, a deck/card workspace, a markdown journal, a reminder engine, and a full-screen Zen surface — all running locally in your browser or in the desktop app, on a single black canvas tuned the color of ink on lacquer.

Zenith is built for people who treat their work like a craft. Long sessions. Repeated focus blocks. Written reflection. It borrows the visual language of Japanese minimalism, the workflow of a kanban board, and the rhythm of a Pomodoro timer, and folds them into one calm, dark-themed surface that lives entirely in `localStorage` — no servers, no accounts, no analytics.

This README is the **full specification** of the product: every screen, every keystroke, every storage key, every design token. If you want the elevator pitch, read the next two paragraphs. If you want to ship a build, scroll to *Running locally*. If you want to extend it, read the whole thing.

---

## Table of contents

1. [Philosophy & goals](#philosophy--goals)
2. [The MVP](#the-mvp)
3. [Product surface — every feature](#product-surface--every-feature)
4. [Architecture](#architecture)
5. [Data model](#data-model)
6. [State management — the two hooks](#state-management--the-two-hooks)
7. [Reminder engine — how scheduling works](#reminder-engine--how-scheduling-works)
8. [Notification system — toasts & browser](#notification-system--toasts--browser)
9. [Design system](#design-system)
10. [Mobile, PWA, install, fullscreen, safe areas](#mobile-pwa-install-fullscreen-safe-areas)
11. [Desktop](#desktop)
12. [Keyboard map](#keyboard-map)
13. [Local storage keys](#local-storage-keys)
14. [Project structure](#project-structure)
15. [Running locally](#running-locally)
16. [Build & deployment](#build--deployment)
17. [Extending Zenith](#extending-zenith)
18. [Non-goals](#non-goals)

---

## Philosophy & goals

Modern productivity apps optimize for **capture** (todo lists) or for **billing** (timesheets). Zenith optimizes for **attention** — the act of choosing one thing, putting time into it, and writing down what happened. The product is shaped around three movements you repeat forever:

1. **Pick a card.** Decks group your projects; cards are the recurring focus blocks inside them (research, writing, reps).
2. **Run a session.** Stopwatch or countdown. One card or several at once. A sticky bottom timer never leaves you.
3. **Reflect.** Every card and every deck gets exactly one markdown journal with autosave. One target, one document, no fragmentation.

Zen mode and the rotating quote packs exist to **remove decoration** — when you're working, the screen should look like the inside of your head when you're calm. There are no streaks, no XP bars, no nags, no popups asking you to upgrade. The only reward is the time you put in.

### Design goals (the rules everything is built against)

| Goal | What it means in practice |
|---|---|
| **Local-first** | Every byte of state lives on the device: `localStorage` in a browser, a JSON file in the app's data folder on the desktop. The app loads from a static `index.html` and never talks to a backend. You can fly with it. |
| **One target, one document** | A task has one journal. A deck has one journal. The data layer enforces this — duplicate journals are deduped on hydrate. |
| **Quiet UI** | Black canvas, gold accent (`#c9a84c`), one display font (DM Sans). No emoji, no rainbow toasts, no celebratory animations. |
| **Recoverable destructive actions** | Every delete returns an undo handle. Deleting a deck cascades to its tasks *and* their journals, but you get one button press to put it all back. |
| **Keyboard-first where it matters** | Esc closes everything. Arrow keys move through the tutorial. ⌘/Ctrl-click multi-selects cards across decks. |
| **Looks the same on a phone as on a 5K** | `max-w-[1600px]`, safe-area padding, `100dvh` heights, a dedicated mobile dropdown for the top nav, and a fullscreen button that uses the real Fullscreen API. |

---

## The MVP

If you cloned this repo and shipped what's already in `main` today, the product you'd be shipping is the MVP. Concretely:

- **Decks & cards** — create, rename, delete (with undo), and run timers against them.
- **Stopwatch + countdown** — per-card timer mode, locked after creation.
- **Multi-task sessions** — ⌘-click multiple cards, hit start, every selected card accrues the same duration.
- **History** — every session writes a `Log`; the History view groups by day with day and week totals.
- **Journal** — one markdown document per card, one per deck, with Edit / Split / Preview modes and autosave.
- **Reminders** — schedule a one-off or repeating reminder against any deck or card, fire a toast + browser notification + chime, jump straight into the target.
- **Focus mode** — full-screen stopwatch overlay; Esc to exit.
- **Zen mode** — full-screen wallpaper + rotating quote + greeting; pick from four quote packs and four wallpaper categories (curated, gradient, pastel, Unsplash) or upload your own.
- **Tutorial** — six-step illustrated walkthrough that auto-opens on first visit and lives behind a `? Tour` button forever after.
- **PWA-ish chrome** — viewport-fit cover, safe-area insets, fullscreen API, mobile dropdown nav.

That entire MVP is implemented in **~4,900 lines of TypeScript and CSS** across `src/components/zen/` and `src/lib/zen/`. There is no backend.

---

## Product surface — every feature

### Decks & cards

A **Deck** is a project. A **Card** (internally `Task`) is a recurring block of work inside that project. Decks have a name and a colored dot; cards have a name, a tag, a total accumulated seconds counter, an optional checklist, and a locked timer mode.

```ts
// src/lib/zen/types.ts
export type Task = {
  id: string;
  deckId: string;
  name: string;
  tag: string;
  totalSeconds: number;     // accrues every time you stop a session on this card
  createdAt: number;
  checklist?: ChecklistItem[];
  mode?: TimerMode;          // "stopwatch" | "countdown" — locked at creation
  targetSeconds?: number;    // only meaningful when mode === "countdown"
};
```

Why lock `mode` after creation? Because a card's history would be incoherent otherwise — a card that was a 25-min Pomodoro yesterday and a free stopwatch today would mean two different things in the same totals row. The state hook enforces it:

```ts
// src/lib/zen/useTogglZen.ts — setTaskTimer is a no-op if mode is already set
setDecks(p => p.map(d => ({
  ...d,
  tasks: d.tasks.map(t => {
    if (t.id !== taskId) return t;
    if (t.mode) return t; // locked
    return { ...t, mode, targetSeconds: mode === "countdown" ? targetSeconds ?? 1500 : undefined };
  }),
})));
```

Card and deck creation/editing both happen in modals (not inline forms) so the chrome stays calm and the keyboard focus is unambiguous.

### Checklists

Every card can carry a `ChecklistItem[]`. You add, toggle, and delete items; deletes are undoable through the unified toast system. Internally it's a single `updateTaskChecklist(taskId, updater)` that takes an `(items) => items` function — the add/toggle/delete helpers are thin wrappers:

```ts
const addChecklistItem = (taskId, text) =>
  updateTaskChecklist(taskId, items => [...items, { id: generateId(), text: text.trim(), done: false }]);
```

### Timer & sessions

There is a single source of truth for "what's running": an `ActiveTask` object on the main hook.

```ts
export type ActiveTask = {
  taskIds: string[];   // can be many — multi-select sessions
  deckIds: string[];   // parallel array; deckIds[i] is the parent of taskIds[i]
  startedAt: number | null;
};
```

Starting tasks while a session is already live **commits** the previous session as logs first, then starts the new one — no time is ever lost:

```ts
// useTogglZen.ts — startTasks
setActive(prev => {
  if (prev.startedAt && prev.taskIds.length) {
    const dur = Math.floor((Date.now() - prev.startedAt) / 1000);
    prev.taskIds.forEach((tid, i) => commitStop(tid, prev.deckIds[i] ?? null, prev.startedAt!, dur));
  }
  return { taskIds: tasks.map(t => t.id), deckIds: tasks.map(t => t.deckId), startedAt: Date.now() };
});
```

A 1-second `setInterval` ticks while a session is active so the live HH:MM:SS counter in the bottom bar (and every selected card) updates without re-rendering the whole tree.

`commitStop` writes a `Log` to history *and* adds the elapsed seconds to the card's `totalSeconds`. Sessions shorter than 1 second are dropped — they're not interesting and they make the history view noisy.

### History

Every committed session becomes a `Log` row. The History view groups logs by day (using `dateKey(ts)`), sums per-day totals, and rolls up a rolling week total. Each row has a one-click *jump to journal* action that opens the journal view scoped to that card.

```ts
export type Log = {
  id: string;
  taskId: string; taskName: string;
  deckName: string; deckColor: string;
  duration: number;       // seconds
  startedAt: number; endedAt: number;
  hasJournal: boolean;    // flipped to true the moment a journal targets this log
};
```

### Journal

One markdown document per card, one per deck. The picker modal makes the target unambiguous — you don't write into "a journal", you write into *this deck's journal* or *this card's journal*. The data hook actively prevents duplicates: on hydrate it dedupes any legacy multi-journal-per-target rows (keeping the most recently updated), and on `upsertJournal` it searches for an existing journal for the same target before creating a new one.

```ts
// useTogglZen.ts — dedupe on hydrate
const byKey = new Map<string, Journal>();
for (const j of [...raw].sort((a, b) => a.updatedAt - b.updatedAt)) {
  const key = j.taskId ? `t:${j.taskId}` : j.deckId ? `d:${j.deckId}` : `id:${j.id}`;
  byKey.set(key, byKey.get(key) ? { ...byKey.get(key)!, ...j } : j);
}
```

The editor has three modes — **Edit**, **Split**, **Preview** — rendered with `react-markdown` + `remark-gfm`. Autosave is silent; a footer shows word and character counts. Markdown styling lives in `src/styles.css` under the `.markdown-body` selectors (headings, blockquotes with a gold left border, monospaced code blocks, gold underlined links).

When a deck or card is deleted, the cascade in `deleteDeck`/`deleteTasks` removes the orphaned journals so the journal list never shows entries that point nowhere.

### Reminders

A reminder targets either a deck or a card and fires either once or on a recurring schedule. See [Reminder engine](#reminder-engine--how-scheduling-works) for the full algorithm.

```ts
// src/lib/zen/useReminders.ts
export type Reminder = {
  id: string;
  targetType: "task" | "deck";
  targetId: string;
  label: string;                    // cached for display even if the target moves
  deckName?: string; deckColor?: string;
  fireAt: number;                   // epoch ms for one-off; time-of-day source for repeats
  repeat: "none" | "daily" | "weekdays" | "weekly";
  weekday?: number;                 // 0=Sun..6=Sat (weekly only)
  enabled: boolean;
  notify: boolean;                  // browser Notification
  sound: boolean;                   // built-in two-tone chime
  createdAt: number;
  lastFiredAt?: number;             // dedupe guard
};
```

When a reminder fires you get **three** signals stacked:

1. A `notify.info` toast inside the app (with a *Open* action that jumps to the target).
2. A browser `Notification` (if permission was granted; click it to focus the tab and jump to the target).
3. A two-tone sine chime synthesized on the fly with `AudioContext` — no audio asset is shipped:

```ts
// useReminders.ts — chime()
const osc = ctx.createOscillator();
osc.type = "sine"; osc.frequency.value = freq;
gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
// played at 880Hz then 660Hz, ~0.6s total
```

The reminders modal also persists the browser's notification permission state (`granted` / `denied` / `default` / unsupported) and shows the correct banner on subsequent opens — you don't get asked twice.

### Focus mode

A full-screen overlay that hides everything except a giant stopwatch readout of the currently running session. Tap or hit `Esc` to drop back to the app. The cursor is hidden after a moment of inactivity via the `.hide-cursor { cursor: none; }` utility.

### Zen mode

A full-screen ambient surface: wallpaper, a rotating quote, a time-of-day greeting (*good morning / afternoon / evening / late night / still up*), and a kanji glyph that changes with the greeting. It exists to give you a screen worth keeping open while you think.

- **Quote packs** — Musashi (*The Book of Five Rings*), Bible Verses, Stoic (Marcus Aurelius / Seneca / Epictetus), Zen Proverbs. Persisted under `zenith.zen.pack`. You can append your own to `zenith.zen.customQuotes`.
- **Quote rotation** — Off, 10s, 20s, 30s, 60s, with manual `‹` `›` navigation. Persisted under `zenith.zen.intervalSec`.
- **Wallpaper categories** —
  - **Pastel** — solid soft colors (cream, sand, mist, sage, blush, ice, lilac, peach).
  - **Gradient** — curated linear gradients (Midnight, Twilight, Ocean Deep, Forest, Autumn, Noir Gold, Linen, Sunset, Slate, Blossom).
  - **Unsplash** — high-resolution photography.
  - **Curated** — built-in artwork (Musashi ink, zen garden, bamboo, temple).
  - **Custom** — your own URL imports or local file uploads, persisted as Base64 in `zenith.zen.customWalls`.

Quote transitions use a custom `.quote-fade` keyframe that simultaneously fades opacity, eases a 10px translate, blurs out 6px, and tightens letter-spacing — the words feel like they're coming into focus, not popping in.

```css
@keyframes quoteFade {
  from { opacity: 0; transform: translateY(10px); filter: blur(6px); letter-spacing: 0.01em; }
  to   { opacity: 1; transform: translateY(0);    filter: blur(0);   letter-spacing: 0; }
}
```

### Notifications (toasts)

A unified `notify` API wraps Sonner with a custom card-shaped badge — same look for every event in the app (create, edit, delete, journal saved, reminder fired).

```ts
notify.success("Deck created");
notify.undoable("Deck deleted", () => restoreDeck(deck, index), { description: deck.name });
```

The undo variant returns a `Restore` button right in the toast, valid for 5 seconds.

### Tutorial

A 6-step modal walkthrough with real PNG screenshots of each view (stored under `src/assets/tutorial/`). Auto-opens on first visit (flag at `zenith.tutorial.seen`), reachable any time via the `? Tour` button in the top bar. Arrow keys walk through steps; clicking outside skips.

### Mobile dropdown nav

On screens narrower than the `sm:` breakpoint the four top-bar action buttons (Reminders, Focus, Zen, Fullscreen) collapse into a single Radix `DropdownMenu` trigger. It opens with a smooth `data-[state=open]:zoom-in-95 slide-in-from-top-1` transition, rotates its `≡` glyph 90° while open, and gilds its border with the gold accent so the active state reads at a glance. Outside-click and select-to-close are handled by Radix.

---

## Architecture

- **Framework** — React 19 + Vite 7. Standard client-side SPA. No SSR.
- **Routing** — TanStack Router (file-based, client-only). The whole app is mounted by `src/routes/index.tsx` as `<TogglZenApp />`.
- **Build** — `vite build` produces a static `dist/` deployable to any CDN.
- **Styling** — Tailwind CSS v4 with the CSS-first config in `src/styles.css` (no `tailwind.config.js`); semantic tokens in `oklch`/hex via `@theme inline`.
- **State** — on the device only, through `src/lib/platform` (`localStorage` in a browser, the Tauri store file on the desktop). Two hooks own everything: `useTogglZen` (decks/tasks/logs/journals/active) and `useReminders` (reminder list + scheduler).
- **Markdown** — `react-markdown` + `remark-gfm`, styled via `.markdown-body` rules in `styles.css`.
- **Notifications** — `sonner` wrapped by the custom `notify` badge in `src/lib/zen/notify.tsx`.
- **Desktop** — a Tauri 2 shell in `src-tauri` wraps the same build; see [Desktop](#desktop).
- **No backend.** Data never leaves the device.

```
┌──────────────────────────────────────────────────────────────┐
│  routes/__root.tsx   ← <html> shell + <Toaster /> + <Outlet> │
│  routes/index.tsx    ← mounts <TogglZenApp />                │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  components/zen/TogglZenApp.tsx   (~3,000 lines)             │
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│   │  Decks view  │  │ Journal view │  │ History view │       │
│   └──────────────┘  └──────────────┘  └──────────────┘       │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│   │  Focus mode  │  │   Zen mode   │  │   Tutorial   │       │
│   └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│   uses → useTogglZen()  +  useReminders()                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Data model

Defined once in `src/lib/zen/types.ts`. Every persisted entity is shown above; here's the relationship sketch:

```
Deck ─┬─< Task ─< ChecklistItem
      │     │
      │     └─< Log         (one Log per stopped session)
      │
      ├─< Journal           (one Journal per Deck, optional)
      └ Task ──< Journal    (one Journal per Task, optional)

Reminder ──> Deck  (targetType:"deck", targetId = deck.id)
        └──> Task  (targetType:"task", targetId = task.id)
```

A Journal has *either* a `taskId` *or* a `deckId` (never both meaningful at once). The hook's dedupe key is `t:<taskId>` or `d:<deckId>` precisely to enforce the one-journal-per-target rule.

---

## State management — the two hooks

### `useTogglZen()`

Owner of decks, tasks, logs, journals, and the active session. Hydrates from storage on mount, sets a `hydrated` flag, then mirrors every state slice back to storage on change via four small effects:

```ts
useEffect(() => { if (hydrated) saveLS(KEYS.decks, decks); }, [decks, hydrated]);
useEffect(() => { if (hydrated) saveLS(KEYS.logs, logs); }, [logs, hydrated]);
useEffect(() => { if (hydrated) saveLS(KEYS.journals, journals); }, [journals, hydrated]);
useEffect(() => { if (hydrated) saveLS(KEYS.active, active); }, [active, hydrated]);
```

The `hydrated` gate matters — without it, the first render would overwrite real saved data with empty defaults. The hook also:

- **Migrates** the legacy single-task `active` shape (`{ taskId, deckId }`) to the new multi-select `{ taskIds, deckIds }` shape.
- **Cleans up** orphaned journals on first load (journals whose target deck or card has been deleted).
- **Seeds** two starter decks (Academics, Projects) on a truly empty install — *never* fake logs or journals. The comment in source is load-bearing:

```ts
// @AI-INSTRUCTION: DO NOT EVER seed fake logs, history, or journals.
// The app must start with zero history to maintain authenticity.
```

The hook returns a wide API: `startTask`, `startTasks`, `stopTask`, `addDeck`, `addTask`, `updateTask`, `renameDeck`, `setTaskTimer`, `deleteLog`, `deleteTasks`, `restoreTasks`, `deleteDeck`, `restoreDeck`, `upsertJournal`, `deleteJournal`, and the three checklist helpers. `deleteDeck`/`deleteTasks` return the data needed to undo themselves (`{ deck, index }` and `[{ deckId, task, index }]`).

### `useReminders(onFire)`

Owner of reminders and the polling scheduler. Same hydrate-then-mirror pattern. Takes a callback `onFire(reminder)` (kept in a ref so callers don't need to memoize it) and polls every 15 seconds for due reminders. See the next section for the exact algorithm.

It also exposes `pruneOrphans(validTaskIds, validDeckIds)` so the main component can drop reminders pointing at deleted targets in a single pass after a cascade delete.

---

## Reminder engine — how scheduling works

The scheduler runs entirely in the foreground (it's a client-only app), so it has to be **idempotent** and **resilient to the user reopening the tab after the trigger time has passed**. The shape of the algorithm:

```ts
// useReminders.ts — the polling tick
const check = () => {
  const now = Date.now();
  setReminders(prev => {
    const next = prev.map(r => {
      if (!r.enabled) return r;
      const last = r.lastFiredAt ?? 0;
      let due = false;

      if (r.repeat === "none") {
        // one-off: fire if past trigger and never fired
        if (r.fireAt <= now && last < r.fireAt) due = true;
      } else {
        // recurring: compute today's trigger from the time-of-day in r.fireAt
        const base = new Date(r.fireAt);
        const todayTrigger = new Date(now);
        todayTrigger.setHours(base.getHours(), base.getMinutes(), 0, 0);
        const t = todayTrigger.getTime();
        const dayOk =
          r.repeat === "daily" ||
          (r.repeat === "weekdays" && todayTrigger.getDay() >= 1 && todayTrigger.getDay() <= 5) ||
          (r.repeat === "weekly"   && todayTrigger.getDay() === (r.weekday ?? base.getDay()));
        // fire only inside a 90-second window after the trigger, once per trigger
        if (dayOk && t <= now && now - t < 90_000 && last < t) due = true;
      }

      if (due) {
        fireRef.current?.(r);
        return { ...r, lastFiredAt: now, enabled: r.repeat === "none" ? false : r.enabled };
      }
      return r;
    });
    return next;
  });
};
check();
const id = setInterval(check, 15_000);
```

Key invariants:

- **One-offs disable themselves** after firing (`enabled: false`).
- **Recurring reminders** stay enabled but record `lastFiredAt` so the same trigger can't fire twice in the 15-second poll window.
- **90-second forgiveness window** — if the user reopens the tab within 90s of the trigger, the reminder still fires. Beyond that, it's considered missed and skipped (it'll fire on the next scheduled day).

`nextFireAt(reminder)` is the read-only counterpart used by the UI to display "next: tomorrow 9:00".

---

## Notification system — toasts & browser

The custom `Badge` component in `notify.tsx` is the only toast layout in the app. It has:

- a colored 1.5×1.5px dot for kind (info / success / warn / error),
- a `micro-caps` label,
- an optional 11px description,
- an optional action button (gold-bordered `micro-caps` pill, used for Undo and Open),
- a dismiss `×`.

Toasts stack up to six at the bottom-center; defaults: 3.2s for plain notifications, 5s for undoables.

Browser notifications go through `fireBrowserNotification(reminder, onClick)`. It checks `Notification.permission`, builds a body string (`"Deck name — Card label"` for cards, `"Time for deck: Name"` for decks), tags by reminder id so the same reminder replaces its own previous notification, and auto-closes after 12 seconds.

---

## Design system

The design system is intentionally tiny — one accent color, one font, a handful of semantic surface tokens.

### Color tokens (defined in `src/styles.css`)

| Token | Value | Used for |
|---|---|---|
| `--background` | `#000000` | The canvas |
| `--foreground` | `#ece9e3` | Body text |
| `--surface-1/2/3` | `#060606` / `#0a0a0a` / `#111111` | Card, popover, raised |
| `--border` / `--border-accent` | `#1a1a1a` / `#2c2c2c` | Hairlines |
| `--text-secondary` / `--text-dim` / `--text-ink` | `#7a7a7a` / `#4a4a4a` / `#b0a999` | Hierarchy |
| `--accent-gold` / `--accent-gold-dim` | `#c9a84c` / `#6e5524` | The only chromatic accent |
| `--danger` | `#c9a84c` | Same gold — destructive isn't red; it's deliberate |

These are aliased into Tailwind via `@theme inline` so you can write `bg-surface-2 text-text-secondary border-border-accent` directly.

### Typography

One font: **DM Sans**, weights 200–700 plus italic 400, bundled with the app from `@fontsource/dm-sans` (imported in `src/main.tsx`), so no font request leaves the device. The `--font-display`, `--font-serif`, and `--font-jp` tokens all point at it — there is no second face, no monospace except in code blocks.

Three text utilities do most of the work:

```css
.micro-caps { font-weight: 300; letter-spacing: 0.08em; text-transform: uppercase; font-size: 11px; color: var(--text-secondary); }
.timer-mono { font-weight: 200; letter-spacing: 0.06em; font-variant-numeric: tabular-nums; }
.display-italic { font-style: italic; }
```

`micro-caps` is the labels-and-chips voice. `timer-mono` is the HH:MM:SS voice (tabular numerals so digits don't dance). `display-italic` is the quote voice.

### Surface utilities

- `.card-soft` — the universal card background: a top-to-bottom gradient (`#0a0a0a → #050505`), an inner highlight, a soft drop shadow, `radius-lg`. Picks up a stronger shadow on hover.
- `.card-soft-active` — same shape with a 1px inset gold ring and a faint gold glow; used for running tasks.
- `.edge-soft` — adds the inset highlight/shadow pair *without* changing the radius. Used on toasts and on the chrome around modals so two borders meeting feel lifted instead of flat.
- `.gold-rule` — a 1px horizontal gradient from transparent → gold-dim → transparent. The divider in modals and headers.
- `.pulse-gold` — a 2.4s breathing opacity loop for the "session active" indicator.

### Animation

Every motion comes from CSS keyframes in `styles.css` — no animation library. The vocabulary:

| Class | What it does | Where |
|---|---|---|
| `.fade-in` | 0.4s opacity + 2% scale-up | Modals appearing |
| `.quote-fade` / `.quote-fade-slow` | The blur/translate/letter-spacing combo above | Zen quote rotation |
| `.pulse-gold` | 2.4s opacity breath | Active-session dot |
| Radix `data-[state=open]:zoom-in-95 slide-in-from-top-1` | Dropdown entrance | Mobile nav |

### Scrollbars & selection

Both Firefox (`scrollbar-color`) and WebKit are themed to a slim brown-to-gold thumb. Text selection uses `--accent-gold-dim` so the gold thread runs through every state.

---

## Mobile, PWA, install, fullscreen, safe areas

The app is built mobile-first with a desktop expansion, not the other way around.

- `index.html` sets `viewport-fit=cover` so the page can paint under the iOS status bar and home indicator.
- `body` adds `padding: env(safe-area-inset-*)` on all four sides so content never hides under notches or the home bar.
- `html, body, #root` use `min-height: 100dvh` (with a `100vh` fallback) so the layout doesn't jump when mobile browsers hide their URL bar.
- `body { overscroll-behavior-y: none; }` kills the iOS rubber-band that breaks the immersive feel.
- The **Fullscreen** top-bar button calls `document.documentElement.requestFullscreen()` (with `webkitRequestFullscreen` fallback) and exits the same way. On mobile it pairs with safe-area padding so the canvas truly reaches the bezels.
- On the `<sm` breakpoint, the top bar collapses to a single dropdown so the chrome is never cluttered.

### Installable PWA

Zenith ships as an installable Progressive Web App — no service worker, no
offline cache trickery, just a real manifest so phones and desktops let you
"Add to Home Screen" / "Install".

- `public/manifest.webmanifest` declares name, short name, `display: "standalone"`,
  `background_color` / `theme_color` (vantablack `#000000`), and three icon
  entries (192, 512, 512 maskable).
- `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`
  are generated from `public/favicon.png`.
- `index.html` references the manifest (`<link rel="manifest" ...>`) plus the
  apple-touch-icon and a black `theme-color` for the iOS status bar.

Install instructions for users:

- **iOS Safari:** Share → "Add to Home Screen".
- **Android Chrome:** auto-prompts an "Install app" banner; otherwise menu → "Install".
- **Desktop Chrome / Edge:** install icon in the URL bar.

Once installed, Zenith launches in its own window, hides browser chrome, and
uses the same vantablack splash background.

---

## Desktop

The same React build runs in a desktop window through [Tauri 2](https://v2.tauri.app/), a small Rust shell around the system webview. The shell is in `src-tauri` ([W04](../../work-orders/web/W04-tauri-react-app.md)); the small always-on-top pop-up is a separate Tauri app in [`apps/popup`](../popup).

- **One window.** An ordinary resizable window (1280 x 820 to start, 360 x 560 at least). Closing it quits. There is no tray icon and no global shortcut, so nothing clashes with the pop-up's `Alt+Space`. A second launch focuses the open window instead of starting another copy (the single-instance plugin), so two processes never write one file.
- **One small interface.** `src/lib/platform` is the only code that knows where the app runs. It checks for Tauri's injected `__TAURI_INTERNALS__` and exports `storage` (`getItem` / `setItem` / `removeItem`) and `appWindow` (`isFullscreen` / `toggleFullscreen` / `onFullscreenChange`). In a browser they are `localStorage` and the Fullscreen API, as before, and no Tauri code is loaded. On the desktop, `storage` reads `zenith.json` in the app's data folder (identifier `app.zenith.desktop`) once at start-up, keeps reads synchronous from memory, and hands every write to the store plugin, which writes the file 200 ms after the last change and again on exit; `appWindow` makes the native window fullscreen. `src/main.tsx` waits for this choice before the first render.
- **Notifications.** The notification plugin implements the Web `Notification` API inside the shell, so the reminder code is the same. Clicking a desktop notification does not jump to the card, because the plugin's notifications have no click event.
- **Content security policy.** Scripts, styles, fonts and connections come only from the app itself; images may also come from `https:` (the Zen wallpapers and wallpapers added by URL) and `data:` / `blob:` (uploaded ones).
- **Data is separate per surface.** The browser and the desktop app each keep their own copy; nothing is copied between them.

```bash
npm run tauri:app -- dev     # from the repository root: the dev server plus the desktop window
npm run tauri:app -- build   # an installer for this system (signing and updates are P03)
```

You need the Rust toolchain and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (on Windows, the Visual Studio C++ build tools and WebView2). If linking fails on Windows because the checkout path is deep, set a short `CARGO_TARGET_DIR` (for example `C:/zt/app`).

---

## Keyboard map

| Key | Action |
|---|---|
| `Esc` | Exit Zen / Focus mode, close any modal |
| `←` / `→` | Step through the tutorial |
| `⌘` / `Ctrl` + click | Multi-select cards across decks (then `Start` runs all of them) |
| `Tab` / `Shift+Tab` | Focus order respects the reading order; modals trap focus |

---

## Local storage keys

All state is namespaced (mostly under `toggl_zen_*` for legacy reasons, with the Zen preferences under `zenith.*`). In a browser these are `localStorage` keys; on the desktop the same keys, with the same string values, are entries in `zenith.json` in the app's data folder:

| Key | Owner | Shape |
|---|---|---|
| `toggl_zen_decks` | `useTogglZen` | `Deck[]` |
| `toggl_zen_logs` | `useTogglZen` | `Log[]` |
| `toggl_zen_journals` | `useTogglZen` | `Journal[]` |
| `toggl_zen_active` | `useTogglZen` | `ActiveTask` |
| `toggl_zen_reminders` | `useReminders` | `Reminder[]` |
| `zenith.tutorial.seen` | TogglZenApp | `"1"` flag on first dismiss |
| `zenith.notif.permission` | RemindersModal | the last seen `NotificationPermission` |
| `zenith.zen.pack` | Zen view | `QuotePackId` |
| `zenith.zen.customQuotes` | Zen view | `string[]` |
| `zenith.zen.customWalls` | Zen view | `string[]` (URLs or data-URLs) |
| `zenith.zen.wallIdx` | Zen view | `number` |
| `zenith.zen.intervalSec` | Zen view | `0 \| 10 \| 20 \| 30 \| 60` |

In the two hooks, `loadLS`/`saveLS` wrap every read/write in a try/catch — if storage is full or disabled (private windows), decks, logs, journals and reminders degrade gracefully to "this session only" instead of crashing. The tutorial flag, the notification permission and the Zen settings call `storage` without that wrapper.

---

## Project structure

```
src/
  components/
    zen/
      TogglZenApp.tsx          ← the whole app: decks, journal, history, zen, tutorial, top bar
      RemindersModal.tsx       ← reminders list + create/edit + permission banner
    ui/dropdown-menu.tsx       ← the one shadcn primitive in use (the mobile top-bar menu)
  lib/
    zen/
      useTogglZen.ts           ← state hook: decks, tasks, journals, logs, checklist, active
      useReminders.ts          ← state hook: reminders + 15s polling scheduler + chime
      quotes.ts                ← quote packs + categorized wallpapers
      notify.tsx               ← unified toast badge (stacked, undoable)
      types.ts                 ← Deck / Task / Journal / Log / TimerMode / ViewName
      utils.ts                 ← time + date formatters, generateId
    platform/index.ts          ← browser or desktop: storage and window calls
  routes/
    __root.tsx                 ← html shell + <Toaster /> + <Outlet />
    index.tsx                  ← mounts <TogglZenApp />
  assets/tutorial/             ← in-app tutorial screenshots
  styles.css                   ← Tailwind v4 + design tokens + markdown styling
  router.tsx                   ← TanStack Router bootstrap
  main.tsx                     ← React 19 entry, bundled fonts, waits for the platform
index.html                     ← viewport-fit=cover, theme color, root mount
public/_redirects              ← SPA fallback for non-Netlify hosts
src-tauri/
  src/lib.rs                   ← the desktop shell: plugins and the single-instance guard
  tauri.conf.json              ← the window, content security policy, bundle settings
  capabilities/default.json    ← what the window may ask the shell to do
  icons/                       ← app icons (the same Z as the pop-up)
```

The Netlify settings live in `netlify.toml` at the repository root.

---

## Running locally

From the repository root:

```bash
npm install
npm run dev                  # the app in a browser (same as npm run dev:app)
npm run tauri:app -- dev     # the app in a desktop window (see Desktop above)
```

Open the URL printed by Vite. The app reads no environment variables and needs no `.env` file and no database — open and go.

---

## Build & deployment

Zenith is a **client-only SPA**. The build pipeline targets any static host (Netlify, Vercel static, plain S3+CDN).

### What `npm run build` does

```bash
npm run build       # from the root; runs vite build in this workspace
```

Standard Vite build. Output:

```
dist/
  index.html          ← SPA entry
  _redirects          ← SPA fallback for unknown paths
  assets/
    index-<hash>.js
    index-<hash>.css
    ...tutorial images
```

### Netlify

`netlify.toml` at the repo root builds this workspace from the monorepo and pins the publish directory and the SPA fallback:

```toml
[build]
  command = "npm install && npm run build -w @zenith/app"
  publish = "apps/app/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Hashed assets get a long-lived immutable cache header, `index.html` is set to `must-revalidate` so new deploys go live immediately, and the redirect (mirrored in `public/_redirects`) ensures deep links like `/journal` and `/history` resolve to `index.html` instead of 404.

### Any other static host

Point the host's publish directory at `dist/` and configure a SPA fallback (`/* → /index.html`, status 200). No Node runtime, no edge worker, no environment variables required.

---

## Extending Zenith

Common extension points and where to start:

| Want to… | Edit |
|---|---|
| Add a new quote pack | `src/lib/zen/quotes.ts` — push a new entry into `QUOTE_PACKS` |
| Add a new wallpaper category | `src/lib/zen/quotes.ts` — push into `WALLPAPER_CATEGORIES` |
| Change the accent color | `src/styles.css` `:root { --accent-gold: ... }` |
| Change the font | `src/main.tsx` — swap the `@fontsource` imports; `src/styles.css` — `--font-display` |
| Add a new persisted slice of state | New hook with the same hydrate-gate-then-mirror pattern as `useReminders` |
| Add a new toast variant | `src/lib/zen/notify.tsx` — extend `ToastKind` and `kindDot` |
| Add a new top-bar action | `TogglZenApp.tsx` — add to both the desktop button row and the mobile `DropdownMenu` |

When you add a new persisted entity that targets a deck or task, remember to **cascade on delete**. Look at how `deleteDeck` and `deleteTasks` cascade to journals, and how `pruneOrphans` in `useReminders` is called after deletions — every new entity needs the same treatment or you'll end up with rows pointing at the void.

---

## Non-goals

What Zenith is deliberately not, and won't become:

- **A team tool.** No multi-user, no shared decks. Single-user and local-first. Today each device keeps its own data; sync between your own devices, directly over the local network with no account, is planned ([`docs/SYNC.md`](../../docs/SYNC.md)) and not built.
- **A billing tool.** No invoicing, no client rates, no exports tuned for accounting.
- **A todo app.** The checklist on a card is incidental — the unit of work is the card itself.
- **Gamified.** No streaks, no XP, no nags. There's a card, a timer, and a blank page. Put the time in. Write what happened. Come back tomorrow.

> "Today is victory over yourself of yesterday." — Musashi
