/**
 * Installs `window.api`, the surface the views were written against in the Electron prototype, so
 * the views did not have to change when the shell moved to Tauri.
 */

import type { AgentState, Command, Reminder } from "../shared/types";
import { AgentStore } from "./store";
import { emitLocal, hideWindow, onEvent, toggleMinimize } from "./window";
import { isTauri } from "./persistence";

export type PopupApi = {
  getState: () => Promise<AgentState>;
  sendCommand: (cmd: Command) => void;
  onStateUpdate: (cb: (state: AgentState) => void) => () => void;
  on: <T = unknown>(channel: string, cb: (data: T) => void) => () => void;
  hideWindow: () => void;
  toggleMinimize: () => void;
};

declare global {
  interface Window {
    api: PopupApi;
  }
}

async function notify(reminder: Reminder): Promise<void> {
  if (!isTauri()) return;
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import("@tauri-apps/plugin-notification");
    const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
    if (granted) sendNotification({ title: reminder.label, body: reminder.deckName ?? "Zenith" });
  } catch {
    /* A notification that cannot be shown must not stop the in-window reminder. */
  }
}

export async function installBridge(): Promise<void> {
  const store = new AgentStore();
  await store.init();

  store.setReminderHandler((reminder) => {
    emitLocal("reminder:fire", reminder);
    if (reminder.notify) void notify(reminder);
  });

  window.api = {
    getState: async () => store.getState(),
    sendCommand: (cmd) => store.handleCommand(cmd),
    onStateUpdate: (cb) => store.subscribe(cb),
    on: (channel, cb) => onEvent(channel, cb),
    hideWindow: () => void hideWindow(),
    toggleMinimize: () => void toggleMinimize(),
  };
}
