import { useState } from 'react';
import type { useTogglZen } from '@/lib/zen/useTogglZen';
import type { usePomodoro } from '@/lib/zen/usePomodoro';
import type { FeatureStore } from './ProgressView';
import { formatTime } from '@/lib/zen/utils';
export function PomodoroView({z,features,p}: {z:ReturnType<typeof useTogglZen>; features:FeatureStore;p:ReturnType<typeof usePomodoro>}) {
 const [task,setTask]=useState(''); const config=features.value.pomodoro;
 return <section className="feature-page"><h1>Pomodoro</h1><p>Give one card a focus block, then take a break. A longer break follows every four completed focus blocks. Ctrl/⌘ + Alt + P opens this view or starts the waiting phase.</p>
 <fieldset disabled={!features.editable || !p.editable}><label><input type="checkbox" checked={config.enabled} onChange={e => features.setValue(v => ({...v,pomodoro:{...v.pomodoro,enabled:e.target.checked}}))} /> Enable Pomodoro</label>
 <button disabled={!!p.value} onClick={() => features.setValue(v => ({...v,pomodoro:{...v.pomodoro,focusMinutes:25,breakMinutes:5}}))}>25 / 5</button><button disabled={!!p.value} onClick={() => features.setValue(v => ({...v,pomodoro:{...v.pomodoro,focusMinutes:50,breakMinutes:10}}))}>50 / 10</button>
 <div className="feature-form">{(['focusMinutes','breakMinutes','longBreakMinutes'] as const).map(key => <label key={key}>{key==='focusMinutes' ? 'Focus' : key==='breakMinutes' ? 'Break' : 'Long break'} minutes<input type="number" min={1} max={key==='focusMinutes' ? 240 : 120} step={1} disabled={!!p.value} value={config[key]} onChange={e => {const n=+e.target.value; if(Number.isInteger(n) && n>=1 && n<=(key==='focusMinutes' ? 240 : 120)) features.setValue(v => ({...v,pomodoro:{...v.pomodoro,[key]:n}}));}} /></label>)}</div>
 <label><input type="checkbox" checked={config.autoStart} onChange={e => features.setValue(v => ({...v,pomodoro:{...v.pomodoro,autoStart:e.target.checked}}))} /> Automatically start the next phase</label>
 <p>When completion screens are enabled, the next phase waits for you. After sleep or reload, only the elapsed focus block is logged; the next phase begins from your return.</p>
 <label>Card<select value={task} onChange={e => setTask(e.target.value)}><option value="">Choose a card</option>{z.decks.map(d => <optgroup key={d.id} label={d.name}>{d.tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}</select></label>
 {!p.value && <button disabled={!config.enabled || !task} onClick={() => p.start(task)}>Start focus</button>}
 {p.value && <article aria-live="polite"><h2>{p.value.phase==='focus' ? 'Focusing' : p.value.phase==='longBreak' ? 'Long break' : 'Break'} · {p.value.completed} focus blocks completed</h2><p>{p.value.deadline===null ? 'Ready when you are' : formatTime(Math.max(0,Math.ceil((p.value.deadline-p.now)/1000)))}</p>
 {p.value.startedAt===null && <button onClick={p.next}>Start {p.value.phase==='focus' ? 'focus' : 'break'}</button>}<button onClick={p.stop}>End cycle</button></article>}
 </fieldset>{(p.error || features.error) && <p role="alert">{p.error || features.error}</p>}</section>;
}
