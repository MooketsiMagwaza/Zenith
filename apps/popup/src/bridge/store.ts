/**
 * The pop-up's state and the commands that change it. This is the Electron prototype's main-process
 * store moved into the page: the same commands, the same immutable updates, the same reminder poll.
 * Persistence is in `persistence.ts`; the page and the window shell talk to this through `index.ts`.
 */

import { produce } from "immer";
import type { AgentState, Command, Reminder } from "../shared/types";
import { generateId } from "../shared/utils";
import { DEFAULT_STATE } from "../shared/constants";
import { loadState, saveState } from "./persistence";

type Listener = (state: AgentState) => void;
type ReminderListener = (reminder: Reminder) => void;

const POLL_MS = 15_000;
/** A repeating reminder only fires if it is at most this late, so reopening the app does not replay the day. */
const GRACE_MS = 90_000;

export class AgentStore {
  private state: AgentState = { ...DEFAULT_STATE, version: 0 };
  private listeners = new Set<Listener>();
  private onReminder: ReminderListener = () => {};
  private poller: ReturnType<typeof setInterval> | null = null;
  private ready: Promise<void> | null = null;

  init(): Promise<void> {
    this.ready ??= (async () => {
      const saved = await loadState();
      this.state = { ...DEFAULT_STATE, ...(saved ?? {}), version: 0 };
      this.startReminderPoller();
    })();
    return this.ready;
  }

  getState(): AgentState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setReminderHandler(fn: ReminderListener): void {
    this.onReminder = fn;
  }

  private update(recipe: (draft: AgentState) => void): void {
    this.state = produce(this.state, (draft) => {
      recipe(draft);
      draft.version++;
    });
    saveState(this.state);
    for (const fn of this.listeners) fn(this.state);
  }

  handleCommand(cmd: Command): void {
    switch (cmd.type) {
      case "START_SESSION": return this.startSession(cmd.taskIds);
      case "STOP_SESSION": return this.stopSession();
      case "ADD_DECK": return this.addDeck(cmd.name, cmd.color);
      case "ADD_TASK": return this.addTask(cmd.deckId, cmd.name, cmd.tag, cmd.mode, cmd.targetSeconds);
      case "DELETE_DECK": return this.deleteDeck(cmd.id);
      case "DELETE_TASK": return this.deleteTask(cmd.id);
      case "UPSERT_JOURNAL": return this.upsertJournal(cmd.content, cmd.targetId, cmd.targetType);
      case "TOGGLE_CHECKLIST": return this.toggleChecklist(cmd.taskId, cmd.itemId);
      case "ADD_CHECKLIST_ITEM": return this.addChecklistItem(cmd.taskId, cmd.text);
      case "ADD_REMINDER": return this.addReminder(cmd.reminder);
      case "REMOVE_REMINDER": return this.removeReminder(cmd.id);
      case "SET_TUTORIAL_SEEN": return this.update((d) => { d.tutorialSeen = cmd.seen; });
      case "SET_ZEN_PREFS":
        return this.update((d) => { d.zenPack = cmd.pack; d.zenInterval = cmd.interval; d.zenWallpaper = cmd.wallpaper; });
    }
  }

  private startSession(taskIds: string[]): void {
    this.update((d) => {
      if (d.active?.startedAt && d.active.taskIds.length) this.commitSession(d, d.active);
      const deckIds = taskIds.map((id) => d.tasks.find((t) => t.id === id)?.deckId || "");
      d.active = { taskIds, deckIds, startedAt: Date.now() };
    });
  }

  private stopSession(): void {
    this.update((d) => {
      if (d.active?.startedAt && d.active.taskIds.length) this.commitSession(d, d.active);
      d.active = null;
    });
  }

  /** Adds the elapsed time to each task in the session and writes one log line per task. */
  private commitSession(draft: AgentState, active: NonNullable<AgentState["active"]>): void {
    const startedAt = active.startedAt!;
    const duration = Math.floor((Date.now() - startedAt) / 1000);
    if (duration < 1) return;
    for (const taskId of active.taskIds) {
      const task = draft.tasks.find((t) => t.id === taskId);
      if (!task) continue;
      task.totalSeconds += duration;
      const deck = draft.decks.find((dd) => dd.id === task.deckId);
      draft.logs.push({
        id: generateId(),
        taskId,
        taskName: task.name,
        deckName: deck?.name || "",
        deckColor: deck?.color || "#c9a84c",
        duration,
        startedAt,
        endedAt: Date.now(),
        hasJournal: false,
      });
    }
  }

  private addDeck(name: string, color: string): void {
    this.update((d) => { d.decks.push({ id: generateId(), name, color, createdAt: Date.now() }); });
  }

