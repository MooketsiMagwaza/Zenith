import { migrateActive } from "./migration";
import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "@/lib/platform";
import type { ActiveTask, ChecklistItem, Deck, Journal, Log, Task, TimerMode } from "./types";
import { generateId } from "./utils";

const KEYS = {
  decks: "toggl_zen_decks",
  logs: "toggl_zen_logs",
  journals: "toggl_zen_journals",
  active: "toggl_zen_active",
};

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveLS(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try {
    storage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

const seedDecks = (): Deck[] => {
  const now = Date.now();
  const academicsId = generateId();
  const projectsId = generateId();
  return [
    {
      id: academicsId,
      name: "Sample: Academics",
      color: "#c9a84c",
      tasks: [
        { id: generateId(), deckId: academicsId, name: "Study session", tag: "Study", totalSeconds: 0, createdAt: now },
        { id: generateId(), deckId: academicsId, name: "Lab", tag: "Lab", totalSeconds: 0, createdAt: now },
        { id: generateId(), deckId: academicsId, name: "Practice", tag: "Drill", totalSeconds: 0, createdAt: now },
      ],
    },
    {
      id: projectsId,
      name: "Sample: Projects",
      color: "#3aa6a0",
      tasks: [
        { id: generateId(), deckId: projectsId, name: "Build", tag: "Code", totalSeconds: 0, createdAt: now },
        { id: generateId(), deckId: projectsId, name: "Design", tag: "Sketch", totalSeconds: 0, createdAt: now },
        { id: generateId(), deckId: projectsId, name: "Writeup", tag: "Doc", totalSeconds: 0, createdAt: now },
      ],
    },
  ];
};

export function useTogglZen() {
  const [hydrated, setHydrated] = useState(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [active, setActive] = useState<ActiveTask>({ taskIds: [], deckIds: [], startedAt: null });
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // hydrate
  useEffect(() => {
    const d = loadLS<Deck[] | null>(KEYS.decks, null);
    if (d !== null) {
      setDecks(d);
      setLogs(loadLS<Log[]>(KEYS.logs, []));
      // Dedupe legacy duplicate journals: keep most recently updated per (taskId|deckId).
      const raw = loadLS<Journal[]>(KEYS.journals, []);
      const byKey = new Map<string, Journal>();
      for (const j of [...raw].sort((a, b) => a.updatedAt - b.updatedAt)) {
        const key = j.taskId ? `t:${j.taskId}` : j.deckId ? `d:${j.deckId}` : `id:${j.id}`;
        const prev = byKey.get(key);
        if (!prev) byKey.set(key, j);
        else byKey.set(key, { ...prev, ...j, body: j.body, updatedAt: j.updatedAt });
      }
      // One-time cleanup: drop journals whose target deck/task no longer exists.
      const validTaskIds = new Set(d.flatMap((deck) => deck.tasks.map((t) => t.id)));
      const validDeckIds = new Set(d.map((deck) => deck.id));
      const cleaned = Array.from(byKey.values()).filter((j) =>
        j.taskId ? validTaskIds.has(j.taskId) : j.deckId ? validDeckIds.has(j.deckId) : false,
      );
      setJournals(cleaned);
      saveLS(KEYS.journals, cleaned);
    } else {
      // @AI-INSTRUCTION: DO NOT EVER seed fake logs, history, or journals.
      // The app must start with zero history to maintain authenticity.
      // We only seed the Decks to show the user the expected data structure.
      const seeded = seedDecks();
      
      setDecks(seeded);
      setLogs([]);
      setJournals([]);
      
      saveLS(KEYS.decks, seeded);
      saveLS(KEYS.logs, []);
      saveLS(KEYS.journals, []);
    }
    const loaded = loadLS<ActiveTask & { taskId?: string | null; deckId?: string | null }>(KEYS.active, { taskIds: [], deckIds: [], startedAt: null });
    setActive(migrateActive(loaded));
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) saveLS(KEYS.decks, decks); }, [decks, hydrated]);
  useEffect(() => { if (hydrated) saveLS(KEYS.logs, logs); }, [logs, hydrated]);
  useEffect(() => { if (hydrated) saveLS(KEYS.journals, journals); }, [journals, hydrated]);
  useEffect(() => { if (hydrated) saveLS(KEYS.active, active); }, [active, hydrated]);

  // ticker
  useEffect(() => {
    if (active.startedAt) {
      intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [active.startedAt]);

  const elapsed = active.startedAt ? Math.floor((Date.now() - active.startedAt) / 1000) : 0;
  void tick;

  // Current refs avoid stale deck snapshots and side effects inside React state updaters.
  const decksRef = useRef(decks);
  decksRef.current = decks;
  const activeRef = useRef(active);
  activeRef.current = active;

  const commitStop = (taskId: string, deckId: string | null, startedAt: number, dur: number, endedAt = Date.now()) => {
    const deck = decksRef.current.find(d => d.id === deckId);
    const task = deck?.tasks.find(t => t.id === taskId);
    if (!deck || !task || dur < 1) return;
    const log: Log = { id: generateId(), taskId, taskName: task.name, deckName: deck.name, deckColor: deck.color, duration: dur, startedAt, endedAt, hasJournal: false };
    setLogs(prev => [log, ...prev]);
    setDecks(prev => prev.map(d => d.id !== deck.id ? d : { ...d, tasks: d.tasks.map(t => t.id !== taskId ? t : { ...t, totalSeconds: t.totalSeconds + dur }) }));
  };

  const stopTask = useCallback((endedAt = Date.now()) => {
    const current = activeRef.current;
    if (current.startedAt === null || !current.taskIds.length) return;
    const dur = Math.max(0, Math.floor((endedAt - current.startedAt) / 1000));
    current.taskIds.forEach((tid, i) => commitStop(tid, current.deckIds[i] ?? null, current.startedAt!, dur, endedAt));
    const empty = { taskIds: [], deckIds: [], startedAt: null };
    activeRef.current = empty;
    setActive(empty);
  }, []);

  const startTasks = useCallback((tasks: Task[]) => {
    if (!tasks.length) return;
    stopTask();
    const next = { taskIds: tasks.map(t => t.id), deckIds: tasks.map(t => t.deckId), startedAt: Date.now() };
    activeRef.current = next;
    setActive(next);
  }, [stopTask]);
  const startTask = useCallback((task: Task) => startTasks([task]), [startTasks]);

  const replaceAll = useCallback(
    (s: { decks: Deck[]; logs: Log[]; journals: Journal[] }) => {
      setDecks(s.decks);
      setLogs(s.logs);
      setJournals(s.journals);
    },
    [],
  );

  const addDeck = (name: string) => {
    const colors = ["#c9a84c", "#3aa6a0", "#a06ad8", "#d87a6a", "#7aa6d8"];
    const color = colors[decks.length % colors.length];
    const id = generateId();
    setDecks((p) => [...p, { id, name, color, tasks: [] }]);
    return id;
  };

  const addTask = (
    deckId: string,
    name: string,
    tag: string,
    opts?: { mode?: TimerMode; targetSeconds?: number }
  ) => {
    const id = generateId();
    setDecks((p) =>
      p.map((d) =>
        d.id !== deckId
          ? d
          : {
              ...d,
              tasks: [
                ...d.tasks,
                {
                  id,
                  deckId,
                  name,
                  tag,
                  totalSeconds: 0,
                  createdAt: Date.now(),
                  mode: opts?.mode ?? "stopwatch",
                  targetSeconds: opts?.mode === "countdown" ? opts?.targetSeconds ?? 1500 : undefined,
                },
              ],
            }
      )
    );
    return id;
  };

  const setTaskTimer = (taskId: string, mode: TimerMode, targetSeconds?: number) => {
    // Timer mode is locked once a task is created. Only allow setting it
    // if it has never been set (defensive — addTask always sets a mode).
    setDecks((p) =>
      p.map((d) => ({
        ...d,
        tasks: d.tasks.map((t) => {
          if (t.id !== taskId) return t;
          if (t.mode) return t; // locked
          return {
            ...t,
            mode,
            targetSeconds: mode === "countdown" ? targetSeconds ?? t.targetSeconds ?? 1500 : undefined,
          };
        }),
      }))
    );
  };

  const updateTask = (
    taskId: string,
    patch: { name?: string; tag?: string; mode?: TimerMode; targetSeconds?: number },
  ) => {
    setDecks((p) =>
      p.map((d) => ({
        ...d,
        tasks: d.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const next: Task = { ...t };
          if (patch.name !== undefined) next.name = patch.name;
          if (patch.tag !== undefined) next.tag = patch.tag;
          if (patch.mode !== undefined) {
            next.mode = patch.mode;
            next.targetSeconds =
              patch.mode === "countdown"
                ? patch.targetSeconds ?? t.targetSeconds ?? 1500
                : undefined;
          } else if (patch.targetSeconds !== undefined && t.mode === "countdown") {
            next.targetSeconds = patch.targetSeconds;
          }
          return next;
        }),
      })),
    );
  };

  const renameDeck = (deckId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setDecks((p) => p.map((d) => (d.id === deckId ? { ...d, name: trimmed } : d)));
  };

  const deleteLog = (id: string) => setLogs((p) => p.filter((l) => l.id !== id));

  const deleteTasks = (taskIds: string[]) => {
    const set = new Set(taskIds);
    setDecks((p) => p.map((d) => ({ ...d, tasks: d.tasks.filter((t) => !set.has(t.id)) })));
    // cascade: remove journals attached to those tasks
    setJournals((p) => p.filter((j) => !(j.taskId && set.has(j.taskId))));
  };

  const deleteDeck = (deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return null;
    const index = decks.findIndex((d) => d.id === deckId);
    const taskIds = new Set(deck.tasks.map((t) => t.id));
    setDecks((p) => p.filter((d) => d.id !== deckId));
    // cascade: remove journals attached to this deck or any of its tasks
    setJournals((p) =>
      p.filter((j) => j.deckId !== deckId && !(j.taskId && taskIds.has(j.taskId)))
    );
    // stop active task if it belonged to this deck
    if (active.deckIds.includes(deckId)) setActive({ taskIds: [], deckIds: [], startedAt: null });
    return { deck, index };
  };

  const restoreDeck = (deck: Deck, index: number) => {
    setDecks((p) => {
      const next = [...p];
      next.splice(Math.min(index, next.length), 0, deck);
      return next;
    });
  };

  const restoreTasks = (entries: Array<{ deckId: string; task: Task; index: number }>) => {
    setDecks((p) =>
      p.map((d) => {
        const mine = entries.filter((e) => e.deckId === d.id);
        if (!mine.length) return d;
        const tasks = [...d.tasks];
        // insert by ascending original index so positions are preserved
        mine.sort((a, b) => a.index - b.index).forEach(({ task, index }) => {
          tasks.splice(Math.min(index, tasks.length), 0, task);
        });
        return { ...d, tasks };
      })
    );
  };

  const upsertJournal = (j: Omit<Journal, "id" | "createdAt" | "updatedAt" | "wordCount"> & { id?: string }) => {
    const wordCount = j.body.trim().split(/\s+/).filter(Boolean).length;
    const now = Date.now();
    // Find an existing journal for this target (one journal per task/deck).
    const matchExisting = (list: Journal[]) =>
      list.find((x) =>
        j.id
          ? x.id === j.id
          : j.taskId
            ? x.taskId === j.taskId
            : j.deckId
              ? x.deckId === j.deckId && !x.taskId
              : false,
      );
    let resolvedId = j.id;
    setJournals((p) => {
      const existing = matchExisting(p);
      if (existing) {
        resolvedId = existing.id;
        // Merge any duplicates that may have leaked in previously.
        const filtered = p.filter(
          (x) =>
            x.id === existing.id ||
            (j.taskId ? x.taskId !== j.taskId : !(j.deckId && x.deckId === j.deckId && !x.taskId)),
        );
        return filtered.map((x) =>
          x.id === existing.id ? { ...x, ...j, id: existing.id, wordCount, updatedAt: now } : x,
        );
      }
      const id = generateId();
      resolvedId = id;
      return [{ id, ...j, wordCount, createdAt: now, updatedAt: now }, ...p];
    });
    if (j.logId) setLogs((p) => p.map((l) => (l.id === j.logId ? { ...l, hasJournal: true } : l)));
    return resolvedId!;
  };

  const deleteJournal = (id: string) => setJournals((p) => p.filter((j) => j.id !== id));

  const updateTaskChecklist = (taskId: string, updater: (items: ChecklistItem[]) => ChecklistItem[]) => {
    setDecks((p) =>
      p.map((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === taskId ? { ...t, checklist: updater(t.checklist ?? []) } : t
        ),
      }))
    );
  };

  const addChecklistItem = (taskId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    updateTaskChecklist(taskId, (items) => [
      ...items,
      { id: generateId(), text: trimmed, done: false },
    ]);
  };

  const toggleChecklistItem = (taskId: string, itemId: string) => {
    updateTaskChecklist(taskId, (items) =>
      items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it))
    );
  };

  const deleteChecklistItem = (taskId: string, itemId: string) => {
    updateTaskChecklist(taskId, (items) => items.filter((it) => it.id !== itemId));
  };

  return {
    hydrated,
    decks,
    logs,
    journals,
    active,
    elapsed,
    startTask,
    startTasks,
    stopTask,
    replaceAll,
    addDeck,
    addTask,
    updateTask,
    renameDeck,
    setTaskTimer,
    deleteLog,
    deleteTasks,
    restoreTasks,
    deleteDeck,
    restoreDeck,
    upsertJournal,
    deleteJournal,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
  };
}
