/**
 * Captures of the real app, taken from its production build with sample data (see the README).
 * A capture that does not exist is null, and the page leaves the image out.
 */
export type ShotInfo = { src: string; alt: string; width: number; height: number };

export const SHOTS: Record<"decks" | "journal" | "history" | "zen", ShotInfo | null> = {
  decks: null,
  journal: null,
  history: null,
  zen: null,
};
