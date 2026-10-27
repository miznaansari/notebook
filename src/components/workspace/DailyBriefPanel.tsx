"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListTodo,
  Lock,
  PenLine,
  RotateCcw,
  Save,
  AlertCircle,
  LayoutTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownLiveEditor, MD_TASK_PREFIX, type MarkdownEditorHandle } from "./MarkdownLiveEditor";
import {
  DAILY_BRIEF_TEMPLATE,
  addDays,
  formatBriefDate,
  fromDateKey,
  openTaskLines,
  summarizeBrief,
  toDateKey,
  type DailyBriefSummary,
} from "@/lib/daily-brief";

// Today's date key, kept current across midnight and when a suspended tab (phones) comes back
export function useTodayKey() {
  const [todayKey, setTodayKey] = React.useState(() => toDateKey(new Date()));

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, nextMidnight.getTime() - now.getTime() + 500);
    };
    const refresh = () => {
      clearTimeout(timer);
      setTodayKey(toDateKey(new Date()));
      scheduleMidnight();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    scheduleMidnight();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return todayKey;
}

interface DailyBriefPanelProps {
  projectId: string;
  todayKey: string;
  // Days that have a brief, newest first; null while the index is loading
  briefs: DailyBriefSummary[] | null;
  onSummaryChange: (date: string, summary: DailyBriefSummary | null) => void;
  onBack?: () => void;
  className?: string;
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

const ROLLER_DAYS_BACK = 60;
const WEEKDAYS_MON_FIRST = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function DailyBriefPanel({
  projectId,
  todayKey,
  briefs,
  onSummaryChange,
  onBack,
  className,
}: DailyBriefPanelProps) {
  // null = follow today, so the brief rolls over to a fresh page when the date changes
  const [pinnedDate, setPinnedDate] = React.useState<string | null>(null);
  const viewDate = pinnedDate ?? todayKey;
  const isToday = viewDate === todayKey;

  // Loaded brief contents by date (also the edit buffer)
  const [docs, setDocs] = React.useState<Record<string, string>>({});
  const docsRef = React.useRef(docs);
  React.useLayoutEffect(() => {
    docsRef.current = docs;
  });
  const [failedDate, setFailedDate] = React.useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const [unlockedDate, setUnlockedDate] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("saved");
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isCarryingOver, setIsCarryingOver] = React.useState(false);

  const editorRef = React.useRef<MarkdownEditorHandle>(null);
  const pendingSaveRef = React.useRef<{ date: string; content: string } | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const briefDates = React.useMemo(() => new Set((briefs ?? []).map((b) => b.date)), [briefs]);
  const isKnownEmpty = briefs !== null && !briefDates.has(viewDate);
  const content: string | undefined = docs[viewDate] ?? (isKnownEmpty ? "" : undefined);
  const readOnly = !isToday && unlockedDate !== viewDate;

