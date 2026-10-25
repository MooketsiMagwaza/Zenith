import { useEffect, useRef, useState } from 'react';
import type { FeatureStore } from './ProgressView';
import type { useTogglZen } from '@/lib/zen/useTogglZen';
import { sessionRewards } from '@/lib/zen/rewards';
import { formatDuration } from '@/lib/zen/utils';
import type { Log } from '@/lib/zen/types';
export function RewardSettings({features}: {features:FeatureStore}) {
  const r=features.value.rewards;
  const [text,setText]=useState(r.pack.join('\n'));
  return <section><h2>Completion and affirmations</h2><p>Each part is optional. No streaks, lost points or pressure to return.</p><fieldset disabled={!features.editable}>
    {(['recap','affirmations','milestones'] as const).map(key => <label key={key}><input type="checkbox" checked={r[key]} onChange={e => features.setValue(v => ({...v,rewards:{...v.rewards,[key]:e.target.checked}}))} /> {key === 'recap' ? 'Session recap' : key === 'affirmations' ? 'Affirmations' : 'First-hour and goal milestones'}</label>)}
    <label>Affirmation pack (one per line, up to 100)<textarea rows={5} value={text} maxLength={50100} onChange={e => setText(e.target.value)} /></label><button onClick={() => features.setValue(v => ({...v,rewards:{...v.rewards,pack:text.split('\n').map(s => s.trim()).filter(Boolean).slice(0,100).map(s => s.slice(0,500))}}))}>Save pack</button>
  </fieldset></section>;
}
export function CompletionScreen({z,features}: {z:ReturnType<typeof useTogglZen>; features:FeatureStore}) {
  const delivered=useRef('');
  const dialog=useRef<HTMLDialogElement>(null);
  const [content,setContent]=useState<{logs:Log[]; messages:string[]; affirmation?:string} | null>(null);
  useEffect(() => {
    if(!z.completion || delivered.current === z.completion.logs[0].id) return;
    delivered.current=z.completion.logs[0].id;
    const result=sessionRewards(z.completion.logs,z.completion.before,z.logs,features.value);
    if (features.editable && result.keys.length) features.setValue(v => ({...v,rewards:{...v.rewards,seen:{...v.rewards.seen,...Object.fromEntries(result.keys.map(k => [k,true]))}}}));
    if(features.value.rewards.recap || result.affirmation || result.messages.length) setContent({logs:z.completion.logs,...result});
  },[z.completion,z.logs,features.value]);
  useEffect(() => { if(content && !dialog.current?.open) dialog.current?.showModal(); },[content]);
  if(!content) return null;
  return <dialog ref={dialog} className="completion-dialog feature-page" aria-labelledby="completion-title" onClose={() => setContent(null)}><h1 id="completion-title">Time well spent</h1>
    {features.value.rewards.recap && content.logs.map(l => <p key={l.id}>{l.taskName} · {formatDuration(l.duration)}</p>)}
    {content.affirmation && <p>{content.affirmation}</p>}{content.messages.map(m => <p key={m}>{m}</p>)}
    <button autoFocus onClick={() => dialog.current?.close()}>Continue</button>
  </dialog>;
}
