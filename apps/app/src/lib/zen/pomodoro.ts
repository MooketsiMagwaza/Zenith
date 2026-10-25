import { z } from 'zod';
import type { Features } from './features';
export const POMODORO_KEY='zenith.pomodoro.v1';
export const PomodoroSchema=z.object({version:z.literal(1),phase:z.enum(['focus','break','longBreak']),completed:z.number().int().nonnegative(),taskIds:z.array(z.string()).min(1),startedAt:z.number().finite().nullable(),deadline:z.number().finite().nullable()}).refine(p => (p.startedAt===null && p.deadline===null) || (p.startedAt!==null && p.deadline!==null && p.deadline>p.startedAt), 'Cycle timestamps must describe a positive phase');
export type Pomodoro=z.infer<typeof PomodoroSchema>;
export function migratePomodoro(raw:unknown):Pomodoro | null { return raw == null ? null : PomodoroSchema.parse(raw); }
export function phaseSeconds(phase:Pomodoro['phase'], config:Features['pomodoro']) {
  return 60*(phase==='focus' ? config.focusMinutes : phase==='break' ? config.breakMinutes : config.longBreakMinutes);
}
export function beginPhase(p:Pomodoro,config:Features['pomodoro'],now:number):Pomodoro {
  return {...p,startedAt:now,deadline:now+phaseSeconds(p.phase,config)*1000};
}
/** Suspended windows finish one block only. No imagined focus sessions during sleep. */
export function advancePomodoro(p:Pomodoro,config:Features['pomodoro'],now:number):Pomodoro {
  const completed=p.completed+(p.phase==='focus' ? 1 : 0);
  const phase=p.phase==='focus' ? completed%4===0 ? 'longBreak' : 'break' : 'focus';
  const next:Pomodoro={...p,phase,completed,startedAt:null,deadline:null};
  return config.autoStart ? beginPhase(next,config,now) : next;
}
/** Only the matching live focus session can be committed by a cycle. */
export function focusEnd(p:Pomodoro,active:{startedAt:number|null;taskIds:string[]},now:number) {
  return p.phase==='focus' && p.startedAt!==null && p.startedAt===active.startedAt && p.taskIds.join()===active.taskIds.join() ? Math.min(now,p.deadline!) : null;
}
