import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { migrateActive, migrateSnapshot } from "./migration";
it("loads a saved current-build format export and preserves existing data", () => {
  const saved = JSON.parse(readFileSync(new URL("./fixtures/current-build-export.json", import.meta.url), "utf8"));
  const original = structuredClone(saved);
  const next = migrateSnapshot(saved);
  expect(next.decks).toEqual(original.decks); expect(next.logs).toEqual(original.logs); expect(next.journals).toEqual(original.journals); expect(saved).toEqual(original);
  expect(next.features.progress).toBe(false); expect(next.features.version).toBe(1);
});
it("migrates old single-card active sessions", () => expect(migrateActive({ taskId: "a", deckId: "b", startedAt: 100 })).toEqual({ taskIds: ["a"], deckIds: ["b"], startedAt: 100 }));
