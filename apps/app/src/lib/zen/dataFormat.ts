import { z } from 'zod';
import { migrateActive } from './migration';
import { migrateFeatures } from './features';
import { migratePomodoro } from './pomodoro';
const id=z.string().min(1).max(1000), number=z.number().finite().min(-8640000000000000).max(8640000000000000), seconds=number.nonnegative();
export const TaskSchema=z.object({id,deckId:id,name:z.string(),tag:z.string(),totalSeconds:seconds,createdAt:number,checklist:z.array(z.object({id,text:z.string(),done:z.boolean()}).passthrough()).optional(),mode:z.enum(['stopwatch','countdown']).optional(),targetSeconds:seconds.optional()}).passthrough();
export const DeckSchema=z.object({id,name:z.string(),color:z.string(),tasks:z.array(TaskSchema)}).passthrough();
export const LogSchema=z.object({id,taskId:id,taskName:z.string(),deckName:z.string(),deckColor:z.string(),duration:seconds,startedAt:number,endedAt:number,hasJournal:z.boolean()}).passthrough().refine(l => l.endedAt>=l.startedAt,'Session end precedes start');
export const JournalSchema=z.object({id,taskId:id.nullable(),taskName:z.string(),deckId:id.nullable(),deckName:z.string().nullable(),deckColor:z.string().nullable().optional(),logId:id.nullable(),body:z.string(),wordCount:seconds,createdAt:number,updatedAt:number}).passthrough();
export const ReminderSchema=z.object({id,targetType:z.enum(['task','deck']),targetId:id,label:z.string(),deckName:z.string().optional(),deckColor:z.string().optional(),fireAt:number,repeat:z.enum(['none','daily','weekdays','weekly']),weekday:z.number().int().min(0).max(6).optional(),enabled:z.boolean(),notify:z.boolean(),sound:z.boolean(),createdAt:number,lastFiredAt:number.optional()}).passthrough();
export const SnapshotSchema=z.object({decks:z.array(DeckSchema),logs:z.array(LogSchema),journals:z.array(JournalSchema),reminders:z.array(ReminderSchema).default([])});
export type DataSnapshot=z.infer<typeof SnapshotSchema>;
export const DATA_KEYS={decks:'toggl_zen_decks',logs:'toggl_zen_logs',journals:'toggl_zen_journals',reminders:'toggl_zen_reminders',active:'toggl_zen_active',features:'zenith.features.v1',pomodoro:'zenith.pomodoro.v1'};
export const isDataKey=(key:string) => key.startsWith('toggl_zen_') || key.startsWith('zenith.') && !key.startsWith('zenith.popup.');
function unique(ids:string[],name:string) {if(new Set(ids).size!==ids.length) throw new Error(`Duplicate ${name} identifiers`);}
export function validateSnapshot(raw:unknown):DataSnapshot {
 const data=SnapshotSchema.parse(raw), tasks=data.decks.flatMap(d => d.tasks), taskIds=new Set(tasks.map(t => t.id)), deckIds=new Set(data.decks.map(d => d.id));
 unique(data.decks.map(d => d.id),'deck'); unique(tasks.map(t => t.id),'card'); unique(data.logs.map(l => l.id),'session'); unique(data.journals.map(j => j.id),'journal'); unique(data.reminders.map(r => r.id),'reminder');
 unique(data.journals.map(j => j.taskId ? `task:${j.taskId}` : `deck:${j.deckId}`),'journal target');
 for(const d of data.decks) if(d.tasks.some(t => t.deckId!==d.id)) throw new Error('Card belongs to a different deck');
 for(const j of data.journals) if(j.taskId ? !taskIds.has(j.taskId) : !j.deckId || !deckIds.has(j.deckId)) throw new Error('Journal target is missing');
 for(const r of data.reminders) if(r.targetType==='task' ? !taskIds.has(r.targetId) : !deckIds.has(r.targetId)) throw new Error('Reminder target is missing');
 return data;
}
export function snapshotFromRecords(records:Record<string,string>) {
 const read=(key:string,fallback:unknown) => records[key]===undefined ? fallback : JSON.parse(records[key]);
 const data=validateSnapshot(Object.fromEntries((['decks','logs','journals','reminders'] as const).map(key => [key,read(DATA_KEYS[key],[])])));
 const active=migrateActive(read(DATA_KEYS.active,null));
 z.object({taskIds:z.array(id),deckIds:z.array(id),startedAt:number.nullable()}).parse(active);
 if(active.taskIds.length!==active.deckIds.length || active.startedAt!==null && !active.taskIds.length) throw new Error('Invalid active session');
 migrateFeatures(read(DATA_KEYS.features,null)); migratePomodoro(read(DATA_KEYS.pomodoro,null));
 return {...data,active};
}
export function exportJSON(records:Record<string,string>,now=Date.now()) {
 return JSON.stringify({format:'zenith',version:1,exportedAt:new Date(now).toISOString(),records:Object.fromEntries(Object.entries(records).filter(([key]) => isDataKey(key)))},null,2)+'\n';
}
/** Full backup records keep their original strings; legacy invented snapshots map to old keys. */
export function importJSON(text:string) {
 const raw=JSON.parse(text); let records:Record<string,string>;
 if(raw.format!==undefined || raw.version!==undefined) {
  const envelope=z.object({format:z.literal('zenith'),version:z.literal(1),exportedAt:z.string(),records:z.record(z.string())}).parse(raw);
  records=envelope.records;
  if(Object.keys(records).some(k => !isDataKey(k))) throw new Error('Backup contains keys outside Zenith');
  for(const key of ['decks','logs','journals'] as const) if(records[DATA_KEYS[key]]===undefined) throw new Error(`Backup is missing ${key}`);
 } else {
  validateSnapshot(raw);
  records=Object.fromEntries(Object.entries(DATA_KEYS).filter(([key]) => raw[key]!==undefined).map(([key,storageKey]) => [storageKey,JSON.stringify(raw[key])]));
 }
 snapshotFromRecords(records); return records;
}
export function recordsWithSnapshot(records:Record<string,string>,snapshot:DataSnapshot) {
 return {...records,...Object.fromEntries((['decks','logs','journals','reminders'] as const).map(key => [DATA_KEYS[key],JSON.stringify(snapshot[key])]))};
}
export async function applyRecords(storage:{getItem:(k:string)=>string|null;setItem:(k:string,v:string)=>void;removeItem:(k:string)=>void;entries:()=>[string,string][];flush?:()=>Promise<void>},records:Record<string,string>) {
 if(Object.keys(records).some(k => !isDataKey(k))) throw new Error('Import contains keys outside Zenith');
 snapshotFromRecords(records);
 const before=Object.fromEntries(storage.entries().filter(([k]) => isDataKey(k)));
 const write=(next:Record<string,string>) => {for(const [key] of storage.entries()) if(isDataKey(key) && !(key in next)) storage.removeItem(key); for(const [key,value] of Object.entries(next)) storage.setItem(key,value);};
 try {write(records); await storage.flush?.();} catch(error) {write(before); await storage.flush?.(); throw error;}
}