  // Load the selected day (skipped when cached or when the index says the day has no brief)
  React.useEffect(() => {
    if (docsRef.current[viewDate] !== undefined || isKnownEmpty) return;
    const controller = new AbortController();
    fetch(`/api/projects/${projectId}/daily-briefs/${viewDate}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        setDocs((prev) =>
          prev[viewDate] !== undefined ? prev : { ...prev, [viewDate]: data.brief?.content ?? "" }
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedDate(viewDate);
      });
    return () => controller.abort();
  }, [projectId, viewDate, isKnownEmpty, reloadNonce]);

  const flushSave = React.useCallback(
    async (keepalive = false) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const pending = pendingSaveRef.current;
      if (!pending) return;
      pendingSaveRef.current = null;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/projects/${projectId}/daily-briefs/${pending.date}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: pending.content }),
          keepalive,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        onSummaryChange(
          pending.date,
          pending.content.trim() ? summarizeBrief(pending.date, pending.content) : null
        );
        if (!pendingSaveRef.current) setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save daily brief:", err);
        // Keep the edit queued so the next save (or a click on the status badge) retries it
        if (!pendingSaveRef.current) pendingSaveRef.current = pending;
        setSaveStatus("error");
      }
    },
    [projectId, onSummaryChange]
  );

  // Write pending edits when leaving the brief, the tab, or the page
  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushSave(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flushSave(true);
    };
  }, [flushSave]);

  const updateContent = (value: string) => {
    if (pendingSaveRef.current && pendingSaveRef.current.date !== viewDate) {
      flushSave();
    }
    setDocs((prev) => ({ ...prev, [viewDate]: value }));
    pendingSaveRef.current = { date: viewDate, content: value };
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushSave(), 800);
  };

  const goToDate = (date: string) => {
    if (date > todayKey || date === viewDate) return;
    flushSave();
    setFailedDate(null);
    setPinnedDate(date === todayKey ? null : date);
  };

  const toggleTaskAt = (lineStart: number) => {
    if (readOnly || content === undefined) return;
    const lineEndIdx = content.indexOf("\n", lineStart);
    const lineEnd = lineEndIdx === -1 ? content.length : lineEndIdx;
    const line = content.substring(lineStart, lineEnd);
    const task = line.match(MD_TASK_PREFIX);
    if (!task) return;
    const isChecked = task[3] === "x" || task[3] === "X";
    const newLine = task[1] + (isChecked ? "- [ ] " : "- [x] ") + line.substring(task[0].length);
    updateContent(content.substring(0, lineStart) + newLine + content.substring(lineEnd));
  };

  const placeCaret = (pos: number) => {
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(pos, pos);
    });
  };

  const applyTemplate = () => {
    updateContent(DAILY_BRIEF_TEMPLATE);
    placeCaret(DAILY_BRIEF_TEMPLATE.indexOf("- [ ] ") + 6);
  };

  // Most recent earlier brief that still has unchecked tasks, offered on an empty today
  const carryOverSource = isToday
    ? (briefs ?? []).find((b) => b.date < todayKey && b.tasksTotal > b.tasksDone)
    : undefined;

  const carryOverOpenTasks = async () => {
    if (!carryOverSource) return;
    setIsCarryingOver(true);
    try {
      let source = docsRef.current[carryOverSource.date];
      if (source === undefined) {
        const res = await fetch(`/api/projects/${projectId}/daily-briefs/${carryOverSource.date}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        source = ((await res.json()).brief?.content as string | undefined) ?? "";
        setDocs((prev) => ({ ...prev, [carryOverSource.date]: source! }));
      }
      const lines = openTaskLines(source);
      if (lines.length === 0) return;
      const heading = `## Carried over from ${formatBriefDate(carryOverSource.date, "short")}`;
      const next = `${heading}\n${lines.join("\n")}\n\n${content ?? ""}`.trimEnd() + "\n";
      updateContent(next);
      placeCaret(next.length);
    } catch (err) {
      console.error("Failed to carry over tasks:", err);
    } finally {
      setIsCarryingOver(false);
    }
  };

  const todaySummary = content ? summarizeBrief(viewDate, content) : null;
  const relativeLabel = isToday ? "Today" : viewDate === addDays(todayKey, -1) ? "Yesterday" : null;

