import { useState } from 'react';
import type { useTogglZen } from '@/lib/zen/useTogglZen';
import type { Reminder } from '@/lib/zen/useReminders';
import type { FeatureStore } from './ProgressView';
import { GoalBar } from './ProgressView';
import { calendarDays, reminderOccurrences } from '@/lib/zen/calendar';
import { dayStart, secondsWithin, targetInfo } from '@/lib/zen/progress';
import { exportICS } from '@/lib/zen/ics';
import { download } from '@/lib/zen/download';
import { formatDuration, dateKey } from '@/lib/zen/utils';
export function CalendarView({z,features,reminders,openTarget}: {z:ReturnType<typeof useTogglZen>;features:FeatureStore;reminders:Reminder[];openTarget:(type:'task'|'deck',id:string)=>void}) {
 const [anchor,setAnchor]=useState(Date.now()), [selected,setSelected]=useState(Date.now()), [mode,setMode]=useState<'month'|'week'>('month');
 const days=calendarDays(anchor,mode), start=+dayStart(selected), endDate=new Date(start); endDate.setDate(endDate.getDate()+1); const end=+endDate;
 const logs=z.logs.filter(l => secondsWithin(l,start,end)>0);
 const occurrences=reminders.flatMap(r => reminderOccurrences(r,start,end).map(at => ({r,at})));
 const exists=(id:string) => z.decks.some(d => d.tasks.some(t => t.id===id));
 const shift=(direction:number) => {const d=new Date(anchor); if(mode==='month') {d.setDate(1); d.setMonth(d.getMonth()+direction);} else d.setDate(d.getDate()+direction*7); setAnchor(+d); setSelected(+d);};
 return <section className="feature-page"><h1>Calendar</h1><p>Sessions and enabled reminders, in your local time. Select a date, then open a card. Goals use the selected date.</p>
 <div className="calendar-controls"><button onClick={() => shift(-1)} aria-label={`Previous ${mode}`}>Previous</button><h2>{new Date(anchor).toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2><button onClick={() => shift(1)} aria-label={`Next ${mode}`}>Next</button>
 <button aria-pressed={mode==='month'} onClick={() => setMode('month')}>Month</button><button aria-pressed={mode==='week'} onClick={() => setMode('week')}>Week</button><button onClick={() => {setAnchor(Date.now());setSelected(Date.now());}}>Today</button><button onClick={() => download('zenith-calendar.ics',exportICS(z.logs,reminders),'text/calendar;charset=utf-8')}>Export sessions and enabled reminders (.ics)</button></div>
 <div className="calendar-grid" aria-label={`${mode} calendar`}>{days.map(d => {const next=new Date(d); next.setDate(next.getDate()+1); const sessions=z.logs.filter(l => secondsWithin(l,+d,+next)>0).length; const due=reminders.reduce((n,r) => n+reminderOccurrences(r,+d,+next).length,0); return <button key={+d} aria-pressed={dateKey(+d)===dateKey(selected)} aria-label={`${d.toLocaleDateString()}: ${sessions} sessions, ${due} reminders`} onClick={() => setSelected(+d)}><span>{d.toLocaleDateString(undefined,{weekday:'short'})}</span><strong>{d.getDate()}</strong><small>{sessions} sessions<br />{due} reminders</small></button>;})}</div>
 <h2>{new Date(selected).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2>
 {!logs.length && !occurrences.length && <p>No sessions or reminders on this day.</p>}
 <div className="feature-grid">{logs.map(l => <article key={l.id}><h3>{l.taskName}</h3><p>{formatDuration(secondsWithin(l,start,end))} on this day · {l.deckName}</p><button disabled={!exists(l.taskId)} onClick={() => openTarget('task',l.taskId)}>{exists(l.taskId) ? 'Open card' : 'Card removed'}</button></article>)}
 {occurrences.map(({r,at}) => <article key={`${r.id}:${at}`}><h3>{r.label}</h3><p>Reminder · {new Date(at).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</p><button onClick={() => openTarget(r.targetType,r.targetId)}>Open {r.targetType==='task' ? 'card' : 'deck'}</button></article>)}</div>
 {features.value.progress && Object.keys(features.value.goals).filter(key => targetInfo(z.decks,key).title).map(key => <article key={key}><h3>{targetInfo(z.decks,key).title}</h3><GoalBar z={z} features={features} target={key} now={start+12*3600000} /></article>)}
 </section>;
}
