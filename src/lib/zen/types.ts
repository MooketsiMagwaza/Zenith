export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type TimerMode = "stopwatch" | "countdown";

export type Task = {
  id: string;
  deckId: string;
  name: string;
  tag: string;
  totalSeconds: number;
  createdAt: number;
  checklist?: ChecklistItem[];
  mode?: TimerMode; // default "stopwatch"
  targetSeconds?: number; // used when mode === "countdown"
};

export type Deck = {
  id: string;
  name: string;
  color: string;
  tasks: Task[];
};

export type Log = {
  id: string;
  taskId: string;
  taskName: string;
  deckName: string;
  deckColor: string;
  duration: number;
  startedAt: number;
  endedAt: number;
  hasJournal: boolean;
};

export type Journal = {
  id: string;
  taskId: string | null;
  taskName: string;
  deckId: string | null;
  deckName: string | null;
  deckColor?: string | null;
  logId: string | null;
  body: string;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
};

export type ActiveTask = {
  taskIds: string[];
  deckIds: string[];
  startedAt: number | null;
};

export type ViewName = "decks" | "journal" | "history";
