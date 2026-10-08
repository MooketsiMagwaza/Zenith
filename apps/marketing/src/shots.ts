/**
 * Captures of the real app: its production build at 1440 x 900, seeded with invented sample data
 * by scripts/capture-app.mjs on 8 October 2026. A capture that does not exist is null, and the
 * page leaves the image out.
 */
export type ShotInfo = { src: string; alt: string; width: number; height: number };

const size = { width: 1440, height: 900 };

export const SHOTS: Record<"decks" | "journal" | "history" | "zen", ShotInfo | null> = {
  decks: {
    src: "/shots/decks.webp",
    alt: "The Decks view: three decks in a side list, and the Thesis deck's cards with their running totals. A session on Chapter 3 draft is running, and its timer shows at the bottom.",
    ...size,
  },
  journal: {
    src: "/shots/journal.webp",
    alt: "The journal for the Chapter 3 draft card in split view: markdown on the left, the formatted page with a task list, a quote and a table on the right.",
    ...size,
  },
  history: {
    src: "/shots/history.webp",
    alt: "The History view: sessions grouped under Today and Yesterday, each with its card, deck, start time and length, and the week's total at the top.",
    ...size,
  },
  zen: {
    src: "/shots/zen.webp",
    alt: "Zen mode: a dark gold gradient, a kanji with the greeting Good afternoon, a quote from Musashi's Book of Five Rings, and the running session timer.",
    ...size,
  },
};
