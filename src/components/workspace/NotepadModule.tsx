"use client";

import * as React from "react";
import {
  Plus,
  Pin,
  Trash2,
  Copy,
  Download,
  Check,
  Eye,
  Edit3,
  Bold,
  Italic,
  List,
  ListOrdered,
  CheckSquare,
  Square,
  Code,
  Heading1,
  Heading2,
  Heading3,
  FileText,
  Clock,
  Sparkles,
  Tag,
  Save,
  Languages,
  Briefcase,
  CheckCheck,
  Smile,
  Loader2,
  Undo2,
  Redo2,
  Quote,
  Minus,
  Lightbulb,
  Highlighter,
  Strikethrough,
  Search,
  Scissors,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Mail,
  Zap,
  Play,
  Send,
  ListCheck,
  PenTool,
  CornerDownLeft,
  WandSparkles,
  CalendarDays,
  History,
  Link2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { AIMagicButton } from "@/components/ui/ai-magic-button";
import { AiActionMenu, type AiMenuEntry, type AiMenuGroup } from "@/components/ui/ai-action-menu";
import { MarkdownLiveEditor, MD_TASK_PREFIX, type MarkdownEditorHandle } from "./MarkdownLiveEditor";
import { getLastNoteId, setLastNoteId } from "@/lib/last-open";
import { DailyBriefPanel, useTodayKey } from "./DailyBriefPanel";
import { formatBriefDate, type DailyBriefSummary } from "@/lib/daily-brief";
import { extractNoteLinkTitles, isDefaultNoteTitle, normalizeNoteTitle, relinkNoteTitle } from "@/lib/note-links";
import { NoteLinkPicker, type PickerAnchor } from "./NoteLinkPicker";
import { VoiceMicButton } from "@/components/ui/voice-mic-button";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  description?: string | null;
  isPinned: boolean;
  tags?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotepadModuleProps {
  projectId: string;
  notes: NoteItem[];
  tasks?: any[];
  onNotesChange: (updatedNotes: NoteItem[]) => void;
  onTasksChange?: (updatedTasks: any[]) => void;
  onNavigateToTab?: (tab: any) => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
  lineIdx?: number;
  lineType?: string;
  isChecked?: boolean;
  multiLineStart?: number;
  multiLineEnd?: number;
}

interface SlashMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  filterText: string;
  selectedIndex: number;
  slashStartPos: number;
}

interface FloatingBubbleState {
  isOpen: boolean;
  // Viewport coordinates of the selection the toolbar points at
  anchorX: number;
  anchorTop: number;
  anchorBottom: number;
  selectedText: string;
  start: number;
  end: number;
}

// AI submenus shared by the right-click selection menu and the per-task AI menu
const TRANSLATE_MENU: AiMenuGroup = {
  id: "translate",
  label: "Translate",
  icon: Languages,
  items: [
    { id: "hinglish_to_english", label: "Hinglish → English", hint: "Hindi/Hinglish to standard English", icon: Languages },
    { id: "english_to_hinglish", label: "English → Hinglish", hint: "English to natural conversational Hinglish", icon: Languages },
  ],
};

const REWRITE_MENU: AiMenuGroup = {
  id: "rewrite",
  label: "Rewrite",
  icon: WandSparkles,
  items: [
    { id: "grammar", label: "Fix grammar & spelling", hint: "Fix typos, tense & sentence flow", icon: CheckCheck },
    { id: "professional", label: "Professional tone", hint: "Formal executive business tone", icon: Briefcase },
    { id: "english_to_simple", label: "Simplify for client", hint: "Easy, crystal clear explanation", icon: Smile },
    { id: "make_short", label: "Make shorter", hint: "Short, concise & punchy", icon: Scissors },
  ],
};

const SELECTION_MENU: AiMenuEntry[] = [
  TRANSLATE_MENU,
  REWRITE_MENU,
  { id: "summarize", label: "Summarize", hint: "Crisp bullet points summary", icon: FileText },
  "divider",
  { id: "convert_to_checkbox", label: "Convert to task", hint: "Turn into an interactive - [ ] task", icon: CheckSquare },
  { id: "execute_task", label: "Generate deliverable", hint: "Email draft, template, or code", icon: Sparkles },
];

const taskMenuEntries = (isEmailTask: boolean): AiMenuEntry[] => [
  TRANSLATE_MENU,
  REWRITE_MENU,
  "divider",
  isEmailTask
    ? { id: "execute_task", label: "Draft email", hint: "Full email template with subject & body", icon: Mail }
    : { id: "execute_task", label: "Generate deliverable", hint: "Draft AI solution or template", icon: Sparkles },
];

// Where a picked [[note link]] goes: a range of the raw markdown, or of one Interactive-view line's visible text
type LinkInsertTarget =
  | { mode: "markdown"; from: number; to: number }
  | { mode: "interactive"; lineIdx: number; from: number; to: number };

// Length of the markdown prefix the Interactive view hides on a line (mirrors renderInteractiveDocument);
// null for lines whose visible text doesn't map onto the raw line (/--checkbox syntax, dividers)
function interactivePrefixLength(line: string): number | null {
  if (line.startsWith("# ")) return 2;
  if (line.startsWith("## ")) return 3;
  if (line.startsWith("### ")) return 4;
  const task = line.match(/^(\s*)-\s*\[([ xX])?\]\s*/);
  if (task) return task[0].length;
  if (/^\s*\/--checkbox/i.test(line) || line.trim() === "---") return null;
  const bullet = line.match(/^(\s*)([-*•])\s+/);
  if (bullet) return bullet[0].length;
  if (line.startsWith("> ")) return 2;
  return 0;
}

// Stored as the "last open note" when the Daily Brief was open
const DAILY_BRIEF_ID = "__daily_brief__";


