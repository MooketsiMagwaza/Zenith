/**
 * Where the pop-up keeps its state: a JSON file in the app's data folder through the Tauri store
 * plugin, or `localStorage` when the page is opened in a plain browser (for development and for
 * screenshots). Nothing leaves the device either way.
 */

import type { AgentState } from "../shared/types";

const FILE = "zenith-popup.json";
const KEY = "state";
const BROWSER_KEY = "zenith.popup.state";

export const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type StoreHandle = { get<T>(key: string): Promise<T | undefined>; set(key: string, value: unknown): Promise<void>; save(): Promise<void> };
let handle: StoreHandle | null = null;

export async function loadState(): Promise<Partial<AgentState> | null> {
  try {
    if (isTauri()) {
      const { load } = await import("@tauri-apps/plugin-store");
      handle = (await load(FILE, { autoSave: false } as never)) as unknown as StoreHandle;
      return (await handle.get<Partial<AgentState>>(KEY)) ?? null;
    }
    const raw = window.localStorage.getItem(BROWSER_KEY);
    return raw ? (JSON.parse(raw) as Partial<AgentState>) : null;
  } catch {
    return null;
  }
}

let pending: AgentState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Writes are batched so a burst of edits is one write. */
export function saveState(state: AgentState): void {
  pending = state;
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    const next = pending;
    pending = null;
    if (!next) return;
    try {
      if (handle) {
        await handle.set(KEY, next);
        await handle.save();
      } else {
        window.localStorage.setItem(BROWSER_KEY, JSON.stringify(next));
      }
    } catch {
      /* A failed write must never break the timer; the next change tries again. */
    }
  }, 250);
}
