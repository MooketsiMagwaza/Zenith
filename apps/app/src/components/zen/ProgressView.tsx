import { useState } from "react";
import type { useTogglZen } from "@/lib/zen/useTogglZen";
import type { useFeatures } from "@/lib/zen/useFeatures";
import { goalProgress, secondsWithin, targetInfo, weekStart } from "@/lib/zen/progress";
import { formatDuration } from "@/lib/zen/utils";
import type { Goal } from "@/lib/zen/features";

export type FeatureStore = ReturnType<typeof useFeatures>;
export function GoalBar({ z, features, target }: { z: ReturnType<typeof useTogglZen>; features: FeatureStore; target: string }) {
  const goal = features.value.goals[target];
  if (!features.value.progress || !goal) return null;
  const info = targetInfo(z.decks, target);
  const p = goalProgress(goal, info.taskIds, z.logs, info.lifetime);
  return <div className="goal-bar"><label>{formatDuration(p.seconds)} / {formatDuration(p.target)} · {goal.period === "day" ? "today" : goal.period === "week" ? "this week" : "total"}
    <progress aria-label={`${info.title} goal progress`} max={1} value={p.ratio} /></label></div>;
}
export function ProgressView({ z, features }: { z: ReturnType<typeof useTogglZen>; features: FeatureStore }) {
  const [target, setTarget] = useState("");
  const [period, setPeriod] = useState<Goal["period"]>("week");
  const [amount, setAmount] = useState("5");
  const now = Date.now();
  const days = Array.from({ length: 7 }, (_, i) => { const d = weekStart(now); d.setDate(d.getDate() + i); const end = new Date(d); end.setDate(end.getDate() + 1); return { date: d, seconds: z.logs.reduce((s, l) => s + secondsWithin(l, +d, +end), 0) }; });
  const maximum = Math.max(60, ...days.map(d => d.seconds));
  return <section className="feature-page"><h1>Progress</h1><p>Set an intention for a card or a whole deck. No streaks, penalties or lost points.</p>
    <label><input type="checkbox" checked={features.value.progress} disabled={!features.editable} onChange={e => features.setValue(v => ({ ...v, progress: e.target.checked }))} /> Show goals and progress</label>
    {features.error && <p role="alert">{features.error}</p>}
    {features.value.progress && <>
      <form className="feature-form" onSubmit={e => { e.preventDefault(); if (!target || !Number.isFinite(+amount) || +amount <= 0) return; features.setValue(v => ({ ...v, goals: { ...v.goals, [target]: { period, seconds: +amount * (period === "day" ? 60 : 3600) } } })); }}>
        <label>Target<select required value={target} onChange={e => { setTarget(e.target.value); const g = features.value.goals[e.target.value]; if (g) { setPeriod(g.period); setAmount(String(g.seconds / (g.period === "day" ? 60 : 3600))); } }}><option value="">Choose a deck or card</option>{z.decks.map(d => <optgroup key={d.id} label={d.name}><option value={`deck:${d.id}`}>Deck: {d.name}</option>{d.tasks.map(t => <option key={t.id} value={`task:${t.id}`}>{t.name}</option>)}</optgroup>)}</select></label>
        <label>Period<select value={period} onChange={e => setPeriod(e.target.value as Goal["period"])}><option value="day">Minutes per day</option><option value="week">Hours per week</option><option value="total">Total hours</option></select></label>
        <label>{period === "day" ? "Minutes" : "Hours"}<input required type="number" min="0.1" step="0.1" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <button disabled={!features.editable}>Save goal</button>
      </form>
      <div className="feature-grid">{Object.keys(features.value.goals).filter(key => targetInfo(z.decks, key).title).map(key => <article key={key}><h2>{targetInfo(z.decks, key).title}</h2><GoalBar z={z} features={features} target={key} /><button onClick={() => features.setValue(v => { const goals = { ...v.goals }; delete goals[key]; return { ...v, goals }; })}>Remove goal</button></article>)}</div>
      <h2>This week</h2><p>{formatDuration(days.reduce((s, d) => s + d.seconds, 0))} logged. Multiple cards in a session each contribute their own time.</p>
      <div className="trend" aria-label="Daily logged time this week">{days.map(d => <div key={+d.date}><span>{d.date.toLocaleDateString([], { weekday: "short" })}</span><progress max={maximum} value={d.seconds} aria-label={`${d.date.toLocaleDateString()}: ${formatDuration(d.seconds)}`} /><span>{formatDuration(d.seconds)}</span></div>)}</div>
    </>}
  </section>;
}
