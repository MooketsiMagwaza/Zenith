import { useFeatures } from "@/lib/zen/useFeatures";
import { ProgressView, GoalBar, type FeatureStore } from "./ProgressView";
import { useEffect, useMemo, useRef, useState } from "react";
import { appWindow, storage } from "@/lib/platform";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notify } from "@/lib/zen/notify";
import { z as zod } from "zod";
import { useTogglZen } from "@/lib/zen/useTogglZen";
import { formatTime, formatDuration, friendlyDateLabel, formatTimeShort, dateKey } from "@/lib/zen/utils";
import { QUOTE_PACKS, WALLPAPER_CATEGORIES, type QuotePackId, type WallpaperCategoryId, type WallpaperItem } from "@/lib/zen/quotes";
import type { Deck, Journal, Task, TimerMode, ViewName } from "@/lib/zen/types";
import tutorialDecks from "@/assets/tutorial/decks.png";
import tutorialJournal from "@/assets/tutorial/journal.png";
import tutorialHistory from "@/assets/tutorial/history.png";
import tutorialZen from "@/assets/tutorial/zen.png";
import logoUrl from "@/assets/logo.png";
import {
  useReminders,
  fireBrowserNotification,
  fireChime,
  type Reminder,
} from "@/lib/zen/useReminders";
import { RemindersModal } from "@/components/zen/RemindersModal";

const isCssWallpaper = (value: string) =>
  value.startsWith("#") ||
  value.startsWith("linear-gradient") ||
  value.startsWith("radial-gradient") ||
  value.startsWith("conic-gradient") ||
  value.startsWith("rgb") ||
  value.startsWith("hsl");

const ALL_BUILTIN_WALLPAPERS: WallpaperItem[] = Object.values(WALLPAPER_CATEGORIES).flatMap((c) => c.items);

