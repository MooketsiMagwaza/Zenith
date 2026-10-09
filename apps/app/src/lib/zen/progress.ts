import type { Goal } from "./features";
import type { Deck, Log } from "./types";

export function dayStart(now: number) { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
export function weekStart(now: number) { const d = dayStart(now); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
export function goalWindow(goal: Goal, now: number): [number, number] {
  if (goal.period === "total") return [-Infinity, Infinity];
  const start = goal.period === "day" ? dayStart(now) : weekStart(now);
  const end = new Date(start); end.setDate(end.getDate() + (goal.period === "day" ? 1 : 7));
  return [start.getTime(), end.getTime()];
}
/** Split sessions at local period boundaries, including midnight and daylight saving changes. */
export function secondsWithin(log: Log, start: number, end: number): number {
  const span = log.endedAt - log.startedAt;
  if (span <= 0) return log.startedAt >= start && log.startedAt < end ? log.duration : 0;
  return log.duration * Math.max(0, Math.min(end, log.endedAt) - Math.max(start, log.startedAt)) / span;
}
export function goalProgress(goal: Goal, taskIds: string[], logs: Log[], lifetime: number, now = Date.now()) {
  const [start, end] = goalWindow(goal, now);
  const ids = new Set(taskIds);
  const seconds = goal.period === "total" ? lifetime : logs.filter(l => ids.has(l.taskId)).reduce((s, l) => s + secondsWithin(l, start, end), 0);
  return { seconds, target: goal.seconds, ratio: Math.min(1, Math.max(0, seconds / goal.seconds)), met: seconds >= goal.seconds };
}
export function targetInfo(decks: Deck[], key: string) {
  const [kind, id] = key.split(":");
  const deck = decks.find(d => kind === "deck" ? d.id === id : d.tasks.some(t => t.id === id));
  const tasks = kind === "deck" ? deck?.tasks ?? [] : deck?.tasks.filter(t => t.id === id) ?? [];
  return { title: kind === "deck" ? deck?.name : tasks[0]?.name, taskIds: tasks.map(t => t.id), lifetime: tasks.reduce((s, t) => s + t.totalSeconds, 0) };
}
