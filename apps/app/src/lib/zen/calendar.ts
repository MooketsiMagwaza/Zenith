import type { Reminder } from './useReminders';
import { dayStart, weekStart } from './progress';
import { repeatStart } from './reminderSchedule';
export function calendarDays(anchor: number, mode: 'month' | 'week') {
  const first = mode === 'week' ? weekStart(anchor) : dayStart(anchor);
  if (mode === 'month') {
    first.setDate(1);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  }
  return Array.from({ length: mode === 'month' ? 42 : 7 }, (_, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + i);
    return d;
  });
}
/** Enumerate wall-clock occurrences; use calendar arithmetic across DST. */
export function reminderOccurrences(r: Reminder, start: number, end: number) {
  if (!r.enabled) return [];
  if (r.repeat === 'none') return r.fireAt >= start && r.fireAt < end ? [r.fireAt] : [];
  const base = new Date(r.fireAt),
    dates: number[] = [];
  const day = dayStart(start);
  for (let count = 0; +day < end && count < 3700; count++, day.setDate(day.getDate() + 1)) {
    const candidate = new Date(day);
    candidate.setHours(base.getHours(), base.getMinutes(), 0, 0);
    const weekday = candidate.getDay();
    if (
      +candidate >= Math.max(start, repeatStart(r)) &&
      +candidate < end &&
      (r.repeat === 'daily' ||
        (r.repeat === 'weekdays' && weekday >= 1 && weekday <= 5) ||
        (r.repeat === 'weekly' && weekday === (r.weekday ?? base.getDay())))
    )
      dates.push(+candidate);
  }
  return dates;
}