  return (
    <div className={cn("flex-1 flex-col bg-white overflow-hidden relative", className)}>
      {/* Header */}
      <div className="px-2.5 sm:px-4 pt-2.5 sm:pt-4 pb-2 border-b-2 border-gray-200 bg-white shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="lg:hidden flex items-center gap-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 p-1.5 sm:px-2.5 sm:py-1.5 rounded-md transition cursor-pointer shrink-0"
                title="Back to notes list"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Notes</span>
              </button>
            )}
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-[#3B82F6] flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-extrabold text-gray-900 leading-tight truncate">
                Daily Brief
              </h2>
              <p className="text-xs font-semibold text-gray-500 truncate">
                {relativeLabel && <span className="text-[#3B82F6]">{relativeLabel} · </span>}
                {formatBriefDate(viewDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <SaveBadge status={saveStatus} onRetry={() => flushSave()} />
            {!isToday && (
              <button
                type="button"
                onClick={() => goToDate(todayKey)}
                className="h-8 px-2.5 rounded-md bg-blue-50 text-[#3B82F6] hover:bg-blue-100 text-xs font-bold transition cursor-pointer"
              >
                Today
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCalendarOpen((open) => !open)}
                aria-haspopup="dialog"
                aria-expanded={isCalendarOpen}
                title="Pick a date"
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-md border-2 transition cursor-pointer",
                  isCalendarOpen
                    ? "border-[#3B82F6] bg-blue-50 text-[#3B82F6]"
                    : "border-gray-200 text-gray-600 hover:border-[#3B82F6] hover:text-[#3B82F6]"
                )}
              >
                <CalendarDays className="w-4 h-4" />
              </button>
              {isCalendarOpen && (
                <BriefCalendar
                  todayKey={todayKey}
                  selected={viewDate}
                  briefDates={briefDates}
                  onSelect={(date) => {
                    goToDate(date);
                    setIsCalendarOpen(false);
                  }}
                  onClose={() => setIsCalendarOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        <DateRoller
          todayKey={todayKey}
          selected={viewDate}
          briefDates={briefDates}
          onSelect={goToDate}
        />
      </div>

      {/* Past day banner */}
      {!isToday && content !== undefined && content !== "" && (
        <div
          className={cn(
            "px-3 sm:px-4 py-1.5 border-b flex items-center justify-between gap-2 text-xs font-semibold shrink-0",
            readOnly ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-blue-50 border-blue-100 text-blue-900"
          )}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            {readOnly ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <PenLine className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{readOnly ? "Past brief · read-only" : "Editing a past brief"}</span>
          </span>
          <button
            type="button"
            onClick={() => setUnlockedDate(readOnly ? viewDate : null)}
            className="px-2 py-0.5 rounded bg-white/80 hover:bg-white border border-current/20 font-bold transition cursor-pointer shrink-0"
          >
            {readOnly ? "Edit" : "Done"}
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col p-2 sm:p-6 relative overflow-hidden bg-white">
        {content === undefined ? (
          failedDate === viewDate ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm font-bold text-gray-700">Couldn&apos;t load this brief</p>
              <button
                type="button"
                onClick={() => {
                  setFailedDate(null);
                  setReloadNonce((n) => n + 1);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#3B82F6] text-white text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          ) : (
            <div className="flex-1 rounded-xl bg-[#F8FAFC] p-5 space-y-3 animate-pulse" aria-busy="true">
              <div className="h-6 w-1/3 rounded bg-gray-200" />
              <div className="h-3.5 w-3/4 rounded bg-gray-200" />
              <div className="h-3.5 w-2/3 rounded bg-gray-200" />
              <div className="h-3.5 w-1/2 rounded bg-gray-200" />
            </div>
          )
        ) : readOnly && content === "" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-6 rounded-xl bg-[#F8FAFC]">
            <CalendarDays className="w-9 h-9 text-gray-300" />
            <p className="text-sm font-bold text-gray-700">No brief on {formatBriefDate(viewDate, "short")}</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Pick a highlighted day in the roller or calendar to read past briefs.
            </p>
            <button
              type="button"
              onClick={() => setUnlockedDate(viewDate)}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 border-gray-200 text-xs font-bold text-gray-700 hover:border-[#3B82F6] hover:text-[#3B82F6] transition cursor-pointer"
            >
              <PenLine className="w-3.5 h-3.5" />
              Write one for this day
            </button>
          </div>
        ) : (
          <>
            {isToday && content === "" && (
              <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                <button
                  type="button"
                  onClick={applyTemplate}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-50 text-[#3B82F6] hover:bg-blue-100 text-xs font-bold transition cursor-pointer"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  Start from template
                </button>
                {carryOverSource && (
                  <button
                    type="button"
                    onClick={carryOverOpenTasks}
                    disabled={isCarryingOver}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold transition cursor-pointer disabled:opacity-60"
                  >
                    <ListTodo className="w-3.5 h-3.5" />
                    Carry over {carryOverSource.tasksTotal - carryOverSource.tasksDone} open task
                    {carryOverSource.tasksTotal - carryOverSource.tasksDone === 1 ? "" : "s"} from{" "}
                    {formatBriefDate(carryOverSource.date, "short")}
                  </button>
                )}
              </div>
            )}
            <div
              className={cn(
                "flex-1 min-h-0 overflow-hidden rounded-xl border-2 transition-colors",
                readOnly
                  ? "bg-[#F8FAFC] border-transparent"
                  : "bg-[#F8FAFC] border-transparent focus-within:bg-white focus-within:border-[#3B82F6]"
              )}
            >
              <MarkdownLiveEditor
                key={viewDate}
                handleRef={editorRef}
                value={content}
                onChange={updateContent}
                onToggleTask={toggleTaskAt}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                    e.preventDefault();
                    flushSave();
                  }
                }}
                readOnly={readOnly}
                withHistory
                placeholder={
                  isToday
                    ? "What's the plan for today?\n\n# Heading · - [ ] task · - bullet"
                    : "Write the brief for this day..."
                }
                className="md-live-editor h-full font-sans text-sm"
              />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 md:px-6 py-2 bg-[#F3F4F6] border-t-2 border-gray-200 flex items-center justify-between gap-3 text-xs font-bold text-gray-500 shrink-0">
        <span>
          {todaySummary && todaySummary.tasksTotal > 0
            ? `${todaySummary.tasksDone}/${todaySummary.tasksTotal} tasks done`
            : isToday
              ? "A fresh page every day"
              : formatBriefDate(viewDate, "short")}
        </span>
        <span className="text-gray-400">
          {briefs === null ? "" : `${briefs.length} ${briefs.length === 1 ? "brief" : "briefs"} in history`}
        </span>
      </div>
    </div>
  );
}

function SaveBadge({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={status === "error" || status === "unsaved" ? onRetry : undefined}
      title={status === "error" ? "Couldn't save. Click to retry" : status === "unsaved" ? "Save now (Ctrl+S)" : undefined}
      className={cn(
        "text-[11px] sm:text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-md select-none transition shrink-0",
        status === "saved" && "bg-emerald-50 text-emerald-800 cursor-default",
        status === "saving" && "bg-blue-50 text-blue-800 cursor-default",
        status === "unsaved" && "bg-amber-50 text-amber-900 hover:bg-amber-100 cursor-pointer",
        status === "error" && "bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
      )}
    >
      {status === "saved" && <Check className="w-3.5 h-3.5 text-[#10B981]" strokeWidth={3} />}
      {status === "saving" && <Clock className="w-3.5 h-3.5 text-[#3B82F6] animate-spin" />}
      {status === "unsaved" && <Save className="w-3.5 h-3.5 text-[#F59E0B]" />}
      {status === "error" && <AlertCircle className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">
        {status === "saved" ? "Saved" : status === "saving" ? "Saving..." : status === "unsaved" ? "Save" : "Retry"}
      </span>
    </button>
  );
}

// Horizontal strip of days ending today. Swipe or use the arrows / arrow keys to move through history.
function DateRoller({
  todayKey,
  selected,
  briefDates,
  onSelect,
}: {
  todayKey: string;
  selected: string;
  briefDates: Set<string>;
  onSelect: (date: string) => void;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const hasScrolledRef = React.useRef(false);

  const days = React.useMemo(() => {
    const defaultStart = addDays(todayKey, -(ROLLER_DAYS_BACK - 1));
    const selectedStart = addDays(selected, -10);
    let cursor = selectedStart < defaultStart ? selectedStart : defaultStart;
    const list: string[] = [];
    while (cursor <= todayKey) {
      list.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return list;
  }, [todayKey, selected]);

  // Keep the selected day centered: smoothly when it changes, instantly when the strip is resized
  // (first layout, rotation, or becoming visible after being hidden on phones)
  const centerSelected = React.useCallback(
    (behavior: ScrollBehavior) => {
      const scroller = scrollerRef.current;
      const chip = scroller?.querySelector<HTMLElement>(`[data-date="${selected}"]`);
      if (!scroller || !chip || scroller.clientWidth === 0) return false;
      scroller.scrollTo({ left: chip.offsetLeft - scroller.clientWidth / 2 + chip.offsetWidth / 2, behavior });
      return true;
    },
    [selected]
  );

  React.useLayoutEffect(() => {
    if (centerSelected(hasScrolledRef.current ? "smooth" : "instant")) hasScrolledRef.current = true;
  }, [centerSelected, days]);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let lastWidth = scroller.clientWidth;
    const observer = new ResizeObserver(() => {
      if (scroller.clientWidth !== lastWidth) {
        lastWidth = scroller.clientWidth;
        centerSelected("instant");
      }
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [centerSelected]);

  const step = (delta: number) => {
    const next = addDays(selected, delta);
    if (next <= todayKey) onSelect(next);
  };

  return (
    <div className="mt-2.5 flex items-center gap-1">
      <button
        type="button"
        onClick={() => step(-1)}
        title="Previous day"
        className="h-12 w-7 shrink-0 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        ref={scrollerRef}
        role="listbox"
        aria-label="Daily brief history"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          }
        }}
        className="relative flex-1 min-w-0 flex items-end gap-1 overflow-x-auto no-scrollbar outline-none snap-x"
      >
        {days.map((date, idx) => {
          const d = fromDateKey(date);
          const isSelected = date === selected;
          const isToday = date === todayKey;
          const hasBrief = briefDates.has(date);
          const showMonth = idx === 0 || d.getDate() === 1;
          return (
            <div key={date} className="flex flex-col items-center shrink-0 snap-center">
              <span className="h-3.5 text-[9px] font-extrabold uppercase tracking-wider text-gray-400 leading-none">
                {showMonth ? d.toLocaleDateString(undefined, { month: "short" }) : ""}
              </span>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                data-date={date}
                onClick={() => onSelect(date)}
                title={formatBriefDate(date)}
                className={cn(
                  "w-11 h-12 flex flex-col items-center justify-center rounded-xl transition cursor-pointer",
                  isSelected
                    ? "bg-[#3B82F6] text-white shadow-sm shadow-blue-500/30"
                    : isToday
                      ? "text-[#3B82F6] ring-2 ring-inset ring-blue-200 hover:bg-blue-50"
                      : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <span className={cn("text-[10px] font-bold uppercase leading-none", !isSelected && "text-gray-400")}>
                  {d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}
                </span>
                <span className="text-[15px] font-extrabold leading-tight">{d.getDate()}</span>
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    hasBrief ? (isSelected ? "bg-white" : "bg-[#3B82F6]") : "bg-transparent"
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => step(1)}
        disabled={selected >= todayKey}
        title="Next day"
        className="h-12 w-7 shrink-0 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// Month calendar for jumping anywhere in history; days with a brief are marked
function BriefCalendar({
  todayKey,
  selected,
  briefDates,
  onSelect,
  onClose,
}: {
  todayKey: string;
  selected: string;
  briefDates: Set<string>;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [month, setMonth] = React.useState(() => {
    const d = fromDateKey(selected);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const trigger = panelRef.current?.parentElement;
      if (trigger && !trigger.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const today = fromDateKey(todayKey);
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const leadingBlanks = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, i) =>
    toDateKey(new Date(month.getFullYear(), month.getMonth(), i + 1))
  );
  const briefsThisMonth = monthDates.filter((date) => briefDates.has(date)).length;

  const shiftMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Pick a date"
      className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl border-2 border-gray-200 shadow-xl p-3 select-none"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          title="Previous month"
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-extrabold text-gray-900">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={isCurrentMonth}
          title="Next month"
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS_MON_FIRST.map((day) => (
          <span key={day} className="text-[10px] font-extrabold uppercase text-gray-400 py-1">
            {day}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {monthDates.map((date) => {
          const isFuture = date > todayKey;
          const isSelected = date === selected;
          const isToday = date === todayKey;
          const hasBrief = briefDates.has(date);
          return (
            <button
              key={date}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(date)}
              className={cn(
                "relative h-9 rounded-lg text-xs transition cursor-pointer disabled:cursor-not-allowed",
                isSelected
                  ? "bg-[#3B82F6] text-white font-extrabold"
                  : isFuture
                    ? "text-gray-300"
                    : hasBrief
                      ? "text-gray-900 font-extrabold hover:bg-blue-50"
                      : "text-gray-500 font-medium hover:bg-gray-100",
                isToday && !isSelected && "ring-2 ring-inset ring-blue-200 text-[#3B82F6]"
              )}
            >
              {fromDateKey(date).getDate()}
              {hasBrief && (
                <span
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 bottom-1 w-1 h-1 rounded-full",
                    isSelected ? "bg-white" : "bg-[#3B82F6]"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-500">
        <span>
          {briefsThisMonth} {briefsThisMonth === 1 ? "brief" : "briefs"} this month
        </span>
        <button
          type="button"
          onClick={() => onSelect(todayKey)}
          className="px-2 py-1 rounded-md text-[#3B82F6] hover:bg-blue-50 font-bold transition cursor-pointer"
        >
          Today
        </button>
      </div>
    </div>
  );
}
