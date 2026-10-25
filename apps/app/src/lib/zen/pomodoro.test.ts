import {it,expect} from 'vitest';
import {migrateFeatures} from './features';
import {beginPhase,advancePomodoro,migratePomodoro,phaseSeconds,focusEnd,type Pomodoro} from './pomodoro';
const base:Pomodoro={version:1,phase:'focus',completed:0,taskIds:['invented-card'],startedAt:null,deadline:null};
it('presets/custom lengths use seconds and manual phases wait',() => {
 const c=migrateFeatures(null).pomodoro;
 expect(phaseSeconds('focus',c)).toBe(1500); expect(phaseSeconds('break',c)).toBe(300);
 expect(phaseSeconds('focus',{...c,focusMinutes:50})).toBe(3000);
 const next=advancePomodoro(beginPhase(base,c,1000),c,1501000); expect(next.phase).toBe('break'); expect(next.deadline).toBe(null);
});
it('takes a long break after exactly four focus blocks and repeats',() => {
 const c=migrateFeatures(null).pomodoro; let p=base;
 for(let i=1;i<=8;i++) {p=advancePomodoro(p,c,0); expect(p.phase).toBe(i%4===0 ? 'longBreak':'break'); p=advancePomodoro(p,c,0); expect(p.phase).toBe('focus'); expect(p.completed).toBe(i);}
});
it('auto-start after suspension begins now and invents no missed blocks',() => {
 const c={...migrateFeatures(null).pomodoro,autoStart:true,focusMinutes:7,breakMinutes:3};
 const next=advancePomodoro(beginPhase(base,c,0),c,86400000);
 expect(next.completed).toBe(1); expect(next.startedAt).toBe(86400000); expect(next.deadline).toBe(86580000);
});
it('migrates a saved cycle without changing input and rejects future data',() => {
 const original=structuredClone(base); expect(migratePomodoro(base)).toEqual(original); expect(base).toEqual(original);
 expect(migratePomodoro(null)).toBe(null); expect(() => migratePomodoro({...base,version:2})).toThrow(); expect(migrateFeatures({version:1}).pomodoro.enabled).toBe(false);
});
it('caps focus logging at deadline and cannot stop another card or a break',() => {
 const p=beginPhase(base,migrateFeatures(null).pomodoro,1000), active={startedAt:1000,taskIds:base.taskIds};
 expect(focusEnd(p,active,86400000)).toBe(1501000); expect(focusEnd(p,active,61000)).toBe(61000);
 expect(focusEnd(p,{...active,taskIds:['another']},86400000)).toBe(null);
 expect(focusEnd({...p,phase:'break'},active,86400000)).toBe(null);
 expect(() => migratePomodoro({...p,deadline:0})).toThrow();
});
