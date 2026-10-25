import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { migratePet, petPhrase, petReaction, petSpeech } from './pet';
import { migratePopupState } from './migration';
import { AgentStore } from '../bridge/store';
import type { AgentState } from './types';
const legacy = JSON.parse(
  readFileSync(new URL('./fixtures/legacy-popup-invented.json', import.meta.url), 'utf8'),
);
it('adds all-off versioned pet options without changing old popup entities or preferences', () => {
  const original = structuredClone(legacy),
    next = migratePopupState(legacy);
  expect(next.state.decks).toEqual(original.decks);
  expect(next.state.tasks).toEqual(original.tasks);
  expect(next.state.logs).toEqual(original.logs);
  expect(next.state.zenWallpaper).toBe(original.zenWallpaper);
  expect(next.state.version).toBe(4);
  expect(legacy).toEqual(original);
  expect(next.state.pet.version).toBe(1);
  expect(next.state.pet.enabled).toBe(false);
  expect(next.state.pet.messages).toBe(false);
  expect(next.state.pet.celebrations).toBe(false);
  expect(next.state.pet.nudges).toBe(false);
});
it('preserves future/unreadable pet records and marks them read-only', () => {
  const raw = { version: 2, sample: 'invented extension' },
    next = migratePet(raw);
  expect(next.original).toEqual(raw);
  expect(next.value.enabled).toBe(false);
  expect(next.error.length > 0).toBe(true);
  expect(migratePet({ version: 1, extra: 'keep' }).value.extra).toBe('keep');
});
it('builds matching plain companion phrases and respects independent speech switches', () => {
  const state = migratePopupState(legacy).state;
  state.pet.cards['sample-t'] = { kind: 'book' };
  expect(petPhrase('The Great Gatsby', 'sample-t', state.pet)).toBe(
    'Time to read The Great Gatsby',
  );
  state.pet.cards['sample-t'] = { kind: 'skill', phrase: 'A little practice: {title}' };
  expect(petPhrase('$&', 'sample-t', state.pet)).toBe('A little practice: $&');
  expect(petSpeech(state, 1000)).toBe('');
  state.pet.messages = true;
  expect(petSpeech(state, 1000)).toBe('Ready when you are.');
});
it('reacts to idle, focus, break, celebration and scheduled nudges with expiry', () => {
  const state = migratePopupState(legacy).state;
  state.pet.enabled = true;
  state.pet.messages = true;
  state.pet.celebrations = true;
  state.pet.nudges = true;
  expect(petReaction(state, 1000)).toBe('idle');
  state.pet.celebrateUntil = 5000;
  expect(petReaction(state, 1000)).toBe('celebrating');
  state.pet.nudgeUntil = 6000;
  state.pet.lastMessage = 'Time to read Gatsby';
  expect(petReaction(state, 1000)).toBe('nudging');
  expect(petSpeech(state, 1000)).toBe('Time to read Gatsby');
  state.pet.breakUntil = 7000;
  expect(petReaction(state, 1000)).toBe('break');
  state.active = { taskIds: ['sample-t'], deckIds: ['sample-d'], startedAt: 0 };
  expect(petReaction(state, 1000)).toBe('focusing');
  state.active = null;
  expect(petReaction(state, 8000)).toBe('idle');
});
it('popup store logs focus before a break and tracks only opted-in interactions', async () => {
  let now = 1000;
  const saved: AgentState[] = [];
  const store = new AgentStore(
    {
      load: async () => structuredClone(legacy),
      save: (s: AgentState) => saved.push(structuredClone(s)),
    },
    () => now,
  );
  await store.init();
  store.handleCommand({ type: 'PET_INTERACTION', kind: 'open' });
  expect(store.getState().pet.interactions.opens).toBe(0);
  store.handleCommand({ type: 'SET_PET_PREFS', patch: { enabled: true, celebrations: true } });
  store.handleCommand({ type: 'START_SESSION', taskIds: ['sample-t'] });
  now = 61000;
  store.handleCommand({ type: 'START_BREAK', minutes: 5 });
  expect(store.getState().logs).toHaveLength(1);
  expect(store.getState().logs[0].duration).toBe(60);
  expect(store.getState().tasks[0].totalSeconds).toBe(60);
  expect(petReaction(store.getState(), now)).toBe('break');
  expect(store.getState().active).toBe(null);
  store.handleCommand({ type: 'PET_INTERACTION', kind: 'open' });
  store.handleCommand({ type: 'PET_INTERACTION', kind: 'drag' });
  expect(store.getState().pet.interactions).toEqual({ opens: 1, drags: 1 });
  store.handleCommand({ type: 'END_BREAK' });
  expect(petReaction(store.getState(), now)).toBe('idle');
  expect(saved.length > 0).toBe(true);
  store.dispose();
});
it('popup store preserves unreadable pet bytes on unrelated changes and refuses edits', async () => {
  const pet = { version: 2, sample: 'invented future value' },
    saved: AgentState[] = [];
  const store = new AgentStore({
    load: async () => ({ ...structuredClone(legacy), pet }),
    save: (s: AgentState) => saved.push(structuredClone(s)),
  } as never);
  await store.init();
  store.handleCommand({ type: 'SET_PET_PREFS', patch: { enabled: true } });
  expect(saved).toHaveLength(0);
  store.handleCommand({ type: 'ADD_DECK', name: 'Sample new deck', color: '#c9a84c' });
  expect(saved[0].pet).toEqual(pet);
  expect(store.getState().petReadOnly).toBe(true);
  store.dispose();
});
it('due reminders use the current card title and do not nudge twice', async () => {
  const now = 61000,
    raw = {
      ...structuredClone(legacy),
      pet: {
        version: 1,
        enabled: true,
        messages: true,
        nudges: true,
        cards: { 'sample-t': { kind: 'book' } },
      },
      reminders: [
        {
          id: 'sample-r',
          targetType: 'task',
          targetId: 'sample-t',
          label: 'Old title',
          fireAt: 1000,
          repeat: 'none',
          enabled: true,
          notify: false,
          sound: false,
          createdAt: 0,
        },
      ],
    };
  const store = new AgentStore({ load: async () => raw, save: () => {} }, () => now);
  await store.init();
  let count = 0;
  store.setReminderHandler(() => count++);
  expect(count).toBe(1);
  expect(store.getState().pet.lastMessage).toBe('Time to read The Great Gatsby');
  expect(store.getState().reminders[0].enabled).toBe(false);
  store.setReminderHandler(() => count++);
  expect(count).toBe(1);
  store.dispose();
});
