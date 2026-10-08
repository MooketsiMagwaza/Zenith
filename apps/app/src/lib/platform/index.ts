/**
 * The one place that knows whether the app runs in a browser or inside the Tauri desktop shell
 * (`src-tauri`). The rest of the app calls `storage` and `appWindow` and does not care which.
 *
 * - Browser: `storage` is `localStorage` and `appWindow` uses the Fullscreen API, exactly as
 *   before the desktop shell existed. Nothing from `@tauri-apps/*` is loaded.
 * - Desktop: `storage` is a JSON file in the app's data folder (the Tauri store plugin), read
 *   once at start-up so reads stay synchronous; `appWindow` makes the native window fullscreen.
 *
 * Notifications need nothing here: the shell's notification plugin implements the Web
 * `Notification` API, so the reminder code is the same on both.
 */

export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** The subset of the Web Storage API the app uses. Values are strings, as in `localStorage`. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The window calls the app makes. */
export interface AppWindow {
  isFullscreen(): Promise<boolean>;
  /** In a browser this must run inside the click handler, so it starts synchronously. */
  toggleFullscreen(): Promise<void>;
  /** Calls `cb` whenever fullscreen may have changed. Returns an unsubscribe function. */
  onFullscreenChange(cb: () => void): () => void;
}

const browserStorage: KeyValueStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};

const browserWindow: AppWindow = {
  isFullscreen: async () => !!document.fullscreenElement,
  toggleFullscreen: () =>
    document.fullscreenElement
      ? (document.exitFullscreen?.() ?? Promise.resolve())
      : (document.documentElement.requestFullscreen?.() ?? Promise.resolve()),
  onFullscreenChange: (cb) => {
    document.addEventListener("fullscreenchange", cb);
    return () => document.removeEventListener("fullscreenchange", cb);
  },
};

/** The desktop store file, in the app's data folder. */
const STORE_FILE = "zenith.json";

type StoreHandle = {
  entries<T>(): Promise<[string, T][]>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
};

async function createTauriStorage(): Promise<KeyValueStorage> {
  const { load } = await import("@tauri-apps/plugin-store");
  // The plugin keeps the data in memory in the shell, writes the file 200 ms after the last
  // change, and saves once more when the app exits.
  const store = (await load(STORE_FILE, { autoSave: 200, defaults: {} })) as unknown as StoreHandle;
  const cache = new Map<string, string>();
  for (const [key, value] of await store.entries<unknown>()) {
    if (typeof value === "string") cache.set(key, value);
  }
  const report = (error: unknown) => console.error("[storage]", error);
  return {
    getItem: (key) => cache.get(key) ?? null,
    setItem: (key, value) => {
      cache.set(key, String(value));
      store.set(key, String(value)).catch(report);
    },
    removeItem: (key) => {
      cache.delete(key);
      store.delete(key).catch(report);
    },
  };
}

async function createTauriWindow(): Promise<AppWindow> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  return {
    isFullscreen: () => win.isFullscreen(),
    toggleFullscreen: async () => win.setFullscreen(!(await win.isFullscreen())),
    onFullscreenChange: (cb) => {
      let off: (() => void) | null = null;
      let cancelled = false;
      void win.onResized(() => cb()).then((unlisten) => {
        if (cancelled) unlisten();
        else off = unlisten;
      });
      return () => {
        cancelled = true;
        off?.();
      };
    },
  };
}

export let storage: KeyValueStorage = browserStorage;
export let appWindow: AppWindow = browserWindow;

/**
 * Picks the storage and window for where the app is running. Call once and wait for it before
 * the first render, so the hooks read saved data on their first pass. In a browser it does
 * nothing. If the desktop store cannot be opened, the app falls back to the webview's
 * `localStorage` rather than not starting.
 */
export async function initPlatform(): Promise<void> {
  if (!isTauri()) return;
  try {
    storage = await createTauriStorage();
  } catch (error) {
    console.error("[storage] the desktop store could not be opened; using localStorage", error);
  }
  try {
    appWindow = await createTauriWindow();
  } catch (error) {
    console.error("[window] the desktop window API is unavailable", error);
  }
}
