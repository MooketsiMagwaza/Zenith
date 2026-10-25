import { useEffect, useState } from 'react';
import type { AgentState } from '../shared/types';
import { petReaction, petSpeech, type PetReaction } from '../shared/pet';
/** Original vector sprout drawn for Zenith, without external art or assets. */
export function PetArt({ reaction }: { reaction: PetReaction }) {
  const resting = reaction === 'break',
    happy = reaction === 'celebrating';
  return (
    <svg className="pet-art" viewBox="0 0 96 96" aria-hidden="true">
      <ellipse cx="48" cy="85" rx="24" ry="4" fill="#28231a" />
      <g className="pet-body">
        <path
          d="M48 25C21 25 15 43 19 64C22 82 74 82 77 64C81 43 75 25 48 25Z"
          fill="#242119"
          stroke="#e3c977"
          strokeWidth="2.5"
        />
        <path
          d="M48 27V15M48 19C34 21 31 8 31 8C45 7 48 15 48 19ZM48 17C61 18 65 7 65 7C52 5 48 12 48 17Z"
          fill="#c9a84c"
          stroke="#e3c977"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {resting ? (
          <path
            d="M32 49q4 4 8 0M57 49q4 4 8 0"
            stroke="#ece9e3"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        ) : (
          <g className="pet-eyes" fill="#ece9e3">
            <ellipse cx="36" cy="49" rx="2.8" ry={reaction === 'focusing' ? 2 : 4} />
            <ellipse cx="61" cy="49" rx="2.8" ry={reaction === 'focusing' ? 2 : 4} />
          </g>
        )}
        <path
          d={happy ? 'M38 61Q48 73 59 61' : 'M43 62Q48 66 54 62'}
          fill="none"
          stroke="#e3c977"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {happy && <path d="M9 32l3-6 3 6-3 6ZM82 27l3-5 3 5-3 5Z" fill="#e3c977" />}
      </g>
    </svg>
  );
}
export function DesktopPet({ state, compact = false }: { state: AgentState; compact?: boolean }) {
  const [now, setNow] = useState(Date.now()),
    [error, setError] = useState('');
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const reaction = petReaction(state, now),
    speech = petSpeech(state, now);
  const open = () => {
    if (compact) {
      window.api.sendCommand({ type: 'PET_INTERACTION', kind: 'open' });
      window.api.toggleMinimize();
    }
  };
  return (
    <div
      className={`pet-shell pet-${reaction} ${compact ? 'pet-compact' : ''} ${state.pet.reducedMotion ? 'pet-static' : ''}`}
    >
      <button
        className="pet-drag"
        aria-label="Drag desktop companion"
        title="Drag the companion"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          window.api.sendCommand({ type: 'PET_INTERACTION', kind: 'drag' });
          void window.api.startDragging().catch(() => setError('The window could not be moved.'));
        }}
      >
        ⋮⋮
      </button>
      <button
        className="pet-open"
        aria-label={`${compact ? 'Open Zenith popup workspace' : 'Companion preview'}. ${speech || reaction}`}
        title={speech || reaction}
        onClick={open}
      >
        <PetArt reaction={reaction} />
        <span className="pet-speech" role="status">
          {speech || (compact ? '' : reaction)}
        </span>
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
