import type { AgentState } from '../shared/types';
import { PET_KINDS, PET_PHRASES, type PetKind } from '../shared/pet';
import { DesktopPet } from './DesktopPet';
export function PetSettings({ state }: { state: AgentState }) {
  const p = state.pet,
    update = (patch: Parameters<typeof window.api.sendCommand>[0] & { type: 'SET_PET_PREFS' }) =>
      window.api.sendCommand(patch);
  return (
    <section className="pet-settings">
      <h2>Desktop companion</h2>
      <p>
        Optional, local and quiet. Click the pet to restore this popup workspace. The full app keeps
        a separate store.
      </p>
      {state.petReadOnly && (
        <p role="alert">
          The saved pet settings are newer or unreadable. They have been preserved.
        </p>
      )}
      <fieldset disabled={state.petReadOnly}>
        {(['enabled', 'messages', 'celebrations', 'nudges', 'reducedMotion'] as const).map(
          (key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={p[key]}
                onChange={(e) =>
                  update({ type: 'SET_PET_PREFS', patch: { [key]: e.target.checked } })
                }
              />{' '}
              {key === 'enabled'
                ? 'Enable desktop pet'
                : key === 'messages'
                  ? 'Companion messages'
                  : key === 'celebrations'
                    ? 'Gentle celebrations'
                    : key === 'nudges'
                      ? 'React to reminders'
                      : 'Still companion (reduced motion)'}
            </label>
          ),
        )}
        {p.enabled && (
          <>
            <DesktopPet state={state} />
            <button onClick={() => window.api.toggleMinimize()}>Show pet on desktop</button>
            <button onClick={() => window.api.sendCommand({ type: 'START_BREAK', minutes: 5 })}>
              Take a five-minute break
            </button>
            {p.breakUntil !== null && (
              <button onClick={() => window.api.sendCommand({ type: 'END_BREAK' })}>
                End break
              </button>
            )}
            <p>
              Taking a break stops and logs the current focus session. Break time is not logged. Pet
              opens: {p.interactions.opens} · drag attempts: {p.interactions.drags}. Counts stay on
              this device.
            </p>
            <details>
              <summary>Edit companion phrases and card kinds</summary>
              <p>Use {'{title}'} for the card name. These settings belong to the popup.</p>
              {PET_KINDS.map((kind) => (
                <label key={kind}>
                  {kind}
                  <input
                    maxLength={500}
                    value={p.phrases[kind] ?? PET_PHRASES[kind]}
                    onChange={(e) =>
                      update({
                        type: 'SET_PET_PREFS',
                        patch: { phrases: { ...p.phrases, [kind]: e.target.value } },
                      })
                    }
                  />
                </label>
              ))}
              {state.tasks.map((t) => (
                <div key={t.id}>
                  <h3>{t.name}</h3>
                  <label>
                    Kind
                    <select
                      value={p.cards[t.id]?.kind ?? 'other'}
                      onChange={(e) =>
                        update({
                          type: 'SET_PET_PREFS',
                          patch: {
                            cards: {
                              ...p.cards,
                              [t.id]: { ...p.cards[t.id], kind: e.target.value as PetKind },
                            },
                          },
                        })
                      }
                    >
                      {PET_KINDS.map((kind) => (
                        <option key={kind}>{kind}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Personal phrase
                    <input
                      maxLength={500}
                      value={p.cards[t.id]?.phrase ?? ''}
                      onChange={(e) =>
                        update({
                          type: 'SET_PET_PREFS',
                          patch: {
                            cards: {
                              ...p.cards,
                              [t.id]: {
                                kind: p.cards[t.id]?.kind ?? 'other',
                                phrase: e.target.value,
                              },
                            },
                          },
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </details>
          </>
        )}
      </fieldset>
    </section>
  );
}
