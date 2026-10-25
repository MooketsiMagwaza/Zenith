import type { Log } from './types';
import type { Reminder } from './useReminders';
import { importId } from './csv';
import { LogSchema, ReminderSchema } from './dataFormat';
function unescape(s:string) {return s.replace(/\\([nN,;\\])/g,(_m,c:string) => c==='n' || c==='N' ? '\n' : c);}
function stamp(s:string) {
 const m=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(s); if(!m) throw new Error('Only timed UTC or floating-local calendar events are supported');
 const [y,mo,d,h,mi,se]=m.slice(1,7).map(Number);
 const result=m[7] ? new Date(Date.UTC(y,mo-1,d,h,mi,se)) : new Date(y,mo-1,d,h,mi,se);
 const values=m[7] ? [result.getUTCFullYear(),result.getUTCMonth()+1,result.getUTCDate(),result.getUTCHours(),result.getUTCMinutes(),result.getUTCSeconds()] : [result.getFullYear(),result.getMonth()+1,result.getDate(),result.getHours(),result.getMinutes(),result.getSeconds()];
 if(y<1900 || values.join()!==[y,mo,d,h,mi,se].join()) throw new Error('Invalid calendar date/time'); return +result;
}
export function importICS(text:string) {
 const lines=text.replace(/\r?\n[ \t]/g,'').split(/\r?\n/);
 if(!lines.includes('BEGIN:VCALENDAR') || !lines.includes('VERSION:2.0') || !lines.includes('END:VCALENDAR')) throw new Error('Expected iCalendar 2.0');
 const logs:Log[]=[],reminders:Reminder[]=[]; let event:Record<string,string> | null=null;
 for(const line of lines) {
  if(line==='BEGIN:VEVENT') {if(event) throw new Error('Nested calendar events'); event={};continue;}
  if(line==='END:VEVENT') {
   if(!event) throw new Error('Unexpected calendar end');
   const get=(key:string) => event![key] ?? '';
   const uid=get('UID'); if(!uid || !get('DTSTART')) throw new Error('Calendar event requires UID and DTSTART');
   const startedAt=stamp(get('DTSTART')), name=unescape(get('SUMMARY')) || 'Imported calendar', deckName=unescape(get('DESCRIPTION')) || 'Imported calendar';
   const kind=get('X-ZENITH-TYPE') || (get('DTEND') ? 'session' : 'reminder');
   const id=uid.endsWith('@zenith.local') && /^(session|reminder)-/.test(uid) ? decodeURIComponent(uid.replace(/^(session|reminder)-/,'').replace(/@zenith.local$/,'')) : importId('ics',uid);
   const targetId=unescape(get('X-ZENITH-TARGET-ID')) || importId('ics-card',name);
   if(get('STATUS')!=='CANCELLED') {
    if(kind==='session') {
     if(!get('DTEND') || get('RRULE')) throw new Error('A session needs an end and cannot repeat');
     const endedAt=stamp(get('DTEND')), duration=get('X-ZENITH-DURATION') ? +get('X-ZENITH-DURATION') : (endedAt-startedAt)/1000;
     logs.push(LogSchema.parse({id,taskId:targetId,taskName:name,deckName,deckColor:get('X-ZENITH-DECK-COLOR') || '#c9a84c',duration,startedAt,endedAt,hasJournal:get('X-ZENITH-HAS-JOURNAL')==='true'}));
    } else if(kind==='reminder') {
     const rule=get('RRULE'), days=['SU','MO','TU','WE','TH','FR','SA']; let repeat:Reminder['repeat']='none',weekday:number | undefined;
     if(rule==='FREQ=DAILY') repeat='daily';
     else if(rule==='FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR') repeat='weekdays';
     else if(/^FREQ=WEEKLY;BYDAY=(SU|MO|TU|WE|TH|FR|SA)$/.test(rule)) {repeat='weekly';weekday=days.indexOf(rule.split('=')[2]);}
     else if(rule) throw new Error('Unsupported recurrence; only daily, weekdays and weekly are supported');
     reminders.push(ReminderSchema.parse({id,targetType:get('X-ZENITH-TARGET-TYPE') || 'task',targetId,label:name,deckName:get('X-ZENITH-DECK-NAME') ? unescape(get('X-ZENITH-DECK-NAME')) : undefined,deckColor:get('X-ZENITH-DECK-COLOR') || undefined,fireAt:get('X-ZENITH-FIRE-AT') ? +get('X-ZENITH-FIRE-AT') : startedAt,repeat,weekday,enabled:true,notify:get('X-ZENITH-NOTIFY')==='true',sound:get('X-ZENITH-SOUND')==='true',createdAt:get('DTSTAMP') ? stamp(get('DTSTAMP')) : startedAt,lastFiredAt:get('X-ZENITH-LAST-FIRED') ? +get('X-ZENITH-LAST-FIRED') : undefined}));
    } else throw new Error('Unsupported Zenith calendar event type');
   }
   event=null;continue;
  }
  if(event) {
   const colon=line.indexOf(':'); if(colon<0) throw new Error('Malformed calendar property');
   const key=line.slice(0,colon).toUpperCase();
   if(key.includes(';TZID=') || /^(RDATE|EXDATE|DURATION|RECURRENCE-ID)/.test(key) || key==='BEGIN' || key==='END') throw new Error('Time-zone tables, exceptions, durations and alarms are not supported');
   if(key.includes(';') && /^(DTSTART|DTEND)/.test(key)) throw new Error('Unsupported calendar date parameters');
   if(key in event) throw new Error('Duplicate calendar property'); event[key]=line.slice(colon+1);
  }
 }
 if(event) throw new Error('Unclosed calendar event'); return {logs,reminders};
}
