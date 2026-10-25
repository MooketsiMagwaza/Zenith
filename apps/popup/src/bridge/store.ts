/**
 * The pop-up's state and the commands that change it. This is the Electron prototype's main-process
 * store moved into the page: the same commands, the same immutable updates, the same reminder poll.
 * Persistence is in `persistence.ts`; the page and the window shell talk to this through `index.ts`.
 */

import { produce } from 'immer';
import type { AgentState, Command, Reminder } from '../shared/types';
import { generateId } from '../shared/utils';
import { DEFAULT_STATE } from '../shared/constants';
import { loadState, saveState } from './persistence';
import { migratePopupState } from '../shared/migration';
import { PetSchema, petPhrase } from '../shared/pet';

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
  private unreadablePet: unknown = undefined;
  private initialized = false;
  private hasReminderHandler = false;
  constructor(
    private persistence = { load: loadState, save: saveState },
    private now: () => number = Date.now,
  ) {}

  init(): Promise<void> {
    this.ready ??= (async () => {
      const saved = await this.persistence.load();
      const migrated = migratePopupState(saved);
      this.state = { ...migrated.state, version: 0 };
      this.unreadablePet = migrated.unreadablePet;
      this.initialized = true;
      if (this.hasReminderHandler) this.startReminderPoller();
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
    this.hasReminderHandler = true;
    if (this.initialized) this.startReminderPoller();
  }
  dispose(): void {
    if (this.poller) clearInterval(this.poller);
    this.poller = null;
    this.listeners.clear();
  }

  private update(recipe: (draft: AgentState) => void): void {
    this.state = produce(this.state, (draft) => {
      recipe(draft);
      draft.version++;
    });
    const { petReadOnly, ...saved } = this.state;
    this.persistence.save(
      (petReadOnly ? { ...saved, pet: this.unreadablePet } : saved) as AgentState,
    );
    for (const fn of this.listeners) fn(this.state);
  }

  handleCommand(cmd: Command): void {
    switch (cmd.type) {
      case 'SET_PET_PREFS': {
        if (this.state.petReadOnly) return;
        const parsed = PetSchema.safeParse({ ...this.state.pet, ...cmd.patch });
        if (parsed.success)
          this.update((d) => {
            d.pet = parsed.data;
          });
        return;
      }
      case 'PET_INTERACTION':
        if (!this.state.pet.enabled || this.state.petReadOnly) return;
        return this.update((d) => {
          if (cmd.kind === 'open') d.pet.interactions.opens++;
          else d.pet.interactions.drags++;
        });
      case 'START_BREAK':
        if (
          !this.state.pet.enabled ||
          this.state.petReadOnly ||
          !Number.isInteger(cmd.minutes) ||
          cmd.minutes < 1 ||
          cmd.minutes > 120
        )
          return;
        this.stopSession();
        return this.update((d) => {
          d.pet.breakUntil = this.now() + cmd.minutes * 60000;
          d.pet.celebrateUntil = null;
        });
      case 'END_BREAK':
        if (this.state.petReadOnly) return;
        return this.update((d) => {
          d.pet.breakUntil = null;
        });
      case 'START_SESSION':
        return this.startSession(cmd.taskIds);
      case 'STOP_SESSION':
        return this.stopSession();
      case 'ADD_DECK':
        return this.addDeck(cmd.name, cmd.color);
      case 'ADD_TASK':
        return this.addTask(cmd.deckId, cmd.name, cmd.tag, cmd.mode, cmd.targetSeconds);
      case 'DELETE_DECK':
        return this.deleteDeck(cmd.id);
      case 'DELETE_TASK':
        return this.deleteTask(cmd.id);
      case 'UPSERT_JOURNAL':
        return this.upsertJournal(cmd.content, cmd.targetId, cmd.targetType);
      case 'TOGGLE_CHECKLIST':
        return this.toggleChecklist(cmd.taskId, cmd.itemId);
      case 'ADD_CHECKLIST_ITEM':
        return this.addChecklistItem(cmd.taskId, cmd.text);
      case 'ADD_REMINDER':
        return this.addReminder(cmd.reminder);
      case 'REMOVE_REMINDER':
        return this.removeReminder(cmd.id);
      case 'SET_TUTORIAL_SEEN':
        return this.update((d) => {
          d.tutorialSeen = cmd.seen;
        });
      case 'SET_ZEN_PREFS':
        return this.update((d) => {
          d.zenPack = cmd.pack;
          d.zenInterval = cmd.interval;
          d.zenWallpaper = cmd.wallpaper;
        });
    }
  }

  private startSession(taskIds: string[]): void {
    this.update((d) => {
      if (d.active?.startedAt != null && d.active.taskIds.length) this.commitSession(d, d.active);
      const deckIds = taskIds.map((id) => d.tasks.find((t) => t.id === id)?.deckId || '');
      d.active = { taskIds, deckIds, startedAt: this.now() };
      d.pet.breakUntil = null;
      d.pet.celebrateUntil = null;
    });
  }

  private stopSession(): void {
    this.update((d) => {
      const hadTime =
        d.active?.startedAt != null &&
        d.active.taskIds.length > 0 &&
        this.now() - d.active.startedAt >= 1000;
      if (d.active?.startedAt != null && d.active.taskIds.length) this.commitSession(d, d.active);
      if (hadTime && d.pet.enabled && d.pet.celebrations) d.pet.celebrateUntil = this.now() + 8000;
      d.active = null;
    });
  }

  /** Adds the elapsed time to each task in the session and writes one log line per task. */
  private commitSession(draft: AgentState, active: NonNullable<AgentState['active']>): void {
    const startedAt = active.startedAt!;
    const duration = Math.floor((this.now() - startedAt) / 1000);
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
        deckName: deck?.name || '',
        deckColor: deck?.color || '#c9a84c',
        duration,
        startedAt,
        endedAt: this.now(),
        hasJournal: false,
      });
    }
  }

  private addDeck(name: string, color: string): void {
    this.update((d) => {
      d.decks.push({ id: generateId(), name, color, createdAt: this.now() });
    });
  }

  private addTask(
    deckId: string,
    name: string,
    tag?: string,
    mode?: 'stopwatch' | 'countdown',
    targetSeconds?: number,
  ): void {
    this.update((d) => {
      d.tasks.push({
        id: generateId(),
        deckId,
        name,
        tag: tag || '',
        totalSeconds: 0,
        createdAt: this.now(),
        mode,
        targetSeconds: mode === 'countdown' ? (targetSeconds ?? 1500) : undefined,
      });
    });
  }

  private deleteDeck(id: string): void {
    this.update((d) => {
      const taskIds = d.tasks.filter((t) => t.deckId === id).map((t) => t.id);
      d.reminders = d.reminders.filter(
        (r) =>
          !(r.targetType === 'deck' && r.targetId === id) &&
          !(r.targetType === 'task' && taskIds.includes(r.targetId)),
      );
      d.decks = d.decks.filter((dd) => dd.id !== id);
      d.tasks = d.tasks.filter((t) => t.deckId !== id);
      d.journals = d.journals.filter(
        (j) => j.deckId !== id && (!j.taskId || !taskIds.includes(j.taskId)),
      );
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
      d.reminders = d.reminders.filter((r) => !(r.targetType === 'task' && r.targetId === id));
      const index = d.active?.taskIds.indexOf(id) ?? -1;
      if (d.active && index !== -1) {
        d.active.taskIds.splice(index, 1);
        d.active.deckIds.splice(index, 1);
        if (!d.active.taskIds.length) d.active = null;
      }
    });
  }

  private upsertJournal(content: string, targetId: string, targetType: 'task' | 'deck'): void {
    this.update((d) => {
      const existing = d.journals.find((j) =>
        targetType === 'task' ? j.taskId === targetId : j.deckId === targetId,
      );
      if (existing) {
        existing.content = content;
        existing.updatedAt = this.now();
      } else {
        d.journals.push({
          id: generateId(),
          [targetType === 'task' ? 'taskId' : 'deckId']: targetId,
          content,
          updatedAt: this.now(),
        });
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

  private addReminder(reminder: Omit<Reminder, 'id' | 'lastFiredAt' | 'createdAt'>): void {
    this.update((d) => {
      d.reminders.push({
        ...reminder,
        id: generateId(),
        createdAt: this.now(),
        lastFiredAt: undefined,
      });
    });
  }

  private removeReminder(id: string): void {
    this.update((d) => {
      d.reminders = d.reminders.filter((r) => r.id !== id);
    });
  }

  /** True when `r` should fire at `now`. A one-off fires once it is due; a repeat fires in the minute after its time of day. */
  static isDue(r: Reminder, now: number): boolean {
    if (!r.enabled) return false;
    const last = r.lastFiredAt ?? -Infinity;
    if (r.repeat === 'none') return r.fireAt <= now && last < r.fireAt;
    const base = new Date(r.fireAt);
    const today = new Date(now);
    today.setHours(base.getHours(), base.getMinutes(), 0, 0);
    const trigger = today.getTime();
    const first = new Date(r.fireAt);
    first.setSeconds(0, 0);
    const day = today.getDay();
    const dayOk =
      r.repeat === 'daily' ||
      (r.repeat === 'weekdays' && day >= 1 && day <= 5) ||
      (r.repeat === 'weekly' && day === (r.weekday ?? base.getDay()));
    return (
      dayOk &&
      trigger >= first.getTime() &&
      trigger <= now &&
      now - trigger < GRACE_MS &&
      last < trigger
    );
  }

  private startReminderPoller(): void {
    if (this.poller) clearInterval(this.poller);
    const check = () => {
      const now = this.now();
      const due = this.state.reminders.filter((r) => AgentStore.isDue(r, now));
      if (!due.length) return;
      this.update((d) => {
        for (const r of d.reminders) {
          if (!due.some((x) => x.id === r.id)) continue;
          r.lastFiredAt = now;
          if (d.pet.enabled && d.pet.messages && d.pet.nudges && !d.petReadOnly) {
            const task = d.tasks.find((t) => r.targetType === 'task' && t.id === r.targetId);
            const deck = d.decks.find((x) => r.targetType === 'deck' && x.id === r.targetId);
            d.pet.lastMessage = petPhrase(
              task?.name ?? deck?.name ?? r.label,
              task?.id,
              d.pet,
            ).slice(0, 10000);
            d.pet.nudgeUntil = now + 12000;
          }
          if (r.repeat === 'none') r.enabled = false;
        }
      });
      for (const r of due) this.onReminder(r);
    };
    check();
    this.poller = setInterval(check, POLL_MS);
  }
}