export function TogglZenApp() {
  const z = useTogglZen();
  const features = useFeatures();
  const [view, setView] = useState<ViewName>("decks");
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [zenOpen, setZenOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [journalContext, setJournalContext] = useState<
    | { kind: "task"; taskId: string; logId?: string | null }
    | { kind: "deck"; deckId: string }
    | null
  >(null);

  const openReminderTarget = (r: Reminder) => {
    let deckId: string | null = null;
    if (r.targetType === "deck") {
      deckId = r.targetId;
    } else {
      const owner = z.decks.find((d) => d.tasks.some((t) => t.id === r.targetId));
      deckId = owner?.id ?? null;
    }
    if (deckId) setActiveDeckId(deckId);
    setView("decks");
    setRemindersOpen(false);
    if (r.targetType === "task" && deckId) {
      // Scroll the card into view shortly after the deck renders
      setTimeout(() => {
        const el = document.getElementById(`zen-card-${r.targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-accent-gold");
          setTimeout(() => el.classList.remove("ring-2", "ring-accent-gold"), 2000);
        }
      }, 120);
    }
  };

  const reminders = useReminders((r: Reminder) => {
    const title =
      r.targetType === "deck"
        ? `Deck: ${r.label}`
        : r.deckName
          ? `${r.deckName} — ${r.label}`
          : r.label;
    notify.info("Reminder", {
      description: title,
      duration: 10000,
      action: { label: "Open", onClick: () => openReminderTarget(r) },
    });
    if (r.sound) fireChime();
    if (r.notify) fireBrowserNotification(r, () => openReminderTarget(r));
  });


  // Prune reminders pointing at deleted decks/cards
  useEffect(() => {
    if (!z.hydrated || !reminders.hydrated) return;
    const taskIds = new Set(z.decks.flatMap((d) => d.tasks.map((t) => t.id)));
    const deckIds = new Set(z.decks.map((d) => d.id));
    reminders.pruneOrphans(taskIds, deckIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.decks, z.hydrated, reminders.hydrated]);

  // Reset selection when leaving select mode
  useEffect(() => {
    if (!selectMode) setSelected(new Set());
  }, [selectMode]);

  useEffect(() => {
    if (!activeDeckId && z.decks.length) setActiveDeckId(z.decks[0].id);
  }, [z.decks, activeDeckId]);

  // Auto-open tutorial on first visit
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!storage.getItem("zenith.tutorial.seen")) {
      setTutorialOpen(true);
      storage.setItem("zenith.tutorial.seen", "1");
    }
  }, []);

  // ESC handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zenOpen) setZenOpen(false);
        else if (focusOpen) setFocusOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusOpen, zenOpen]);

  if (!z.hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  const activeTaskInfo = z.active.taskIds.length
    ? (() => {
        const items = z.active.taskIds.map((tid, i) => {
          const deckId = z.active.deckIds[i] ?? null;
          const deck = z.decks.find((d) => d.id === deckId);
          const task = deck?.tasks.find((t) => t.id === tid);
          return deck && task ? { deck, task } : null;
        }).filter(Boolean) as Array<{ deck: Deck; task: Task }>;
        if (!items.length) return null;
        const primary = items[0];
        const label = items.length === 1 ? primary.task.name : `${primary.task.name} +${items.length - 1} more`;
        return { deck: primary.deck, task: primary.task, label, count: items.length };
      })()
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav
        view={view}
        setView={setView}
        onFocus={() => activeTaskInfo && setFocusOpen(true)}
        onZen={() => setZenOpen(true)}
        onReminders={() => setRemindersOpen(true)}
        reminderCount={reminders.reminders.filter((r) => r.enabled).length}
        canFocus={!!activeTaskInfo}
      />

      <main className="pb-32">
        {view === "decks" && (
          <DecksView
            z={z}
            features={features}
            activeDeckId={activeDeckId}
            setActiveDeckId={setActiveDeckId}
            selectMode={selectMode}
            setSelectMode={setSelectMode}
            selected={selected}
            setSelected={setSelected}
            onTutorial={() => setTutorialOpen(true)}
            openJournal={(taskId) => {
              setJournalContext({ kind: "task", taskId });
              setView("journal");
            }}
            openDeckJournal={(deckId) => {
              setJournalContext({ kind: "deck", deckId });
              setView("journal");
            }}
          />
        )}

        {view === "progress" && <ProgressView z={z} features={features} />}
        {view === "journal" && (
          <JournalView z={z} context={journalContext} clearContext={() => setJournalContext(null)} />
        )}
        {view === "history" && (
          <HistoryView
            z={z}
            openJournal={(log) => {
              setJournalContext({ kind: "task", taskId: log.taskId, logId: log.id });
              setView("journal");
            }}
          />
        )}
      </main>

      {(activeTaskInfo || (selectMode && selected.size > 0)) && !focusOpen && !zenOpen && (
        <BottomBar
          z={z}
          selectMode={selectMode}
          selected={selected}
          setSelected={setSelected}
          setSelectMode={setSelectMode}
          onFocus={() => setFocusOpen(true)}
        />
      )}

      {focusOpen && activeTaskInfo && (
        <FocusMode
          taskName={activeTaskInfo.label}
          items={z.active.taskIds.map((tid, i) => {
            const deck = z.decks.find((d) => d.id === (z.active.deckIds[i] ?? null));
            const task = deck?.tasks.find((t) => t.id === tid);
            return task && deck
              ? { id: tid, name: task.name, deckName: deck.name, deckColor: deck.color, totalSeconds: task.totalSeconds }
              : null;
          }).filter(Boolean) as Array<{ id: string; name: string; deckName: string; deckColor: string; totalSeconds: number }>}
          startedAt={z.active.startedAt!}
          elapsed={z.elapsed}
          onExit={() => setFocusOpen(false)}
          onStop={() => {
            z.stopTask();
            setFocusOpen(false);
          }}
          onZen={() => setZenOpen(true)}
        />
      )}

      {zenOpen && (
        <ZenMode
          activeElapsed={activeTaskInfo ? z.elapsed : null}
          items={z.active.taskIds.map((tid, i) => {
            const deck = z.decks.find((d) => d.id === (z.active.deckIds[i] ?? null));
            const task = deck?.tasks.find((t) => t.id === tid);
            return task && deck
              ? { id: tid, name: task.name, deckName: deck.name, deckColor: deck.color, totalSeconds: task.totalSeconds }
              : null;
          }).filter(Boolean) as Array<{ id: string; name: string; deckName: string; deckColor: string; totalSeconds: number }>}
          onExit={() => setZenOpen(false)}
        />
      )}

      {tutorialOpen && <Tutorial onClose={() => setTutorialOpen(false)} />}

      {remindersOpen && (
        <RemindersModal
          decks={z.decks}
          reminders={reminders.reminders}
          onClose={() => setRemindersOpen(false)}
          onAdd={reminders.addReminder}
          onUpdate={reminders.updateReminder}
          onDelete={reminders.deleteReminder}
          onToggle={reminders.toggleReminder}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* NAV                                                                 */
/* ------------------------------------------------------------------ */

function Nav({
  view,
  setView,
  onFocus,
  onZen,
  onReminders,
  reminderCount,
  canFocus,
}: {
  view: ViewName;
  setView: (v: ViewName) => void;
  onFocus: () => void;
  onZen: () => void;
  onReminders: () => void;
  reminderCount: number;
  canFocus: boolean;
}) {
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const sync = () => {
      appWindow.isFullscreen().then(setIsFs, () => {});
    };
    const off = appWindow.onFullscreenChange(sync);
    sync();
    return off;
  }, []);
  const toggleFs = () => {
    appWindow.toggleFullscreen().catch(() => {});
  };

  const tabs: ViewName[] = ["decks", "journal", "history", "progress"];
  return (
    <nav className="sticky top-0 z-30 bg-background/85 backdrop-blur">
      <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-1.5 px-2 sm:h-16 sm:gap-3 sm:px-4 md:px-6">
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <img
            src={logoUrl}
            alt="Zenith"
            className="h-7 w-7 shrink-0 invert sm:h-8 sm:w-8"
            draggable={false}
          />
          <div className="font-display hidden text-xl leading-none sm:block md:text-2xl">
            Zen<span className="display-italic text-foreground">ith</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto sm:flex-none sm:justify-start sm:gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setView(t)}

              className={`micro-caps shrink-0 px-1.5 py-2 text-[10px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold-dim sm:px-3 sm:text-xs md:px-4 ${
                view === t ? "text-foreground" : "text-text-secondary hover:text-foreground"
              }`}
            >
              <span className="relative">
                {t}
                {view === t && (
                  <span className="absolute -bottom-1 left-0 h-px w-full bg-foreground" />
                )}
              </span>
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Mobile: single dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open actions menu"
              className="micro-caps relative inline-flex items-center rounded border border-border px-2.5 py-1.5 text-text-secondary transition-all duration-200 hover:border-accent-gold-dim hover:text-accent-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold data-[state=open]:border-accent-gold-dim data-[state=open]:text-accent-gold sm:hidden"
            >
              <span aria-hidden className="transition-transform duration-200 data-[state=open]:rotate-90">≡</span>
              {reminderCount > 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-1.5 -top-1.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-accent-gold px-1 text-[9px] font-semibold leading-none text-background ring-2 ring-background"
                >
                  {reminderCount > 99 ? "99+" : reminderCount}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="min-w-[200px] origin-top-right duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1"
            >
              <DropdownMenuItem onSelect={onReminders} className="micro-caps text-xs">
                <span aria-hidden className="mr-2">☖</span>
                Reminders
                {reminderCount > 0 && (
                  <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-gold px-1 text-[10px] font-semibold leading-none text-background">
                    {reminderCount > 99 ? "99+" : reminderCount}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onFocus}
                disabled={!canFocus}
                className="micro-caps text-xs"
              >
                <span aria-hidden className="mr-2">◉</span>
                Focus
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onZen} className="micro-caps text-xs text-accent-gold">
                <span aria-hidden className="mr-2">禅</span>
                Zen
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggleFs} className="micro-caps text-xs">
                <span aria-hidden className="mr-2">{isFs ? "⤡" : "⤢"}</span>
                {isFs ? "Exit fullscreen" : "Fullscreen"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Desktop: inline buttons */}
          <button
            onClick={onReminders}
            title="Reminders"
            aria-label={
              reminderCount > 0
                ? `Reminders, ${reminderCount} ${reminderCount === 1 ? "active reminder" : "active reminders"}`
                : "Reminders, none active"
            }
            className="micro-caps relative hidden rounded border border-border px-2 py-1.5 text-text-secondary transition-colors hover:border-accent-gold-dim hover:text-accent-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold sm:inline-flex sm:px-3"
          >
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden>☖</span>
              <span className="hidden md:inline">Remind</span>
            </span>
            {reminderCount > 0 && (
              <span
                aria-hidden
                className="pointer-events-none absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-gold px-1 text-[10px] font-semibold leading-none text-background ring-2 ring-background"
              >
                {reminderCount > 99 ? "99+" : reminderCount}
              </span>
            )}
          </button>

          <button
            onClick={onFocus}
            disabled={!canFocus}
            title="Enter focus mode"
            aria-label="Enter focus mode"
            className="micro-caps hidden rounded border border-border px-2 py-1.5 text-foreground transition-colors hover:border-border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold disabled:cursor-not-allowed disabled:opacity-30 sm:inline-flex sm:px-3"
          >
            ◉ <span className="hidden sm:inline">Focus</span>
          </button>
          <button
            onClick={onZen}
            title="Enter zen mode"
            aria-label="Enter zen mode"
            className="micro-caps hidden rounded border border-accent-gold-dim px-2 py-1.5 text-accent-gold transition-colors hover:bg-accent-gold-dim/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold sm:inline-flex sm:px-3"
          >
            禅 <span className="hidden sm:inline">Zen</span>
          </button>

          <button
            onClick={toggleFs}
            title={isFs ? "Exit fullscreen" : "Enter fullscreen"}
            aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}
            className="micro-caps hidden rounded border border-border px-2.5 py-1.5 text-text-secondary transition-colors hover:border-accent-gold-dim hover:text-accent-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold sm:inline-flex sm:px-3"
          >
            <span aria-hidden>{isFs ? "⤡" : "⤢"}</span>
          </button>
        </div>

      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* DECKS VIEW                                                          */
/* ------------------------------------------------------------------ */

function DecksView({
  z,
  features,
  activeDeckId,
  setActiveDeckId,
  selectMode,
  setSelectMode,
  selected,
  setSelected,
  onTutorial,
  openJournal,
  openDeckJournal,
}: {
  z: ReturnType<typeof useTogglZen>;
  features: FeatureStore;
  activeDeckId: string | null;
  setActiveDeckId: (id: string) => void;
  selectMode: boolean;
  setSelectMode: (v: boolean | ((s: boolean) => boolean)) => void;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  onTutorial: () => void;
  openJournal: (taskId: string) => void;
  openDeckJournal: (deckId: string) => void;
}) {

  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [renameDeckId, setRenameDeckId] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [pendingDeckId, setPendingDeckId] = useState<string | null>(null);

  const requestDelete = (ids: string[]) => {
    if (!ids.length) return;
    setPendingIds(ids);
  };

  const deck = z.decks.find((d) => d.id === activeDeckId) ?? z.decks[0];

  const toggleSelected = (taskId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectAll = () => {
    if (!deck) return;
    const allInDeckSelected = deck.tasks.length > 0 && deck.tasks.every((t) => selected.has(t.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allInDeckSelected) deck.tasks.forEach((t) => next.delete(t.id));
      else deck.tasks.forEach((t) => next.add(t.id));
      return next;
    });
  };

  const todaySeconds = useMemo(() => {
    const todayKey = dateKey(Date.now());
    return z.logs
      .filter((l) => l.deckName === deck?.name && dateKey(l.startedAt) === todayKey)
      .reduce((acc, l) => acc + l.duration, 0);
  }, [z.logs, deck]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border px-4 py-6 md:min-h-[calc(100vh-4rem)] md:w-60 md:border-b-0 md:border-r md:py-8">
        <div className="micro-caps mb-4 px-2">Decks</div>
        <div className="space-y-1">
          {z.decks.map((d) => {
            const isActive = d.id === deck?.id;
            return (
              <div
                key={d.id}
                className={`group/deck relative flex items-center rounded-lg transition-colors ${
                  isActive ? "bg-surface-2" : "hover:bg-surface-1"
                }`}
              >
                <button
                  onClick={() => setActiveDeckId(d.id)}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? "text-foreground" : "text-text-secondary group-hover/deck:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="size-2 rounded-full" style={{ background: d.color }} />
                    <span className="font-serif truncate">{d.name}</span>
                  </span>
                  <span className="text-xs text-text-dim">{d.tasks.length}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setRenameDeckId(d.id); setDeckModalOpen(true); }}
                  title="Rename deck"
                  aria-label={`Rename deck ${d.name}`}
                  className="rounded-md p-1 text-text-dim opacity-0 transition-all hover:bg-surface-2 hover:text-foreground focus:opacity-100 group-hover/deck:opacity-100"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPendingDeckId(d.id); }}
                  title="Delete deck"
                  aria-label={`Delete deck ${d.name}`}
                  className="mr-1 rounded-md p-1 text-text-dim opacity-0 transition-all hover:bg-surface-2 hover:text-foreground focus:opacity-100 group-hover/deck:opacity-100"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-6 border-t border-border pt-4">
          <button
            onClick={() => setDeckModalOpen(true)}
            className="micro-caps w-full rounded-lg border border-dashed border-border px-3 py-2 text-left text-text-secondary transition-colors hover:border-accent-gold-dim hover:text-accent-gold"
          >
            + New Deck
          </button>
        </div>
        <div className="mt-auto space-y-2 pt-6">
          <button
            onClick={onTutorial}
            title="Open tutorial"
            aria-label="Open tutorial"
            className="micro-caps flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-text-secondary transition-colors hover:border-accent-gold-dim hover:text-accent-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <span aria-hidden>?</span>
            <span>Tour</span>
          </button>
        </div>
      </aside>


      {/* Main */}
      <section className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        {deck ? (
          <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
              <div className="min-w-0">
                <h1 className="font-display text-3xl md:text-4xl">{deck.name}</h1>
                <GoalBar z={z} features={features} target={`deck:${deck.id}`} />
                <div className="micro-caps mt-2">
                  <span className="size-1.5 inline-block rounded-full mr-2 align-middle" style={{ background: deck.color }} />
                  {deck.tasks.length} tasks
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => openDeckJournal(deck.id)}
                  className="micro-caps rounded-full border border-border px-3 py-1.5 text-text-secondary transition-colors hover:border-accent-gold-dim hover:text-accent-gold"
                  title="Journal for this deck"
                >
                  ✎ Deck Journal
                </button>
                <button
                  onClick={() => setSelectMode((s) => !s)}
                  className={`micro-caps rounded-full border px-3 py-1.5 transition-colors ${
                    selectMode
                      ? "border-accent-gold text-accent-gold"
                      : "border-border text-text-secondary hover:border-accent-gold-dim hover:text-accent-gold"
                  }`}
                >
                  {selectMode ? "Done" : "Select"}
                </button>
                <div className="text-right">
                  <div className="micro-caps">today</div>
                  <div className="timer-mono mt-1 text-2xl text-text-secondary">{formatDuration(todaySeconds)}</div>
                </div>
              </div>
            </div>

            {selectMode && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-1 px-5 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={selectAll}
                    className="micro-caps text-text-secondary hover:text-accent-gold"
                  >
                    {deck.tasks.length > 0 && deck.tasks.every((t) => selected.has(t.id)) ? "Clear deck" : "Select deck"}
                  </button>
                  <span className="micro-caps">
                    {selected.size} selected
                    {(() => {
                      const deckIds = new Set(
                        z.decks
                          .filter((d) => d.tasks.some((t) => selected.has(t.id)))
                          .map((d) => d.id)
                      );
                      return deckIds.size > 1 ? ` · ${deckIds.size} decks` : "";
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={selected.size < 1}
                    onClick={() => {
                      const tasks = z.decks.flatMap((d) => d.tasks).filter((t) => selected.has(t.id));
                      if (!tasks.length) return;
                      z.startTasks(tasks);
                      setSelectMode(false);
                      setSelected(new Set());
                    }}
                    className="micro-caps rounded-md border border-accent-gold-dim px-3 py-1.5 text-accent-gold transition-colors hover:bg-accent-gold-dim/30 disabled:cursor-not-allowed disabled:opacity-30"
                    title="Start selected cards together as a group (across decks)"
                  >
                    ▶ Start group
                  </button>
                  <button
                    disabled={selected.size === 0}
                    onClick={() => requestDelete(Array.from(selected))}
                    className="micro-caps rounded-md border border-border px-3 py-1.5 text-text-secondary transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
              {deck.tasks.map((task) => (
                <div key={task.id} id={`zen-card-${task.id}`} className="rounded-lg transition-shadow">
                  <TaskCard
                    task={task}
                    isRunning={z.active.taskIds.includes(task.id)}
                    liveSeconds={z.active.taskIds.includes(task.id) ? z.elapsed : 0}
                    selectMode={selectMode}
                    selected={selected.has(task.id)}
                    onToggleSelect={() => { if (!selectMode) setSelectMode(true); toggleSelected(task.id); }}
                    onStart={() => z.startTask(task)}
                    onStop={() => z.stopTask()}
                    onJournal={() => openJournal(task.id)}
                    onEdit={() => { setEditTaskId(task.id); setTaskModalOpen(true); }}
                    onDelete={() => requestDelete([task.id])}
                    onAddChecklistItem={(text) => {
                      z.addChecklistItem(task.id, text);
                      notify.success("Checklist item added", { description: text });
                    }}
                    onToggleChecklistItem={(id) => {
                      const item = task.checklist?.find((c) => c.id === id);
                      z.toggleChecklistItem(task.id, id);
                      if (item && !item.done) notify.success("Item completed", { description: item.text });
                    }}
                    onDeleteChecklistItem={(id) => {
                      const item = task.checklist?.find((c) => c.id === id);
                      z.deleteChecklistItem(task.id, id);
                      if (item) {
                        notify.undoable(
                          "Checklist item removed",
                          () => z.addChecklistItem(task.id, item.text),
                          { description: item.text },
                        );
                      }
                    }}
                    onSetTimer={(mode, target) => z.setTaskTimer(task.id, mode, target)}
                  />
                  <GoalBar z={z} features={features} target={`task:${task.id}`} />
                </div>
              ))}

              <button
                onClick={() => { setEditTaskId(null); setTaskModalOpen(true); }}
                className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-text-dim transition-colors hover:border-accent-gold-dim hover:text-accent-gold"
              >
                <span className="text-2xl leading-none">＋</span>
                <span className="micro-caps">Add Card</span>
              </button>
            </div>
          </>
        ) : (
          <div className="text-text-secondary">Create your first deck on the left to begin.</div>
        )}
      </section>

      {pendingIds && deck && (
        <ConfirmDialog
          title={pendingIds.length === 1 ? "Delete this card?" : "Delete selected cards?"}
          message={`This will remove ${pendingIds.length} card${pendingIds.length === 1 ? "" : "s"} from "${deck.name}". You'll have a few seconds to undo.`}
          confirmLabel="Delete"
          onCancel={() => setPendingIds(null)}
          onConfirm={() => {
            const ids = pendingIds;
            const entries: Array<{ deckId: string; task: Task; index: number }> = [];
            z.decks.forEach((d) => {
              d.tasks.forEach((t, i) => {
                if (ids.includes(t.id)) entries.push({ deckId: d.id, task: t, index: i });
              });
            });
            z.deleteTasks(ids);
            setSelected(new Set());
            setSelectMode(false);
            setPendingIds(null);
            notify.undoable(
              `Removed ${entries.length} card${entries.length === 1 ? "" : "s"}`,
              () => z.restoreTasks(entries),
            );
          }}
        />
      )}

      {pendingDeckId && (() => {
        const d = z.decks.find((x) => x.id === pendingDeckId);
        if (!d) return null;
        return (
          <ConfirmDialog
            title={`Delete deck "${d.name}"?`}
            message={`This will remove the deck and its ${d.tasks.length} card${d.tasks.length === 1 ? "" : "s"}. You'll have a few seconds to undo.`}
            confirmLabel="Delete deck"
            onCancel={() => setPendingDeckId(null)}
            onConfirm={() => {
              const result = z.deleteDeck(d.id);
              setPendingDeckId(null);
              if (result) {
                notify.undoable(
                  `Deck "${result.deck.name}" deleted`,
                  () => z.restoreDeck(result.deck, result.index),
                );
              }
              if (activeDeckId === d.id) {
                const next = z.decks.find((x) => x.id !== d.id);
                if (next) setActiveDeckId(next.id);
              }
            }}
          />
        );
      })()}

      {deckModalOpen && (
        <DeckFormModal
          initial={renameDeckId ? z.decks.find((d) => d.id === renameDeckId) ?? null : null}
          onClose={() => { setDeckModalOpen(false); setRenameDeckId(null); }}
          onSubmit={(name) => {
            if (renameDeckId) {
              z.renameDeck(renameDeckId, name);
              notify.success("Deck renamed", { description: name });
            } else {
              const id = z.addDeck(name);
              setActiveDeckId(id);
              notify.success("Deck created", { description: name });
            }
            setDeckModalOpen(false);
            setRenameDeckId(null);
          }}
        />
      )}

      {taskModalOpen && deck && (() => {
        const editing = editTaskId ? deck.tasks.find((t) => t.id === editTaskId) ?? null : null;
        return (
          <TaskFormModal
            deckName={deck.name}
            initial={editing}
            onClose={() => { setTaskModalOpen(false); setEditTaskId(null); }}
            onSubmit={(payload) => {
              if (editing) {
                z.updateTask(editing.id, payload);
                notify.success("Card updated", { description: payload.name });
              } else {
                z.addTask(deck.id, payload.name, payload.tag || "Task", {
                  mode: payload.mode,
                  targetSeconds: payload.targetSeconds,
                });
                notify.success("Card created", { description: `${payload.name} · ${deck.name}` });
              }
              setTaskModalOpen(false);
              setEditTaskId(null);
            }}
          />
        );
      })()}
    </div>
  );
}

function TaskCard({
  task,
  isRunning,
  liveSeconds,
  selectMode,
  selected,
  onToggleSelect,
  onStart,
  onStop,
  onJournal,
  onEdit,
  onDelete,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onSetTimer,
}: {
  task: Task;
  isRunning: boolean;
  liveSeconds: number;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onStart: () => void;
  onStop: () => void;
  onJournal: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddChecklistItem: (text: string) => void;
  onToggleChecklistItem: (id: string) => void;
  onDeleteChecklistItem: (id: string) => void;
  onSetTimer: (mode: TimerMode, targetSeconds?: number) => void;
}) {
  const sessionSeconds = isRunning ? liveSeconds : 0;
  const totalSeconds = task.totalSeconds + sessionSeconds;
  const checklist = task.checklist ?? [];
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [newItem, setNewItem] = useState("");

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectMode) {
      onToggleSelect();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      onToggleSelect();
      return;
    }
    if (isRunning) onStop();
    else onStart();
  };

  // Reusable hardener: any inner control must NEVER trigger card click/select
  // under pointer, keyboard, or modifier-key paths.
  const stopAll = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };
  const innerKeyGuard = (e: React.KeyboardEvent) => {
    // Stop Enter/Space (and any other key) from bubbling to the card's keydown
    e.stopPropagation();
  };

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        // Only react to Enter/Space when the card itself is the target —
        // not when an inner control (delete, start, stop, journal, checklist)
        // is focused. Without this, keyboard activation on the delete button
        // would also toggle run/select state.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick(e as unknown as React.MouseEvent);
        }
      }}
      style={selected ? { boxShadow: "inset 0 0 0 1px rgba(201,168,76,0.45)" } : undefined}
      className={`card-soft group relative flex min-h-[280px] cursor-pointer flex-col p-5 transition-all duration-300 hover:-translate-y-[3px] hover:border-border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold-dim ${
        isRunning ? "card-soft-active" : ""
      }`}
    >
      {selectMode && (
        <div className="absolute right-3 top-3">
          <span
            className={`flex size-5 items-center justify-center rounded-full border transition-colors ${
              selected
                ? "border-accent-gold-dim bg-accent-gold-dim/40 text-foreground"
                : "border-border bg-surface-2"
            }`}
          >
            {selected && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2.5 6.5l2.5 2.5 4.5-5" />
              </svg>
            )}
          </span>
        </div>
      )}
      {!selectMode && (
        <div className="absolute right-2.5 top-2.5 flex gap-0.5 opacity-0 transition-all group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => { stopAll(e); onEdit(); }}
            onMouseDown={stopAll}
            onPointerDown={stopAll}
            onKeyDown={innerKeyGuard}
            title="Edit card"
            aria-label="Edit card"
            className="rounded-md p-1 text-text-dim hover:bg-surface-2 hover:text-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => { stopAll(e); onDelete(); }}
            onMouseDown={stopAll}
            onPointerDown={stopAll}
            onKeyDown={innerKeyGuard}
            title="Delete card"
            aria-label="Delete card"
            className="rounded-md p-1 text-text-dim hover:bg-surface-2 hover:text-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" />
            </svg>
          </button>
        </div>
      )}
      <div className="font-display text-base leading-tight pr-14">{task.name}</div>
      <div className="micro-caps mt-2">{task.tag}</div>

      {/* Mode picker + single timer */}
      {(() => {
        const mode: TimerMode = task.mode ?? "stopwatch";
        const target = task.targetSeconds ?? 1500;
        const remaining = Math.max(0, target - totalSeconds);
        const done = mode === "countdown" && remaining === 0 && target > 0;
        const display = mode === "countdown" ? remaining : totalSeconds;
        return (
          <div className="mt-5">
            <div
              className={`timer-mono text-2xl ${
                done ? "text-accent-gold" : isRunning ? "pulse-gold text-foreground" : "text-foreground"
              }`}
            >
              {formatTime(display)}
            </div>
          </div>
        );
      })()}
      {/* Checklist */}
      <div className="mt-4" onClick={stopAll}>
        <button
          type="button"
          onClick={(e) => { stopAll(e); setChecklistOpen((v) => !v); }}
          onMouseDown={stopAll}
          onKeyDown={innerKeyGuard}
          className="micro-caps flex w-full items-center justify-between text-text-secondary hover:text-foreground"
        >
          <span>
            checklist
            {checklist.length > 0 && (
              <span className="ml-1 text-text-dim">
                {checklist.filter((c) => c.done).length}/{checklist.length}
              </span>
            )}
          </span>
          <span className="text-text-dim">{checklistOpen ? "−" : "+"}</span>
        </button>
        {checklistOpen && (
          <div className="mt-2 space-y-1.5">
            {checklist.map((item) => (
              <div key={item.id} className="group/check flex items-start gap-2 text-xs">
                <button
                  type="button"
                  onClick={(e) => { stopAll(e); onToggleChecklistItem(item.id); }}
                  onMouseDown={stopAll}
                  onKeyDown={innerKeyGuard}
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    item.done ? "border-accent-gold-dim bg-accent-gold-dim/40" : "border-border"
                  }`}
                  aria-label={item.done ? "Mark incomplete" : "Mark complete"}
                >
                  {item.done && (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                    </svg>
                  )}
                </button>
                <span className={`min-w-0 flex-1 break-words ${item.done ? "text-text-dim line-through" : "text-foreground"}`}>
                  {item.text}
                </span>
                <button
                  type="button"
                  onClick={(e) => { stopAll(e); onDeleteChecklistItem(item.id); }}
                  onMouseDown={stopAll}
                  onKeyDown={innerKeyGuard}
                  className="text-text-dim opacity-0 transition-opacity hover:text-foreground group-hover/check:opacity-100"
                  aria-label="Remove item"
                >
                  ×
                </button>
              </div>
            ))}
            <form
              onClick={stopAll}
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (newItem.trim()) {
                  onAddChecklistItem(newItem);
                  setNewItem("");
                }
              }}
              className="flex gap-1"
            >
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onClick={stopAll}
                onKeyDown={innerKeyGuard}
                placeholder="Add item"
                className="min-w-0 flex-1 rounded border border-border bg-surface-2 px-2 py-1 text-xs focus:border-accent-gold-dim focus:outline-none"
              />
              <button
                type="submit"
                onMouseDown={stopAll}
                onKeyDown={innerKeyGuard}
                className="micro-caps rounded border border-border px-2 py-1 text-text-secondary hover:border-accent-gold-dim hover:text-accent-gold"
              >
                Add
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 flex items-center justify-between gap-2">
        {selectMode ? (
          <span className="micro-caps text-text-dim">tap to {selected ? "unselect" : "select"}</span>
        ) : isRunning ? (
          <button
            onClick={(e) => { stopAll(e); onStop(); }}
            onMouseDown={stopAll}
            onKeyDown={innerKeyGuard}
            className="micro-caps rounded-md border border-destructive px-3 py-1.5 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={(e) => { stopAll(e); onStart(); }}
            onMouseDown={stopAll}
            onKeyDown={innerKeyGuard}
            className="micro-caps rounded-md border border-accent-gold-dim px-3 py-1.5 text-accent-gold transition-colors hover:bg-accent-gold-dim/30"
          >
            Start
          </button>
        )}
        {!selectMode && (
          <button
            onClick={(e) => { stopAll(e); onJournal(); }}
            onMouseDown={stopAll}
            onKeyDown={innerKeyGuard}
            title="Journal"
            className="rounded-md border border-border p-2 text-text-secondary transition-colors hover:border-border-accent hover:text-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z" />
              <path d="M8 8h8M8 12h8M8 16h5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BOTTOM BAR                                                          */
/* ------------------------------------------------------------------ */

function BottomBar({
  z,
  selectMode,
  selected,
  setSelected,
  setSelectMode,
  onFocus,
}: {
  z: ReturnType<typeof useTogglZen>;
  selectMode: boolean;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectMode: (v: boolean | ((s: boolean) => boolean)) => void;
  onFocus: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const runningItems = useMemo(() => {
    return z.active.taskIds
      .map((tid, i) => {
        const deck = z.decks.find((d) => d.id === (z.active.deckIds[i] ?? null));
        const task = deck?.tasks.find((t) => t.id === tid);
        return deck && task ? { task, deck } : null;
      })
      .filter(Boolean) as Array<{ task: Task; deck: Deck }>;
  }, [z.active.taskIds, z.active.deckIds, z.decks]);

  const selectedItems = useMemo(() => {
    if (!selectMode || selected.size === 0) return [];
    const out: Array<{ task: Task; deck: Deck }> = [];
    z.decks.forEach((d) => d.tasks.forEach((t) => { if (selected.has(t.id)) out.push({ task: t, deck: d }); }));
    return out;
  }, [z.decks, selected, selectMode]);

  const isRunning = runningItems.length > 0;
  const hasSelection = selectedItems.length > 0;

  // Stats
  const runningTotal = runningItems.reduce((s, it) => s + it.task.totalSeconds, 0) + (isRunning ? z.elapsed * runningItems.length : 0);
  const selectedTotal = selectedItems.reduce((s, it) => s + it.task.totalSeconds, 0);
  const selectedDeckCount = new Set(selectedItems.map((it) => it.deck.id)).size;

  const unselectOne = (taskId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  const startSelected = () => {
    const tasks = selectedItems.map((it) => it.task);
    if (!tasks.length) return;
    z.startTasks(tasks);
    setSelected(new Set());
    setSelectMode(false);
    setExpanded(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface-1/95 backdrop-blur">
      {/* Expanded details panel */}
      {expanded && (
        <div className="mx-auto max-h-[45vh] max-w-[1600px] overflow-y-auto px-4 py-4 md:px-6">
          {isRunning && (
            <div className="mb-4">
              <div className="micro-caps mb-2 text-text-dim">
                Running · {runningItems.length} {runningItems.length === 1 ? "task" : "tasks"}
              </div>
              <div className="space-y-2">
                {runningItems.map(({ task, deck }) => {
                  const live = task.totalSeconds + z.elapsed;
                  const target = task.mode === "countdown" ? task.targetSeconds ?? 0 : 0;
                  const remaining = target ? Math.max(0, target - z.elapsed) : 0;
                  const pct = target ? Math.min(100, (z.elapsed / target) * 100) : 0;
                  return (
                    <div
                      key={task.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-4 py-3"
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ background: deck.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="display-italic truncate text-base text-foreground/90">{task.name}</span>
                          <span className="micro-caps text-text-dim">{deck.name}</span>
                        </div>
                        <div className="micro-caps mt-1 text-text-dim">
                          {task.mode === "countdown" ? `Countdown · ${formatTime(remaining)} left` : "Stopwatch"}
                          {task.tag ? ` · ${task.tag}` : ""}
                        </div>
                        {task.mode === "countdown" && (
                          <div className="mt-2 h-0.5 w-full overflow-hidden rounded bg-surface-2">
                            <div className="h-full bg-accent-gold transition-[width]" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="timer-mono text-lg text-foreground">{formatTime(z.elapsed)}</div>
                        <div className="micro-caps text-text-dim">total {formatDuration(live)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasSelection && (
            <div>
              <div className="micro-caps mb-2 text-text-dim">
                Selected · {selectedItems.length} {selectedItems.length === 1 ? "card" : "cards"}
                {selectedDeckCount > 1 ? ` · ${selectedDeckCount} decks` : ""}
              </div>
              <div className="space-y-2">
                {selectedItems.map(({ task, deck }) => (
                  <div
                    key={task.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-4 py-3"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: deck.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="display-italic truncate text-base text-foreground/90">{task.name}</span>
                        <span className="micro-caps text-text-dim">{deck.name}</span>
                      </div>
                      <div className="micro-caps mt-1 text-text-dim">
                        {task.mode === "countdown"
                          ? `Countdown · ${formatDuration(task.targetSeconds ?? 0)} target`
                          : "Stopwatch"}
                        {task.tag ? ` · ${task.tag}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="timer-mono text-lg text-foreground">{formatDuration(task.totalSeconds)}</div>
                      <div className="micro-caps text-text-dim">invested</div>
                    </div>
                    <button
                      onClick={() => unselectOne(task.id)}
                      className="micro-caps rounded border border-border px-2 py-1 text-text-dim transition-colors hover:border-foreground hover:text-foreground"
                      title="Remove from selection"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action row inside expanded panel — keeps the collapsed footer minimal & responsive */}
          {(isRunning || hasSelection) && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {isRunning && (
                <>
                  <button
                    onClick={onFocus}
                    className="micro-caps rounded border border-border px-4 py-2 transition-colors hover:border-accent-gold-dim hover:text-accent-gold"
                  >
                    Focus →
                  </button>
                  <button
                    onClick={() => z.stopTask()}
                    className="micro-caps rounded border border-destructive px-4 py-2 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                  >
                    {runningItems.length > 1 ? `Stop group (${runningItems.length})` : "Stop"}
                  </button>
                </>
              )}
              {!isRunning && hasSelection && (
                <>
                  <button
                    onClick={startSelected}
                    className="micro-caps rounded border border-accent-gold-dim px-4 py-2 text-accent-gold transition-colors hover:bg-accent-gold-dim/30"
                  >
                    ▶ Start group
                  </button>
                  <button
                    onClick={() => { setSelected(new Set()); setSelectMode(false); }}
                    className="micro-caps rounded border border-border px-4 py-2 text-text-secondary transition-colors hover:border-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer — minimal & responsive: Details toggle + live timer. Actions live in the expanded panel. */}
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="micro-caps flex shrink-0 items-center gap-1.5 rounded border border-border px-3 py-1.5 text-text-secondary transition-colors hover:border-accent-gold-dim hover:text-accent-gold"
          aria-expanded={expanded}
        >
          <span>Details</span>
          {(isRunning || hasSelection) && (
            <span className="rounded-full bg-accent-gold-dim/40 px-1.5 text-[10px] text-accent-gold">
              {isRunning ? runningItems.length : selectedItems.length}
            </span>
          )}
          <span aria-hidden className={`transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
        </button>

        {isRunning && (
          <div className="timer-mono pulse-gold truncate text-xl text-foreground sm:text-2xl md:text-3xl">
            {formatTime(z.elapsed)}
          </div>
        )}
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* JOURNAL VIEW                                                        */
/* ------------------------------------------------------------------ */

function JournalView({
  z,
  context,
  clearContext,
}: {
  z: ReturnType<typeof useTogglZen>;
  context:
    | { kind: "task"; taskId: string; logId?: string | null }
    | { kind: "deck"; deckId: string }
    | null;
  clearContext: () => void;
}) {
  type Target =
    | { kind: "task"; id: string; name: string; deckName: string; tag?: string }
    | { kind: "deck"; id: string; name: string; deckName: string };

  const allTargets = useMemo<Target[]>(() => {
    const list: Target[] = [];
    z.decks.forEach((d) => {
      list.push({ kind: "deck", id: d.id, name: d.name, deckName: d.name });
      d.tasks.forEach((t) =>
        list.push({ kind: "task", id: t.id, name: t.name, deckName: d.name, tag: t.tag })
      );
    });
    return list;
  }, [z.decks]);

  const [targetKey, setTargetKey] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [touched, setTouched] = useState<{ target?: boolean; body?: boolean }>({});
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");
  const [logId, setLogId] = useState<string | null>(null);
  const lastLoadedKey = useRef<string>("__init__");

  const BODY_MAX = 20000;

  const keyFor = (t: Target | undefined) => (t ? `${t.kind}:${t.id}` : "");

  // Find the (single) journal entry attached to the currently selected target.
  // We treat each card/deck as having ONE accumulating note.
  const editing = useMemo<Journal | null>(() => {
    if (!targetKey) return null;
    const [kind, id] = targetKey.split(":");
    return (
      z.journals.find((j) =>
        kind === "task" ? j.taskId === id : j.deckId === id && !j.taskId
      ) ?? null
    );
  }, [targetKey, z.journals]);

  // External context (clicking a deck/task/log "open journal" button)
  useEffect(() => {
    if (!context) return;
    const key =
      context.kind === "task" ? `task:${context.taskId}` : `deck:${context.deckId}`;
    setTargetKey(key);
    setLogId(context.kind === "task" ? context.logId ?? null : null);
    setTouched({});
    clearContext();
  }, [context, clearContext]);

  // Initial selection — open the most recently updated entry if nothing chosen yet.
  useEffect(() => {
    if (targetKey || !z.journals.length) return;
    const newest = [...z.journals].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (newest) {
      setTargetKey(
        newest.taskId ? `task:${newest.taskId}` : `deck:${newest.deckId}`
      );
      setLogId(newest.logId);
    }
  }, [z.journals, targetKey]);

  // When the target changes (different card / deck), load that target's body
  // fresh — never carry the previous card's text over.
  useEffect(() => {
    if (lastLoadedKey.current === targetKey) return;
    lastLoadedKey.current = targetKey;
    setBody(editing?.body ?? "");
    setLogId(editing?.logId ?? null);
    setTouched({});
  }, [targetKey, editing]);

  const currentTarget = allTargets.find((t) => keyFor(t) === targetKey);
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;

  const validate = (key: string, b: string) => {
    const schema = zod.object({
      targetKey: zod
        .string()
        .min(1, "Pick a deck or task to attach this entry to.")
        .refine((k) => allTargets.some((t) => keyFor(t) === k), {
          message: "That target no longer exists.",
        }),
      body: zod
        .string()
        .trim()
        .min(1, "Write something before saving.")
        .max(BODY_MAX, `Keep it under ${BODY_MAX} characters.`),
    });
    const result = schema.safeParse({ targetKey: key, body: b });
    if (result.success) return {};
    const fieldErrors: { target?: string; body?: string } = {};
    for (const issue of result.error.issues) {
      const k = issue.path[0] as "targetKey" | "body";
      if (k === "targetKey" && !fieldErrors.target) fieldErrors.target = issue.message;
      if (k === "body" && !fieldErrors.body) fieldErrors.body = issue.message;
    }
    return fieldErrors;
  };

  const liveErrors = validate(targetKey, body);
  const visibleErrors = {
    target: touched.target ? liveErrors.target : undefined,
    body: touched.body ? liveErrors.body : undefined,
  };
  const isValid = !liveErrors.target && !liveErrors.body;
  const overLimit = body.length > BODY_MAX;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const performSave = (opts?: { silent?: boolean }) => {
    const errs = validate(targetKey, body);
    if (errs.target || errs.body) {
      if (!opts?.silent) {
        setTouched({ target: true, body: true });
        notify.error(errs.target ?? errs.body ?? "Could not save entry");
      }
      return false;
    }
    const target = allTargets.find((t) => keyFor(t) === targetKey);
    if (!target) return false;
    const deck = z.decks.find((d) => d.name === target.deckName);
    const isUpdate = !!editing?.id;
    z.upsertJournal({
      id: editing?.id,
      taskId: target.kind === "task" ? target.id : null,
      taskName: target.name,
      deckId: target.kind === "deck" ? target.id : deck?.id ?? null,
      deckName: target.deckName,
      deckColor: deck?.color ?? null,
      logId,
      body: body.trim(),
    });
    setSaveStatus("saved");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
    if (!opts?.silent) {
      notify.success(isUpdate ? "Entry updated" : "Entry saved", {
        description: `${wordCount} word${wordCount === 1 ? "" : "s"} · ${target.deckName}${target.kind === "task" ? ` · ${target.name}` : ""}`,
      });
    }
    return true;
  };

  const handleSave = () => performSave();

  // Autosave: debounce body changes once a target is selected.
  useEffect(() => {
    if (!targetKey) return;
    if (lastLoadedKey.current !== targetKey) return; // skip the load-tick
    if ((editing?.body ?? "") === body) return; // nothing to persist
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      performSave({ silent: true });
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, targetKey]);

  const startNew = () => {
    setTargetKey("");
    lastLoadedKey.current = "";
    setBody("");
    setLogId(null);
    setTouched({});
    setSaveStatus("idle");
  };

  // Cmd/Ctrl+S shortcut to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, targetKey, logId]);

  const sortedJournals = useMemo(() => {
    const taskIds = new Set(z.decks.flatMap((d) => d.tasks.map((t) => t.id)));
    const deckIds = new Set(z.decks.map((d) => d.id));
    return [...z.journals]
      .filter((j) =>
        j.taskId ? taskIds.has(j.taskId) : j.deckId ? deckIds.has(j.deckId) : false
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [z.journals, z.decks]);

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col">
      <section className="flex min-w-0 flex-1 flex-col px-4 py-6 md:px-10 md:py-8">
        <div className="mb-4 flex flex-col gap-3 border-b border-border pb-5">
          <div className="flex items-center justify-between">
            <div className="micro-caps text-text-dim">Journal target</div>
          </div>
          <div className="flex flex-col gap-1">
            <TargetBadgeDropdown
              targets={allTargets}
              decks={z.decks}
              value={targetKey}
              onChange={(key) => {
                setTargetKey(key);
                setTouched((t) => ({ ...t, target: true }));
              }}
              onBlur={() => setTouched((t) => ({ ...t, target: true }))}
              hasError={!!visibleErrors.target}
            />
            {visibleErrors.target && (
              <span className="micro-caps !text-destructive">{visibleErrors.target}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <div className="font-serif text-sm text-text-secondary">
              {friendlyDateLabel(editing?.updatedAt ?? Date.now())}
            </div>
            <div className="hidden h-3 w-px bg-border sm:block" />
            {currentTarget && (() => {
              const liveDeck = z.decks.find((d) => d.name === currentTarget.deckName);
              return (
                <span className="micro-caps inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-text-secondary transition-colors duration-300">
                  <span
                    className="size-1.5 rounded-full transition-colors duration-300"
                    style={{ background: liveDeck?.color ?? "#555" }}
                  />
                  {currentTarget.deckName}
                  {currentTarget.kind === "deck" && <span className="text-text-dim">· deck</span>}
                </span>
              );
            })()}
            {currentTarget?.kind === "task" && currentTarget.tag && (
              <span className="micro-caps rounded-md border border-border px-2 py-0.5 text-text-secondary">
                {currentTarget.tag}
              </span>
            )}
            <div className="inline-flex overflow-hidden rounded-md border border-border text-[10px] uppercase tracking-[0.08em]">
              {(["edit", "split", "preview"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-2 py-1 transition-colors ${
                    viewMode === m
                      ? "bg-accent-gold-dim text-foreground"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {editing && (
              <button
                onClick={() => {
                  const snapshot = editing;
                  z.deleteJournal(snapshot.id);
                  notify.undoable(
                    "Entry deleted",
                    () => {
                      z.upsertJournal({
                        id: snapshot.id,
                        taskId: snapshot.taskId ?? null,
                        taskName: snapshot.taskName ?? null,
                        deckId: snapshot.deckId ?? null,
                        deckName: snapshot.deckName,
                        deckColor: snapshot.deckColor ?? null,
                        logId: snapshot.logId ?? null,
                        body: snapshot.body,
                      });
                    },
                    { description: snapshot.deckName }
                  );
                  startNew();
                }}
                className="micro-caps rounded text-destructive hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <div
          className={`mt-4 grid flex-1 gap-4 ${
            viewMode === "split" ? "md:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {(viewMode === "edit" || viewMode === "split") && (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, body: true }))}
              placeholder="Write in markdown — # headings, **bold**, - lists, `code`, > quotes…"
              maxLength={BODY_MAX + 200}
              aria-invalid={!!visibleErrors.body}
              aria-label="Journal entry"
              className={`min-h-[260px] w-full resize-none border-0 bg-transparent font-mono text-[13px] leading-[1.7] text-ink placeholder:text-text-dim focus:outline-none md:min-h-[420px] ${
                visibleErrors.body ? "caret-destructive" : ""
              }`}
            />
          )}
          {(viewMode === "preview" || viewMode === "split") && (
            <div
              className={`min-h-[260px] overflow-y-auto rounded-md md:min-h-[420px] ${
                viewMode === "split"
                  ? "border border-border bg-surface-1/30 p-4"
                  : ""
              }`}
            >
              {body.trim() ? (
                <article className="markdown-body font-serif text-[15px] leading-[1.9] text-ink">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </article>
              ) : (
                <div className="font-serif text-[15px] italic leading-[1.9] text-text-dim">
                  Nothing to preview yet.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-3">
            {savedFlash && (
              <span className="micro-caps inline-flex items-center gap-1.5 rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2.5 py-1 text-accent-gold quote-fade">
                <span className="size-1.5 rounded-full bg-accent-gold" />
                Saved
              </span>
            )}
            {visibleErrors.body && (
              <span className="micro-caps !text-destructive">{visibleErrors.body}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className={`micro-caps ${overLimit ? "!text-destructive" : ""}`}>
              {wordCount} words · {body.length}/{BODY_MAX}
            </span>
            <span
              className="micro-caps text-text-dim"
              title={isValid ? "Autosaves as you type" : "Pick a target and write something"}
            >
              {!targetKey
                ? "Pick a target"
                : saveStatus === "saving"
                  ? "Saving…"
                  : editing
                    ? "Saved"
                    : "Type to save"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HISTORY VIEW                                                        */
/* ------------------------------------------------------------------ */

function HistoryView({
  z,
  openJournal,
}: {
  z: ReturnType<typeof useTogglZen>;
  openJournal: (log: { taskId: string; id: string }) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, { ts: number; logs: typeof z.logs }>();
    [...z.logs]
      .sort((a, b) => b.startedAt - a.startedAt)
      .forEach((l) => {
        const k = dateKey(l.startedAt);
        if (!map.has(k)) map.set(k, { ts: l.startedAt, logs: [] });
        map.get(k)!.logs.push(l);
      });
    return Array.from(map.values());
  }, [z.logs]);

  const weekTotal = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    return z.logs.filter((l) => l.startedAt >= weekAgo).reduce((acc, l) => acc + l.duration, 0);
  }, [z.logs]);

  return (
    <div className="mx-auto max-w-[920px] px-6 py-12">
      <div className="mb-10 flex items-end justify-between border-b border-border pb-6">
        <h1 className="font-display text-3xl">History</h1>
        <div className="text-right">
          <div className="micro-caps">this week</div>
          <div className="timer-mono mt-1 text-2xl text-foreground">{formatDuration(weekTotal)}</div>
        </div>
      </div>

      {grouped.length === 0 && (
        <div className="text-center text-text-dim">No sessions yet. Start a task to begin.</div>
      )}

      <div className="space-y-10">
        {grouped.map((g) => (
          <div key={g.ts}>
            <div className="mb-4 flex items-center gap-3">
              <div className="micro-caps text-text-secondary">{friendlyDateLabel(g.ts)}</div>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-1">
              {g.logs.map((l) => (
                <div
                  key={l.id}
                  className="group flex items-center gap-4 rounded px-3 py-3 transition-colors hover:bg-surface-1"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: l.deckColor }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif text-sm">{l.taskName}</div>
                    <div className="micro-caps mt-0.5">
                      {l.deckName} · {formatTimeShort(l.startedAt)}
                    </div>
                  </div>
                  <div className="timer-mono text-base text-foreground">
                    {formatTime(l.duration)}
                  </div>
                  {l.hasJournal ? (() => {
                    const j = z.journals.find((x) => x.logId === l.id) ?? z.journals.find((x) => x.taskId === l.taskId);
                    const linkedDeck = j ? z.decks.find((d) => d.id === j.deckId) : null;
                    const linkedName = linkedDeck?.name ?? j?.deckName ?? null;
                    const linkedColor = linkedDeck?.color ?? j?.deckColor ?? l.deckColor;
                    return (
                      <button
                        onClick={() => openJournal(l)}
                        title={linkedName ? `Journal · linked to ${linkedName}` : "Open journal"}
                        className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-text-secondary transition-colors hover:border-border-accent hover:text-foreground"
                      >
                        <span className="size-1.5 rounded-full" style={{ background: linkedColor }} />
                        <span className="text-[10px] uppercase tracking-[0.08em]">
                          {linkedName ?? "Journal"}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z" />
                          <path d="M8 8h8M8 12h8M8 16h5" />
                        </svg>
                      </button>
                    );
                  })() : (
                    <span className="w-[14px]" />
                  )}
                  <button
                    onClick={() => z.deleteLog(l.id)}
                    className="text-text-dim opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FOCUS MODE                                                          */
/* ------------------------------------------------------------------ */

function FocusMode({
  taskName,
  items,
  startedAt,
  elapsed,
  onExit,
  onStop,
  onZen,
}: {
  taskName: string;
  items: Array<{ id: string; name: string; deckName: string; deckColor: string; totalSeconds: number }>;
  startedAt: number;
  elapsed: number;
  onExit: () => void;
  onStop: () => void;
  onZen: () => void;
}) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 4000);
    };
    reset();
    window.addEventListener("mousemove", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("keydown", reset);
    };
  }, []);

  const isGroup = items.length > 1;

  return (
    <div className={`fixed inset-0 z-40 flex flex-col items-center justify-center bg-background fade-in ${idle ? "hide-cursor" : ""}`}>
      <button
        onClick={onExit}
        className={`micro-caps absolute right-6 top-6 text-text-dim transition-opacity duration-500 hover:text-foreground ${
          idle ? "opacity-0" : "opacity-100"
        }`}
      >
        × Exit Focus
      </button>
      <button
        onClick={onExit}
        className={`micro-caps absolute left-6 top-6 text-text-dim transition-opacity duration-500 hover:text-foreground ${
          idle ? "opacity-0" : "opacity-100"
        }`}
      >
        ← Exit
      </button>

      <div className="display-italic micro-caps !text-base text-text-secondary">{taskName}</div>
      <div className="my-6 h-px w-12 bg-border-accent" />
      <div className="timer-mono text-[88px] leading-none text-foreground">{formatTime(elapsed)}</div>
      <div className="my-6 h-px w-12 bg-border-accent" />

      {isGroup && (
        <div className={`mb-6 w-full max-w-[520px] px-6 transition-opacity duration-500 ${idle ? "opacity-30" : "opacity-100"}`}>
          <div className="micro-caps mb-3 text-center text-text-dim">Group · {items.length} tasks</div>
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-1/60 px-4 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: it.deckColor }} />
                  <div className="min-w-0">
                    <div className="truncate font-serif text-sm text-foreground">{it.name}</div>
                    <div className="micro-caps text-text-dim">{it.deckName}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="timer-mono text-base text-foreground">{formatTime(elapsed)}</div>
                  <div className="micro-caps text-text-dim">total {formatDuration(it.totalSeconds + elapsed)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`flex gap-4 transition-opacity duration-500 ${idle ? "opacity-0" : "opacity-100"}`}>
        <button
          onClick={onStop}
          className="micro-caps rounded border border-destructive px-4 py-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          {isGroup ? `Stop Group (${items.length})` : "Stop Session"}
        </button>
        <button
          onClick={onZen}
          className="micro-caps rounded border border-accent-gold-dim px-4 py-2 text-accent-gold hover:bg-accent-gold-dim/20"
        >
          Zen →
        </button>
      </div>
      <div className="absolute bottom-6 right-6 text-[11px] text-text-dim font-jp">
        started {formatTimeShort(startedAt)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ZEN MODE                                                            */
/* ------------------------------------------------------------------ */

function ZenMode({
  activeElapsed,
  items = [],
  onExit,
}: {
  activeElapsed: number | null;
  items?: Array<{ id: string; name: string; deckName: string; deckColor: string; totalSeconds: number }>;
  onExit: () => void;
}) {
  const isGroup = items.length > 1;

  // Persisted settings
  const [packId, setPackId] = useState<QuotePackId>(() => {
    if (typeof window === "undefined") return "musashi";
    return (storage.getItem("zenith.zen.pack") as QuotePackId) ?? "musashi";
  });
  const [customQuotes, setCustomQuotes] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(storage.getItem("zenith.zen.customQuotes") ?? "[]"); } catch { return []; }
  });
  const [customWallpapers, setCustomWallpapers] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(storage.getItem("zenith.zen.customWalls") ?? "[]"); } catch { return []; }
  });
  const [activeWallIdx, setActiveWallIdx] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(storage.getItem("zenith.zen.wallIdx") ?? "0") || 0;
  });
  const [intervalSec, setIntervalSec] = useState<number>(() => {
    if (typeof window === "undefined") return 20;
    return Number(storage.getItem("zenith.zen.intervalSec") ?? "20") || 20;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { storage.setItem("zenith.zen.pack", packId); }, [packId]);
  useEffect(() => { storage.setItem("zenith.zen.customQuotes", JSON.stringify(customQuotes)); }, [customQuotes]);
  useEffect(() => { storage.setItem("zenith.zen.customWalls", JSON.stringify(customWallpapers)); }, [customWallpapers]);
  useEffect(() => { storage.setItem("zenith.zen.wallIdx", String(activeWallIdx)); }, [activeWallIdx]);
  useEffect(() => { storage.setItem("zenith.zen.intervalSec", String(intervalSec)); }, [intervalSec]);

  const wallpapers = useMemo<WallpaperItem[]>(
    () => [
      ...ALL_BUILTIN_WALLPAPERS,
      ...customWallpapers.map((value) => ({ kind: "image" as const, value, label: "Custom" })),
    ],
    [customWallpapers],
  );
  const pack = QUOTE_PACKS[packId];
  const quotes = useMemo(
    () => (packId === "musashi" && customQuotes.length === 0 ? pack.quotes : [...pack.quotes, ...customQuotes]),
    [pack, customQuotes, packId]
  );

  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * 8));
  const [fadeKey, setFadeKey] = useState(0);
  const nextQuote = () => { setQuoteIdx((q) => (q + 1) % Math.max(quotes.length, 1)); setFadeKey((k) => k + 1); };
  const prevQuote = () => { setQuoteIdx((q) => (q - 1 + Math.max(quotes.length, 1)) % Math.max(quotes.length, 1)); setFadeKey((k) => k + 1); };

  useEffect(() => {
    if (intervalSec <= 0) return;
    const i = setInterval(nextQuote, intervalSec * 1000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes.length, intervalSec]);

  const currentWall = wallpapers[activeWallIdx % wallpapers.length] ?? wallpapers[0];
  const currentQuote = quotes[quoteIdx % Math.max(quotes.length, 1)] ?? "";

  // Personality: greeting + rotating kanji
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "still up" : hour < 12 ? "good morning" : hour < 17 ? "good afternoon" : hour < 22 ? "good evening" : "late night";
  const KANJI = ["静", "禅", "心", "道", "間", "侘", "寂", "気"];
  const kanji = KANJI[quoteIdx % KANJI.length];

  const wallStyle: React.CSSProperties = currentWall && isCssWallpaper(currentWall.value)
    ? { background: currentWall.value, filter: "brightness(0.85)" }
    : { backgroundImage: `url(${currentWall?.value ?? ""})`, filter: "grayscale(100%) brightness(0.55)" };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background fade-in" onClick={onExit}>
      <div
        key={currentWall?.value}
        className="absolute inset-0 bg-cover bg-center quote-fade"
        style={wallStyle}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="font-jp text-6xl text-accent-gold/80 quote-fade" key={`k-${fadeKey}`}>{kanji}</div>
          <div className="micro-caps text-text-dim">{greeting}</div>
        </div>
        <div className="my-8 max-w-[620px]" key={fadeKey}>
          <div className="display-italic quote-fade text-[28px] leading-[1.6] text-foreground">
            "{currentQuote}"
          </div>
          <div className="quote-fade-slow mt-4 font-serif text-[13px] text-text-secondary">
            — {pack.label} · {pack.source}
          </div>
        </div>
        <div className="mb-6 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={prevQuote}
            aria-label="Previous quote"
            className="rounded-full border border-border/50 bg-black/30 px-3 py-1 text-text-secondary backdrop-blur-sm hover:border-accent-gold-dim hover:text-accent-gold"
          >‹</button>
          <span className="micro-caps text-text-dim">{(quoteIdx % Math.max(quotes.length, 1)) + 1} / {Math.max(quotes.length, 1)}</span>
          <button
            onClick={nextQuote}
            aria-label="Next quote"
            className="rounded-full border border-border/50 bg-black/30 px-3 py-1 text-text-secondary backdrop-blur-sm hover:border-accent-gold-dim hover:text-accent-gold"
          >›</button>
        </div>
        <div className="h-px w-24 bg-border-accent" />
        {activeElapsed !== null && (
          <div className="timer-mono mt-8 text-4xl text-foreground">{formatTime(activeElapsed)}</div>
        )}
        {isGroup && activeElapsed !== null && (
          <div
            className="mt-6 w-full max-w-[420px] space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="micro-caps text-center text-text-dim">Group · {items.length} tasks</div>
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-black/30 px-3 py-1.5 text-left backdrop-blur-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: it.deckColor }} />
                  <span className="truncate font-serif text-[13px] text-foreground">{it.name}</span>
                  <span className="micro-caps shrink-0 text-text-dim">· {it.deckName}</span>
                </div>
                <span className="timer-mono shrink-0 text-xs text-text-secondary">
                  {formatTime(it.totalSeconds + activeElapsed)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Customize — top-center, styled like a task card */}
        <button
          onClick={(e) => { e.stopPropagation(); setSettingsOpen(true); }}
          title="Customize wallpaper & quotes"
          className="card-soft micro-caps absolute left-1/2 top-4 sm:top-6 -translate-x-1/2 inline-flex items-center gap-2 border border-border bg-surface-1 px-4 py-2 sm:px-5 sm:py-2.5 text-foreground shadow-lg transition-all hover:scale-[1.02] hover:border-accent-gold-dim whitespace-nowrap"
        >
          <span className="text-base leading-none text-accent-gold">⚙</span>
          <span>Customize Zen</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onExit();
          }}
          className="micro-caps absolute bottom-8 text-text-dim hover:text-foreground"
        >
          press anywhere or Esc to return
        </button>
      </div>

      {settingsOpen && (
        <ZenSettings
          packId={packId}
          setPackId={setPackId}
          customQuotes={customQuotes}
          setCustomQuotes={setCustomQuotes}
          customWallpapers={customWallpapers}
          setCustomWallpapers={setCustomWallpapers}
          wallpapers={wallpapers}
          activeWallIdx={activeWallIdx}
          setActiveWallIdx={setActiveWallIdx}
          intervalSec={intervalSec}
          setIntervalSec={setIntervalSec}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function ZenSettings({
  packId, setPackId,
  customQuotes, setCustomQuotes,
  customWallpapers, setCustomWallpapers,
  wallpapers, activeWallIdx, setActiveWallIdx,
  intervalSec, setIntervalSec,
  onClose,
}: {
  packId: QuotePackId;
  setPackId: (id: QuotePackId) => void;
  customQuotes: string[];
  setCustomQuotes: (q: string[]) => void;
  customWallpapers: string[];
  setCustomWallpapers: (w: string[]) => void;
  wallpapers: WallpaperItem[];
  activeWallIdx: number;
  setActiveWallIdx: (i: number) => void;
  intervalSec: number;
  setIntervalSec: (n: number) => void;
  onClose: () => void;
}) {
  const [newQuote, setNewQuote] = useState("");
  const [newWall, setNewWall] = useState("");

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCustomWallpapers([...customWallpapers, reader.result]);
        setActiveWallIdx(wallpapers.length); // becomes the newly added one
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/85 backdrop-blur-md fade-in"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card-soft w-full max-w-[680px] max-h-[88vh] overflow-y-auto border border-border bg-surface-1 p-7"
      >
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="font-jp text-2xl text-accent-gold">禅</span>
            <h2 className="font-display text-2xl">Customize Zen</h2>
          </div>
          <button
            onClick={onClose}
            className="micro-caps rounded-md border border-border px-2.5 py-1 text-text-secondary transition-colors hover:border-foreground hover:text-foreground"
          >
            × Close
          </button>
        </div>

        {/* Quote pack */}
        <section className="mb-6">
          <div className="micro-caps mb-3 text-text-dim">Quote pack</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(QUOTE_PACKS) as QuotePackId[]).map((id) => (
              <button
                key={id}
                onClick={() => setPackId(id)}
                className={`micro-caps rounded-full border px-3.5 py-1.5 transition-colors ${
                  packId === id
                    ? "border-accent-gold bg-accent-gold-dim/20 text-accent-gold"
                    : "border-border text-text-secondary hover:border-accent-gold-dim hover:text-foreground"
                }`}
              >
                {QUOTE_PACKS[id].label}
              </button>
            ))}
          </div>
        </section>

        {/* Rotation interval */}
        <section className="mb-6">
          <div className="micro-caps mb-3 text-text-dim">Quote rotation</div>
          <div className="flex flex-wrap gap-2">
            {[0, 10, 20, 30, 60].map((sec) => (
              <button
                key={sec}
                onClick={() => setIntervalSec(sec)}
                className={`micro-caps rounded-full border px-3.5 py-1.5 transition-colors ${
                  intervalSec === sec
                    ? "border-accent-gold bg-accent-gold-dim/20 text-accent-gold"
                    : "border-border text-text-secondary hover:border-accent-gold-dim hover:text-foreground"
                }`}
              >
                {sec === 0 ? "Off" : `${sec}s`}
              </button>
            ))}
          </div>
        </section>

        {/* Wallpapers — categorized */}
        <WallpaperPicker
          wallpapers={wallpapers}
          activeWallIdx={activeWallIdx}
          setActiveWallIdx={setActiveWallIdx}
          customWallpapers={customWallpapers}
          setCustomWallpapers={setCustomWallpapers}
          newWall={newWall}
          setNewWall={setNewWall}
          onFile={onFile}
        />
      </div>
    </div>
  );
}

function WallpaperPicker({
  wallpapers,
  activeWallIdx,
  setActiveWallIdx,
  customWallpapers,
  setCustomWallpapers,
  newWall,
  setNewWall,
  onFile,
}: {
  wallpapers: WallpaperItem[];
  activeWallIdx: number;
  setActiveWallIdx: (i: number) => void;
  customWallpapers: string[];
  setCustomWallpapers: (w: string[]) => void;
  newWall: string;
  setNewWall: (s: string) => void;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const categoryKeys = Object.keys(WALLPAPER_CATEGORIES) as WallpaperCategoryId[];
  const tabs: Array<{ id: string; label: string }> = [
    ...categoryKeys.map((id) => ({ id, label: WALLPAPER_CATEGORIES[id].label })),
    { id: "custom", label: `Custom (${customWallpapers.length})` },
  ];
  const [tab, setTab] = useState<string>("builtin");

  // Offsets into the flat `wallpapers` array, used to compute the real index per item
  const offsets: Record<string, number> = {};
  let acc = 0;
  for (const id of categoryKeys) {
    offsets[id] = acc;
    acc += WALLPAPER_CATEGORIES[id].items.length;
  }
  offsets.custom = acc;

  const items: WallpaperItem[] =
    tab === "custom"
      ? customWallpapers.map((value) => ({ kind: "image" as const, value, label: "Custom" }))
      : [...WALLPAPER_CATEGORIES[tab as WallpaperCategoryId].items];

  return (
    <section>
      <div className="micro-caps mb-2">Wallpaper</div>
      <div className="mb-3 flex flex-wrap gap-1.5 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`micro-caps rounded-md px-2.5 py-1 transition-colors ${
              tab === t.id
                ? "bg-accent-gold-dim/30 text-accent-gold"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface-2/30 px-4 py-6 text-center text-sm text-text-dim">
          No custom wallpapers yet. Paste a URL or upload below.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item, i) => {
            const globalIdx = offsets[tab] + i;
            const active = activeWallIdx === globalIdx;
            const style: React.CSSProperties = isCssWallpaper(item.value)
              ? { background: item.value }
              : { backgroundImage: `url(${item.value})`, backgroundSize: "cover", backgroundPosition: "center" };
            return (
              <button
                key={item.value + i}
                onClick={() => setActiveWallIdx(globalIdx)}
                className={`relative aspect-video overflow-hidden rounded-md border-2 transition-colors ${
                  active ? "border-accent-gold" : "border-transparent hover:border-border"
                }`}
                title={item.label}
                style={style}
              >
                {item.label && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/90">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={newWall}
          onChange={(e) => setNewWall(e.target.value)}
          placeholder="Paste image URL to import…"
          className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm focus:border-accent-gold-dim focus:outline-none"
        />
        <button
          onClick={() => {
            if (newWall.trim()) {
              const value = newWall.trim();
              setCustomWallpapers([...customWallpapers, value]);
              setActiveWallIdx(wallpapers.length); // points at the new custom one
              setNewWall("");
              setTab("custom");
            }
          }}
          className="micro-caps rounded-md border border-accent-gold-dim px-3 py-2 text-accent-gold hover:bg-accent-gold-dim/20"
        >
          Import URL
        </button>
        <label className="micro-caps inline-flex cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 text-text-secondary hover:border-accent-gold-dim hover:text-accent-gold">
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
      </div>
      {customWallpapers.length > 0 && (
        <div className="micro-caps mt-2 text-text-dim">
          {customWallpapers.length} custom wallpaper{customWallpapers.length === 1 ? "" : "s"} ·{" "}
          <button
            onClick={() => { setCustomWallpapers([]); setActiveWallIdx(0); }}
            className="text-text-secondary hover:text-destructive"
          >clear all</button>
        </div>
      )}
    </section>
  );
}



/* ------------------------------------------------------------------ */
/* TARGET BADGE MODAL (Journal header) — picks deck or task            */
/* ------------------------------------------------------------------ */

type TargetItem =
  | { kind: "task"; id: string; name: string; deckName: string; tag?: string }
  | { kind: "deck"; id: string; name: string; deckName: string };

function TargetBadgeDropdown({
  targets,
  decks,
  value,
  onChange,
  onBlur,
  hasError,
}: {
  targets: TargetItem[];
  decks: Deck[];
  value: string;
  onChange: (key: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const keyFor = (kind: "task" | "deck", id: string) => `${kind}:${id}`;
  const current = targets.find((t) => keyFor(t.kind, t.id) === value);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        onBlur?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onBlur]);

  const triggerLabel = current
    ? current.kind === "deck"
      ? `${current.name} · Deck`
      : current.name
    : "Select a deck or task";

  const select = (k: string) => {
    onChange(k);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const close = () => {
    setOpen(false);
    onBlur?.();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={triggerLabel}
        className={`group flex w-full items-center gap-4 rounded-2xl border-2 bg-surface-1 px-6 py-4 text-left shadow-sm transition-all hover:border-accent-gold hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
          hasError ? "border-destructive" : current ? "border-accent-gold-dim" : "border-dashed border-border"
        }`}
      >
        <span
          className="size-3 shrink-0 rounded-full ring-2 ring-background"
          style={{
            background: current
              ? decks.find(
                  (d) =>
                    d.id === (current.kind === "deck" ? current.id : undefined) ||
                    d.tasks.some((t) => current.kind === "task" && t.id === current.id),
                )?.color ?? "#555"
              : "#3a3a3a",
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="micro-caps text-text-dim">
            {current ? (current.kind === "deck" ? "Deck journal" : "Card journal") : "Choose where to journal"}
          </span>
          <span className="display-italic truncate text-2xl leading-tight text-foreground">
            {triggerLabel}
          </span>
        </div>
        <span className="micro-caps shrink-0 rounded-full border border-border px-3 py-1 text-text-secondary transition-colors group-hover:border-accent-gold group-hover:text-accent-gold">
          Change ▾
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-12 backdrop-blur-sm fade-in"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pick a deck or task"
            onClick={(e) => e.stopPropagation()}
            className="card-soft w-full max-w-2xl border border-border bg-surface-1 p-6 md:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="micro-caps text-text-secondary">Journal target</div>
                <div className="display-italic mt-1 text-2xl leading-tight">
                  Pick a deck or card
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="text-text-dim transition-colors hover:text-foreground"
              >
                ×
              </button>
            </div>

            {decks.length === 0 && (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-text-dim">
                No decks or tasks yet — create one in Decks.
              </div>
            )}

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
              {decks.map((deck) => {
                const deckKey = keyFor("deck", deck.id);
                const deckSelected = deckKey === value;
                return (
                  <div key={deck.id}>
                    {/* Deck header — large, colored, distinct */}
                    <button
                      type="button"
                      onClick={() => select(deckKey)}
                      className={`group flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
                        deckSelected
                          ? "border-accent-gold-dim bg-accent-gold/5"
                          : "border-border hover:border-border-accent hover:bg-surface-2"
                      }`}
                    >
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ background: deck.color }}
                      />
                      <div className="flex flex-1 items-baseline gap-2">
                        <span
                          className="font-display text-xl tracking-tight"
                          style={{ color: deck.color }}
                        >
                          {deck.name}
                        </span>
                        <span className="micro-caps text-text-dim">Deck note</span>
                      </div>
                      <span className="micro-caps text-text-dim">
                        {deck.tasks.length} {deck.tasks.length === 1 ? "card" : "cards"}
                      </span>
                      {deckSelected && (
                        <span className="text-xs text-accent-gold">✓</span>
                      )}
                    </button>

                    {/* Tasks — smaller, muted, indented */}
                    {deck.tasks.length > 0 && (
                      <ul className="mt-2 space-y-px pl-6">
                        {deck.tasks.map((task) => {
                          const taskKey = keyFor("task", task.id);
                          const taskSelected = taskKey === value;
                          return (
                            <li key={task.id}>
                              <button
                                type="button"
                                onClick={() => select(taskKey)}
                                className={`group flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold-dim ${
                                  taskSelected
                                    ? "bg-surface-2 text-foreground"
                                    : "text-text-secondary hover:bg-surface-2/60 hover:text-foreground"
                                }`}
                              >
                                <span
                                  className="size-1 shrink-0 rounded-full opacity-60"
                                  style={{ background: deck.color }}
                                />
                                <span className="flex-1 truncate font-serif">
                                  {task.name}
                                </span>
                                {task.tag && (
                                  <span className="micro-caps text-text-dim">
                                    {task.tag}
                                  </span>
                                )}
                                {taskSelected && (
                                  <span className="text-xs text-accent-gold">✓</span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// silence unused-var lint for re-exported types in dev iterations
export type _Internal = Journal;
export type _Task = Task;


/* ------------------------------------------------------------------ */
/* CONFIRM DIALOG                                                      */
/* ------------------------------------------------------------------ */

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm fade-in"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="card-soft mx-4 w-full max-w-sm border border-border p-6"
      >
        <div className="font-display text-lg leading-tight">{title}</div>
        <div className="mt-2 text-sm text-text-secondary">{message}</div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="micro-caps rounded-md border border-border px-3 py-1.5 text-text-secondary transition-colors hover:border-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="micro-caps rounded-md border border-accent-gold-dim bg-accent-gold-dim/30 px-4 py-1.5 text-accent-gold transition-colors hover:bg-accent-gold hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* UNDO TOAST                                                          */
/* ------------------------------------------------------------------ */

function UndoToast({
  count,
  label,
  onUndo,
  onDismiss,
}: {
  count: number;
  label?: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 fade-in">
      <div className="card-soft edge-soft flex items-center gap-4 border border-border px-4 py-2.5">
        <span className="micro-caps text-text-secondary">
          {label ?? `Removed ${count} card${count === 1 ? "" : "s"}`}
        </span>
        <button
          onClick={onUndo}
          className="micro-caps rounded-md border border-accent-gold-dim px-3 py-1 text-accent-gold transition-colors hover:bg-accent-gold-dim/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
        >
          Undo
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-text-dim transition-colors hover:text-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DECK + TASK FORM MODALS                                             */
/* ------------------------------------------------------------------ */

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="card-soft w-full max-w-md border border-border bg-surface-1 p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="micro-caps text-text-dim">{subtitle ?? "Zenith"}</div>
            <div className="font-display mt-1 text-2xl leading-tight">{title}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-dim transition-colors hover:text-foreground"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DeckFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: Deck | null;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const editing = !!initial;
  return (
    <ModalShell
      title={editing ? "Rename deck" : "New deck"}
      subtitle={editing ? "Edit" : "Create"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}
        className="space-y-4"
      >
        <label className="block">
          <span className="micro-caps text-text-dim">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Deep Work"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm focus:border-accent-gold-dim focus:outline-none"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="micro-caps rounded-md border border-border px-3 py-1.5 text-text-secondary hover:border-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="micro-caps rounded-md border border-accent-gold-dim bg-accent-gold-dim/30 px-4 py-1.5 text-accent-gold hover:bg-accent-gold hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editing ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function TaskFormModal({
  deckName,
  initial,
  onClose,
  onSubmit,
}: {
  deckName: string;
  initial: Task | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; tag: string; mode: TimerMode; targetSeconds?: number }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [mode, setMode] = useState<TimerMode>(initial?.mode ?? "stopwatch");
  const [minutes, setMinutes] = useState<string>(
    initial?.targetSeconds ? String(Math.round(initial.targetSeconds / 60)) : "25",
  );
  const editing = !!initial;
  const modeLocked = editing && !!initial?.mode;
  return (
    <ModalShell
      title={editing ? "Edit card" : "New card"}
      subtitle={deckName}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const mins = Math.max(1, Math.min(24 * 60, parseInt(minutes, 10) || 25));
          onSubmit({
            name: name.trim(),
            tag: tag.trim(),
            mode,
            targetSeconds: mode === "countdown" ? mins * 60 : undefined,
          });
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="micro-caps text-text-dim">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What are you working on?"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm focus:border-accent-gold-dim focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="micro-caps text-text-dim">Tag</span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Dev · Research · Read…"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm focus:border-accent-gold-dim focus:outline-none"
          />
        </label>
        <div>
          <div className="micro-caps mb-1.5 text-text-dim">Timer</div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode("stopwatch")}
              disabled={modeLocked && initial?.mode !== "stopwatch"}
              className={`micro-caps flex-1 rounded-md border px-2 py-2 transition-colors ${
                mode === "stopwatch"
                  ? "border-accent-gold-dim text-foreground"
                  : "border-border text-text-secondary hover:border-border-accent"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Stopwatch
            </button>
            <button
              type="button"
              onClick={() => setMode("countdown")}
              disabled={modeLocked && initial?.mode !== "countdown"}
              className={`micro-caps flex-1 rounded-md border px-2 py-2 transition-colors ${
                mode === "countdown"
                  ? "border-accent-gold-dim text-foreground"
                  : "border-border text-text-secondary hover:border-border-accent"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Countdown
            </button>
          </div>
          {modeLocked && (
            <div className="micro-caps mt-1.5 text-text-dim">Timer mode is locked after creation.</div>
          )}
          {mode === "countdown" && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-24 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm focus:border-accent-gold-dim focus:outline-none"
              />
              <span className="micro-caps text-text-dim">minutes</span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="micro-caps rounded-md border border-border px-3 py-1.5 text-text-secondary hover:border-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="micro-caps rounded-md border border-accent-gold-dim bg-accent-gold-dim/30 px-4 py-1.5 text-accent-gold hover:bg-accent-gold hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editing ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/* TUTORIAL                                                            */
/* ------------------------------------------------------------------ */

const TUTORIAL_STEPS: Array<{ title: string; body: string; kanji: string; image?: string; caption?: string }> = [
  {
    kanji: "始",
    title: "Welcome to Zenith",
    body: "Zenith is a deliberate practice timer. Build decks of work, focus one card at a time, and reflect in markdown. Everything lives locally on your device — no account, no cloud.",
    image: tutorialDecks,
    caption: "The Decks view — your projects, cards, and timers at a glance.",
  },
  {
    kanji: "札",
    title: "Decks & Cards",
    body: "A deck is a project. A card is a single repeating focus — a study session, a lab, a build. Click + New Deck on the left, then + Add Card. Each card opens in a modal so you can name, tag, and pick stopwatch or countdown.",
    image: tutorialDecks,
    caption: "Two seeded decks — Academics and Projects — with three cards each.",
  },
  {
    kanji: "時",
    title: "Run a session",
    body: "Tap Start on any card to begin its timer. Tap Stop in the bottom bar to log the session. Hold ⌘/Ctrl-click to select multiple cards across decks and run them as a group.",
    image: tutorialHistory,
    caption: "Logged sessions stack into History, grouped by day.",
  },
  {
    kanji: "禅",
    title: "Focus & Zen",
    body: "Focus is a full-screen stopwatch with everything else hidden. Zen layers your timer over a wallpaper with a rotating quote. Tap ⚙ Customize Zen to swap quote packs (Musashi, Bible, Stoic, Zen) and pick wallpapers by category — Pastel, Gradient, Unsplash, Curated, or your own imports.",
    image: tutorialZen,
    caption: "Zen mode — kanji + a contextual greeting + a rotating verse.",
  },
  {
    kanji: "墨",
    title: "Journal",
    body: "Every deck and every card has exactly one journal. Open it from the card or the Journal tab, write in markdown, and it autosaves like a notes app. Switch Edit / Split / Preview to see your rendered notes.",
    image: tutorialJournal,
    caption: "Markdown editor with live split preview — autosaves silently.",
  },
  {
    kanji: "巻",
    title: "History",
    body: "Sessions stack up under History, grouped by day. Click the journal icon next to any log to jump into the matching entry. Delete one with ✕ on hover.",
    image: tutorialHistory,
    caption: "Your week in focus — every logged session, grouped by day.",
  },
];

function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep((s) => Math.min(TUTORIAL_STEPS.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const s = TUTORIAL_STEPS[step];
  const last = step === TUTORIAL_STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="card-soft w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-border bg-surface-1 p-8"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="micro-caps text-text-dim">Step {step + 1} of {TUTORIAL_STEPS.length}</div>
          <button onClick={onClose} className="micro-caps text-text-secondary hover:text-foreground">× Skip</button>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="font-jp text-5xl text-accent-gold">{s.kanji}</div>
          <h2 className="font-display mt-4 text-3xl">{s.title}</h2>
          <p className="font-serif mt-3 max-w-prose text-[15px] leading-[1.8] text-text-secondary">{s.body}</p>
        </div>
        {s.image && (
          <figure className="mt-6">
            <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
              <img
                src={s.image}
                alt={s.title}
                className="block w-full"
                loading="lazy"
              />
            </div>
            {s.caption && (
              <figcaption className="micro-caps mt-2 text-center text-text-dim">{s.caption}</figcaption>
            )}
          </figure>
        )}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setStep((v) => Math.max(0, v - 1))}
            disabled={step === 0}
            className="micro-caps rounded-md border border-border px-3 py-1.5 text-text-secondary hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← Back
          </button>
          <div className="flex gap-1.5">
            {TUTORIAL_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-accent-gold" : "w-1.5 bg-border hover:bg-text-dim"}`}
              />
            ))}
          </div>
          {last ? (
            <button
              onClick={onClose}
              className="micro-caps rounded-md border border-accent-gold-dim bg-accent-gold-dim/30 px-4 py-1.5 text-accent-gold hover:bg-accent-gold hover:text-primary-foreground"
            >
              Begin →
            </button>
          ) : (
            <button
              onClick={() => setStep((v) => Math.min(TUTORIAL_STEPS.length - 1, v + 1))}
              className="micro-caps rounded-md border border-accent-gold-dim bg-accent-gold-dim/30 px-4 py-1.5 text-accent-gold hover:bg-accent-gold hover:text-primary-foreground"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

