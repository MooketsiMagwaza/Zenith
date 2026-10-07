import { useCallback, useEffect, useRef, useState } from "react";
import { generateId } from "./utils";

export type ReminderRepeat = "none" | "daily" | "weekdays" | "weekly";

export type Reminder = {
  id: string;
  // Target: either a task ("card") or a deck
  targetType: "task" | "deck";
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

const KEY = "toggl_zen_reminders";

function loadLS<T>(k: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return fb;
    return JSON.parse(raw) as T;
  } catch {
    return fb;
  }
}

function saveLS(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/** Compute the next time (epoch ms) a reminder should fire, or null if past one-off. */
export function nextFireAt(r: Reminder, from: number = Date.now()): number | null {
  if (r.repeat === "none") {
    return r.fireAt > from ? r.fireAt : null;
  }
  const base = new Date(r.fireAt);
  const hours = base.getHours();
  const minutes = base.getMinutes();
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setHours(hours, minutes, 0, 0);
  if (candidate.getTime() <= from) candidate.setDate(candidate.getDate() + 1);

  if (r.repeat === "daily") return candidate.getTime();
  if (r.repeat === "weekdays") {
    while (candidate.getDay() === 0 || candidate.getDay() === 6) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.getTime();
  }
  if (r.repeat === "weekly") {
    const target = r.weekday ?? base.getDay();
    while (candidate.getDay() !== target) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.getTime();
  }
  return null;
}

/* tiny built-in chime (no asset) */
function chime() {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
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

export function useReminders(onFire?: FireHandler) {
  const [hydrated, setHydrated] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const fireRef = useRef<FireHandler | undefined>(onFire);
  useEffect(() => {
    fireRef.current = onFire;
  }, [onFire]);

  useEffect(() => {
    setReminders(loadLS<Reminder[]>(KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveLS(KEY, reminders);
  }, [reminders, hydrated]);

  // Poll every 15s for due reminders
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const check = () => {
      if (cancelled) return;
      const now = Date.now();
      setReminders((prev) => {
        let changed = false;
        const next = prev.map((r) => {
          if (!r.enabled) return r;
          const last = r.lastFiredAt ?? 0;
          // For repeat reminders, compute the most recent scheduled trigger <= now
          let due = false;
          if (r.repeat === "none") {
            if (r.fireAt <= now && last < r.fireAt) due = true;
          } else {
            // find today's trigger
            const base = new Date(r.fireAt);
            const todayTrigger = new Date(now);
            todayTrigger.setHours(base.getHours(), base.getMinutes(), 0, 0);
            const t = todayTrigger.getTime();
            const dayOk =
              r.repeat === "daily" ||
              (r.repeat === "weekdays" && todayTrigger.getDay() >= 1 && todayTrigger.getDay() <= 5) ||
              (r.repeat === "weekly" && todayTrigger.getDay() === (r.weekday ?? base.getDay()));
            if (dayOk && t <= now && now - t < 90 * 1000 && last < t) due = true;
          }
          if (due) {
            changed = true;
            try {
              fireRef.current?.(r);
            } catch {
              /* ignore */
            }
            return {
              ...r,
              lastFiredAt: now,
              enabled: r.repeat === "none" ? false : r.enabled,
            };
          }
          return r;
        });
        return changed ? next : prev;
      });
    };

    check();
    const id = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hydrated]);

  const addReminder = useCallback((r: Omit<Reminder, "id" | "createdAt">) => {
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
        r.targetType === "task" ? validTaskIds.has(r.targetId) : validDeckIds.has(r.targetId),
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
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function fireBrowserNotification(r: Reminder, onClick?: () => void) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const body =
      r.targetType === "deck"
        ? `Time for deck: ${r.label}`
        : r.deckName
          ? `${r.deckName} — ${r.label}`
          : r.label;
    const n = new Notification("Zenith reminder", {
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
        n.close();
      };
    }
    setTimeout(() => n.close(), 12000);
  } catch {
    /* ignore */
  }
}

export function fireChime() {
  chime();
}
