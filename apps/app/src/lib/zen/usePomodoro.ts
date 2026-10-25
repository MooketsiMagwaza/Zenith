import { useEffect, useRef, useState } from 'react';
import { storage } from '../platform';
import { POMODORO_KEY, advancePomodoro, beginPhase, migratePomodoro, focusEnd, type Pomodoro } from './pomodoro';
import type { useTogglZen } from './useTogglZen';
import type { useFeatures } from './useFeatures';
import { companionMessage } from './companion';
import { notify } from './notify';
export function usePomodoro(z:ReturnType<typeof useTogglZen>,features:ReturnType<typeof useFeatures>) {
  const [error,setError]=useState('');
  const [editable]=useState(() => { try { migratePomodoro(JSON.parse(storage.getItem(POMODORO_KEY) ?? 'null')); return true; } catch { return false; } });
  const [value,setValue]=useState<Pomodoro | null>(() => { try { return migratePomodoro(JSON.parse(storage.getItem(POMODORO_KEY) ?? 'null')); } catch { return null; } });
  const current=useRef(value); current.current=value;
  const [now,setNow]=useState(Date.now());
  const config=features.value.pomodoro;
  const save=(next:Pomodoro | null) => {
    if(!editable) return;
    current.current=next; setValue(next);
    try { storage.setItem(POMODORO_KEY,JSON.stringify(next)); setError(''); }
    catch { setError('This cycle could not be saved. It applies for this visit only.'); }
  };
  const tasks=(p:Pomodoro) => z.decks.flatMap(d => d.tasks).filter(t => p.taskIds.includes(t.id));
  const announce=(p:Pomodoro) => {
    if(!features.value.companion.enabled) return;
    const task=tasks(p)[0];
    notify.info(p.phase==='focus' ? companionMessage(task?.name ?? 'your focus',task?.id,features.value) : p.phase==='longBreak' ? 'Time for a longer break.' : 'Time for a break.');
  };
  const start=(taskId:string) => {
    if(!editable || !config.enabled) return;
    const p=beginPhase({version:1,phase:'focus',completed:0,taskIds:[taskId],startedAt:null,deadline:null},config,Date.now());
    const selected=tasks(p); if(!selected.length) return;
    z.startTasks(selected,p.startedAt!); save(p); announce(p);
  };
  const next=() => {
    const p=current.current; if(!p || p.startedAt!==null || !editable || !config.enabled) return;
    const selected=tasks(p); if(!selected.length) {save(null); return;}
    const started=beginPhase(p,config,Date.now());
    if(started.phase==='focus') z.startTasks(selected,started.startedAt!);
    save(started); announce(started);
  };
  const stop=() => {
    const p=current.current;
    const endedAt=p ? focusEnd(p,z.active,Date.now()) : null;
    if(endedAt!==null) z.stopTask(endedAt);
    save(null);
  };
  const latest=useRef({z,features,save,announce}); latest.current={z,features,save,announce};
  useEffect(() => {
    const check=() => {
      const {z,features,save,announce}=latest.current;
      const p=current.current, now=Date.now(); setNow(now);
      if(!p || !z.hydrated) return;
      const expected = p.phase==='focus' && p.startedAt!==null;
      if(!features.value.pomodoro.enabled) {
        if(expected && z.active.startedAt===p.startedAt) z.stopTask(Math.min(now,p.deadline ?? now));
        save(null); return;
      }
      if(!p.taskIds.every(id => z.decks.some(d => d.tasks.some(t => t.id===id)))) {save(null); return;}
      if(expected && (z.active.startedAt!==p.startedAt || z.active.taskIds.join()!==p.taskIds.join())) {save(null); return;}
      if(!expected && z.active.startedAt!==null) {save(null); return;}
      if(p.deadline!==null && p.deadline<=now) {
        const endedAt=focusEnd(p,z.active,now);
        if(endedAt!==null) z.stopTask(endedAt);
        const advanced=advancePomodoro(p,features.value.pomodoro,now);
        // Never auto-start into a completion dialog. Waiting preserves a calm recap.
        if(features.value.rewards.recap || features.value.rewards.affirmations || features.value.rewards.milestones) {advanced.startedAt=null; advanced.deadline=null;}
        if(advanced.phase==='focus' && advanced.startedAt!==null) {
          const selected=z.decks.flatMap(d => d.tasks).filter(t => advanced.taskIds.includes(t.id));
          z.startTasks(selected,advanced.startedAt);
        }
        save(advanced); announce(advanced);
      }
    };
    check(); const id=setInterval(check,1000); return () => clearInterval(id);
  },[]);
  return {value,now,error:editable ? error : 'The saved cycle has a newer or unreadable format. It has been preserved.',editable,start,next,stop};
}
