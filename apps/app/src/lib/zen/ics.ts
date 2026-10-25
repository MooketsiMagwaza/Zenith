import type { Log } from './types';
import type { Reminder } from './useReminders';
const pad = (n: number) => String(n).padStart(2, '0');
export const utcStamp = (n: number) =>
  new Date(n)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
export const localStamp = (n: number) => {
  const d = new Date(n);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};
export const escapeICS = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
/** RFC 5545's limit is octets, not UTF-16 characters. Never split a code point. */
export function foldICS(line: string) {
  const encoder = new TextEncoder();
  let result = '',
    part = '',
    bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      result += part + '\r\n';
      part = ' ';
      bytes = 1;
    }
    part += char;
    bytes += size;
  }
  return result + part;
}
const weekday = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export function exportICS(logs: Log[], reminders: Reminder[]) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zenith//Open data v1//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const l of logs)
    lines.push(
      'BEGIN:VEVENT',
      `UID:session-${encodeURIComponent(l.id)}@zenith.local`,
      `DTSTAMP:${utcStamp(l.endedAt)}`,
      `DTSTART:${utcStamp(l.startedAt)}`,
      `DTEND:${utcStamp(l.endedAt)}`,
      `SUMMARY:${escapeICS(l.taskName)}`,
      `DESCRIPTION:${escapeICS(l.deckName)}`,
      `X-ZENITH-TYPE:session`,
      `X-ZENITH-TARGET-ID:${escapeICS(l.taskId)}`,
      `X-ZENITH-DURATION:${l.duration}`,
      `X-ZENITH-DECK-COLOR:${escapeICS(l.deckColor)}`,
      `X-ZENITH-HAS-JOURNAL:${l.hasJournal}`,
      'END:VEVENT',
    );
  for (const r of reminders.filter((r) => r.enabled)) {
    const start = new Date(r.fireAt);
    if (r.repeat !== 'none') start.setSeconds(0, 0);
    if (r.repeat === 'weekdays')
      while (start.getDay() === 0 || start.getDay() === 6) start.setDate(start.getDate() + 1);
    if (r.repeat === 'weekly')
      while (start.getDay() !== (r.weekday ?? start.getDay())) start.setDate(start.getDate() + 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:reminder-${encodeURIComponent(r.id)}@zenith.local`,
      `DTSTAMP:${utcStamp(r.createdAt)}`,
      `DTSTART:${r.repeat === 'none' ? utcStamp(+start) : localStamp(+start)}`,
      `SUMMARY:${escapeICS(r.label)}`,
      `X-ZENITH-TYPE:reminder`,
      `X-ZENITH-TARGET-ID:${escapeICS(r.targetId)}`,
      `X-ZENITH-TARGET-TYPE:${r.targetType}`,
    );
    if (r.repeat !== 'none')
      lines.push(
        r.repeat === 'weekly'
          ? `RRULE:FREQ=WEEKLY;BYDAY=${weekday[r.weekday ?? start.getDay()]}`
          : r.repeat === 'weekdays'
            ? 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
            : 'RRULE:FREQ=DAILY',
      );
    lines.push(
      `X-ZENITH-FIRE-AT:${r.fireAt}`,
      `X-ZENITH-NOTIFY:${r.notify}`,
      `X-ZENITH-SOUND:${r.sound}`,
    );
    if (r.deckName !== undefined) lines.push(`X-ZENITH-DECK-NAME:${escapeICS(r.deckName)}`);
    if (r.deckColor !== undefined) lines.push(`X-ZENITH-DECK-COLOR:${escapeICS(r.deckColor)}`);
    if (r.lastFiredAt !== undefined) lines.push(`X-ZENITH-LAST-FIRED:${r.lastFiredAt}`);
    lines.push('END:VEVENT');
  }
  return lines.concat('END:VCALENDAR').map(foldICS).join('\r\n') + '\r\n';
}
