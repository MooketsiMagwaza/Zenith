export type TimerMode = 'stopwatch' | 'countdown'
export type ChecklistItem = { id: string; text: string; done: boolean }
export type Deck = { id: string; name: string; color: string; createdAt: number }
export type Task = {
  id: string; deckId: string; name: string; tag: string;
  totalSeconds: number; createdAt: number;
  checklist?: ChecklistItem[];
  mode?: TimerMode; targetSeconds?: number;
}
export type Log = {
  id: string; taskId: string; taskName: string;
  deckName: string; deckColor: string;
  duration: number; startedAt: number; endedAt: number;
  hasJournal: boolean;
}
export type Journal = {
  id: string; taskId?: string; deckId?: string;
  content: string; updatedAt: number;
}
export type Reminder = {
  id: string; targetType: 'task' | 'deck'; targetId: string;
  label: string; deckName?: string; deckColor?: string;
  fireAt: number; repeat: 'none' | 'daily' | 'weekdays' | 'weekly';
  weekday?: number; enabled: boolean; notify: boolean; sound: boolean;
  createdAt: number; lastFiredAt?: number;
}
export type ActiveTask = { taskIds: string[]; deckIds: string[]; startedAt: number | null } | null
export type AgentState = {
  version: number; decks: Deck[]; tasks: Task[]; logs: Log[];
  journals: Journal[]; active: ActiveTask; reminders: Reminder[];
  tutorialSeen: boolean; zenPack: string; zenInterval: number; zenWallpaper: string;
}
export type Command =
  | { type: 'START_SESSION'; taskIds: string[] }
  | { type: 'STOP_SESSION' }
  | { type: 'ADD_DECK'; name: string; color: string }
  | { type: 'ADD_TASK'; deckId: string; name: string; tag?: string; mode?: TimerMode; targetSeconds?: number }
  | { type: 'DELETE_DECK'; id: string }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'UPSERT_JOURNAL'; content: string; targetId: string; targetType: 'task' | 'deck' }
  | { type: 'TOGGLE_CHECKLIST'; taskId: string; itemId: string }
  | { type: 'ADD_CHECKLIST_ITEM'; taskId: string; text: string }
  | { type: 'ADD_REMINDER'; reminder: Omit<Reminder, 'id' | 'lastFiredAt' | 'createdAt'> }
  | { type: 'REMOVE_REMINDER'; id: string }
  | { type: 'SET_TUTORIAL_SEEN'; seen: boolean }
  | { type: 'SET_ZEN_PREFS'; pack: string; interval: number; wallpaper: string }
