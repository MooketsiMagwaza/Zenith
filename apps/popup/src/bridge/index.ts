/**
 * Installs `window.api`, the surface the views were written against in the Electron prototype, so
 * the views did not have to change when the shell moved to Tauri.
 */

import type { AgentState, Command, Reminder } from '../shared/types';
import { AgentStore } from './store';
import { emitLocal, hideWindow, onEvent, toggleMinimize, startDragging } from './window';
import { petPhrase, petSpeech } from '../shared/pet';
import { isTauri } from './persistence';

export type PopupApi = {
  getState: () => Promise<AgentState>;
  sendCommand: (cmd: Command) => void;
  onStateUpdate: (cb: (state: AgentState) => void) => () => void;
  on: <T = unknown>(channel: string, cb: (data: T) => void) => () => void;
  hideWindow: () => void;
  toggleMinimize: () => void;
  startDragging: () => Promise<void>;
};

declare global {
  interface Window {
    api: PopupApi;
  }
}

async function notify(reminder: Reminder, message?: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import('@tauri-apps/plugin-notification');
    const granted = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
    if (granted) sendNotification({ title: 'Zenith reminder', body: message ?? reminder.label });
  } catch {
    /* A notification that cannot be shown must not stop the in-window reminder. */
  }
}

export async function installBridge(): Promise<void> {
  const store = new AgentStore();
  await store.init();

  store.setReminderHandler((reminder) => {
    const state = store.getState(),
      task = state.tasks.find((t) => reminder.targetType === 'task' && t.id === reminder.targetId),
      deck = state.decks.find((d) => reminder.targetType === 'deck' && d.id === reminder.targetId);
    const message =
      state.pet.enabled && state.pet.messages
        ? petPhrase(task?.name ?? deck?.name ?? reminder.label, task?.id, state.pet)
        : undefined;
    emitLocal('reminder:fire', { ...reminder, message });
    if (reminder.notify) void notify(reminder, message);
  });

  window.api = {
    getState: async () => store.getState(),
    sendCommand: (cmd) => {
      store.handleCommand(cmd);
      if (cmd.type === 'PET_INTERACTION' && cmd.kind === 'open' && store.getState().pet.enabled)
        emitLocal('pet:open', petSpeech(store.getState(), Date.now()));
    },
    onStateUpdate: (cb) => store.subscribe(cb),
    on: (channel, cb) => onEvent(channel, cb),
    hideWindow: () => void hideWindow(),
    toggleMinimize: () => void toggleMinimize(),
    startDragging,
  };
}
