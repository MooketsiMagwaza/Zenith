import { useCallback, useEffect, useRef, useState } from 'react';
import { storage, isTauri } from '@/lib/platform';
import { generateId } from './utils';
import { isReminderDue, nextReminderAt } from './reminderSchedule';

export type ReminderRepeat = 'none' | 'daily' | 'weekdays' | 'weekly';

export type Reminder = {
  id: string;
  // Target: either a task ("card") or a deck
  targetType: 'task' | 'deck';
  targetId: string;
  // Cached labels for display in the list / notification
  label: string;
  deckName?: string;
  deckColor?: string;
  // ISO time-of-day for daily/weekdays/weekly; epoch ms for one-off ("none")
  fireAt: number;
  repeat: ReminderRepeat;
  // For weekly: 0=Sun..6=Sat
  weekday?: number;
  enabled: boolean;
  notify: boolean; // browser notification
  sound: boolean; // audible chime
  createdAt: number;
  lastFiredAt?: number;
};

const KEY = 'toggl_zen_reminders';

function loadLS<T>(k: string, fb: T): T {
  if (typeof window === 'undefined') return fb;
  try {
    const raw = storage.getItem(k);
    if (!raw) return fb;
    return JSON.parse(raw) as T;
  } catch {
    return fb;
  }
}

function saveLS(k: string, v: unknown) {
  if (typeof window === 'undefined') return;
  try {
    storage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/** Compute the next time (epoch ms) a reminder should fire, or null if past one-off. */
export const nextFireAt = nextReminderAt;

/* tiny built-in chime (no asset) */
function chime() {
  if (typeof window === 'undefined') return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };
    playTone(880, 0, 0.35);
    playTone(660, 0.18, 0.45);
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* ignore */
  }
}

export type FireHandler = (r: Reminder) => void;

export function useReminders(onFire?: FireHandler, paused = false) {
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [hydrated, setHydrated] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;
  const fireRef = useRef<FireHandler | undefined>(onFire);
  useEffect(() => {
    fireRef.current = onFire;
  }, [onFire]);

  useEffect(() => {
    setReminders(loadLS<Reminder[]>(KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !paused) saveLS(KEY, reminders);
  }, [reminders, hydrated, paused]);

  // Poll every 15s for due reminders
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const check = () => {
      if (cancelled || pausedRef.current) return;
      const now = Date.now();
      const dueReminders: Reminder[] = [];
      const prev = remindersRef.current;
      let changed = false;
      const next = prev.map((r) => {
        const due = isReminderDue(r, now);
        if (due) {
          changed = true;
          dueReminders.push(r);
          return {
            ...r,
            lastFiredAt: now,
            enabled: r.repeat === 'none' ? false : r.enabled,
          };
        }
        return r;
      });
      if (changed) {
        remindersRef.current = next;
        setReminders(next);
      }
      for (const r of dueReminders) fireRef.current?.(r);
    };

    check();
    const id = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hydrated]);

  const addReminder = useCallback((r: Omit<Reminder, 'id' | 'createdAt'>) => {
    const id = generateId();
    setReminders((p) => [{ ...r, id, createdAt: Date.now() }, ...p]);
    return id;
  }, []);

  const updateReminder = useCallback((id: string, patch: Partial<Reminder>) => {
    setReminders((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const deleteReminder = useCallback((id: string) => {
    setReminders((p) => p.filter((r) => r.id !== id));
  }, []);

  const toggleReminder = useCallback((id: string) => {
    setReminders((p) => p.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }, []);

  // Remove orphans when their target deck/card disappears
  const pruneOrphans = useCallback((validTaskIds: Set<string>, validDeckIds: Set<string>) => {
    setReminders((p) =>
      p.filter((r) =>
        r.targetType === 'task' ? validTaskIds.has(r.targetId) : validDeckIds.has(r.targetId),
      ),
    );
  }, []);

  return {
    hydrated,
    reminders,
    addReminder,
    updateReminder,
    deleteReminder,
    toggleReminder,
    pruneOrphans,
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (isTauri()) {
    try {
      const { isPermissionGranted, requestPermission } =
        await import('@tauri-apps/plugin-notification');
      return (await isPermissionGranted()) ? 'granted' : await requestPermission();
    } catch {
      return 'denied';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function fireBrowserNotification(r: Reminder, onClick?: () => void, message?: string) {
  if (isTauri()) {
    void import('@tauri-apps/plugin-notification')
      .then(async ({ isPermissionGranted, sendNotification }) => {
        if (await isPermissionGranted())
          sendNotification({ title: 'Zenith reminder', body: message ?? r.label });
      })
      .catch(() => {});
    return;
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const body =
      message ??
      (r.targetType === 'deck'
        ? `Time for deck: ${r.label}`
        : r.deckName
          ? `${r.deckName} — ${r.label}`
          : r.label);
    const n = new Notification('Zenith reminder', {
      body,
      tag: r.id,
      silent: !r.sound,
    });
    if (onClick) {
      n.onclick = () => {
        try {
          window.focus();
          onClick();
        } catch {
          /* ignore */
        }
        n.close?.();
      };
    }
    // The desktop shell's notifications have no close(); the system dismisses them.
    setTimeout(() => n.close?.(), 12000);
  } catch {
    /* ignore */
  }
}

export function fireChime() {
  chime();
}
