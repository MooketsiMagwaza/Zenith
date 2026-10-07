import { useMemo, useState, useEffect, useRef } from "react";
import type { Deck } from "@/lib/zen/types";
import {
  type Reminder,
  type ReminderRepeat,
  nextFireAt,
  requestNotificationPermission,
} from "@/lib/zen/useReminders";
import { notify } from "@/lib/zen/notify";

const PERM_KEY = "zenith.notif.permission";


type Props = {
  decks: Deck[];
  reminders: Reminder[];
  onClose: () => void;
  onAdd: (r: Omit<Reminder, "id" | "createdAt">) => void;
  onUpdate: (id: string, patch: Partial<Reminder>) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
};

const REPEAT_OPTIONS: { value: ReminderRepeat; label: string }[] = [
  { value: "none", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toLocalDateTimeInput(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalTimeInput(ms: number) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatFireLabel(r: Reminder) {
  const next = nextFireAt(r);
  if (!next) return "Past";
  const d = new Date(next);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (r.repeat === "daily") return `Daily · ${time}`;
  if (r.repeat === "weekdays") return `Weekdays · ${time}`;
  if (r.repeat === "weekly") return `${WEEKDAYS[r.weekday ?? d.getDay()]} · ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

export function RemindersModal({
  decks,
  reminders,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  onToggle,
}: Props) {
  const [creating, setCreating] = useState(false);

  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (!supported) return "unsupported";
    // Hydrate instantly from last-known persisted value, then sync with live state.
    try {
      const cached = localStorage.getItem(PERM_KEY) as NotificationPermission | null;
      return (cached as NotificationPermission) || Notification.permission;
    } catch {
      return Notification.permission;
    }
  });

  // Persist permission whenever it changes so subsequent opens reflect it instantly.
  useEffect(() => {
    if (!supported || permission === "unsupported") return;
    try {
      localStorage.setItem(PERM_KEY, permission);
    } catch {
      /* ignore */
    }
  }, [permission, supported]);

  // Keep permission state in sync: re-check on focus/visibility, and subscribe
  // to the Permissions API change event if available.
  useEffect(() => {
    if (!supported) return;
    const sync = () => setPermission(Notification.permission);
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    let status: PermissionStatus | null = null;
    const nav = navigator as Navigator & { permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> } };
    if (nav.permissions?.query) {
      nav.permissions
        .query({ name: "notifications" as PermissionName })
        .then((s) => {
          status = s;
          status.addEventListener("change", sync);
        })
        .catch(() => {});
    }
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      if (status) status.removeEventListener("change", sync);
    };
  }, [supported]);

  // Focus trap + ESC close. Focus the first interactive element on open;
  // cycle Tab/Shift+Tab within the dialog; restore focus on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    const root = dialogRef.current;
    const focusables = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    const first = focusables()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (active && root && !root.contains(active)) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  const sorted = useMemo(() => {
    return [...reminders].sort((a, b) => (nextFireAt(a) ?? Infinity) - (nextFireAt(b) ?? Infinity));
  }, [reminders]);

  const askPermission = async () => {
    const p = await requestNotificationPermission();
    setPermission(p);
    if (p === "granted") notify.success("Notifications enabled");
    else if (p === "denied") notify.error("Notifications blocked", { description: "Enable them in your browser settings." });
  };

  const permRegionLabel =
    permission === "granted"
      ? "Notification permission: enabled"
      : permission === "denied"
        ? "Notification permission: blocked"
        : permission === "unsupported"
          ? "Notification permission: unsupported"
          : "Notification permission: not set";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-3 py-6 backdrop-blur-sm fade-in sm:items-center sm:px-4 sm:py-8"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminders-title"
        aria-describedby="reminders-desc"
        onClick={(e) => e.stopPropagation()}
        className="card-soft my-auto w-full max-w-lg border border-border bg-surface-1 p-4 sm:p-6"
      >

        <div className="mb-4 flex items-start justify-between gap-4 sm:mb-5">
          <div className="min-w-0">
            <div className="micro-caps text-text-dim">Schedule</div>
            <div id="reminders-title" className="font-display mt-1 text-2xl leading-tight">Reminders</div>
            <p id="reminders-desc" className="mt-1 text-xs text-text-secondary">
              Get a chime and notification when it's time to start a deck or card.
            </p>

          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-md p-1 text-text-dim transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            ×
          </button>
        </div>
        <div role="region" aria-label={permRegionLabel} aria-live="polite">
          {permission === "default" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-accent-gold-dim/60 bg-accent-gold-dim/10 px-3 py-2.5">
              <div className="min-w-0 flex-1 text-xs text-text-secondary">
                <span className="text-foreground">Enable browser notifications</span> so reminders reach you even when this tab is in the background.
              </div>
              <button
                onClick={askPermission}
                aria-label="Enable browser notifications"
                className="micro-caps shrink-0 rounded border border-accent-gold-dim bg-accent-gold-dim/20 px-3 py-1.5 text-accent-gold transition-colors hover:bg-accent-gold-dim/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
              >
                Enable
              </button>
            </div>
          )}
          {permission === "denied" && (
            <div className="mb-4 rounded border border-border bg-background/40 px-3 py-2.5 text-xs text-text-secondary">
              Notifications are blocked. You'll still hear the chime — re-enable notifications in your browser settings to get pop-ups.
            </div>
          )}
          {permission === "granted" && (
            <div className="mb-4 flex items-center gap-2 rounded border border-accent-gold-dim/40 bg-accent-gold-dim/5 px-3 py-2 text-xs text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-gold" aria-hidden />
              Browser notifications are on.
            </div>
          )}
          {permission === "unsupported" && (
            <div className="mb-4 rounded border border-border bg-background/40 px-3 py-2.5 text-xs text-text-secondary">
              This browser doesn't support notifications. Reminders will still play the chime when this tab is open.
            </div>
          )}
        </div>


        {creating ? (
          <ReminderForm
            decks={decks}
            onCancel={() => setCreating(false)}
            onSubmit={async (r) => {
              if (r.notify) {
                const p = await requestNotificationPermission();
                setPermission(p);
              }
              onAdd(r);
              setCreating(false);
              notify.success("Reminder scheduled");
            }}
          />

        ) : (
          <>
            <button
              onClick={() => setCreating(true)}
              className="micro-caps mb-4 w-full rounded border border-accent-gold-dim px-3 py-2 text-accent-gold transition-colors hover:bg-accent-gold-dim/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
            >
              + New reminder
            </button>

            {sorted.length === 0 ? (
              <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-secondary">
                No reminders yet. Schedule a chime for a deck or card.
              </div>
            ) : (
              <ul className="space-y-2">
                {sorted.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded border border-border bg-background/40 p-3"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: r.deckColor ?? "#7a7a7a" }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">
                        {r.targetType === "deck" ? "Deck · " : ""}
                        {r.label}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-text-dim">
                        {r.deckName && r.targetType === "task" ? `${r.deckName} · ` : ""}
                        {formatFireLabel(r)}
                        {!r.enabled ? " · paused" : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => onToggle(r.id)}
                      className="micro-caps shrink-0 rounded border border-border px-2 py-1 text-text-secondary transition-colors hover:border-accent-gold-dim hover:text-accent-gold"
                    >
                      {r.enabled ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => {
                        onDelete(r.id);
                        notify.info("Reminder removed");
                      }}
                      aria-label="Delete reminder"
                      className="shrink-0 text-text-dim transition-colors hover:text-danger"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReminderForm({
  decks,
  onCancel,
  onSubmit,
}: {
  decks: Deck[];
  onCancel: () => void;
  onSubmit: (r: Omit<Reminder, "id" | "createdAt">) => void;
}) {
  const flatTargets = useMemo(
    () =>
      decks.flatMap((d) => [
        { kind: "deck" as const, id: d.id, label: d.name, deckName: d.name, color: d.color },
        ...d.tasks.map((t) => ({
          kind: "task" as const,
          id: t.id,
          label: t.name,
          deckName: d.name,
          color: d.color,
        })),
      ]),
    [decks],
  );

  const [targetKey, setTargetKey] = useState<string>(
    flatTargets[0] ? `${flatTargets[0].kind}:${flatTargets[0].id}` : "",
  );
  const [repeat, setRepeat] = useState<ReminderRepeat>("daily");
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  const [timeStr, setTimeStr] = useState<string>(toLocalTimeInput(now.getTime()));
  const [dateTimeStr, setDateTimeStr] = useState<string>(toLocalDateTimeInput(now.getTime()));
  const [weekday, setWeekday] = useState<number>(new Date().getDay());
  const [notifOn, setNotifOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  const submit = () => {
    const target = flatTargets.find((t) => `${t.kind}:${t.id}` === targetKey);
    if (!target) {
      notify.error("Pick a deck or card first");
      return;
    }
    let fireAt: number;
    if (repeat === "none") {
      const d = new Date(dateTimeStr);
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        notify.error("Pick a future date and time");
        return;
      }
      fireAt = d.getTime();
    } else {
      const [h, m] = timeStr.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      fireAt = d.getTime();
    }
    onSubmit({
      targetType: target.kind,
      targetId: target.id,
      label: target.label,
      deckName: target.deckName,
      deckColor: target.color,
      fireAt,
      repeat,
      weekday: repeat === "weekly" ? weekday : undefined,
      enabled: true,
      notify: notifOn,
      sound: soundOn,
    });
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="micro-caps text-text-dim">Target</span>
        <select
          value={targetKey}
          onChange={(e) => setTargetKey(e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent-gold-dim focus:outline-none"
        >
          {flatTargets.length === 0 ? (
            <option value="">No decks or cards yet</option>
          ) : (
            decks.map((d) => (
              <optgroup key={d.id} label={d.name}>
                <option value={`deck:${d.id}`}>Whole deck · {d.name}</option>
                {d.tasks.map((t) => (
                  <option key={t.id} value={`task:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))
          )}
        </select>
      </label>

      <label className="block">
        <span className="micro-caps text-text-dim">Repeat</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {REPEAT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setRepeat(o.value)}
              className={`micro-caps rounded border px-3 py-1.5 transition-colors ${
                repeat === o.value
                  ? "border-accent-gold-dim bg-accent-gold-dim/20 text-accent-gold"
                  : "border-border text-text-secondary hover:border-accent-gold-dim hover:text-accent-gold"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </label>

      {repeat === "weekly" && (
        <label className="block">
          <span className="micro-caps text-text-dim">Day</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {WEEKDAYS.map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeekday(i)}
                className={`micro-caps rounded border px-2.5 py-1.5 transition-colors ${
                  weekday === i
                    ? "border-accent-gold-dim bg-accent-gold-dim/20 text-accent-gold"
                    : "border-border text-text-secondary hover:border-accent-gold-dim hover:text-accent-gold"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </label>
      )}

      <label className="block">
        <span className="micro-caps text-text-dim">{repeat === "none" ? "When" : "Time"}</span>
        {repeat === "none" ? (
          <input
            type="datetime-local"
            value={dateTimeStr}
            onChange={(e) => setDateTimeStr(e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent-gold-dim focus:outline-none"
          />
        ) : (
          <input
            type="time"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent-gold-dim focus:outline-none"
          />
        )}
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setNotifOn((v) => !v)}
          className={`micro-caps rounded border px-3 py-1.5 transition-colors ${
            notifOn
              ? "border-accent-gold-dim bg-accent-gold-dim/20 text-accent-gold"
              : "border-border text-text-secondary hover:text-foreground"
          }`}
        >
          {notifOn ? "✓" : "○"} Notification
        </button>
        <button
          type="button"
          onClick={() => setSoundOn((v) => !v)}
          className={`micro-caps rounded border px-3 py-1.5 transition-colors ${
            soundOn
              ? "border-accent-gold-dim bg-accent-gold-dim/20 text-accent-gold"
              : "border-border text-text-secondary hover:text-foreground"
          }`}
        >
          {soundOn ? "✓" : "○"} Chime
        </button>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="micro-caps rounded border border-border px-4 py-2 text-text-secondary transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="micro-caps rounded border border-accent-gold-dim bg-accent-gold-dim/20 px-4 py-2 text-accent-gold transition-colors hover:bg-accent-gold-dim/30"
        >
          Schedule
        </button>
      </div>
    </div>
  );
}
