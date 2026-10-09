import { describe, expect, it } from "vitest";
import { goalProgress, secondsWithin, weekStart } from "./progress";
import { migrateFeatures } from "./features";
import type { Log } from "./types";

const stamp = (day: number, hour = 0) => +new Date(2026, 9, day, hour);
const log = (start: number, end: number, taskId = "a"): Log => ({ id: "l", taskId, taskName: "Invented fixture", deckName: "Sample", deckColor: "#c9a84c", duration: (end - start) / 1000, startedAt: start, endedAt: end, hasJournal: false });
describe("goal maths", () => {
  it("uses Monday through Sunday in local time", () => expect(weekStart(stamp(8)).getDate()).toBe(5));
  it("splits a session over midnight", () => expect(secondsWithin(log(stamp(7, 23), stamp(8, 1)), stamp(8), stamp(9))).toBe(3600));
  it("filters task IDs and clips the displayed ratio", () => expect(goalProgress({ period: "day", seconds: 60 }, ["a"], [log(stamp(8), stamp(8, 1)), log(stamp(8), stamp(8, 2), "b")], 0, stamp(8, 12))).toEqual({ seconds: 3600, target: 60, ratio: 1, met: true }));
  it("uses stored lifetime for total goals", () => expect(goalProgress({ period: "total", seconds: 7200 }, [], [], 3600).ratio).toBe(.5));
  it("does not carry daily time into tomorrow", () => expect(goalProgress({ period: "day", seconds: 60 }, ["a"], [log(stamp(7), stamp(7, 1))], 100, stamp(8)).seconds).toBe(0));
  it("migrates missing options to quiet defaults and refuses future versions", () => { expect(migrateFeatures(null)).toEqual({ version: 1, progress: false, goals: {} }); expect(() => migrateFeatures({ version: 2 })).toThrow(); });
});
