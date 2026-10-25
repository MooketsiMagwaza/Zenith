import {it,expect} from 'vitest';
import {exportICS,foldICS,utcStamp} from './ics';
import {calendarDays,reminderOccurrences} from './calendar';
import type {Reminder} from './useReminders';
import type {Log} from './types';
const at=+new Date(2026,9,9,9);
const r:Reminder={id:'sample-r',targetType:'task',targetId:'t',label:'Sample, read; Gatsby\nquietly',fireAt:at,repeat:'weekdays',enabled:true,notify:false,sound:false,createdAt:at};
const l:Log={id:'sample-l',taskId:'t',taskName:'Sample \\ title',deckName:'Sample deck',deckColor:'#c9a84c',duration:60,startedAt:at,endedAt:at+60000,hasJournal:false};
it('exports escaped ICS text, UTC sessions, floating recurring local reminders and stable UIDs',() => {
 const first=exportICS([l],[r]); expect(first).toContain('Sample\\, read\\; Gatsby\\nquietly'); expect(first).toContain('Sample \\\\ title');
 expect(first).toContain(`DTSTART:${utcStamp(at)}`); expect(first).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'); expect(first).toContain('UID:session-sample-l@zenith.local'); expect(exportICS([l],[r])).toBe(first);
});
it('folds at 75 UTF-8 octets without breaking characters',() => {
 const source='SUMMARY:'+ '雪😀'.repeat(40), folded=foldICS(source);
 for(const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length<=75).toBe(true);
 expect(folded.replace(/\r\n /g,'')).toBe(source);
});
it('exports daily, weekly and one-off recurrence and excludes disabled reminders',() => {
 expect(exportICS([],[{...r,repeat:'daily'}])).toContain('RRULE:FREQ=DAILY');
 expect(exportICS([],[{...r,repeat:'weekly',weekday:1}])).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
 expect(exportICS([],[{...r,repeat:'none'}])).not.toContain('RRULE'); expect(exportICS([],[{...r,enabled:false}])).not.toContain('BEGIN:VEVENT');
});
it('builds Monday-based month/week grids and expands reminders only from their first date',() => {
 const week=calendarDays(at,'week'); expect(week).toHaveLength(7); expect(week[0].getDay()).toBe(1); expect(calendarDays(at,'month')).toHaveLength(42);
 expect(reminderOccurrences(r,+new Date(2026,9,5),+new Date(2026,9,13))).toHaveLength(2);
 expect(reminderOccurrences({...r,repeat:'none'},at,at+1)).toEqual([at]); expect(reminderOccurrences({...r,enabled:false},at,at+1000)).toEqual([]);
});
