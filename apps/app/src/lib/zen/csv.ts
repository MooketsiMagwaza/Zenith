import { LogSchema } from './dataFormat';
import type { Log } from './types';
export function parseCSV(text:string) {
 const rows:string[][]=[],row:string[]=[]; let field='',quoted=false,closed=false;
 const push=() => {row.push(field); field=''; closed=false;};
 for(let i=0;i<text.length;i++) {
  const c=text[i];
  if(quoted) {if(c==='"') {if(text[i+1]==='"') {field+='"';i++;} else {quoted=false;closed=true;}} else field+=c;}
  else if(c==='"') {if(field || closed) throw new Error('Malformed CSV quote'); quoted=true;}
  else if(c===',') push();
  else if(c==='\r' || c==='\n') {if(c==='\r' && text[i+1]==='\n') i++; push(); if(row.some(s => s.length)) rows.push([...row]); row.length=0;}
  else {if(closed) throw new Error('Text after CSV closing quote'); field+=c;}
 }
 if(quoted) throw new Error('Unclosed CSV quote'); push(); if(row.some(s => s.length)) rows.push([...row]);
 if(!rows.length) throw new Error('Empty CSV'); rows[0][0]=rows[0][0].replace(/^\uFEFF/,'');
 if(new Set(rows[0]).size!==rows[0].length) throw new Error('Duplicate CSV columns');
 if(rows.some(r => r.length!==rows[0].length)) throw new Error('CSV row length differs from header');
 return rows;
}
const fields=['id','taskId','taskName','deckName','deckColor','duration','startedAt','endedAt','hasJournal'] as const;
const safe=(value:string) => /^[=+@\-\t\r\n']/.test(value) ? "'"+value : value;
const cell=(value:string) => '"'+safe(value).replace(/"/g,'""')+'"';
export function exportCSV(logs:Log[]) {
 return ['zenithCsvVersion,'+fields.join(','),...logs.map(l => ['1',...fields.map(key => String(l[key]))].map(cell).join(','))].join('\r\n')+'\r\n';
}
/** Stable import IDs prevent a second import crediting time again. */
export function importId(source:string,value:string) {
 let hash=2166136261; for(const byte of new TextEncoder().encode(value)) {hash^=byte;hash=Math.imul(hash,16777619);}
 return `import-${source}-${(hash>>>0).toString(16)}`;
}
export type DateOrder='ymd'|'dmy'|'mdy';
function dateTime(date:string,time:string,order:DateOrder) {
 const parts=date.split(/[-/]/).map(Number); if(parts.length!==3 || parts.some(n => !Number.isInteger(n))) throw new Error(`Unsupported date: ${date}`);
 const [y,m,d]=order==='ymd' ? parts : order==='dmy' ? [parts[2],parts[1],parts[0]] : [parts[2],parts[0],parts[1]];
 const match=/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(time.trim()); if(!match) throw new Error(`Unsupported time: ${time}`);
 let h=+match[1]; const minute=+match[2],second=+(match[3]??0);
 if(match[4]) {if(h<1 || h>12) throw new Error('Invalid twelve-hour time'); h=h%12+(match[4].toUpperCase()==='PM' ? 12 : 0);}
 const at=new Date(y,m-1,d,h,minute,second);
 if(y<1900 || y>9999 || at.getFullYear()!==y || at.getMonth()!==m-1 || at.getDate()!==d || at.getHours()!==h || minute>59 || second>59) throw new Error('Invalid or nonexistent local date/time');
 return +at;
}
function durationHours(s:string) {
 const match=/^(\d+):(\d{2}):(\d{2})$/.exec(s.trim());
 if(match) {if(+match[2]>59 || +match[3]>59) throw new Error('Invalid duration'); return +match[1]*3600+ +match[2]*60+ +match[3];}
 if(!/^\d+(\.\d+)?$/.test(s.trim())) throw new Error('Invalid duration'); return +s*3600;
}
export function importCSV(text:string,source:'zenith'|'toggl'|'clockify',order:DateOrder='ymd'):Log[] {
 const [headers,...rows]=parseCSV(text), normalized=headers.map(h => h.trim().toLowerCase());
 const required=source==='zenith' ? ['zenithcsvversion',...fields.map(s => s.toLowerCase())] : ['project','description','start date','start time','end date','end time'];
 for(const key of required) if(!normalized.includes(key)) throw new Error(`Missing ${source} column: ${key}`);
 return rows.map(row => {
  const get=(key:string) => {const index=normalized.indexOf(key.toLowerCase()); return index<0 ? '' : row[index];};
  if(source==='zenith') {
   if(get('zenithCsvVersion')!=='1') throw new Error('Unsupported Zenith CSV version');
   const decode=(s:string) => s.startsWith("'") ? s.slice(1) : s;
   const numeric=(key:string) => {const raw=decode(get(key)); if(!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`Invalid ${key}`); return +raw;};
   if(!['true','false'].includes(get('hasJournal'))) throw new Error('Invalid journal flag');
   return LogSchema.parse({id:decode(get('id')),taskId:decode(get('taskId')),taskName:decode(get('taskName')),deckName:decode(get('deckName')),deckColor:decode(get('deckColor')),duration:numeric('duration'),startedAt:numeric('startedAt'),endedAt:numeric('endedAt'),hasJournal:get('hasJournal')==='true'});
  }
  const startedAt=dateTime(get('start date'),get('start time'),order), endedAt=dateTime(get('end date'),get('end time'),order);
  const duration=durationHours(get('duration') || get('duration (h)') || get('duration (decimal)'));
  const taskName=get('description').trim() || 'Imported focus',deckName=get('project').trim() || `Imported ${source}`;
  const taskId=importId(source,JSON.stringify([deckName,taskName]));
  return LogSchema.parse({id:importId(source,JSON.stringify([taskId,startedAt,endedAt,duration])),taskId,taskName,deckName,deckColor:'#c9a84c',duration,startedAt,endedAt,hasJournal:false});
 });
}