  private addTask(deckId: string, name: string, tag?: string, mode?: "stopwatch" | "countdown", targetSeconds?: number): void {
    this.update((d) => {
      d.tasks.push({
        id: generateId(), deckId, name, tag: tag || "", totalSeconds: 0, createdAt: Date.now(), mode,
        targetSeconds: mode === "countdown" ? targetSeconds ?? 1500 : undefined,
      });
    });
  }

  private deleteDeck(id: string): void {
    this.update((d) => {
      const taskIds = d.tasks.filter((t) => t.deckId === id).map((t) => t.id);
      d.reminders = d.reminders.filter(
        (r) => !(r.targetType === "deck" && r.targetId === id) && !(r.targetType === "task" && taskIds.includes(r.targetId)),
      );
      d.decks = d.decks.filter((dd) => dd.id !== id);
      d.tasks = d.tasks.filter((t) => t.deckId !== id);
      d.journals = d.journals.filter((j) => j.deckId !== id && (!j.taskId || !taskIds.includes(j.taskId)));
      if (d.active) {
        d.active.taskIds = d.active.taskIds.filter((tid) => !taskIds.includes(tid));
        d.active.deckIds = d.active.deckIds.filter((did) => did !== id);
        if (!d.active.taskIds.length) d.active = null;
      }
    });
  }

  private deleteTask(id: string): void {
    this.update((d) => {
      d.tasks = d.tasks.filter((t) => t.id !== id);
      d.journals = d.journals.filter((j) => j.taskId !== id);
      // The prototype kept only *task* reminders here, which silently dropped every deck reminder.
      d.reminders = d.reminders.filter((r) => !(r.targetType === "task" && r.targetId === id));
      const index = d.active?.taskIds.indexOf(id) ?? -1;
      if (d.active && index !== -1) {
        d.active.taskIds.splice(index, 1);
        d.active.deckIds.splice(index, 1);
        if (!d.active.taskIds.length) d.active = null;
      }
    });
  }

  private upsertJournal(content: string, targetId: string, targetType: "task" | "deck"): void {
    this.update((d) => {
      const existing = d.journals.find((j) => (targetType === "task" ? j.taskId === targetId : j.deckId === targetId));
      if (existing) {
        existing.content = content;
        existing.updatedAt = Date.now();
      } else {
        d.journals.push({ id: generateId(), [targetType === "task" ? "taskId" : "deckId"]: targetId, content, updatedAt: Date.now() });
      }
    });
  }

  private toggleChecklist(taskId: string, itemId: string): void {
    this.update((d) => {
      const item = d.tasks.find((t) => t.id === taskId)?.checklist?.find((i) => i.id === itemId);
      if (item) item.done = !item.done;
    });
  }

  private addChecklistItem(taskId: string, text: string): void {
    this.update((d) => {
      const task = d.tasks.find((t) => t.id === taskId);
      if (!task) return;
      (task.checklist ??= []).push({ id: generateId(), text: text.trim(), done: false });
    });
  }

  private addReminder(reminder: Omit<Reminder, "id" | "lastFiredAt" | "createdAt">): void {
    this.update((d) => { d.reminders.push({ ...reminder, id: generateId(), createdAt: Date.now(), lastFiredAt: undefined }); });
  }

  private removeReminder(id: string): void {
    this.update((d) => { d.reminders = d.reminders.filter((r) => r.id !== id); });
  }

  /** True when `r` should fire at `now`. A one-off fires once it is due; a repeat fires in the minute after its time of day. */
  static isDue(r: Reminder, now: number): boolean {
    if (!r.enabled) return false;
    if (r.repeat === "none") return r.fireAt <= now && (!r.lastFiredAt || r.lastFiredAt < r.fireAt);
    const base = new Date(r.fireAt);
    const today = new Date(now);
    today.setHours(base.getHours(), base.getMinutes(), 0, 0);
    const trigger = today.getTime();
    const day = today.getDay();
    const dayOk =
      r.repeat === "daily" ||
      (r.repeat === "weekdays" && day >= 1 && day <= 5) ||
      (r.repeat === "weekly" && day === (r.weekday ?? base.getDay()));
    return dayOk && trigger <= now && now - trigger < GRACE_MS && (!r.lastFiredAt || r.lastFiredAt < trigger);
  }

  private startReminderPoller(): void {
    if (this.poller) clearInterval(this.poller);
    const check = () => {
      const now = Date.now();
      const due = this.state.reminders.filter((r) => AgentStore.isDue(r, now));
      if (!due.length) return;
      this.update((d) => {
        for (const r of d.reminders) {
          if (!due.some((x) => x.id === r.id)) continue;
          r.lastFiredAt = now;
          if (r.repeat === "none") r.enabled = false;
        }
      });
      for (const r of due) this.onReminder(r);
    };
    check();
    this.poller = setInterval(check, POLL_MS);
  }
}
