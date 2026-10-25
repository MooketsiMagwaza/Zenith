import type { useTogglZen } from '@/lib/zen/useTogglZen';
import type { FeatureStore } from './ProgressView';
import { CARD_KINDS, DEFAULT_PHRASES, companionMessage, type CardKind } from '@/lib/zen/companion';
import { requestNotificationPermission } from '@/lib/zen/useReminders';
import { RewardSettings } from './Rewards';
export function CompanionView({z, features}: {z: ReturnType<typeof useTogglZen>; features: FeatureStore}) {
  const c = features.value.companion;
  return <section className="feature-page"><h1>Companion</h1><p>A quiet message when your reminder is due. Everything stays on this device. Use {'{title}'} for the card name.</p>
    {features.error && <p role="alert">{features.error}</p>}
    <fieldset disabled={!features.editable}><label><input type="checkbox" checked={c.enabled} onChange={e => features.setValue(v => ({...v, companion: {...v.companion, enabled:e.target.checked}}))} /> Enable companion messages</label>
    <button onClick={() => void requestNotificationPermission()}>Allow system notifications</button><p>Each reminder keeps its own notification and sound switches.</p>
    <h2>Phrases</h2><div className="feature-grid">{CARD_KINDS.map(kind => <label key={kind}>{kind}<input maxLength={500} value={c.phrases[kind] ?? DEFAULT_PHRASES[kind]} onChange={e => features.setValue(v => ({...v, companion:{...v.companion, phrases:{...v.companion.phrases,[kind]:e.target.value}}}))} /></label>)}</div>
    <h2>Cards</h2><div className="feature-grid">{z.decks.flatMap(d => d.tasks.map(t => <article key={t.id}><h3>{d.name} / {t.name}</h3>
      <label>Kind<select value={c.cards[t.id]?.kind ?? 'other'} onChange={e => features.setValue(v => ({...v, companion:{...v.companion,cards:{...v.companion.cards,[t.id]:{...v.companion.cards[t.id],kind:e.target.value as CardKind}}}}))}>{CARD_KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
      <label>Personal phrase (optional)<input maxLength={500} value={c.cards[t.id]?.phrase ?? ''} placeholder="Use the kind's phrase" onChange={e => features.setValue(v => ({...v,companion:{...v.companion,cards:{...v.companion.cards,[t.id]:{kind:v.companion.cards[t.id]?.kind ?? 'other',phrase:e.target.value}}}}))} /></label>
      <p>{companionMessage(t.name,t.id,features.value)}</p></article>))}</div></fieldset>
    <RewardSettings features={features} />
  </section>;
}
