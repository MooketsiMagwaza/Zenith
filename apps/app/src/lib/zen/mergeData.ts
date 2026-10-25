import { validateSnapshot, type DataSnapshot } from './dataFormat';
import { importId } from './csv';
import type { Journal, Log } from './types';
import type { Reminder } from './useReminders';
const stable=(value:unknown):unknown => Array.isArray(value) ? value.map(stable) : value && typeof value==='object' ? Object.fromEntries(Object.entries(value).filter(([,v]) => v!==undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,stable(v)])) : value;
const same=(a:unknown,b:unknown) => JSON.stringify(stable(a))===JSON.stringify(stable(b));
/** Merge without discarding existing entities, time or journal bodies. */
export function mergeData(before:DataSnapshot, incoming:{logs?:Log[];journals?:Journal[];reminders?:Reminder[]}) {
 const data=structuredClone(before);
 const ensureTask=(id:string,name:string,deckName:string) => {
  const existing=data.decks.flatMap(d => d.tasks).find(t => t.id===id); if(existing) return existing;
  const title=deckName || 'Imported journals'; let deck=data.decks.find(d => d.name===title);
  if(!deck) {deck={id:importId('deck',title),name:title,color:'#c9a84c',tasks:[]}; if(data.decks.some(d => d.id===deck!.id)) throw new Error('Imported deck identifier collision'); data.decks.push(deck);}
  const task={id,deckId:deck.id,name:name || 'Imported focus',tag:'Imported',totalSeconds:0,createdAt:Date.now(),mode:'stopwatch' as const}; deck.tasks.push(task); return task;
 };
 for(const l of incoming.logs ?? []) {
  const old=data.logs.find(x => x.id===l.id);
  if(old) {if(!same(old,l)) throw new Error('A session ID already exists with different content'); continue;}
  const task=ensureTask(l.taskId,l.taskName,l.deckName); task.totalSeconds+=l.duration; data.logs.push(l);
 }
 for(const j of incoming.journals ?? []) {
  const next={...j};
  if(j.taskId) {const task=ensureTask(j.taskId,j.taskName,j.deckName ?? ''); next.deckId=task.deckId;}
  else if(j.deckId && !data.decks.some(d => d.id===j.deckId)) data.decks.push({id:j.deckId,name:j.deckName || 'Imported journals',color:j.deckColor || '#c9a84c',tasks:[]});
  const old=data.journals.find(x => j.taskId ? x.taskId===j.taskId : !x.taskId && x.deckId===j.deckId);
  if(!old) data.journals.push(next);
  else if(old.body!==j.body) {
   const marker=`<!-- zenith-import:${encodeURIComponent(j.id)}:${importId('body',j.body)} -->`;
   if(!old.body.includes(marker)) {old.body+=`\n\n---\n${marker}\n\n${j.body}`; old.updatedAt=Math.max(old.updatedAt,j.updatedAt); old.wordCount=old.body.trim().split(/\s+/).filter(Boolean).length;}
  }
 }
 for(const r of incoming.reminders ?? []) {
  if(r.targetType==='task') ensureTask(r.targetId,r.label,r.deckName ?? 'Imported calendar');
  else if(!data.decks.some(d => d.id===r.targetId)) data.decks.push({id:r.targetId,name:r.label,color:r.deckColor || '#c9a84c',tasks:[]});
  const old=data.reminders.find(x => x.id===r.id);
  if(old) {if(!same(old,r)) throw new Error('A reminder ID already exists with different content');} else data.reminders.push(r);
 }
 return validateSnapshot(data);
}
