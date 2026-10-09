import type { ActiveTask, Deck, Journal, Log } from "./types";
import { migrateFeatures } from "./features";

export function migrateActive(raw: Partial<ActiveTask> & { taskId?: string | null; deckId?: string | null } | null): ActiveTask {
  return { taskIds: Array.isArray(raw?.taskIds) ? raw.taskIds : raw?.taskId ? [raw.taskId] : [], deckIds: Array.isArray(raw?.deckIds) ? raw.deckIds : raw?.deckId ? [raw.deckId] : [], startedAt: raw?.startedAt ?? null };
}
/** Migrate a snapshot of the existing build's storage without mutating any source value. */
export function migrateSnapshot(raw: { decks: Deck[]; logs: Log[]; journals: Journal[]; active?: Parameters<typeof migrateActive>[0]; features?: unknown }) {
  return { ...raw, active: migrateActive(raw.active ?? null), features: migrateFeatures(raw.features) };
}
