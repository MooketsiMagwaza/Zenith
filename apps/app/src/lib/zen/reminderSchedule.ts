import type { Reminder } from './useReminders';
type Schedule = Pick<Reminder, 'enabled' | 'repeat' | 'fireAt' | 'lastFiredAt' | 'weekday'>;
/** Repeats have minute precision and never begin before their chosen local date. */
export function repeatStart(r: Schedule) {
  const first = new Date(r.fireAt);
  first.setSeconds(0, 0);
  return +first;
}
export function isReminderDue(r: Schedule, now: number) {
  if (!r.enabled) return false;
  const last = r.lastFiredAt ?? -Infinity;
  if (r.repeat === 'none') return r.fireAt <= now && last < r.fireAt;
  const base = new Date(r.fireAt),
    trigger = new Date(now);
  trigger.setHours(base.getHours(), base.getMinutes(), 0, 0);
  const day = trigger.getDay(),
    at = +trigger;
  const dayOk =
    r.repeat === 'daily' ||
    (r.repeat === 'weekdays' && day >= 1 && day <= 5) ||
    (r.repeat === 'weekly' && day === (r.weekday ?? base.getDay()));
  return dayOk && at >= repeatStart(r) && at <= now && now - at < 90000 && last < at;
}
export function nextReminderAt(r: Schedule, from = Date.now()): number | null {
  if (r.repeat === 'none') return r.fireAt > from ? r.fireAt : null;
  const base = new Date(r.fireAt),
    first = repeatStart(r),
    candidate = new Date(Math.max(from, first));
  candidate.setHours(base.getHours(), base.getMinutes(), 0, 0);
  if (+candidate <= from || +candidate < first) candidate.setDate(candidate.getDate() + 1);
  while (
    (r.repeat === 'weekdays' && (candidate.getDay() === 0 || candidate.getDay() === 6)) ||
    (r.repeat === 'weekly' && candidate.getDay() !== (r.weekday ?? base.getDay()))
  )
    candidate.setDate(candidate.getDate() + 1);
  return +candidate;
}
