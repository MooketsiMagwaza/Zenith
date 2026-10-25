import { it, expect } from 'vitest';
import { isReminderDue, nextReminderAt } from './reminderSchedule';
import { AgentStore } from '../../../../popup/src/bridge/store';
import { exportICS, localStamp } from './ics';
import type { Reminder } from './useReminders';
const at = +new Date(2026, 9, 12, 9);
const r: Reminder = {
  id: 'sample-future',
  targetType: 'task',
  targetId: 'sample-card',
  label: 'Invented future reminder',
  fireAt: at,
  repeat: 'daily',
  enabled: true,
  notify: false,
  sound: false,
  createdAt: at,
};
it('both reminder engines wait for the scheduled first date and deduplicate delivery', () => {
  for (const due of [isReminderDue, AgentStore.isDue]) {
    expect(due(r, +new Date(2026, 9, 9, 9))).toBe(false);
    expect(due(r, at)).toBe(true);
    expect(due({ ...r, lastFiredAt: at }, at + 15000)).toBe(false);
    expect(due(r, at + 90000)).toBe(false);
    expect(due({ ...r, enabled: false }, at)).toBe(false);
  }
});
it('next occurrence respects future start dates and weekly/weekday choices', () => {
  expect(nextReminderAt(r, +new Date(2026, 9, 9))).toBe(at);
  expect(
    nextReminderAt(
      { ...r, repeat: 'weekdays', fireAt: +new Date(2026, 9, 10, 9) },
      +new Date(2026, 9, 9),
    ),
  ).toBe(at);
  expect(nextReminderAt({ ...r, repeat: 'weekly', weekday: 4 }, at)).toBe(
    +new Date(2026, 9, 15, 9),
  );
});
it('weekday ICS starts on the first eligible weekday and retains original reminder time', () => {
  const fireAt = +new Date(2026, 9, 10, 9),
    ics = exportICS([], [{ ...r, repeat: 'weekdays', fireAt }]);
  expect(ics).toContain(`DTSTART:${localStamp(at)}`);
  expect(ics).toContain(`X-ZENITH-FIRE-AT:${fireAt}`);
});
