/**
 * The page's side of the native window: events the Rust shell sends in (a global shortcut was
 * pressed, the window shrank to a ball) and the two calls it makes out (hide, shrink or expand).
 * In a plain browser there is no shell, so the calls are handled here and the events never arrive.
 */

import { isTauri } from "./persistence";

type Handler<T = unknown> = (data: T) => void;

const local = new Map<string, Set<Handler>>();

/** Delivers an event to listeners inside the page. */
export function emitLocal(channel: string, data?: unknown): void {
  for (const fn of local.get(channel) ?? []) fn(data);
}

/** Subscribes to an event from the shell (or from `emitLocal`). Returns an unsubscribe function straight away. */
export function onEvent<T = unknown>(channel: string, cb: Handler<T>): () => void {
  const handler = cb as Handler;
  if (!local.has(channel)) local.set(channel, new Set());
  local.get(channel)!.add(handler);

  let off: (() => void) | null = null;
  let cancelled = false;
  if (isTauri()) {
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen<T>(channel, (event) => cb(event.payload)).then((unlisten) => {
        if (cancelled) unlisten();
        else off = unlisten;
      }),
    );
  }
  return () => {
    cancelled = true;
    local.get(channel)?.delete(handler);
    off?.();
  };
}

let browserBall = false;

/** Shrinks the window to a small ball, or brings it back. */
export async function toggleMinimize(): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("toggle_minimize");
    return;
  }
  browserBall = !browserBall;
  emitLocal(browserBall ? "window:minimized" : "window:restored");
}

/** Hides the window; the tray icon or Alt+Space brings it back. */
export async function hideWindow(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().hide();
}