export function NotepadModule({
  projectId,
  notes,
  tasks = [],
  onNotesChange,
  onTasksChange,
  onNavigateToTab,
}: NotepadModuleProps) {
  // Reopen what the user last had open in this project: a note that still exists, or the
  // Daily Brief (also the default, since it's the first item in every project)
  const [isDailyBriefOpen, setIsDailyBriefOpen] = React.useState(() => {
    const lastNoteId = getLastNoteId(projectId);
    return !lastNoteId || lastNoteId === DAILY_BRIEF_ID || !notes.some((n) => n.id === lastNoteId);
  });
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(() => {
    const lastNoteId = getLastNoteId(projectId);
    if (lastNoteId && notes.some((n) => n.id === lastNoteId)) return lastNoteId;
    return notes.length > 0 ? notes[0].id : null;
  });
  const isDailyBriefOpenRef = React.useRef(isDailyBriefOpen);
  // Notes (or the Daily Brief) left by following a [[link]], for the "Back to ..." button
  const [linkBackStack, setLinkBackStack] = React.useState<string[]>([]);
  const [linkPicker, setLinkPicker] = React.useState<{
    anchor: PickerAnchor;
    target: LinkInsertTarget;
    initialQuery?: string;
  } | null>(null);
  React.useEffect(() => {
    isDailyBriefOpenRef.current = isDailyBriefOpen;
  }, [isDailyBriefOpen]);
  const [currentTitle, setCurrentTitle] = React.useState("");
  const [currentContent, setCurrentContent] = React.useState("");
  const [currentDescription, setCurrentDescription] = React.useState<string | null>(null);
  const [currentTags, setCurrentTags] = React.useState("");
  const [isPinned, setIsPinned] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "unsaved">("saved");
  const [viewMode, setViewMode] = React.useState<"interactive" | "markdown">("interactive");
  const [searchNotes, setSearchNotes] = React.useState("");
  const [mobileView, setMobileView] = React.useState<"list" | "editor">(
    isDailyBriefOpen || notes.length > 0 ? "editor" : "list"
  );

  // Daily Brief: index of days with a brief (null while loading), shared by the list card and the panel
  const todayKey = useTodayKey();
  const [briefIndex, setBriefIndex] = React.useState<DailyBriefSummary[] | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/projects/${projectId}/daily-briefs`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setBriefIndex(data.briefs);
      })
      .catch((err) => {
        if (!controller.signal.aborted) console.error("Failed to load daily briefs:", err);
      });
    return () => controller.abort();
  }, [projectId]);

  // Normalized titles that a [[link]] can resolve to
  const linkTitles = React.useMemo(
    () => new Set(notes.filter((n) => !isDefaultNoteTitle(n.title)).map((n) => normalizeNoteTitle(n.title))),
    [notes]
  );

  const handleBriefSummaryChange = React.useCallback((date: string, summary: DailyBriefSummary | null) => {
    setBriefIndex((prev) => {
      const rest = (prev ?? []).filter((b) => b.date !== date);
      return summary ? [...rest, summary].sort((a, b) => b.date.localeCompare(a.date)) : rest;
    });
  }, []);

  const handleOpenDailyBrief = () => {
    setIsDailyBriefOpen(true);
    setMobileView("editor");
  };

  // Multi-tier AI description generation tracking (15 words -> tier 1, 30 words -> tier 2, 50 words -> tier 3)
  const noteDescTiersRef = React.useRef<{ [noteId: string]: number }>({});
  const descAiTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isGeneratingDescRef = React.useRef(false);
  const latestDescriptionRef = React.useRef<string | null>(null);
  // Titles the AI wrote this session, so later tiers may refine them without touching user-typed titles
  const aiTitlesRef = React.useRef<{ [noteId: string]: string }>({});
  const [isGeneratingTitle, setIsGeneratingTitle] = React.useState(false);

  // Latest props for async callbacks and the unmount flush, which would otherwise see stale closures
  const notesRef = React.useRef(notes);
  const onNotesChangeRef = React.useRef(onNotesChange);
  React.useEffect(() => {
    notesRef.current = notes;
    onNotesChangeRef.current = onNotesChange;
  });

  // Undo / Redo history stack tracking
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);
  const historyRef = React.useRef<string[]>([]);
  const historyIndexRef = React.useRef<number>(-1);
  const typingTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Slash Command Menu State (Notion Style)
  const [slashMenu, setSlashMenu] = React.useState<SlashMenuState | null>(null);

  // Floating Selection Bubble Toolbar State
  const [bubbleToolbar, setBubbleToolbar] = React.useState<FloatingBubbleState | null>(null);

  // Context Menu State for Right-Click AI on selected text
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);
  const [isAiProcessingSelection, setIsAiProcessingSelection] = React.useState(false);
  const [activeAiAction, setActiveAiAction] = React.useState<string | null>(null);

  // Task AI Deliverable Modal State
  const [taskDeliverableModal, setTaskDeliverableModal] = React.useState<{
    isOpen: boolean;
    taskTitle: string;
    lineIndex?: number;
    deliverable: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    taskTitle: "",
    deliverable: "",
    isLoading: false,
  });
  const [isSyncingTasks, setIsSyncingTasks] = React.useState(false);
  const [isCreatingNote, setIsCreatingNote] = React.useState(false);
  const [executingTaskTitle, setExecutingTaskTitle] = React.useState<string | null>(null);
  const [executingLineIndex, setExecutingLineIndex] = React.useState<number | null>(null);
  const [activeTaskAiMenu, setActiveTaskAiMenu] = React.useState<{ lineIdx: number; taskText: string } | null>(null);
  const [taskAiLoadingIdx, setTaskAiLoadingIdx] = React.useState<number | null>(null);

  const markdownEditorRef = React.useRef<MarkdownEditorHandle>(null);
  const editorContainerRef = React.useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Line element refs, active cursor line ref, and pending focus tracking for seamless in-place formatting & navigation
  const lineInputRefs = React.useRef<{ [key: number]: HTMLTextAreaElement | HTMLInputElement | null }>({});
  const activeInteractiveLineRef = React.useRef<{ lineIdx: number; cursorPos: number }>({ lineIdx: 0, cursorPos: 0 });
  // Multi-Line Selection State in Interactive Mode
  const [selectedLineRange, setSelectedLineRange] = React.useState<{ start: number; end: number } | null>(null);
  const isMouseDownSelectingRef = React.useRef(false);
  const selectionStartLineRef = React.useRef<number | null>(null);
  const [pendingFocus, setPendingFocus] = React.useState<{ lineIdx: number; cursorPos?: number } | null>(null);

  // Refs to track absolute latest state without stale closure or prop-overwrite issues
  const latestContentRef = React.useRef("");
  const latestTitleRef = React.useRef("");
  const latestTagsRef = React.useRef("");
  const latestPinnedRef = React.useRef(false);
  const latestActiveIdRef = React.useRef<string | null>(null);
  const lastLoadedNoteIdRef = React.useRef<string | null>(null);
  const voiceBaseContentRef = React.useRef<string | null>(null);

  // Push snapshot into history stack (max 50 snapshots)
  const pushHistorySnapshot = React.useCallback((newContent: string) => {
    const currentHist = historyRef.current;
    const currentIndex = historyIndexRef.current;

    // Avoid duplicate adjacent states
    if (currentIndex >= 0 && currentHist[currentIndex] === newContent) {
      return;
    }

    const nextHist = [...currentHist.slice(0, currentIndex + 1), newContent];
    if (nextHist.length > 50) {
      nextHist.shift();
    }

    const nextIdx = nextHist.length - 1;
    historyRef.current = nextHist;
    historyIndexRef.current = nextIdx;
    setHistory(nextHist);
    setHistoryIndex(nextIdx);
  }, []);

  // Word count & Tier calculation helper (15 words -> Tier 1, 30 words -> Tier 2, 50 words -> Tier 3)
  const countWords = (text: string): number => {
    return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  };

  const getWordTier = (wordCount: number): 0 | 1 | 2 | 3 => {
    if (wordCount >= 50) return 3;
    if (wordCount >= 30) return 2;
    if (wordCount >= 15) return 1;
    return 0;
  };

  // Trigger AI to generate / refine the note description, and the title too while the note is
  // still unnamed (or still carries a title the AI wrote earlier). forceTitle renames regardless.
  const triggerAiNoteMetaGeneration = React.useCallback(
    async (
      noteId: string,
      title: string,
      content: string,
      targetTier: number,
      forceTitle = false
    ): Promise<string | null> => {
      if (!noteId || isGeneratingDescRef.current) return null;
      isGeneratingDescRef.current = true;
      const wantsTitle =
        forceTitle ||
        isDefaultNoteTitle(title) ||
        aiTitlesRef.current[noteId] === title;
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: wantsTitle ? "generate_note_meta" : "generate_note_description",
            text: content.slice(0, 3000),
            context: title || "Untitled Note",
          }),
        });
        if (!res.ok) return null;

        const data = await res.json();
        // generate_note_meta falls back to a raw string when the model's JSON can't be parsed; ignore that
        const meta =
          data.result && typeof data.result === "object"
            ? data.result
            : wantsTitle
              ? {}
              : { description: data.result };
        const generatedDesc = typeof meta.description === "string" ? meta.description.trim() : "";

        // Skip the AI title if the user typed their own while the request was running
        const titleNow =
          latestActiveIdRef.current === noteId
            ? latestTitleRef.current
            : notesRef.current.find((n) => n.id === noteId)?.title ?? title;
        const generatedTitle =
          wantsTitle && titleNow === title && typeof meta.title === "string"
            ? meta.title.trim().replace(/^["']|["']$/g, "")
            : "";

        if (!generatedDesc && !generatedTitle) return null;

        const patch: Partial<NoteItem> = {};
        if (generatedDesc) {
          noteDescTiersRef.current[noteId] = targetTier;
          patch.description = generatedDesc;
        }
        if (generatedTitle) {
          aiTitlesRef.current[noteId] = generatedTitle;
          patch.title = generatedTitle;
        }
        if (latestActiveIdRef.current === noteId) {
          if (generatedDesc) {
            setCurrentDescription(generatedDesc);
            latestDescriptionRef.current = generatedDesc;
          }
          if (generatedTitle) {
            setCurrentTitle(generatedTitle);
            latestTitleRef.current = generatedTitle;
          }
        }
        onNotesChange(notesRef.current.map((n) => (n.id === noteId ? { ...n, ...patch } : n)));
        const saveRes = await fetch(`/api/projects/${projectId}/notes/${noteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const relinked: { id: string; content: string }[] = saveRes.ok ? (await saveRes.json()).relinkedNotes ?? [] : [];
        if (relinked.length > 0 && generatedTitle) {
          const byId = new Map(relinked.map((n) => [n.id, n.content]));
          const openId = latestActiveIdRef.current;
          if (openId && byId.has(openId)) {
            const relinkedLive = relinkNoteTitle(latestContentRef.current, title, generatedTitle);
            setCurrentContent(relinkedLive);
            latestContentRef.current = relinkedLive;
            byId.set(openId, relinkedLive);
          }
          onNotesChange(notesRef.current.map((n) => (byId.has(n.id) ? { ...n, content: byId.get(n.id)! } : n)));
        }
        return generatedTitle || null;
      } catch (err) {
        console.error("Auto note title/description generation failed:", err);
        return null;
      } finally {
        isGeneratingDescRef.current = false;
      }
    },
    [projectId, onNotesChange]
  );

  // Check word count tier and handle reset on erase or trigger on word thresholds
  const checkAutoDescriptionTier = React.useCallback(
    (noteId: string, title: string, content: string) => {
      if (!noteId) return;
      const words = countWords(content);
      const tier = getWordTier(words);
      const lastTier = noteDescTiersRef.current[noteId] || 0;

      // If dropped below 15 words: clear old description & reset tier to 0
      if (words < 15) {
        if (lastTier > 0 || latestDescriptionRef.current !== null) {
          noteDescTiersRef.current[noteId] = 0;
          latestDescriptionRef.current = null;
          setCurrentDescription(null);
          onNotesChange(
            notes.map((n) => (n.id === noteId ? { ...n, description: null } : n))
          );
        }
        if (descAiTimeoutRef.current) {
          clearTimeout(descAiTimeoutRef.current);
          descAiTimeoutRef.current = null;
        }
        return;
      }

      // If user erased words from a higher tier to a lower tier (e.g., from tier 3 to tier 1)
      if (tier < lastTier) {
        noteDescTiersRef.current[noteId] = tier;
      }

      // If user typed/re-typed and reached 15 words (tier 1), 30 words (tier 2), or 50 words (tier 3)
      if (tier > 0 && tier > (noteDescTiersRef.current[noteId] || 0)) {
        if (descAiTimeoutRef.current) {
          clearTimeout(descAiTimeoutRef.current);
        }
        descAiTimeoutRef.current = setTimeout(() => {
          triggerAiNoteMetaGeneration(noteId, title, content, tier);
        }, 1000);
      }
    },
    [notes, onNotesChange, triggerAiNoteMetaGeneration]
  );

  // Flush pending save immediately to server
  const saveNoteToServer = React.useCallback(
    async (
      noteId: string,
      title: string,
      content: string,
      tags: string,
      pinned: boolean,
      description?: string | null
    ) => {
      if (!noteId) return;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/projects/${projectId}/notes/${noteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || "Untitled Note",
            content,
            description: description !== undefined ? description : latestDescriptionRef.current,
            tags,
            isPinned: pinned,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSaveStatus("saved");
          const relinked = new Map<string, string>(
            (data.relinkedNotes ?? []).map((n: { id: string; content: string }) => [n.id, n.content])
          );
          onNotesChange(
            notes.map((n) =>
              n.id === noteId
                ? { ...n, ...data.note }
                : relinked.has(n.id)
                  ? { ...n, content: relinked.get(n.id)! }
                  : n
            )
          );
        } else {
          setSaveStatus("unsaved");
        }
      } catch (err) {
        setSaveStatus("unsaved");
      }
    },
    [projectId, notes, onNotesChange]
  );

  // Debounced auto-save handler
  const scheduleAutoSave = React.useCallback(() => {
    setSaveStatus("unsaved");
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Trigger word threshold check for AI description auto-generation
    if (latestActiveIdRef.current) {
      checkAutoDescriptionTier(
        latestActiveIdRef.current,
        latestTitleRef.current,
        latestContentRef.current
      );
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      if (latestActiveIdRef.current) {
        saveNoteToServer(
          latestActiveIdRef.current,
          latestTitleRef.current,
          latestContentRef.current,
          latestTagsRef.current,
          latestPinnedRef.current,
          latestDescriptionRef.current
        );
      }
    }, 1200);
  }, [saveNoteToServer, checkAutoDescriptionTier]);

  // Undo handler (Restores previous snapshot)
  const handleUndo = React.useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (historyIndexRef.current > 0) {
      const newIndex = historyIndexRef.current - 1;
      const previousContent = historyRef.current[newIndex];
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      setCurrentContent(previousContent);
      latestContentRef.current = previousContent;
      scheduleAutoSave();
      toast.info("Undone (Ctrl+Z) - Restored previous version", { duration: 1500 });
      return true;
    }
    return false;
  }, [scheduleAutoSave]);

  // Redo handler (Restores next snapshot)
  const handleRedo = React.useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (historyIndexRef.current < historyRef.current.length - 1) {
      const newIndex = historyIndexRef.current + 1;
      const nextContent = historyRef.current[newIndex];
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      setCurrentContent(nextContent);
      latestContentRef.current = nextContent;
      scheduleAutoSave();
      toast.info("Redone (Ctrl+Y)", { duration: 1500 });
      return true;
    }
    return false;
  }, [scheduleAutoSave]);

  // Remember the open note (or the Daily Brief) so reopening the app lands back on it
  React.useEffect(() => {
    if (isDailyBriefOpen) setLastNoteId(projectId, DAILY_BRIEF_ID);
    else if (activeNoteId) setLastNoteId(projectId, activeNoteId);
  }, [projectId, activeNoteId, isDailyBriefOpen]);

  // Sync state ONLY when switching to a DIFFERENT active note
  React.useEffect(() => {
    if (!activeNoteId) {
      if (notes.length > 0) {
        setActiveNoteId(notes[0].id);
      }
      return;
    }

    if (activeNoteId !== lastLoadedNoteIdRef.current) {
      const targetNote = notes.find((n) => n.id === activeNoteId);
      if (targetNote) {
        setCurrentTitle(targetNote.title);
        setCurrentContent(targetNote.content);
        setCurrentDescription(targetNote.description || null);
        setCurrentTags(targetNote.tags || "");
        setIsPinned(targetNote.isPinned);
        setSaveStatus("saved");

        latestTitleRef.current = targetNote.title;
        latestContentRef.current = targetNote.content;
        latestDescriptionRef.current = targetNote.description || null;
        latestTagsRef.current = targetNote.tags || "";
        latestPinnedRef.current = targetNote.isPinned;
        latestActiveIdRef.current = targetNote.id;
        lastLoadedNoteIdRef.current = targetNote.id;

        // Initialize tier tracking for note
        if (noteDescTiersRef.current[targetNote.id] === undefined) {
          const words = countWords(targetNote.content);
          if (targetNote.description) {
            if (words >= 50) noteDescTiersRef.current[targetNote.id] = 3;
            else if (words >= 30) noteDescTiersRef.current[targetNote.id] = 2;
            else if (words >= 15) noteDescTiersRef.current[targetNote.id] = 1;
            else noteDescTiersRef.current[targetNote.id] = 0;
          } else {
            noteDescTiersRef.current[targetNote.id] = 0;
          }
        }

        // Reset history stack for the loaded note
        const initialContent = targetNote.content;
        historyRef.current = [initialContent];
        historyIndexRef.current = 0;
        setHistory([initialContent]);
        setHistoryIndex(0);

        setSlashMenu(null);
        setBubbleToolbar(null);
      }
    }
  }, [activeNoteId, notes]);

  // Focus next line automatically when Enter or Backspace is pressed in Interactive Mode
  React.useEffect(() => {
    if (pendingFocus !== null) {
      const el = lineInputRefs.current[pendingFocus.lineIdx];
      if (el) {
        el.focus();
        const pos = pendingFocus.cursorPos ?? 0;
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
          try {
            el.setSelectionRange(pos, pos);
            if (el instanceof HTMLTextAreaElement) {
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }
          } catch (e) {
            // Ignore if element is not focusable
          }
        }
      }
      setPendingFocus(null);
    }
  }, [currentContent, pendingFocus]);

  // Clean up on unmount. Switching project or tab unmounts the editor, so an edit still waiting
  // for auto-save is written right away instead of being dropped with the timer.
  React.useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (descAiTimeoutRef.current) clearTimeout(descAiTimeoutRef.current);

      const noteId = latestActiveIdRef.current;
      const saved = notesRef.current.find((n) => n.id === noteId);
      if (!noteId || !saved) return;

      const local = {
        title: latestTitleRef.current.trim() || "Untitled Note",
        content: latestContentRef.current,
        description: latestDescriptionRef.current,
        tags: latestTagsRef.current,
        isPinned: latestPinnedRef.current,
      };
      const isDirty =
        local.title !== saved.title ||
        local.content !== saved.content ||
        local.tags !== (saved.tags || "") ||
        local.isPinned !== saved.isPinned ||
        local.description !== (saved.description || null);
      if (!isDirty) return;

      onNotesChangeRef.current(notesRef.current.map((n) => (n.id === noteId ? { ...n, ...local } : n)));
      fetch(`/api/projects/${projectId}/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local),
        keepalive: true,
      }).catch((err) => console.error("Failed to flush note on unmount:", err));
    };
  }, [projectId]);

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+X, Backspace, Escape)
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedLineRange(null);
        setContextMenu(null);
        setSlashMenu(null);
        setBubbleToolbar(null);
        setActiveTaskAiMenu(null);
      }

      // The Daily Brief has its own undo history and save; note shortcuts would edit the hidden note
      if (isDailyBriefOpenRef.current) return;

      // Multi-line selection Copy (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && selectedLineRange) {
        const lines = latestContentRef.current.split("\n");
        const selText = lines.slice(selectedLineRange.start, selectedLineRange.end + 1).join("\n");
        if (selText) {
          e.preventDefault();
          navigator.clipboard.writeText(selText);
          toast.success(`Copied ${selectedLineRange.end - selectedLineRange.start + 1} lines to clipboard!`);
        }
      }

      // Multi-line selection Cut (Ctrl+X / Cmd+X)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x" && selectedLineRange) {
        const lines = latestContentRef.current.split("\n");
        const selText = lines.slice(selectedLineRange.start, selectedLineRange.end + 1).join("\n");
        if (selText) {
          e.preventDefault();
          navigator.clipboard.writeText(selText);
          lines.splice(selectedLineRange.start, selectedLineRange.end - selectedLineRange.start + 1, "");
          const newFull = lines.join("\n");
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          pushHistorySnapshot(latestContentRef.current);
          pushHistorySnapshot(newFull);
          setCurrentContent(newFull);
          latestContentRef.current = newFull;
          scheduleAutoSave();
          setSelectedLineRange(null);
          setPendingFocus({ lineIdx: selectedLineRange.start, cursorPos: 0 });
          toast.success("Cut selected lines!");
        }
      }

      // Multi-line selection Delete / Backspace
      if ((e.key === "Backspace" || e.key === "Delete") && selectedLineRange) {
        e.preventDefault();
        const lines = latestContentRef.current.split("\n");
        lines.splice(selectedLineRange.start, selectedLineRange.end - selectedLineRange.start + 1, "");
        const newFull = lines.length === 0 ? [""] : lines;
        const newFullContent = newFull.join("\n");
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        pushHistorySnapshot(latestContentRef.current);
        pushHistorySnapshot(newFullContent);
        setCurrentContent(newFullContent);
        latestContentRef.current = newFullContent;
        scheduleAutoSave();
        setSelectedLineRange(null);
        setPendingFocus({ lineIdx: Math.max(0, selectedLineRange.start - 1), cursorPos: 0 });
        toast.info("Deleted selected lines");
      }

      // Save Shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (latestActiveIdRef.current) {
          if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
          saveNoteToServer(
            latestActiveIdRef.current,
            latestTitleRef.current,
            latestContentRef.current,
            latestTagsRef.current,
            latestPinnedRef.current
          );
          toast.success("Note saved!");
        }
      }
      // Undo Shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (markdownEditorRef.current?.hasFocus || document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          handleUndo();
        }
      }
      // Redo Shortcut
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && e.shiftKey)
      ) {
        if (markdownEditorRef.current?.hasFocus || document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    const handleClickOutside = () => {
      setContextMenu(null);
      setSlashMenu(null);
      setActiveTaskAiMenu(null);
    };

    const handleGlobalMouseUp = () => {
      isMouseDownSelectingRef.current = false;
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [saveNoteToServer, handleUndo, handleRedo, selectedLineRange]);

  // Slash Command Definitions (Notion Style)
  const slashCommands = React.useMemo(
    () => [
      {
        id: "checkbox",
        title: "Task Checkbox",
        description: "Interactive task checkbox (/--checkbox ... --/ or - [ ])",
        icon: CheckSquare,
        prefix: "- [ ] ",
        suffix: "",
        color: "text-blue-500 bg-blue-50",
      },
      {
        id: "email_template",
        title: "Email Template Task",
        description: "Task item to generate / draft client email template",
        icon: Mail,
        prefix: "- [ ] create email template: ",
        suffix: "",
        color: "text-amber-500 bg-amber-50",
      },
      {
        id: "task",
        title: "Action Item Task",
        description: "Action task item with AI support and workspace sync",
        icon: CheckCircle2,
        prefix: "- [ ] ",
        suffix: "",
        color: "text-emerald-500 bg-emerald-50",
      },
      {
        id: "h1",
        title: "Heading 1",
        description: "Big section title (# text)",
        icon: Heading1,
        prefix: "# ",
        suffix: "",
        color: "text-blue-500 bg-blue-50",
      },
      {
        id: "h2",
        title: "Heading 2",
        description: "Medium section header (## text)",
        icon: Heading2,
        prefix: "## ",
        suffix: "",
        color: "text-indigo-500 bg-indigo-50",
      },
      {
        id: "h3",
        title: "Heading 3",
        description: "Small section header (### text)",
        icon: Heading3,
        prefix: "### ",
        suffix: "",
        color: "text-purple-500 bg-purple-50",
      },
      {
        id: "bullet",
        title: "Bulleted List",
        description: "Create bulleted list (- point)",
        icon: List,
        prefix: "- ",
        suffix: "",
        color: "text-emerald-500 bg-emerald-50",
      },
      {
        id: "numbered",
        title: "Numbered List",
        description: "Sequential list (1. item)",
        icon: ListOrdered,
        prefix: "1. ",
        suffix: "",
        color: "text-amber-500 bg-amber-50",
      },
      {
        id: "callout",
        title: "Callout Box",
        description: "Highlighted insight card (> 💡 Note:)",
        icon: Lightbulb,
        prefix: "> 💡 **Key Note:** ",
        suffix: "",
        color: "text-amber-600 bg-amber-50",
      },
      {
        id: "quote",
        title: "Executive Quote",
        description: "Blockquote for client statements (> )",
        icon: Quote,
        prefix: "> ",
        suffix: "",
        color: "text-gray-600 bg-gray-100",
      },
      {
        id: "code",
        title: "Code Block",
        description: "Monospace code snippet (```)",
        icon: Code,
        prefix: "```\n",
        suffix: "\n```",
        color: "text-cyan-600 bg-cyan-50",
      },
      {
        id: "divider",
        title: "Divider",
        description: "Horizontal divider rule (---)",
        icon: Minus,
        prefix: "\n---\n",
        suffix: "",
        color: "text-gray-400 bg-gray-50",
      },
    ],
    []
  );

  const filteredSlashCommands = React.useMemo(() => {
    if (!slashMenu) return [];
    const query = slashMenu.filterText.toLowerCase().trim();
    if (!query) return slashCommands;
    return slashCommands.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query)
    );
  }, [slashCommands, slashMenu]);

  // Execute Slash Command replacement
  const applySlashCommand = (cmd: (typeof slashCommands)[0]) => {
    if (!slashMenu || !markdownEditorRef.current) return;
    const editor = markdownEditorRef.current;
    const slashStart = slashMenu.slashStartPos;
    const cursorPos = editor.selectionStart;

    const beforeSlash = currentContent.substring(0, slashStart);
    const afterCursor = currentContent.substring(cursorPos);

    let insertion = cmd.prefix;
    let replacementSuffix = cmd.suffix;

    const newFullContent = beforeSlash + insertion + replacementSuffix + afterCursor;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newFullContent);

    setCurrentContent(newFullContent);
    latestContentRef.current = newFullContent;
    scheduleAutoSave();
    setSlashMenu(null);

    setTimeout(() => {
      editor.focus();
      const newCursorPos = slashStart + insertion.length;
      editor.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  // Helper to wrap or replace text with markdown formatting
  const applyFormatting = (prefix: string, suffix: string = "") => {
    if (viewMode === "interactive") {
      const lines = currentContent ? currentContent.split("\n") : [""];
      const targetIdx = Math.max(0, Math.min(activeInteractiveLineRef.current.lineIdx, lines.length - 1));
      const currentLine = lines[targetIdx] ?? "";
      const rawText = currentLine.replace(/^(\s*-\s*\[([ xX])?\]\s*|#+\s*|>\s*💡?\s*|-\s*)/, "").trim();

      let targetFocusIdx = targetIdx;

      if (prefix === "# " || prefix === "## " || prefix === "### ") {
        lines[targetIdx] = `${prefix}${rawText}`;
      } else if (prefix === "- ") {
        lines[targetIdx] = `- ${rawText}`;
      } else if (prefix === "> 💡 **Note:** ") {
        lines[targetIdx] = `> 💡 ${rawText || "Note"}`;
      } else if (prefix === "> ") {
        lines[targetIdx] = `> ${rawText}`;
      } else if (prefix === "```\n") {
        lines.splice(targetIdx + 1, 0, "```\ncode here\n```");
        targetFocusIdx = targetIdx + 1;
      } else {
        // Inline formatting (bold, italic, strikethrough, highlight)
        if (currentLine.trim() === "") {
          lines[targetIdx] = `${prefix}text${suffix}`;
        } else {
          lines[targetIdx] = `${prefix}${currentLine}${suffix}`;
        }
      }

      const newFull = lines.join("\n");
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      pushHistorySnapshot(currentContent);
      pushHistorySnapshot(newFull);
      setCurrentContent(newFull);
      latestContentRef.current = newFull;
      scheduleAutoSave();

      setPendingFocus({ lineIdx: targetFocusIdx, cursorPos: lines[targetFocusIdx].length });
      activeInteractiveLineRef.current = { lineIdx: targetFocusIdx, cursorPos: lines[targetFocusIdx].length };
      toast.success(`Applied ${prefix.trim()} at cursor`);
      return;
    }

    const editor = markdownEditorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = currentContent.substring(start, end);

    let newContent = "";
    let newStart = start;
    let newEnd = end;

    if (selected.length > 0) {
      if (
        prefix &&
        suffix &&
        selected.startsWith(prefix) &&
        selected.endsWith(suffix) &&
        selected.length >= prefix.length + suffix.length
      ) {
        // Toggle OFF
        const unformatted = selected.substring(prefix.length, selected.length - suffix.length);
        newContent = currentContent.substring(0, start) + unformatted + currentContent.substring(end);
        newEnd = start + unformatted.length;
      } else {
        // Wrap
        const replacement = `${prefix}${selected}${suffix}`;
        newContent = currentContent.substring(0, start) + replacement + currentContent.substring(end);
        newEnd = start + replacement.length;
      }
    } else {
      // No selection: insert placeholder or prefix
      const placeholder = prefix.startsWith("#") || prefix.startsWith("-") ? "" : "text";
      const replacement = `${prefix}${placeholder}${suffix}`;
      newContent = currentContent.substring(0, start) + replacement + currentContent.substring(end);
      newStart = start + prefix.length;
      newEnd = start + prefix.length + placeholder.length;
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newContent);

    setCurrentContent(newContent);
    latestContentRef.current = newContent;
    scheduleAutoSave();
    setBubbleToolbar(null);

    setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(newStart, newEnd);
    }, 10);
  };

  // Live Auto-Formatting & Smart Keys on Textarea
  const handleEditorKeyDown = (e: KeyboardEvent) => {
    const editor = markdownEditorRef.current;
    if (!editor) return;

    const { selectionStart, selectionEnd, value } = editor;

    // 1. If Slash Menu is open, handle arrow navigation and selection
    if (slashMenu && slashMenu.isOpen && filteredSlashCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenu((prev) =>
          prev
            ? {
              ...prev,
              selectedIndex: (prev.selectedIndex + 1) % filteredSlashCommands.length,
            }
            : null
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenu((prev) =>
          prev
            ? {
              ...prev,
              selectedIndex:
                (prev.selectedIndex - 1 + filteredSlashCommands.length) %
                filteredSlashCommands.length,
            }
            : null
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selectedCmd = filteredSlashCommands[slashMenu.selectedIndex] || filteredSlashCommands[0];
        if (selectedCmd) {
          applySlashCommand(selectedCmd);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashMenu(null);
        return;
      }
    }

    // 2. Keyboard shortcuts for formatting
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        applyFormatting("**", "**");
        return;
      }
      if (key === "i") {
        e.preventDefault();
        applyFormatting("*", "*");
        return;
      }
      if (key === "u") {
        e.preventDefault();
        applyFormatting("<u>", "</u>");
        return;
      }
      if (e.shiftKey && key === "x") {
        e.preventDefault();
        applyFormatting("~~", "~~");
        return;
      }
      if (e.shiftKey && key === "c") {
        e.preventDefault();
        applyFormatting("`", "`");
        return;
      }
      if (e.shiftKey && key === "h") {
        e.preventDefault();
        applyFormatting("==", "==");
        return;
      }
    }

    // 3. Tab & Shift+Tab Indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const currentLine = value.substring(lineStart, selectionStart);

      if (e.shiftKey) {
        // Outdent 2 spaces if present
        if (currentLine.startsWith("  ")) {
          const newContent = value.substring(0, lineStart) + currentLine.substring(2) + value.substring(selectionStart);
          setCurrentContent(newContent);
          latestContentRef.current = newContent;
          scheduleAutoSave();
          setTimeout(() => {
            editor.setSelectionRange(Math.max(lineStart, selectionStart - 2), Math.max(lineStart, selectionEnd - 2));
          }, 0);
        }
      } else {
        // Indent 2 spaces
        const newContent = value.substring(0, lineStart) + "  " + value.substring(lineStart);
        setCurrentContent(newContent);
        latestContentRef.current = newContent;
        scheduleAutoSave();
        setTimeout(() => {
          editor.setSelectionRange(selectionStart + 2, selectionEnd + 2);
        }, 0);
      }
      return;
    }

    // 4. Smart ENTER Key for Lists (- Bullet, 1. Numbered, - [ ] Task, > Quote)
    if (e.key === "Enter" && !e.shiftKey) {
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const currentLine = value.substring(lineStart, selectionStart);

      // A) Checkbox Task: - [ ] or - [x]
      const taskMatch = currentLine.match(/^(\s*)-\s*\[([ xX])?\]\s*(.*)$/);
      if (taskMatch) {
        const indent = taskMatch[1];
        const taskText = taskMatch[3];

        if (taskText.trim().length === 0) {
          // Empty task item: Clear task marker on enter (exit list mode)
          e.preventDefault();
          const newContent = value.substring(0, lineStart) + value.substring(selectionStart);
          setCurrentContent(newContent);
          latestContentRef.current = newContent;
          scheduleAutoSave();
          setTimeout(() => {
            editor.setSelectionRange(lineStart, lineStart);
          }, 0);
          return;
        }

        // Continue task list on next line
        e.preventDefault();
        const continuation = `\n${indent}- [ ] `;
        const newContent = value.substring(0, selectionStart) + continuation + value.substring(selectionEnd);

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        pushHistorySnapshot(value);
        pushHistorySnapshot(newContent);

        setCurrentContent(newContent);
        latestContentRef.current = newContent;
        scheduleAutoSave();
        setTimeout(() => {
          editor.setSelectionRange(selectionStart + continuation.length, selectionStart + continuation.length);
        }, 0);
        return;
      }

      // A.2) Custom Task Shortcut syntax on Enter: /--checkbox <task> --/ or /--checkbox <task>
      const customTaskMatch = currentLine.match(/^(\s*)(?:\/--checkbox|\/checkbox|\/task)\s+(.*?)(?:\s*--\/)?$/i);
      if (customTaskMatch) {
        const indent = customTaskMatch[1] || "";
        const taskText = customTaskMatch[2].trim();
        e.preventDefault();
        const replacementLine = `${indent}- [ ] ${taskText}\n${indent}- [ ] `;
        const newContent = value.substring(0, lineStart) + replacementLine + value.substring(selectionEnd);

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        pushHistorySnapshot(value);
        pushHistorySnapshot(newContent);

        setCurrentContent(newContent);
        latestContentRef.current = newContent;
        scheduleAutoSave();
        setTimeout(() => {
          const newPos = lineStart + replacementLine.length;
          editor.setSelectionRange(newPos, newPos);
        }, 0);
        return;
      }

      // B) Numbered List: 1. Item
      const numMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (numMatch) {
        const indent = numMatch[1];
        const currentNum = parseInt(numMatch[2], 10);
        const itemText = numMatch[3];

        if (itemText.trim().length === 0) {
          e.preventDefault();
          const newContent = value.substring(0, lineStart) + value.substring(selectionStart);
          setCurrentContent(newContent);
          latestContentRef.current = newContent;
          scheduleAutoSave();
          setTimeout(() => {
            editor.setSelectionRange(lineStart, lineStart);
          }, 0);
          return;
        }

        e.preventDefault();
        const nextNum = currentNum + 1;
        const continuation = `\n${indent}${nextNum}. `;
        const newContent = value.substring(0, selectionStart) + continuation + value.substring(selectionEnd);

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        pushHistorySnapshot(value);
        pushHistorySnapshot(newContent);

        setCurrentContent(newContent);
        latestContentRef.current = newContent;
        scheduleAutoSave();
        setTimeout(() => {
          editor.setSelectionRange(selectionStart + continuation.length, selectionStart + continuation.length);
        }, 0);
        return;
      }

      // C) Bulleted List: - Item or * Item or • Item
      const bulletMatch = currentLine.match(/^(\s*)([-*•])\s+(.*)$/);
      if (bulletMatch) {
        const indent = bulletMatch[1];
        const itemText = bulletMatch[3];

        if (itemText.trim().length === 0) {
          e.preventDefault();
          const newContent = value.substring(0, lineStart) + value.substring(selectionStart);
          setCurrentContent(newContent);
          latestContentRef.current = newContent;
          scheduleAutoSave();
          setTimeout(() => {
            editor.setSelectionRange(lineStart, lineStart);
          }, 0);
          return;
        }

        e.preventDefault();
        const continuation = `\n${indent}- `;
        const newContent = value.substring(0, selectionStart) + continuation + value.substring(selectionEnd);

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        pushHistorySnapshot(value);
        pushHistorySnapshot(newContent);

        setCurrentContent(newContent);
        latestContentRef.current = newContent;
        scheduleAutoSave();
        setTimeout(() => {
          editor.setSelectionRange(selectionStart + continuation.length, selectionStart + continuation.length);
        }, 0);
        return;
      }

      // D) Blockquote: > Quote
      const quoteMatch = currentLine.match(/^(\s*)>\s*(.*)$/);
      if (quoteMatch) {
        const indent = quoteMatch[1];
        const itemText = quoteMatch[2];

        if (itemText.trim().length === 0) {
          e.preventDefault();
          const newContent = value.substring(0, lineStart) + value.substring(selectionStart);
          setCurrentContent(newContent);
          latestContentRef.current = newContent;
          scheduleAutoSave();
          setTimeout(() => {
            editor.setSelectionRange(lineStart, lineStart);
          }, 0);
          return;
        }

        e.preventDefault();
        const continuation = `\n${indent}> `;
        const newContent = value.substring(0, selectionStart) + continuation + value.substring(selectionEnd);
        setCurrentContent(newContent);
        latestContentRef.current = newContent;
        scheduleAutoSave();
        setTimeout(() => {
          editor.setSelectionRange(selectionStart + continuation.length, selectionStart + continuation.length);
        }, 0);
        return;
      }
    }

    // 5. Live Space Key Auto-Transformations (# , ## , - , [] , 1. , > , /--checkbox )
    if (e.key === " " && selectionStart === selectionEnd) {
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const linePrefix = value.substring(lineStart, selectionStart);

      const triggers: Array<{ pattern: string; replaceWith: string }> = [
        { pattern: "###", replaceWith: "### " },
        { pattern: "##", replaceWith: "## " },
        { pattern: "#", replaceWith: "# " },
        { pattern: "/--checkbox", replaceWith: "- [ ] " },
        { pattern: "/checkbox", replaceWith: "- [ ] " },
        { pattern: "/task", replaceWith: "- [ ] " },
        { pattern: "-", replaceWith: "- " },
        { pattern: "*", replaceWith: "- " },
        { pattern: "[]", replaceWith: "- [ ] " },
        { pattern: "[ ]", replaceWith: "- [ ] " },
        { pattern: "[x]", replaceWith: "- [x] " },
        { pattern: "[X]", replaceWith: "- [x] " },
        { pattern: "1.", replaceWith: "1. " },
        { pattern: ">", replaceWith: "> " },
      ];

      for (const t of triggers) {
        if (linePrefix === t.pattern) {
          e.preventDefault();
          const newContent = value.substring(0, lineStart) + t.replaceWith + value.substring(selectionStart);
          setCurrentContent(newContent);
          latestContentRef.current = newContent;
          scheduleAutoSave();
          setTimeout(() => {
            const newPos = lineStart + t.replaceWith.length;
            editor.setSelectionRange(newPos, newPos);
          }, 0);
          return;
        }
      }
    }
  };

  // Markdown Editor Change Handler (debounced history snapshot & slash command detection & /--checkbox auto-transform)
  const handleContentChange = (val: string, cursorPos: number) => {
    // Auto-detect and transform inline /--checkbox ... --/ syntax
    let nextVal = val;
    if (nextVal.includes("/--checkbox") && nextVal.includes("--/")) {
      nextVal = nextVal.replace(/\/--checkbox\s*(.*?)\s*--\//gi, "- [ ] $1");
    }

    // Typed "[[": offer the note link picker at the caret (layout is read after CodeMirror's update)
    if (nextVal.length > currentContent.length && nextVal.slice(cursorPos - 2, cursorPos) === "[[" && !nextVal.slice(cursorPos).startsWith("]]")) {
      requestAnimationFrame(() => {
        const coords = markdownEditorRef.current?.getSelectionCoords();
        if (!coords) return;
        setLinkPicker({
          anchor: { left: coords.left, top: coords.top, bottom: coords.bottom },
          target: { mode: "markdown", from: cursorPos - 2, to: cursorPos },
        });
      });
    }

    setCurrentContent(nextVal);
    latestContentRef.current = nextVal;
    scheduleAutoSave();

    // Debounce history snapshot for typing
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      pushHistorySnapshot(nextVal);
    }, 600);

    // Detect Slash Command trigger (/)
    const lineStart = nextVal.lastIndexOf("\n", cursorPos - 1) + 1;
    const currentLine = nextVal.substring(lineStart, cursorPos);

    const slashMatch = currentLine.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      const filter = slashMatch[1];
      const slashIndexInLine = currentLine.lastIndexOf("/");
      const slashStartPos = lineStart + slashIndexInLine;

      setSlashMenu({
        isOpen: true,
        x: Math.min(window.innerWidth - 320, 260),
        y: Math.min(window.innerHeight - 380, 180),
        filterText: filter,
        selectedIndex: 0,
        slashStartPos,
      });
    } else {
      if (slashMenu) setSlashMenu(null);
    }
  };

  // Text Selection Handler for Floating Bubble Toolbar
  const handleSelectText = () => {
    const editor = markdownEditorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.substring(start, end).trim();
    const coords = selected.length > 1 ? editor.getSelectionCoords() : null;

    if (coords) {
      setBubbleToolbar({
        isOpen: true,
        anchorX: (coords.left + coords.right) / 2,
        anchorTop: coords.top,
        anchorBottom: coords.bottom,
        selectedText: selected,
        start,
        end,
      });
    } else {
      setBubbleToolbar(null);
    }
  };

  // Keep the selection toolbar on screen: centered above the selection, below it when there's
  // no room above, and clamped to the viewport edges. Written straight to the DOM before paint.
  const bubbleToolbarRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = bubbleToolbarRef.current;
    if (!bubbleToolbar || !el) return;
    const margin = 8;
    // Measure from the corner: left unset, a fixed box sits at its in-flow spot and stretches to the remaining width
    el.style.left = "0px";
    el.style.top = "0px";
    const { width, height } = el.getBoundingClientRect();
    let top = bubbleToolbar.anchorTop - height - margin;
    if (top < margin) top = bubbleToolbar.anchorBottom + margin;
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
    const left = Math.max(margin, Math.min(bubbleToolbar.anchorX - width / 2, window.innerWidth - width - margin));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [bubbleToolbar]);

  // Right-Click Context Menu for Selection AI (Supports Markdown mode editor and Interactive mode lines / multi-line selection)
  const handleContextMenu = (
    e: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement | HTMLDivElement> | MouseEvent,
    lineIdx?: number,
    lineType?: string,
    isChecked?: boolean
  ) => {
    const target = e.currentTarget as HTMLTextAreaElement | HTMLInputElement;
    let selectedText = "";
    let start = 0;
    let end = 0;
    let multiStart: number | undefined;
    let multiEnd: number | undefined;

    // 1. If user has selected a multi-line range in Interactive mode
    if (selectedLineRange) {
      const lines = currentContent.split("\n");
      const multiText = lines.slice(selectedLineRange.start, selectedLineRange.end + 1).join("\n").trim();
      if (multiText.length > 0) {
        selectedText = multiText;
        multiStart = selectedLineRange.start;
        multiEnd = selectedLineRange.end;
      }
    } else if (lineIdx !== undefined) {
      // 2. Interactive mode single line element
      const selStart = target.selectionStart ?? 0;
      const selEnd = target.selectionEnd ?? 0;
      if (selEnd > selStart) {
        selectedText = target.value.substring(selStart, selEnd).trim();
        start = selStart;
        end = selEnd;
      } else {
        const winSel = window.getSelection()?.toString()?.trim();
        if (winSel && winSel.length > 0) {
          selectedText = winSel;
          start = selStart;
          end = selEnd;
        } else if (target.value && target.value.trim().length > 0) {
          selectedText = target.value.trim();
          start = 0;
          end = target.value.length;
        }
      }
    } else {
      // 3. Markdown mode editor
      const editor = markdownEditorRef.current;
      if (!editor) return;

      const selStart = editor.selectionStart ?? 0;
      const selEnd = editor.selectionEnd ?? 0;
      if (selEnd > selStart) {
        selectedText = currentContent.substring(selStart, selEnd).trim();
        start = selStart;
        end = selEnd;
      } else {
        const winSel = window.getSelection()?.toString()?.trim();
        if (winSel && winSel.length > 0) {
          selectedText = winSel;
          start = selStart;
          end = selEnd;
        }
      }
    }

    if (selectedText.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const menuWidth = Math.min(230, window.innerWidth - 20);
      const menuHeight = Math.min(290, window.innerHeight - 30);
      const x = Math.max(10, Math.min(e.clientX, window.innerWidth - menuWidth - 15));
      const y = Math.max(10, Math.min(e.clientY, window.innerHeight - menuHeight - 15));

      setContextMenu({
        isOpen: true,
        x,
        y,
        selectedText,
        selectionStart: start,
        selectionEnd: end,
        lineIdx,
        lineType,
        isChecked,
        multiLineStart: multiStart,
        multiLineEnd: multiEnd,
      });
    } else {
      setContextMenu(null);
    }
  };

  // Execute AI action on selected text range (Supports Markdown full document, Interactive single line, and Multi-line selection)
  const handleAiActionOnSelection = async (action: string) => {
    const targetSelected = contextMenu?.selectedText || bubbleToolbar?.selectedText;
    const start = contextMenu?.selectionStart ?? bubbleToolbar?.start;
    const end = contextMenu?.selectionEnd ?? bubbleToolbar?.end;
    const lineIdx = contextMenu?.lineIdx;
    const lineType = contextMenu?.lineType;
    const isChecked = contextMenu?.isChecked;
    const multiLineStart = contextMenu?.multiLineStart;
    const multiLineEnd = contextMenu?.multiLineEnd;

    if (!targetSelected) return;

    // Multi-line selection handling
    if (multiLineStart !== undefined && multiLineEnd !== undefined) {
      if (action === "convert_to_checkbox") {
        const lines = currentContent.split("\n");
        for (let i = multiLineStart; i <= multiLineEnd; i++) {
          const raw = lines[i];
          const clean = raw.replace(/^(\s*-\s*\[([ xX])?\]\s*|#+\s*|>\s*💡?\s*|-\s*)/, "");
          lines[i] = `- [ ] ${clean}`;
        }
        const newFull = lines.join("\n");
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        pushHistorySnapshot(currentContent);
        pushHistorySnapshot(newFull);
        setCurrentContent(newFull);
        latestContentRef.current = newFull;
        scheduleAutoSave();
        setContextMenu(null);
        setSelectedLineRange(null);
        toast.success(`Converted ${multiLineEnd - multiLineStart + 1} lines to Checkboxes!`);
        return;
      }

      if (action === "execute_task") {
        setContextMenu(null);
        setBubbleToolbar(null);
        handleExecuteTaskWithAi(targetSelected, multiLineStart);
        return;
      }

      setIsAiProcessingSelection(true);
      setActiveAiAction(action);

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            text: targetSelected,
            context: `Selection in Note: "${currentTitle}"`,
          }),
        });

        const data = await res.json();
        if (res.ok && data.result) {
          const lines = currentContent.split("\n");
          const newLines = data.result.split("\n");
          lines.splice(multiLineStart, multiLineEnd - multiLineStart + 1, ...newLines);
          const newFull = lines.join("\n");

          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          pushHistorySnapshot(currentContent);
          pushHistorySnapshot(newFull);
          setCurrentContent(newFull);
          latestContentRef.current = newFull;
          scheduleAutoSave();

          toast.success(`Selected lines updated with AI!`, {
            action: {
              label: "Undo (Ctrl+Z)",
              onClick: () => handleUndo(),
            },
            duration: 5000,
          });

          setContextMenu(null);
          setSelectedLineRange(null);
        } else {
          toast.error(data.error || "Gemini AI processing failed");
        }
      } catch (err) {
        toast.error("Failed to process selection with AI");
      } finally {
        setIsAiProcessingSelection(false);
        setActiveAiAction(null);
      }
      return;
    }

    // Single line / Markdown selection handling
    if (action === "convert_to_checkbox") {
      if (lineIdx !== undefined && lineIdx >= 0) {
        const lines = currentContent.split("\n");
        if (lineIdx < lines.length) {
          lines[lineIdx] = `- [ ] ${targetSelected}`;
          const newFull = lines.join("\n");

          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          pushHistorySnapshot(currentContent);
          pushHistorySnapshot(newFull);

          setCurrentContent(newFull);
          latestContentRef.current = newFull;
          scheduleAutoSave();
          setContextMenu(null);
          setBubbleToolbar(null);
          toast.success("Converted line to Task Checkbox!");
          return;
        }
      } else {
        const formatted = `- [ ] ${targetSelected}`;
        const before = currentContent.substring(0, start ?? 0);
        const after = currentContent.substring(end ?? currentContent.length);
        const newFull = before + formatted + after;

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        pushHistorySnapshot(currentContent);
        pushHistorySnapshot(newFull);

        setCurrentContent(newFull);
        latestContentRef.current = newFull;
        scheduleAutoSave();
        setContextMenu(null);
        setBubbleToolbar(null);
        toast.success("Converted selection to Task Checkbox!");
        return;
      }
    }

    // Special quick action: Generate AI Task Deliverable
    if (action === "execute_task") {
      setContextMenu(null);
      setBubbleToolbar(null);
      handleExecuteTaskWithAi(targetSelected, lineIdx);
      return;
    }

    setIsAiProcessingSelection(true);
    setActiveAiAction(action);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          text: targetSelected,
          context: `Selection in Note: "${currentTitle}"`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        const replacementText = data.result;

        if (lineIdx !== undefined && lineIdx >= 0) {
          // Interactive line update
          const lines = currentContent.split("\n");
          if (lineIdx < lines.length) {
            const rawLine = lines[lineIdx];
            let innerText = rawLine;
            if (lineType === "h1") innerText = rawLine.replace(/^#\s*/, "");
            else if (lineType === "h2") innerText = rawLine.replace(/^##\s*/, "");
            else if (lineType === "h3") innerText = rawLine.replace(/^###\s*/, "");
            else if (lineType === "task") innerText = rawLine.replace(/^(\s*)-\s*\[([ xX])?\]\s*|^\s*\/--checkbox\s*|\s*--\/$/gi, "");
            else if (lineType === "bullet") innerText = rawLine.replace(/^(\s*)([-*•])\s+/, "");
            else if (lineType === "callout") innerText = rawLine.replace(/^>\s*💡?\s*|>\s*🤖?\s*|>\s*⚠️?\s*|>\s*📌?\s*/, "");
            else if (lineType === "quote") innerText = rawLine.replace(/^>\s*/, "");

            let newInnerText = replacementText;
            if (start !== undefined && end !== undefined && (start > 0 || end < innerText.length)) {
              newInnerText = innerText.substring(0, start) + replacementText + innerText.substring(end);
            }

            updateLineContent(lineIdx, newInnerText, lineType || "paragraph", isChecked);

            setTimeout(() => {
              lineInputRefs.current[lineIdx]?.focus();
            }, 50);
          }
        } else {
          // Markdown full document replacement
          const before = currentContent.substring(0, start ?? 0);
          const after = currentContent.substring(end ?? currentContent.length);
          const newFullContent = before + replacementText + after;

          if (typingTimerRef.current) {
            clearTimeout(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          pushHistorySnapshot(currentContent);
          pushHistorySnapshot(newFullContent);

          setCurrentContent(newFullContent);
          latestContentRef.current = newFullContent;
          scheduleAutoSave();

          setTimeout(() => {
            if (markdownEditorRef.current) {
              markdownEditorRef.current.focus();
              markdownEditorRef.current.setSelectionRange(start ?? 0, (start ?? 0) + replacementText.length);
            }
          }, 50);
        }

        toast.success(`Selected text updated with AI!`, {
          action: {
            label: "Undo (Ctrl+Z)",
            onClick: () => handleUndo(),
          },
          duration: 5000,
        });

        setContextMenu(null);
        setBubbleToolbar(null);
      } else {
        toast.error(data.error || "Gemini AI processing failed");
      }
    } catch (err) {
      toast.error("Failed to process selection with AI");
    } finally {
      setIsAiProcessingSelection(false);
      setActiveAiAction(null);
    }
  };

  // Toggle Interactive Checkbox item directly in the notepad document
  const toggleCheckbox = (lineIndex: number) => {
    const lines = currentContent.split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const line = lines[lineIndex];
    if (line.includes("- [ ]")) {
      lines[lineIndex] = line.replace("- [ ]", "- [x]");
    } else if (line.includes("- [x]")) {
      lines[lineIndex] = line.replace("- [x]", "- [ ]");
    } else if (line.includes("- [X]")) {
      lines[lineIndex] = line.replace("- [X]", "- [ ]");
    } else if (line.match(/^\s*\/--checkbox\s*(.*?)(?:\s*--\/)?$/i)) {
      const customMatch = line.match(/^\s*\/--checkbox\s*(.*?)(?:\s*--\/)?$/i);
      const text = customMatch ? customMatch[1].trim() : "";
      lines[lineIndex] = `- [x] ${text}`;
    } else {
      lines[lineIndex] = `- [x] ${line.replace(/^(\s*[-*•\d.]*\s*)/, "")}`;
    }

    const newFull = lines.join("\n");
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newFull);

    setCurrentContent(newFull);
    latestContentRef.current = newFull;
    scheduleAutoSave();
  };

  // Markdown mode: clicking a drawn checkbox toggles the task on the line starting at lineStart
  const toggleMarkdownTaskAt = (lineStart: number) => {
    const lineEndIdx = currentContent.indexOf("\n", lineStart);
    const lineEnd = lineEndIdx === -1 ? currentContent.length : lineEndIdx;
    const line = currentContent.substring(lineStart, lineEnd);
    const task = line.match(MD_TASK_PREFIX);
    if (!task) return;

    const isChecked = task[3] === "x" || task[3] === "X";
    const newPrefix = isChecked ? "- [ ] " : "- [x] ";
    const newLine = task[1] + newPrefix + line.substring(task[0].length);
    const newFull = currentContent.substring(0, lineStart) + newLine + currentContent.substring(lineEnd);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newFull);
    setCurrentContent(newFull);
    latestContentRef.current = newFull;
    scheduleAutoSave();
  };

  // Update line text in Interactive Document mode
  const updateLineContent = (lineIndex: number, newText: string, lineType: string, isChecked?: boolean) => {
    const lines = currentContent.split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    const oldLine = lines[lineIndex];

    if (lineType === "task") {
      let cleanText = newText;
      if (cleanText.includes("/--checkbox") && cleanText.includes("--/")) {
        cleanText = cleanText.replace(/\/--checkbox\s*(.*?)\s*--\//gi, "$1");
      }
      lines[lineIndex] = `- [${isChecked ? "x" : " "}] ${cleanText}`;
    } else if (lineType === "h1") {
      lines[lineIndex] = `# ${newText}`;
    } else if (lineType === "h2") {
      lines[lineIndex] = `## ${newText}`;
    } else if (lineType === "h3") {
      lines[lineIndex] = `### ${newText}`;
    } else if (lineType === "bullet") {
      lines[lineIndex] = `- ${newText}`;
    } else if (lineType === "callout") {
      lines[lineIndex] = `> 💡 ${newText}`;
    } else if (lineType === "quote") {
      lines[lineIndex] = `> ${newText}`;
    } else {
      // Paragraph: check if user typed shortcut prefix
      if (
        newText.startsWith("/--checkbox") ||
        newText.startsWith("/checkbox") ||
        newText.startsWith("/task") ||
        newText.startsWith("- [ ]") ||
        newText.startsWith("[]")
      ) {
        const cleanTask = newText
          .replace(/^\s*(?:\/--checkbox|\/checkbox|\/task|- \[ \]|\[\])\s*/i, "")
          .replace(/\s*--\/$/, "");
        lines[lineIndex] = `- [ ] ${cleanTask}`;
      } else {
        lines[lineIndex] = newText;
      }
    }

    const newFull = lines.join("\n");
    setCurrentContent(newFull);
    latestContentRef.current = newFull;
    scheduleAutoSave();

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      pushHistorySnapshot(newFull);
    }, 600);

    // Typed "[[": offer the note link picker under this line
    const caret = activeInteractiveLineRef.current.cursorPos;
    if (
      lines[lineIndex].length > oldLine.length &&
      activeInteractiveLineRef.current.lineIdx === lineIndex &&
      newText.slice(caret - 2, caret) === "[[" &&
      !newText.slice(caret).startsWith("]]")
    ) {
      const rect = lineInputRefs.current[lineIndex]?.getBoundingClientRect();
      if (rect) {
        setLinkPicker({
          anchor: { left: rect.left, top: rect.top, bottom: rect.bottom },
          target: { mode: "interactive", lineIdx: lineIndex, from: caret - 2, to: caret },
        });
      }
    }
  };

  // Insert a new line directly after a line in the document and focus it
  const insertLineAfter = (lineIndex: number, type: "task" | "paragraph" = "task", initialText = "") => {
    const lines = currentContent.split("\n");
    const newLineContent = type === "task" ? `- [ ] ${initialText}` : initialText;
    lines.splice(lineIndex + 1, 0, newLineContent);

    const newFull = lines.join("\n");
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newFull);

    setCurrentContent(newFull);
    latestContentRef.current = newFull;
    scheduleAutoSave();

    setPendingFocus({ lineIdx: lineIndex + 1, cursorPos: initialText.length });
  };

  // Handle Enter Key on a specific line in Interactive Mode (splits line and focuses next line)
  const handleEnterOnLine = (
    lineIndex: number,
    lineType: "task" | "bullet" | "h1" | "h2" | "h3" | "callout" | "quote" | "paragraph",
    currentText: string,
    cursorPos: number,
    isChecked?: boolean
  ) => {
    const beforeCursor = currentText.slice(0, cursorPos);
    const afterCursor = currentText.slice(cursorPos);
    const lines = currentContent.split("\n");

    if (lineType === "task") {
      if (currentText.trim() === "") {
        lines[lineIndex] = "";
        const newFull = lines.join("\n");
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        pushHistorySnapshot(currentContent);
        pushHistorySnapshot(newFull);
        setCurrentContent(newFull);
        latestContentRef.current = newFull;
        scheduleAutoSave();
        setPendingFocus({ lineIdx: lineIndex, cursorPos: 0 });
        return;
      }

      lines[lineIndex] = `- [${isChecked ? "x" : " "}] ${beforeCursor}`;
      lines.splice(lineIndex + 1, 0, `- [ ] ${afterCursor}`);
    } else if (lineType === "bullet") {
      if (currentText.trim() === "") {
        lines[lineIndex] = "";
        const newFull = lines.join("\n");
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        pushHistorySnapshot(currentContent);
        pushHistorySnapshot(newFull);
        setCurrentContent(newFull);
        latestContentRef.current = newFull;
        scheduleAutoSave();
        setPendingFocus({ lineIdx: lineIndex, cursorPos: 0 });
        return;
      }
      lines[lineIndex] = `- ${beforeCursor}`;
      lines.splice(lineIndex + 1, 0, `- ${afterCursor}`);
    } else if (lineType === "h1") {
      lines[lineIndex] = `# ${beforeCursor}`;
      lines.splice(lineIndex + 1, 0, afterCursor);
    } else if (lineType === "h2") {
      lines[lineIndex] = `## ${beforeCursor}`;
      lines.splice(lineIndex + 1, 0, afterCursor);
    } else if (lineType === "h3") {
      lines[lineIndex] = `### ${beforeCursor}`;
      lines.splice(lineIndex + 1, 0, afterCursor);
    } else if (lineType === "callout") {
      lines[lineIndex] = `> 💡 ${beforeCursor}`;
      lines.splice(lineIndex + 1, 0, afterCursor);
    } else if (lineType === "quote") {
      lines[lineIndex] = `> ${beforeCursor}`;
      lines.splice(lineIndex + 1, 0, afterCursor);
    } else {
      lines[lineIndex] = beforeCursor;
      lines.splice(lineIndex + 1, 0, afterCursor);
    }

    const newFull = lines.join("\n");
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newFull);

    setCurrentContent(newFull);
    latestContentRef.current = newFull;
    scheduleAutoSave();

    setPendingFocus({ lineIdx: lineIndex + 1, cursorPos: 0 });
  };

  // Handle Backspace on a specific line when empty (merges with previous line and focuses)
  const handleBackspaceOnLine = (lineIndex: number, currentText: string) => {
    if (currentText === "" && lineIndex > 0) {
      const lines = currentContent.split("\n");
      const prevLine = lines[lineIndex - 1];
      const prevLineLength = prevLine.replace(/^(\s*-\s*\[([ xX])?\]\s*|#+\s*|>\s*💡?\s*|-\s*)/, "").length;
      lines.splice(lineIndex, 1);

      const newFull = lines.join("\n");
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      pushHistorySnapshot(currentContent);
      pushHistorySnapshot(newFull);

      setCurrentContent(newFull);
      latestContentRef.current = newFull;
      scheduleAutoSave();

      setPendingFocus({ lineIdx: lineIndex - 1, cursorPos: prevLineLength });
    }
  };

  // Remove or convert empty line on Backspace
  const removeOrConvertLine = (lineIndex: number) => {
    const lines = currentContent.split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    if (lines.length > 1) {
      lines.splice(lineIndex, 1);
    } else {
      lines[0] = "";
    }

    const newFull = lines.join("\n");
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newFull);

    setCurrentContent(newFull);
    latestContentRef.current = newFull;
    scheduleAutoSave();

    if (lineIndex > 0) {
      setPendingFocus({ lineIdx: lineIndex - 1, cursorPos: 0 });
    }
  };

  // Apply AI Text Transformation directly to Checkbox Task Label (Grammar, Hinglish -> English, Professional, etc.)
  const handleApplyAiToTaskLabel = async (action: string, taskText: string, lineIndex: number) => {
    if (!taskText || !taskText.trim()) {
      toast.error("Task description is empty!");
      return;
    }

    setTaskAiLoadingIdx(lineIndex);
    setActiveTaskAiMenu(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          text: taskText.trim(),
          context: `Note Title: "${currentTitle}"\nContext: Checkbox task label in project note`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        const cleanedResult = data.result
          .replace(/^[-*•\s]+/, "")
          .replace(/^\[[ xX]?\]\s*/, "")
          .trim();

        updateLineContent(lineIndex, cleanedResult, "task");
        toast.success(`AI updated task label!`, {
          action: {
            label: "Undo (Ctrl+Z)",
            onClick: () => handleUndo(),
          },
          duration: 4000,
        });
      } else {
        toast.error(data.error || "AI processing failed");
      }
    } catch (err) {
      toast.error("Failed to connect to AI assistant");
    } finally {
      setTaskAiLoadingIdx(null);
    }
  };

  // Execute Task with Gemini AI (e.g. create email template, documentation, steps)
  const handleExecuteTaskWithAi = async (taskTitle: string, lineIndex?: number) => {
    if (!taskTitle || !taskTitle.trim()) {
      toast.error("Task title is empty!");
      return;
    }

    setTaskDeliverableModal({
      isOpen: true,
      taskTitle: taskTitle.trim(),
      lineIndex,
      deliverable: "",
      isLoading: true,
    });
    setExecutingTaskTitle(taskTitle.trim());
    if (lineIndex !== undefined) setExecutingLineIndex(lineIndex);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute_task",
          text: taskTitle.trim(),
          context: `Note Title: "${currentTitle}"\nFull Note Content:\n${currentContent}`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        setTaskDeliverableModal((prev) => ({
          ...prev,
          deliverable: data.result,
          isLoading: false,
        }));
        toast.success(`AI deliverable generated for "${taskTitle}"!`);
      } else {
        toast.error(data.error || "Failed to execute task with AI");
        setTaskDeliverableModal((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      toast.error("Failed to connect to AI assistant");
      setTaskDeliverableModal((prev) => ({ ...prev, isLoading: false }));
    } finally {
      setExecutingTaskTitle(null);
      setExecutingLineIndex(null);
    }
  };

  // Insert AI Task Deliverable directly below task line in the note
  const handleInsertDeliverableBelowTask = () => {
    const { deliverable, lineIndex, taskTitle } = taskDeliverableModal;
    if (!deliverable) return;

    let newFullContent = "";
    if (lineIndex !== undefined && lineIndex >= 0) {
      const lines = currentContent.split("\n");
      const beforeLines = lines.slice(0, lineIndex + 1);
      const afterLines = lines.slice(lineIndex + 1);

      const deliverableFormatted = `\n> 🤖 **AI Deliverable (${taskTitle}):**\n${deliverable
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n")}\n`;

      newFullContent = [...beforeLines, deliverableFormatted, ...afterLines].join("\n");
    } else {
      newFullContent = `${currentContent}\n\n### 🤖 AI Deliverable: ${taskTitle}\n\n${deliverable}\n`;
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newFullContent);

    setCurrentContent(newFullContent);
    latestContentRef.current = newFullContent;
    scheduleAutoSave();
    setTaskDeliverableModal((prev) => ({ ...prev, isOpen: false }));
    toast.success("Deliverable inserted below task into note!");
  };

  // Sync single task to project workspace tasks
  const handleSyncTaskToWorkspace = async (taskTitle: string) => {
    if (!taskTitle || !taskTitle.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: `From Note: "${currentTitle}"`,
          priority: "HIGH",
          status: "PENDING",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (onTasksChange && tasks && data.task) {
          onTasksChange([data.task, ...tasks]);
        }
        toast.success(`Task "${taskTitle}" synced to Project Tasks board!`, {
          action: onNavigateToTab
            ? {
              label: "View Tasks",
              onClick: () => onNavigateToTab("tasks"),
            }
            : undefined,
        });
      } else {
        toast.error("Failed to sync task to workspace");
      }
    } catch (err) {
      toast.error("Error syncing task");
    }
  };

  // Insert Task Checkbox template at current cursor line or append
  const handleInsertCheckbox = (presetText?: string) => {
    if (viewMode === "interactive") {
      const lines = currentContent ? currentContent.split("\n") : [""];
      const targetIdx = Math.max(0, Math.min(activeInteractiveLineRef.current.lineIdx, lines.length - 1));
      const currentLine = lines[targetIdx] ?? "";
      const isAlreadyTask = currentLine.match(/^(\s*)-\s*\[([ xX])?\]\s*(.*)$/);

      let targetFocusIdx = targetIdx;
      let targetFocusCursor = (presetText || "").length;

      if (currentLine.trim() === "") {
        // Current active line is empty: replace with checkbox
        lines[targetIdx] = presetText !== undefined ? `- [ ] ${presetText}` : "- [ ] ";
        targetFocusIdx = targetIdx;
      } else if (isAlreadyTask) {
        // Current active line is already a checkbox: insert new checkbox on the line directly below
        lines.splice(targetIdx + 1, 0, presetText !== undefined ? `- [ ] ${presetText}` : "- [ ] ");
        targetFocusIdx = targetIdx + 1;
      } else if (presetText !== undefined) {
        // Preset (e.g. Email task): insert new task line right below
        lines.splice(targetIdx + 1, 0, `- [ ] ${presetText}`);
        targetFocusIdx = targetIdx + 1;
      } else {
        // Convert current line to a task checkbox in-place
        lines[targetIdx] = `- [ ] ${currentLine}`;
        targetFocusIdx = targetIdx;
        targetFocusCursor = currentLine.length;
      }

      const newFull = lines.join("\n");
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      pushHistorySnapshot(currentContent);
      pushHistorySnapshot(newFull);

      setCurrentContent(newFull);
      latestContentRef.current = newFull;
      scheduleAutoSave();

      setPendingFocus({ lineIdx: targetFocusIdx, cursorPos: targetFocusCursor });
      activeInteractiveLineRef.current = { lineIdx: targetFocusIdx, cursorPos: targetFocusCursor };
      toast.success("Task checkbox added at cursor!");
      return;
    }

    const editor = markdownEditorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const formatted = presetText !== undefined ? `- [ ] ${presetText}\n` : "- [ ] ";

    const newContent = currentContent.substring(0, start) + formatted + currentContent.substring(end);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newContent);

    setCurrentContent(newContent);
    latestContentRef.current = newContent;
    scheduleAutoSave();

    setTimeout(() => {
      editor.focus();
      const newPos = start + formatted.length;
      editor.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCurrentTitle(val);
    latestTitleRef.current = val;
    scheduleAutoSave();
  };

  const handleGenerateTitle = async () => {
    if (!activeNoteId || isGeneratingTitle) return;
    if (countWords(latestContentRef.current.replace(/^#\s*New Note\s*$/m, "")) < 3) {
      toast.error("Write a few words in the note first");
      return;
    }
    setIsGeneratingTitle(true);
    try {
      const words = countWords(latestContentRef.current);
      const title = await triggerAiNoteMetaGeneration(
        activeNoteId,
        latestTitleRef.current,
        latestContentRef.current,
        Math.max(getWordTier(words), noteDescTiersRef.current[activeNoteId] || 0),
        true
      );
      if (title) toast.success("AI named this note");
      else toast.error("AI couldn't generate a title right now");
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCurrentTags(val);
    latestTagsRef.current = val;
    scheduleAutoSave();
  };

  const handleTogglePin = async () => {
    if (!activeNoteId) return;
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    latestPinnedRef.current = newPinned;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    await saveNoteToServer(
      activeNoteId,
      latestTitleRef.current,
      latestContentRef.current,
      latestTagsRef.current,
      newPinned,
      latestDescriptionRef.current
    );
    toast.success(newPinned ? "Note pinned to top" : "Note unpinned");
  };

  const handleManualSave = () => {
    if (!activeNoteId) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    saveNoteToServer(
      activeNoteId,
      latestTitleRef.current,
      latestContentRef.current,
      latestTagsRef.current,
      latestPinnedRef.current,
      latestDescriptionRef.current
    );
    toast.success("Note saved to database!");
  };

  const handleSelectNote = (noteId: string) => {
    setIsDailyBriefOpen(false);
    if (noteId === activeNoteId) {
      setMobileView("editor");
      return;
    }
    if (activeNoteId && saveStatus === "unsaved") {
      saveNoteToServer(
        activeNoteId,
        latestTitleRef.current,
        latestContentRef.current,
        latestTagsRef.current,
        latestPinnedRef.current,
        latestDescriptionRef.current
      );
    }
    setActiveNoteId(noteId);
    setMobileView("editor");
  };

  const handleCreateNote = async () => {
    if (isCreatingNote) return;
    setIsCreatingNote(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Note",
          content: "# New Note",
          tags: "General",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onNotesChange([data.note, ...notes]);
        lastLoadedNoteIdRef.current = null;
        setActiveNoteId(data.note.id);
        setIsDailyBriefOpen(false);
        setMobileView("editor");
        toast.success("New note created!");
      } else {
        toast.error("Failed to create note");
      }
    } catch (err) {
      toast.error("Failed to create note");
    } finally {
      setIsCreatingNote(false);
    }
  };

  // Follow a [[link]]: open the note with that title, or create it first if none exists yet
  const openNoteLink = async (title: string) => {
    const fromId = isDailyBriefOpen ? DAILY_BRIEF_ID : activeNoteId;
    const existing = notes.find((n) => normalizeNoteTitle(n.title) === normalizeNoteTitle(title));
    if (existing && !isDailyBriefOpen && existing.id === activeNoteId) return;

    if (existing) {
      if (fromId) setLinkBackStack((prev) => [...prev, fromId].slice(-20));
      handleSelectNote(existing.id);
      return;
    }

    try {
      if (activeNoteId && saveStatus === "unsaved") {
        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
        await saveNoteToServer(
          activeNoteId,
          latestTitleRef.current,
          latestContentRef.current,
          latestTagsRef.current,
          latestPinnedRef.current,
          latestDescriptionRef.current
        );
      }
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: `# ${title.trim()}\n`, tags: "General" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created: NoteItem = (await res.json()).note;
      onNotesChange([created, ...notesRef.current]);
      if (fromId) setLinkBackStack((prev) => [...prev, fromId].slice(-20));
      lastLoadedNoteIdRef.current = null;
      setActiveNoteId(created.id);
      setIsDailyBriefOpen(false);
      setMobileView("editor");
      toast.success(`Created note "${created.title}"`);
    } catch (err) {
      console.error("Failed to create linked note:", err);
      toast.error("Couldn't create that note");
    }
  };

  // Most recent place left via a link that still exists
  const backTargetId =
    [...linkBackStack].reverse().find((id) => id === DAILY_BRIEF_ID || notes.some((n) => n.id === id)) ?? null;
  const backTargetLabel =
    backTargetId === DAILY_BRIEF_ID ? "Daily Brief" : notes.find((n) => n.id === backTargetId)?.title || "Untitled Note";

  const goBackFromLink = () => {
    if (!backTargetId) return;
    setLinkBackStack(linkBackStack.slice(0, linkBackStack.lastIndexOf(backTargetId)));
    if (backTargetId === DAILY_BRIEF_ID) handleOpenDailyBrief();
    else handleSelectNote(backTargetId);
  };

  const openLinkPickerAtCursor = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = { left: rect.left, top: rect.top, bottom: rect.bottom };
    if (viewMode === "markdown") {
      const editor = markdownEditorRef.current;
      if (!editor) return;
      const from = editor.selectionStart;
      const to = editor.selectionEnd;
      setLinkPicker({ anchor, target: { mode: "markdown", from, to }, initialQuery: editor.value.slice(from, to).trim() });
    } else {
      const { lineIdx, cursorPos } = activeInteractiveLineRef.current;
      setLinkPicker({ anchor, target: { mode: "interactive", lineIdx, from: cursorPos, to: cursorPos } });
    }
  };

  const insertNoteLink = (title: string) => {
    if (!linkPicker) return;
    const { target } = linkPicker;
    const link = `[[${title.trim()}]]`;
    setLinkPicker(null);

    const before = latestContentRef.current;
    let next: string;
    if (target.mode === "markdown") {
      next = before.slice(0, target.from) + link + before.slice(target.to);
    } else {
      const lines = before.split("\n");
      const line = lines[target.lineIdx] ?? "";
      const prefix = interactivePrefixLength(line);
      lines[target.lineIdx] =
        prefix === null
          ? `${line} ${link}`
          : line.slice(0, prefix + target.from) + link + line.slice(prefix + target.to);
      next = lines.join("\n");
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistorySnapshot(before);
    pushHistorySnapshot(next);
    setCurrentContent(next);
    latestContentRef.current = next;
    scheduleAutoSave();

    const caret = target.from + link.length;
    if (target.mode === "markdown") {
      setTimeout(() => {
        markdownEditorRef.current?.focus();
        markdownEditorRef.current?.setSelectionRange(caret, caret);
      }, 10);
    } else {
      setPendingFocus({ lineIdx: target.lineIdx, cursorPos: caret });
    }
  };

  const closeLinkPicker = (reason: "escape" | "outside") => {
    const target = linkPicker?.target;
    setLinkPicker(null);
    if (reason !== "escape" || !target) return;
    if (target.mode === "markdown") {
      setTimeout(() => {
        markdownEditorRef.current?.focus();
        markdownEditorRef.current?.setSelectionRange(target.to, target.to);
      }, 10);
    } else {
      setPendingFocus({ lineIdx: target.lineIdx, cursorPos: target.to });
    }
  };

  const handleDeleteNote = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/notes/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const updated = notes.filter((n) => n.id !== id);
        onNotesChange(updated);
        if (activeNoteId === id) {
          lastLoadedNoteIdRef.current = null;
          setActiveNoteId(updated.length > 0 ? updated[0].id : null);
          if (updated.length === 0) {
            setMobileView("list");
          }
        }
        toast.success("Note deleted");
      }
    } catch (err) {
      toast.error("Failed to delete note");
    }
  };

  const handleCopyNote = () => {
    navigator.clipboard.writeText(`${currentTitle}\n\n${currentContent}`);
    toast.success("Note copied to clipboard!");
  };

  const handleDownloadNote = () => {
    const blob = new Blob([`${currentTitle}\n\n${currentContent}`], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentTitle.toLowerCase().replace(/\s+/g, "-") || "note"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Note downloaded");
  };

  const filteredNotes = React.useMemo(() => {
    return [...notes]
      .filter(
        (n) =>
          n.title.toLowerCase().includes(searchNotes.toLowerCase()) ||
          n.content.toLowerCase().includes(searchNotes.toLowerCase()) ||
          (n.tags && n.tags.toLowerCase().includes(searchNotes.toLowerCase()))
      )
      .sort((a, b) => {
        // Pinned notes always come first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // Within same pin status, sort by newest updated/created date
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
  }, [notes, searchNotes]);

  const wordCount = currentContent.trim() ? currentContent.trim().split(/\s+/).length : 0;
  const charCount = currentContent.length;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  // Render Interactive Document directly inside Notepad Canvas (Rich Editable Lines with Live Checkboxes)
  const renderInteractiveDocument = () => {
    const rawLines = currentContent.split("\n");

    // Lines are plain text inputs, so their [[links]] are also shown as clickable chips beside the text
    const renderLineLinks = (text: string) => {
      const titles = extractNoteLinkTitles(text);
      if (titles.length === 0) return null;
      return (
        <div className="flex flex-wrap items-center justify-end gap-1 shrink-0 max-w-[45%] sm:max-w-[40%] pt-0.5">
          {titles.map((title) => {
            const exists = linkTitles.has(normalizeNoteTitle(title));
            return (
              <button
                key={title}
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => openNoteLink(title)}
                title={exists ? `Open "${title}"` : `Create note "${title}"`}
                className={cn(
                  "flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer",
                  exists
                    ? "bg-blue-50 text-[#2563EB] border border-blue-200 hover:bg-blue-100"
                    : "text-gray-500 border border-dashed border-gray-400 hover:border-[#3B82F6] hover:text-[#3B82F6]"
                )}
              >
                {exists ? <FileText className="w-3 h-3 shrink-0" /> : <Plus className="w-3 h-3 shrink-0" />}
                <span className="truncate">{title}</span>
              </button>
            );
          })}
        </div>
      );
    };

    const handleLineMouseDown = (idx: number, e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only primary left-click
      if (e.shiftKey) {
        e.preventDefault();
        const anchor = activeInteractiveLineRef.current.lineIdx ?? 0;
        const start = Math.min(anchor, idx);
        const end = Math.max(anchor, idx);
        setSelectedLineRange({ start, end });
        return;
      }
      isMouseDownSelectingRef.current = true;
      selectionStartLineRef.current = idx;
      if (selectedLineRange) {
        setSelectedLineRange(null);
      }
    };

    const handleLineMouseEnter = (idx: number) => {
      if (isMouseDownSelectingRef.current && selectionStartLineRef.current !== null) {
        if (selectionStartLineRef.current !== idx) {
          const start = Math.min(selectionStartLineRef.current, idx);
          const end = Math.max(selectionStartLineRef.current, idx);
          setSelectedLineRange({ start, end });
        }
      }
    };

    const updateCursorLocation = (
      idx: number,
      e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const target = e.currentTarget;
      activeInteractiveLineRef.current = {
        lineIdx: idx,
        cursorPos: target.selectionStart ?? 0,
      };
    };

    const handleInteractiveKeyDown = (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
      idx: number,
      type: "h1" | "h2" | "h3" | "task" | "bullet" | "callout" | "quote" | "paragraph",
      content: string,
      isChecked?: boolean
    ) => {
      updateCursorLocation(idx, e);

      const target = e.currentTarget;
      const isInput = target.tagName.toLowerCase() === "input";
      const cursorPos = target.selectionStart ?? 0;
      const selectionEnd = target.selectionEnd ?? 0;
      const isCollapsed = cursorPos === selectionEnd;

      // 1. Enter key
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleEnterOnLine(idx, type, content, cursorPos, isChecked);
        return;
      }

      // 2. Backspace key on empty line
      if (e.key === "Backspace" && content === "" && (rawLines.length > 1 || idx > 0)) {
        e.preventDefault();
        handleBackspaceOnLine(idx, content);
        return;
      }

      // 3. ArrowUp navigation (move focus to line above)
      if (e.key === "ArrowUp") {
        const firstNewline = content.indexOf("\n");
        const isOnFirstLine = isInput || firstNewline === -1 || cursorPos <= firstNewline;

        if (isOnFirstLine) {
          let prevIdx = idx - 1;
          while (prevIdx >= 0 && !lineInputRefs.current[prevIdx]) {
            prevIdx--;
          }
          if (prevIdx >= 0) {
            const prevEl = lineInputRefs.current[prevIdx];
            if (prevEl) {
              e.preventDefault();
              prevEl.focus();
              const targetPos = Math.min(cursorPos, prevEl.value.length);
              try {
                prevEl.setSelectionRange(targetPos, targetPos);
              } catch (_) { }
              activeInteractiveLineRef.current = { lineIdx: prevIdx, cursorPos: targetPos };
              return;
            }
          }
        }
      }

      // 4. ArrowDown navigation (move focus to line below)
      if (e.key === "ArrowDown") {
        const lastNewline = content.lastIndexOf("\n");
        const isOnLastLine = isInput || lastNewline === -1 || cursorPos >= lastNewline;

        if (isOnLastLine) {
          let nextIdx = idx + 1;
          while (nextIdx < rawLines.length && !lineInputRefs.current[nextIdx]) {
            nextIdx++;
          }
          if (nextIdx < rawLines.length) {
            const nextEl = lineInputRefs.current[nextIdx];
            if (nextEl) {
              e.preventDefault();
              nextEl.focus();
              const targetPos = Math.min(cursorPos, nextEl.value.length);
              try {
                nextEl.setSelectionRange(targetPos, targetPos);
              } catch (_) { }
              activeInteractiveLineRef.current = { lineIdx: nextIdx, cursorPos: targetPos };
              return;
            }
          }
        }
      }

      // 5. ArrowLeft at start of line
      if (e.key === "ArrowLeft" && isCollapsed && cursorPos === 0 && idx > 0) {
        let prevIdx = idx - 1;
        while (prevIdx >= 0 && !lineInputRefs.current[prevIdx]) {
          prevIdx--;
        }
        if (prevIdx >= 0) {
          const prevEl = lineInputRefs.current[prevIdx];
          if (prevEl) {
            e.preventDefault();
            prevEl.focus();
            const endPos = prevEl.value.length;
            try {
              prevEl.setSelectionRange(endPos, endPos);
            } catch (_) { }
            activeInteractiveLineRef.current = { lineIdx: prevIdx, cursorPos: endPos };
            return;
          }
        }
      }

      // 6. ArrowRight at end of line
      if (e.key === "ArrowRight" && isCollapsed && cursorPos === content.length && idx < rawLines.length - 1) {
        let nextIdx = idx + 1;
        while (nextIdx < rawLines.length && !lineInputRefs.current[nextIdx]) {
          nextIdx++;
        }
        if (nextIdx < rawLines.length) {
          const nextEl = lineInputRefs.current[nextIdx];
          if (nextEl) {
            e.preventDefault();
            nextEl.focus();
            try {
              nextEl.setSelectionRange(0, 0);
            } catch (_) { }
            activeInteractiveLineRef.current = { lineIdx: nextIdx, cursorPos: 0 };
            return;
          }
        }
      }
    };

    return (
      <div className="space-y-0 font-sans text-gray-900 leading-relaxed max-w-full mx-auto py-1 relative">
        {rawLines.map((line, idx) => {
          const isSelectedLine = selectedLineRange !== null && idx >= selectedLineRange.start && idx <= selectedLineRange.end;

          // 1. Heading 1 (# ...)
          if (line.startsWith("# ")) {
            const hText = line.substring(2);
            return (
              <div
                key={idx}
                onMouseDown={(e) => handleLineMouseDown(idx, e)}
                onMouseEnter={() => handleLineMouseEnter(idx)}
                className={cn(
                  "group flex items-center gap-2 pt-2 pb-0.5 border-b border-gray-200 transition-all rounded px-1 -mx-1",
                  isSelectedLine && "bg-blue-100/70"
                )}
              >
                <input
                  ref={(el) => {
                    lineInputRefs.current[idx] = el;
                  }}
                  type="text"
                  value={hText}
                  onContextMenu={(e) => handleContextMenu(e, idx, "h1")}
                  onFocus={(e) => updateCursorLocation(idx, e)}
                  onClick={(e) => updateCursorLocation(idx, e)}
                  onKeyUp={(e) => updateCursorLocation(idx, e)}
                  onSelect={(e) => updateCursorLocation(idx, e)}
                  onChange={(e) => {
                    updateCursorLocation(idx, e);
                    updateLineContent(idx, e.target.value, "h1");
                  }}
                  onKeyDown={(e) => handleInteractiveKeyDown(e, idx, "h1", hText)}
                  placeholder="Heading 1..."
                  className="keep-font-size w-full text-2xl sm:text-3xl font-extrabold text-gray-950 bg-transparent border-none outline-none focus:bg-blue-50/50 rounded px-1 -mx-1 py-0 leading-tight"
                />
              </div>
            );
          }

          // 2. Heading 2 (## ...)
          if (line.startsWith("## ")) {
            const hText = line.substring(3);
            return (
              <div
                key={idx}
                onMouseDown={(e) => handleLineMouseDown(idx, e)}
                onMouseEnter={() => handleLineMouseEnter(idx)}
                className={cn(
                  "group flex items-center gap-2 pt-1.5 pb-0.5 transition-all rounded px-1 -mx-1",
                  isSelectedLine && "bg-blue-100/70"
                )}
              >
                <input
                  ref={(el) => {
                    lineInputRefs.current[idx] = el;
                  }}
                  type="text"
                  value={hText}
                  onContextMenu={(e) => handleContextMenu(e, idx, "h2")}
                  onFocus={(e) => updateCursorLocation(idx, e)}
                  onClick={(e) => updateCursorLocation(idx, e)}
                  onKeyUp={(e) => updateCursorLocation(idx, e)}
                  onSelect={(e) => updateCursorLocation(idx, e)}
                  onChange={(e) => {
                    updateCursorLocation(idx, e);
                    updateLineContent(idx, e.target.value, "h2");
                  }}
                  onKeyDown={(e) => handleInteractiveKeyDown(e, idx, "h2", hText)}
                  placeholder="Heading 2..."
                  className="keep-font-size w-full text-xl sm:text-2xl font-bold text-indigo-950 bg-transparent border-none outline-none focus:bg-blue-50/50 rounded px-1 -mx-1 py-0 leading-snug"
                />
              </div>
            );
          }

          // 3. Heading 3 (### ...)
          if (line.startsWith("### ")) {
            const hText = line.substring(4);
            return (
              <div
                key={idx}
                onMouseDown={(e) => handleLineMouseDown(idx, e)}
                onMouseEnter={() => handleLineMouseEnter(idx)}
                className={cn(
                  "group flex items-center gap-2 pt-1 pb-0.5 transition-all rounded px-1 -mx-1",
                  isSelectedLine && "bg-blue-100/70"
                )}
              >
                <input
                  ref={(el) => {
                    lineInputRefs.current[idx] = el;
                  }}
                  type="text"
                  value={hText}
                  onContextMenu={(e) => handleContextMenu(e, idx, "h3")}
                  onFocus={(e) => updateCursorLocation(idx, e)}
                  onClick={(e) => updateCursorLocation(idx, e)}
                  onKeyUp={(e) => updateCursorLocation(idx, e)}
                  onSelect={(e) => updateCursorLocation(idx, e)}
                  onChange={(e) => {
                    updateCursorLocation(idx, e);
                    updateLineContent(idx, e.target.value, "h3");
                  }}
                  onKeyDown={(e) => handleInteractiveKeyDown(e, idx, "h3", hText)}
                  placeholder="Heading 3..."
                  className="keep-font-size w-full text-lg font-bold text-gray-800 bg-transparent border-none outline-none focus:bg-blue-50/50 rounded px-1 -mx-1 py-0 leading-snug"
                />
              </div>
            );
          }

          // 4. Checkbox Task item (- [ ] / - [x] / /--checkbox ... --/)
          const isStandardTask = line.match(/^(\s*)-\s*\[([ xX])?\]\s*(.*)$/);
          const isCustomSyntaxTask = line.match(/^\s*\/--checkbox\s*(.*?)(?:\s*--\/)?$/i);

          if (isStandardTask || isCustomSyntaxTask) {
            const isChecked = line.includes("- [x]") || line.includes("- [X]");
            const taskText = isStandardTask
              ? line.replace(/^(\s*)-\s*\[([ xX])?\]\s*/, "")
              : isCustomSyntaxTask
                ? isCustomSyntaxTask[1].trim()
                : "";

            const isThisExecuting = executingLineIndex === idx || executingTaskTitle === taskText;
            const isEmailTask = taskText.toLowerCase().includes("email") || taskText.toLowerCase().includes("templete") || taskText.toLowerCase().includes("template");

            return (
              <div
                key={idx}
                onMouseDown={(e) => handleLineMouseDown(idx, e)}
                onMouseEnter={() => handleLineMouseEnter(idx)}
                className={cn(
                  "group flex flex-row items-start justify-between gap-1 sm:gap-2 py-0.5 px-1.5 rounded-md transition border border-transparent",
                  isChecked ? "bg-gray-50/70" : "hover:bg-blue-50/60 hover:border-blue-200",
                  isSelectedLine && "bg-blue-100/70"
                )}
              >
                {/* Left: Checkbox + Full Width Multiline Task Label */}
                <div className="flex items-start gap-2 flex-1 min-w-0 w-full">
                  <button
                    type="button"
                    onClick={() => toggleCheckbox(idx)}
                    title={isChecked ? "Mark Incomplete" : "Mark Completed"}
                    className={cn(
                      "w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition shrink-0 cursor-pointer shadow-xs mt-0.5",
                      isChecked
                        ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                        : "border-gray-400 bg-white hover:border-[#3B82F6] hover:bg-blue-50"
                    )}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <textarea
                    rows={1}
                    value={taskText}
                    ref={(el) => {
                      lineInputRefs.current[idx] = el;
                      if (el) {
                        el.style.height = "auto";
                        el.style.height = `${el.scrollHeight}px`;
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, idx, "task", isChecked)}
                    onFocus={(e) => updateCursorLocation(idx, e)}
                    onClick={(e) => updateCursorLocation(idx, e)}
                    onKeyUp={(e) => updateCursorLocation(idx, e)}
                    onSelect={(e) => updateCursorLocation(idx, e)}
                    onChange={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = `${e.target.scrollHeight}px`;
                      updateCursorLocation(idx, e);
                      updateLineContent(idx, e.target.value, "task", isChecked);
                    }}
                    onKeyDown={(e) => handleInteractiveKeyDown(e, idx, "task", taskText, isChecked)}
                    placeholder="Task description..."
                    className={cn(
                      "flex-1 text-sm font-medium bg-transparent border-none outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 rounded px-1 py-0 w-full min-w-0 resize-none overflow-hidden leading-relaxed break-words whitespace-pre-wrap transition-all",
                      isChecked ? "line-through text-gray-400" : "text-gray-900 font-semibold"
                    )}
                  />
                </div>

                {/* Right / Mobile Action Badges */}
                <div className="relative flex items-center gap-1 sm:gap-1.5 shrink-0 self-start">
                  {renderLineLinks(taskText)}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTaskAiMenu(activeTaskAiMenu?.lineIdx === idx ? null : { lineIdx: idx, taskText });
                      }}
                      disabled={isThisExecuting || taskAiLoadingIdx === idx}
                      title="AI Tools (Grammar, Hinglish ↔ English, Professional, Deliverables)"
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 max-sm:p-1.5 rounded text-[11px] sm:text-xs font-bold transition border cursor-pointer shadow-xs whitespace-nowrap",
                        isEmailTask
                          ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300"
                          : "bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200"
                      )}
                    >
                      {isThisExecuting || taskAiLoadingIdx === idx ? (
                        <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                      ) : isEmailTask ? (
                        <Mail className="w-3 h-3 text-amber-700" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-blue-600" />
                      )}
                      <span className="max-sm:hidden">{isEmailTask ? "Draft Email" : "AI Tools"}</span>
                      <ChevronDown className="w-2.5 h-2.5 opacity-70 ml-0.5 max-sm:hidden" />
                    </button>

                    {/* AI Task Actions Dropdown Menu */}
                    {activeTaskAiMenu?.lineIdx === idx && (
                      <AiActionMenu
                        title="Task AI Actions"
                        entries={taskMenuEntries(isEmailTask)}
                        onSelect={(actionId) => {
                          setActiveTaskAiMenu(null);
                          if (actionId === "execute_task") {
                            handleExecuteTaskWithAi(taskText, idx);
                          } else {
                            handleApplyAiToTaskLabel(actionId, taskText, idx);
                          }
                        }}
                        onClose={() => setActiveTaskAiMenu(null)}
                        submenuSide="left"
                        className="absolute right-0 top-full mt-1.5 z-50"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSyncTaskToWorkspace(taskText)}
                    title="Sync to Project Tasks board"
                    className="p-1 max-sm:p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs transition border border-gray-200 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          // 5. Bullet Point (- ...)
          if (line.match(/^(\s*)([-*•])\s+(.*)$/)) {
            const bText = line.replace(/^(\s*)([-*•])\s+/, "");
            return (
              <div
                key={idx}
                onMouseDown={(e) => handleLineMouseDown(idx, e)}
                onMouseEnter={() => handleLineMouseEnter(idx)}
                className={cn(
                  "group flex items-start gap-2 pl-1 py-0 transition-all rounded px-1 -mx-1",
                  isSelectedLine && "bg-blue-100/70"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shrink-0 mt-2" />
                <textarea
                  rows={1}
                  value={bText}
                  ref={(el) => {
                    lineInputRefs.current[idx] = el;
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, idx, "bullet")}
                  onFocus={(e) => updateCursorLocation(idx, e)}
                  onClick={(e) => updateCursorLocation(idx, e)}
                  onKeyUp={(e) => updateCursorLocation(idx, e)}
                  onSelect={(e) => updateCursorLocation(idx, e)}
                  onChange={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                    updateCursorLocation(idx, e);
                    updateLineContent(idx, e.target.value, "bullet");
                  }}
                  onKeyDown={(e) => handleInteractiveKeyDown(e, idx, "bullet", bText)}
                  placeholder="Bullet point..."
                  className="flex-1 text-sm text-gray-800 bg-transparent border-none outline-none focus:bg-blue-50/50 rounded px-1 py-0 resize-none overflow-hidden leading-relaxed break-words whitespace-pre-wrap"
                />
                {renderLineLinks(bText)}
              </div>
            );
          }

          // 6. Callout Box / Key Note (> 💡 ...)
          if (line.startsWith("> 💡") || line.startsWith("> 🤖") || line.startsWith("> ⚠️") || line.startsWith("> 📌")) {
            const cText = line.substring(2);
            return (
              <div
                key={idx}
                onMouseDown={(e) => handleLineMouseDown(idx, e)}
                onMouseEnter={() => handleLineMouseEnter(idx)}
                className={cn(
                  "my-1 p-2.5 bg-amber-50/80 border-l-4 border-amber-500 rounded-r-lg transition-all",
                  isSelectedLine && "bg-blue-100/70"
                )}
              >
                <textarea
                  rows={1}
                  value={cText}
                  ref={(el) => {
                    lineInputRefs.current[idx] = el;
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, idx, "callout")}
                  onFocus={(e) => updateCursorLocation(idx, e)}
                  onClick={(e) => updateCursorLocation(idx, e)}
                  onKeyUp={(e) => updateCursorLocation(idx, e)}
                  onSelect={(e) => updateCursorLocation(idx, e)}
                  onChange={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                    updateCursorLocation(idx, e);
                    updateLineContent(idx, e.target.value, "callout");
                  }}
                  onKeyDown={(e) => handleInteractiveKeyDown(e, idx, "callout", cText)}
                  className="w-full text-xs sm:text-sm text-amber-950 font-medium bg-transparent border-none outline-none resize-none overflow-hidden leading-relaxed break-words whitespace-pre-wrap py-0"
                />
              </div>
            );
          }

          // 7. Standard Blockquote (> ...)
          if (line.startsWith("> ")) {
            const qText = line.substring(2);
            return (
              <div
                key={idx}
                onMouseDown={(e) => handleLineMouseDown(idx, e)}
                onMouseEnter={() => handleLineMouseEnter(idx)}
                className={cn(
                  "my-0.5 pl-3 py-0.5 border-l-4 border-gray-300 transition-all rounded px-1 -mx-1",
                  isSelectedLine && "bg-blue-100/70"
                )}
              >
                <textarea
                  rows={1}
                  value={qText}
                  ref={(el) => {
                    lineInputRefs.current[idx] = el;
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, idx, "quote")}
                  onFocus={(e) => updateCursorLocation(idx, e)}
                  onClick={(e) => updateCursorLocation(idx, e)}
                  onKeyUp={(e) => updateCursorLocation(idx, e)}
                  onSelect={(e) => updateCursorLocation(idx, e)}
                  onChange={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                    updateCursorLocation(idx, e);
                    updateLineContent(idx, e.target.value, "quote");
                  }}
                  onKeyDown={(e) => handleInteractiveKeyDown(e, idx, "quote", qText)}
                  className="w-full text-sm italic text-gray-600 bg-transparent border-none outline-none resize-none overflow-hidden leading-relaxed break-words whitespace-pre-wrap py-0"
                />
              </div>
            );
          }

          // 8. Divider Rule (---)
          if (line.trim() === "---") {
            return <hr key={idx} className="my-2 border-t-2 border-gray-200" />;
          }

          // 9. Standard Paragraph
          return (
            <div
              key={idx}
              onMouseDown={(e) => handleLineMouseDown(idx, e)}
              onMouseEnter={() => handleLineMouseEnter(idx)}
              className={cn(
                "group flex items-start gap-1 py-0 transition-all rounded px-1 -mx-1",
                isSelectedLine && "bg-blue-100/70"
              )}
            >
              <textarea
                rows={1}
                value={line}
                ref={(el) => {
                  lineInputRefs.current[idx] = el;
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, idx, "paragraph")}
                onFocus={(e) => updateCursorLocation(idx, e)}
                onClick={(e) => updateCursorLocation(idx, e)}
                onKeyUp={(e) => updateCursorLocation(idx, e)}
                onSelect={(e) => updateCursorLocation(idx, e)}
                onChange={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  updateCursorLocation(idx, e);
                  updateLineContent(idx, e.target.value, "paragraph");
                }}
                onKeyDown={(e) => handleInteractiveKeyDown(e, idx, "paragraph", line)}
                placeholder={idx === 0 ? "Type note text or '/--checkbox <task> --/' for a checkbox..." : ""}
                className="w-full text-sm text-gray-800 bg-transparent border-none outline-none focus:bg-blue-50/40 rounded px-1 -mx-1 py-0 resize-none overflow-hidden leading-relaxed break-words whitespace-pre-wrap"
              />
              {renderLineLinks(line)}
            </div>
          );
        })}

        {/* Quick Document Action Buttons at Bottom */}
        <div className="pt-3 grid grid-cols-3 sm:flex sm:flex-row items-stretch sm:items-center gap-2 border-t border-gray-100 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleInsertCheckbox()}
            className="max-sm:px-1 gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer active:scale-95 transition-all shadow-xs justify-center"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="sm:hidden">Task</span>
            <span className="max-sm:hidden">+ Add Task Checkbox</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleInsertCheckbox("create email template for: ")}
            className="max-sm:px-1 gap-1.5 text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200 cursor-pointer active:scale-95 transition-all shadow-xs justify-center"
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="sm:hidden">Email</span>
            <span className="max-sm:hidden">+ Add Email Template Task</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => insertLineAfter(activeInteractiveLineRef.current.lineIdx ?? rawLines.length - 1, "paragraph", "")}
            className="max-sm:px-1 gap-1.5 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer active:scale-95 transition-all justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="sm:hidden">Line</span>
            <span className="max-sm:hidden">+ Add Line</span>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-white relative overflow-hidden">
      {/* Left Sidebar: Notes Navigator */}
      <div
        className={cn(
          "w-full lg:w-72 sm:w-80 border-r-2 border-gray-200 bg-[#F3F4F6] flex-col shrink-0 h-full overflow-hidden",
          mobileView === "editor" ? "hidden lg:flex" : "flex"
        )}
      >
        <div className="p-3 border-b-2 border-gray-200 bg-white shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#3B82F6]" strokeWidth={2.5} />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                Notes ({notes.length})
              </h3>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateNote}
              disabled={isCreatingNote}
              className="gap-1 text-xs h-7 px-2.5 active:scale-95 transition-all shadow-sm cursor-pointer"
              title="Create a new note"
            >
              {isCreatingNote ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                  <span>New Note</span>
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter notes by title or tags..."
              value={searchNotes}
              onChange={(e) => setSearchNotes(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 rounded-md bg-[#F3F4F6] text-sm font-medium text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition-all"
            />
          </div>
        </div>

        {/* Notes Items List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {/* Daily Brief: always the first item, a fresh page each day */}
          {!searchNotes && (() => {
            const todayBrief = briefIndex?.find((b) => b.date === todayKey);
            const pastCount = briefIndex ? briefIndex.filter((b) => b.date < todayKey).length : null;
            return (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setLinkBackStack([]);
                  handleOpenDailyBrief();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLinkBackStack([]);
                    handleOpenDailyBrief();
                  }
                }}
                className={cn(
                  "group p-3.5 rounded-lg cursor-pointer transition-all duration-150 select-none relative active:scale-[0.98] border-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                  isDailyBriefOpen
                    ? "bg-white border-blue-200 border-l-4 border-l-[#3B82F6] shadow-sm"
                    : "bg-blue-50/70 border-blue-100 hover:bg-white hover:scale-[1.01]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CalendarDays className="w-4 h-4 text-[#3B82F6] shrink-0" strokeWidth={2.4} />
                    <h4 className="text-sm font-bold text-gray-900 truncate leading-tight">Daily Brief</h4>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3B82F6] shrink-0">
                    {formatBriefDate(todayKey, "short")}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 mt-1.5 leading-relaxed break-words">
                  {todayBrief?.preview || "Nothing yet today. Tap to plan your day."}
                </p>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-blue-100 text-[11px] font-semibold text-gray-500">
                  <span>
                    {todayBrief && todayBrief.tasksTotal > 0
                      ? `${todayBrief.tasksDone}/${todayBrief.tasksTotal} tasks done`
                      : "Today"}
                  </span>
                  {pastCount !== null && pastCount > 0 && (
                    <span className="flex items-center gap-1 text-gray-400">
                      <History className="w-3 h-3" />
                      {pastCount} past {pastCount === 1 ? "brief" : "briefs"}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {filteredNotes.length === 0 ? (
            <div className="p-6 text-center bg-white rounded-lg border-2 border-dashed border-gray-300">
              <FileText className="w-6 h-6 text-gray-400 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-gray-600">No notes found</p>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateNote}
                disabled={isCreatingNote}
                className="mt-3 text-xs w-full active:scale-95 transition-all gap-1.5 cursor-pointer"
              >
                {isCreatingNote ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Note...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Note</span>
                  </>
                )}
              </Button>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isSelected = !isDailyBriefOpen && note.id === activeNoteId;
              const words = countWords(note.content);
              const hasAiDescription = words >= 15 && Boolean(note.description);
              const fullNoteSnippet = hasAiDescription
                ? note.description!
                : (note.content.replace(/[#*`_>\[\]]/g, "").trim() || "Empty note...");

              return (
                <div
                  key={note.id}
                  onClick={() => {
                    setLinkBackStack([]);
                    handleSelectNote(note.id);
                  }}
                  className={cn(
                    "group p-3.5 rounded-lg cursor-pointer transition-all duration-150 select-none relative active:scale-[0.98]",
                    isSelected
                      ? "bg-white border-l-4 border-l-[#3B82F6] text-gray-900 shadow-sm"
                      : "bg-white/70 hover:bg-white text-gray-700 hover:scale-[1.01]"
                  )}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {note.isPinned && (
                        <Pin className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B] shrink-0" />
                      )}
                      <h4 className="text-sm font-bold truncate leading-tight">
                        {note.title || "Untitled Note"}
                      </h4>
                    </div>

                    <button
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      title="Delete Note"
                      className="opacity-0 group-hover:opacity-100 max-md:opacity-100 max-md:p-1.5 p-1 text-gray-400 hover:text-red-600 rounded transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p
                    title={fullNoteSnippet}
                    className="text-xs text-gray-500 line-clamp-3 mt-1.5 font-normal leading-relaxed break-words"
                  >
                    {fullNoteSnippet}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-400 font-medium">
                    <span className="font-semibold text-gray-500">{formatDate(note.createdAt || note.updatedAt)}</span>
                    <div className="flex items-center gap-1">
                      {hasAiDescription && (
                        <span
                          title="AI generated note summary"
                          className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>AI</span>
                        </span>
                      )}
                      {note.tags && (
                        <span className="truncate max-w-[100px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                          {note.tags}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Advance Editor Area */}
      {isDailyBriefOpen ? (
        <DailyBriefPanel
          projectId={projectId}
          todayKey={todayKey}
          briefs={briefIndex}
          onSummaryChange={handleBriefSummaryChange}
          linkTitles={linkTitles}
          linkNotes={notes}
          onOpenLink={openNoteLink}
          onBack={() => setMobileView("list")}
          className={mobileView === "list" ? "hidden lg:flex" : "flex"}
        />
      ) : activeNoteId ? (
        <div
          className={cn(
            "flex-1 flex-col bg-white overflow-hidden relative",
            mobileView === "list" ? "hidden lg:flex" : "flex"
          )}
          ref={editorContainerRef}
        >
          {/* Note Controls Top Bar */}
          <div className="p-2.5 sm:p-4 border-b-2 border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-2 max-md:flex-wrap max-md:gap-y-1.5">
              {/* Left: Mobile Back Button + Title & Tags */}
              <div className="flex items-center gap-2 flex-1 min-w-0 max-md:basis-full">
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="lg:hidden flex items-center gap-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 p-1.5 sm:px-2.5 sm:py-1.5 rounded-md transition cursor-pointer shrink-0"
                  title="Back to notes list"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs">Notes</span>
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={currentTitle}
                      onChange={handleTitleChange}
                      placeholder="Note Title..."
                      className="keep-font-size flex-1 min-w-0 text-lg sm:text-2xl font-extrabold text-gray-900 border-none outline-none placeholder:text-gray-300 bg-transparent truncate"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateTitle}
                      disabled={isGeneratingTitle}
                      title="Generate title with AI"
                      className="p-1 rounded-md text-blue-600 hover:bg-blue-50 disabled:opacity-60 transition cursor-pointer shrink-0"
                    >
                      {isGeneratingTitle ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Tag className="w-3 h-3 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={currentTags}
                      onChange={handleTagsChange}
                      placeholder="Add tags (e.g., Requirements)..."
                      className="text-xs text-gray-600 font-medium placeholder:text-gray-400 border-none outline-none w-full bg-transparent truncate"
                    />
                  </div>
                </div>
              </div>

              {/* Right: Actions Bar (Save status, Voice, AI, Pin, Copy, Export) */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0 max-md:w-full max-md:pl-9">
                {/* Save Status Badge */}
                <span
                  onClick={handleManualSave}
                  title="Click to save (Ctrl+S)"
                  className={cn(
                    "text-[11px] sm:text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-md select-none cursor-pointer transition shrink-0",
                    saveStatus === "saved" && "bg-emerald-50 text-emerald-800",
                    saveStatus === "saving" && "bg-blue-50 text-blue-800",
                    saveStatus === "unsaved" && "bg-amber-50 text-amber-900 hover:bg-amber-100"
                  )}
                >
                  {saveStatus === "saved" && (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#10B981]" strokeWidth={3} />
                      <span className="hidden sm:inline">Saved</span>
                    </>
                  )}
                  {saveStatus === "saving" && (
                    <>
                      <Clock className="w-3.5 h-3.5 text-[#3B82F6] animate-spin" />
                      <span className="hidden sm:inline">Saving...</span>
                    </>
                  )}
                  {saveStatus === "unsaved" && (
                    <>
                      <Save className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span className="hidden sm:inline">Save</span>
                    </>
                  )}
                </span>

                {/* Live Voice STT Dictation directly into Notepad */}
                <VoiceMicButton
                  onInterimTranscript={(interimText) => {
                    if (voiceBaseContentRef.current === null) {
                      voiceBaseContentRef.current = currentContent;
                    }
                    const base = voiceBaseContentRef.current;
                    const separator = base && !base.endsWith("\n") && !base.endsWith(" ") ? " " : "";
                    const liveContent = base + separator + interimText;
                    setCurrentContent(liveContent);
                    latestContentRef.current = liveContent;
                  }}
                  onTranscript={(finalTranscript) => {
                    if (typingTimerRef.current) {
                      clearTimeout(typingTimerRef.current);
                      typingTimerRef.current = null;
                    }

                    const base = voiceBaseContentRef.current !== null ? voiceBaseContentRef.current : currentContent;
                    voiceBaseContentRef.current = null;

                    const separator = base && !base.endsWith("\n") && !base.endsWith(" ") ? " " : "";
                    const newContent = base + separator + finalTranscript;

                    pushHistorySnapshot(base);
                    pushHistorySnapshot(newContent);
                    setCurrentContent(newContent);
                    latestContentRef.current = newContent;
                    scheduleAutoSave();

                    toast.success("Voice transcribed directly into note!", {
                      action: {
                        label: "Undo (Ctrl+Z)",
                        onClick: () => handleUndo(),
                      },
                      duration: 4000,
                    });
                  }}
                  variant="rose"
                  size="sm"
                  label="Voice (Live)"
                />

                {/* Gemini AI Assistant */}
                <AIMagicButton
                  getText={() => currentContent}
                  onResult={(aiText) => {
                    if (typingTimerRef.current) {
                      clearTimeout(typingTimerRef.current);
                      typingTimerRef.current = null;
                    }
                    pushHistorySnapshot(currentContent);
                    pushHistorySnapshot(aiText);
                    setCurrentContent(aiText);
                    latestContentRef.current = aiText;
                    scheduleAutoSave();
                    toast.success("AI response applied!", {
                      action: {
                        label: "Undo (Ctrl+Z)",
                        onClick: () => handleUndo(),
                      },
                      duration: 5000,
                    });
                  }}
                  context={`Project Note: ${currentTitle}`}
                  variant="secondary"
                  size="sm"
                />

                {/* Pin button */}
                <Button
                  variant={isPinned ? "amber" : "secondary"}
                  size="sm"
                  onClick={handleTogglePin}
                  className="h-8 px-2 text-xs"
                  title={isPinned ? "Unpin Note" : "Pin Note to Top"}
                >
                  <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-current")} />
                  <span className="hidden md:inline">{isPinned ? "Pinned" : "Pin"}</span>
                </Button>

                {/* Copy button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyNote}
                  className="flex h-8 px-2 text-xs"
                  title="Copy Markdown"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Copy</span>
                </Button>

                {/* Download Export button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadNote}
                  className="flex h-8 px-2 text-xs"
                  title="Download Note (.md)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Export</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Back to where a [[link]] was followed from */}
          {backTargetId && (
            <button
              type="button"
              onClick={goBackFromLink}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-bold text-[#2563EB] hover:bg-blue-100 transition cursor-pointer text-left shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Back to {backTargetLabel}</span>
            </button>
          )}

          {/* Formatting Ribbon */}
          <div className="px-2 sm:px-4 py-1.5 bg-[#F3F4F6] border-b-2 border-gray-200 flex items-center justify-between gap-2 overflow-x-auto select-none no-scrollbar">
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              {/* History Undo / Redo */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1" />

              {/* Text Formats */}
              <button
                type="button"
                onClick={() => applyFormatting("**", "**")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition font-bold cursor-pointer"
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("*", "*")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition italic cursor-pointer"
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("~~", "~~")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                title="Strikethrough (Ctrl+Shift+X)"
              >
                <Strikethrough className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("==", "==")}
                className="p-1.5 rounded hover:bg-gray-200 text-amber-600 transition cursor-pointer"
                title="Highlight Marker"
              >
                <Highlighter className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1" />

              {/* Headings */}
              <button
                type="button"
                onClick={() => applyFormatting("# ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                title="Heading 1 (#)"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("## ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                title="Heading 2 (##)"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("### ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                title="Heading 3 (###)"
              >
                <Heading3 className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1" />

              {/* Lists & Tasks */}
              <button
                type="button"
                onClick={() => applyFormatting("- ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                title="Bullet List (-)"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleInsertCheckbox()}
                className="p-1.5 rounded hover:bg-blue-100 text-[#3B82F6] font-bold transition flex items-center gap-1 cursor-pointer bg-blue-50 shrink-0"
                title="Task Checkbox in Notepad (- [ ] or /--checkbox)"
              >
                <CheckSquare className="w-4 h-4 text-[#3B82F6]" />
                <span className="text-[11px] whitespace-nowrap">Checkbox</span>
              </button>
              <button
                type="button"
                onClick={openLinkPickerAtCursor}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition flex items-center gap-1 cursor-pointer shrink-0"
                title="Link to another note (or type [[)"
              >
                <Link2 className="w-4 h-4" />
                <span className="text-[11px] whitespace-nowrap max-md:hidden">Link</span>
              </button>

              <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1 shrink-0" />

              {/* Blocks */}
              <button
                type="button"
                onClick={() => applyFormatting("> 💡 **Note:** ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-amber-600 transition cursor-pointer shrink-0"
                title="Callout Box"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("> ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition cursor-pointer shrink-0"
                title="Quote (>)"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("```\n", "\n```")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition cursor-pointer shrink-0"
                title="Code Block"
              >
                <Code className="w-4 h-4" />
              </button>
            </div>

            {/* View Mode Toggle Switch */}
            <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-md border-2 border-gray-200 shrink-0 ml-auto max-md:sticky max-md:right-0 max-md:z-10 max-md:shadow-[-10px_0_8px_-2px_#F3F4F6,10px_0_0_0_#F3F4F6]">
              <button
                type="button"
                onClick={() => setViewMode("interactive")}
                className={cn(
                  "px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-bold rounded transition cursor-pointer flex items-center gap-1 whitespace-nowrap",
                  viewMode === "interactive"
                    ? "bg-[#3B82F6] text-white"
                    : "text-gray-600 hover:text-gray-900"
                )}
                title="Interactive Document with Live Checkboxes"
              >
                <CheckSquare className="w-3 h-3" />
                <span className="max-md:hidden">Interactive</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("markdown")}
                className={cn(
                  "px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-bold rounded transition cursor-pointer flex items-center gap-1 whitespace-nowrap",
                  viewMode === "markdown"
                    ? "bg-[#3B82F6] text-white"
                    : "text-gray-600 hover:text-gray-900"
                )}
                title="Free-typing Markdown editor with live bullets & checkboxes"
              >
                <PenTool className="w-3 h-3" />
                <span className="max-md:hidden">Markdown</span>
              </button>
            </div>
          </div>

          {/* Editor & Live Document Canvas */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* 1. Interactive Document View (Default - Live In-Place Checkboxes) */}
            {viewMode === "interactive" && (
              <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-white">
                {renderInteractiveDocument()}
              </div>
            )}

            {/* 2. Markdown Editor View: free typing with live preview (real headings, checkboxes, bullets) */}
            {viewMode === "markdown" && (
              <div className="flex-1 flex flex-col p-2 sm:p-6 relative overflow-hidden bg-white">
                <div className="flex-1 min-h-0 overflow-hidden rounded-xl bg-[#F8FAFC] border-2 border-transparent focus-within:bg-white focus-within:border-[#3B82F6] transition-colors">
                  <MarkdownLiveEditor
                    handleRef={markdownEditorRef}
                    value={currentContent}
                    onChange={handleContentChange}
                    onKeyDown={handleEditorKeyDown}
                    onSelectionChange={handleSelectText}
                    onContextMenu={handleContextMenu}
                    onToggleTask={toggleMarkdownTaskAt}
                    linkTitles={linkTitles}
                    onOpenLink={openNoteLink}
                    onScroll={() => setBubbleToolbar(null)}
                    placeholder={"Start typing your notes...\n\n✨ Shortcuts:\n• Type '/--checkbox create email templete --/' for Instant Checkbox\n• Type '/' for Notion-Style Slash Commands\n• Type '- ' for Bullet Points\n• Type '1. ' for Numbered Lists\n• Type '[] ' for To-Do Checklist\n• Type '# ' for Large Heading"}
                    className="md-live-editor h-full font-sans text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Notepad Info Bar */}
          <div className="px-4 md:px-6 py-2 bg-[#F3F4F6] border-t-2 border-gray-200 flex items-center justify-between text-xs font-bold text-gray-500 shrink-0">
            <div className="flex items-center gap-4">
              <span>{wordCount} words</span>
              <span>{charCount} characters</span>
              <span className="hidden sm:inline text-gray-400">• {readTimeMin} min read</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-gray-400">💡 Type <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">/--checkbox task --/</code> or click Checkbox</span>
              <span className="max-md:hidden"><kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px]">Ctrl+Z</kbd> Undo</span>
              <span className="max-md:hidden"><kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px]">Ctrl+S</kbd> Save</span>
            </div>
          </div>

          {/* 🪄 Notion-Style Slash Command Palette Popover (in Markdown mode) */}
          {slashMenu && slashMenu.isOpen && (
            <div
              style={{ top: `${slashMenu.y}px`, left: `${slashMenu.x}px` }}
              className="absolute z-50 w-72 bg-white rounded-xl border-2 border-gray-300 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none max-h-80 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                  Slash Commands
                </span>
                <span className="text-[10px] text-gray-400">↑↓ to navigate, Enter to insert</span>
              </div>

              <div className="overflow-y-auto p-1.5 space-y-1">
                {filteredSlashCommands.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">
                    No matching commands found
                  </div>
                ) : (
                  filteredSlashCommands.map((cmd, idx) => {
                    const Icon = cmd.icon;
                    const isSelected = idx === slashMenu.selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        onClick={() => applySlashCommand(cmd)}
                        className={cn(
                          "w-full text-left p-2 rounded-lg transition flex items-center gap-2.5 group cursor-pointer",
                          isSelected ? "bg-blue-50 text-[#3B82F6]" : "hover:bg-gray-100 text-gray-800"
                        )}
                      >
                        <div className={cn("p-1.5 rounded-md shrink-0", cmd.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-tight">
                            {cmd.title}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            {cmd.description}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 🫧 Floating Bubble Toolbar on Selection */}
          {bubbleToolbar && bubbleToolbar.isOpen && (
            <div
              ref={bubbleToolbarRef}
              className="fixed z-50 w-max max-w-[calc(100vw-16px)] bg-white text-gray-700 p-1 rounded-xl border-2 border-gray-200 shadow-xl flex flex-wrap items-center gap-0.5 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => applyFormatting("**", "**")}
                className="p-1.5 rounded-md hover:bg-blue-50 hover:text-[#3B82F6] transition cursor-pointer"
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("*", "*")}
                className="p-1.5 rounded-md hover:bg-blue-50 hover:text-[#3B82F6] transition cursor-pointer"
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleAiActionOnSelection("convert_to_checkbox")}
                className="px-1.5 py-1 rounded-md hover:bg-blue-50 hover:text-[#3B82F6] font-semibold transition flex items-center gap-1 text-xs cursor-pointer"
                title="Convert selection to Task Checkbox"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Task</span>
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("`", "`")}
                className="p-1.5 rounded-md hover:bg-blue-50 hover:text-[#3B82F6] transition cursor-pointer"
                title="Inline Code"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("==", "==")}
                className="p-1.5 rounded-md hover:bg-blue-50 hover:text-[#3B82F6] transition cursor-pointer"
                title="Highlight"
              >
                <Highlighter className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-gray-200 mx-1" />

              <button
                type="button"
                onClick={() => handleAiActionOnSelection("execute_task")}
                disabled={isAiProcessingSelection}
                className="px-2 py-1 rounded-md hover:bg-blue-50 hover:text-[#3B82F6] text-xs font-semibold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                title="AI: Generate Deliverable (Email template, etc.)"
              >
                {isAiProcessingSelection && activeAiAction === "execute_task" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3B82F6]" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
                )}
                <span>Deliverable</span>
              </button>

              <button
                type="button"
                onClick={() => handleAiActionOnSelection("make_short")}
                disabled={isAiProcessingSelection}
                className="px-2 py-1 rounded-md hover:bg-blue-50 hover:text-[#3B82F6] text-xs font-semibold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                title="Make selection shorter and concise"
              >
                {isAiProcessingSelection && activeAiAction === "make_short" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3B82F6]" />
                ) : (
                  <Scissors className="w-3.5 h-3.5" />
                )}
                <span>Shorten</span>
              </button>
            </div>
          )}

          {/* Right-Click AI Menu on Selection */}
          {contextMenu && contextMenu.isOpen && (
            <AiActionMenu
              title="AI & Task Actions"
              subtitle={contextMenu.selectedText}
              entries={SELECTION_MENU}
              onSelect={handleAiActionOnSelection}
              onClose={() => setContextMenu(null)}
              loadingActionId={isAiProcessingSelection ? activeAiAction : null}
              disabled={isAiProcessingSelection}
              footer="Replaces the selected text · Esc to close"
              style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
              className="fixed z-50"
            />
          )}
        </div>
      ) : (
        <div
          className={cn(
            "flex-1 flex-col items-center justify-center p-8 text-center bg-gray-50",
            mobileView === "list" ? "hidden lg:flex" : "flex"
          )}
        >
          <div>
            <div className="w-16 h-16 rounded-full bg-blue-50 text-[#3B82F6] flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No Note Selected</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Select an existing note from the sidebar or click Create New Note to start typing.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreateNote}
              disabled={isCreatingNote}
              className="mt-5 active:scale-95 transition-all gap-2 cursor-pointer shadow-md"
            >
              {isCreatingNote ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Note...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" strokeWidth={2.5} />
                  <span>Create New Note</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {linkPicker && (
        <NoteLinkPicker
          notes={notes}
          anchor={linkPicker.anchor}
          initialQuery={linkPicker.initialQuery}
          excludeNoteId={activeNoteId}
          onSelect={insertNoteLink}
          onClose={closeLinkPicker}
        />
      )}

      {/* 🤖 AI Task Deliverable Modal */}
      <Modal
        isOpen={taskDeliverableModal.isOpen}
        onClose={() => setTaskDeliverableModal((prev) => ({ ...prev, isOpen: false }))}
        title={`AI Task Deliverable: "${taskDeliverableModal.taskTitle}"`}
        description="Gemini AI has generated the complete deliverable for this note task."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {taskDeliverableModal.isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-sm font-bold text-gray-700">Generating deliverable for "{taskDeliverableModal.taskTitle}"...</p>
              <p className="text-xs text-gray-400">Drafting professional email template / execution content with Gemini AI</p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-xl max-h-96 overflow-y-auto font-sans text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                {taskDeliverableModal.deliverable}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(taskDeliverableModal.deliverable);
                    toast.success("Deliverable copied to clipboard!");
                  }}
                  className="gap-1.5 w-full sm:w-auto text-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy to Clipboard</span>
                </Button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTaskDeliverableModal((prev) => ({ ...prev, isOpen: false }))}
                    className="w-full sm:w-auto text-xs"
                  >
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleInsertDeliverableBelowTask}
                    className="gap-1.5 w-full sm:w-auto text-xs bg-[#3B82F6]"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Insert Below Task in Note</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
