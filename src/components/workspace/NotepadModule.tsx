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
  X,
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
  Layers,
  ListCheck,
  PenTool,
  CornerDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { AIMagicButton } from "@/components/ui/ai-magic-button";
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
  x: number;
  y: number;
  selectedText: string;
  start: number;
  end: number;
}

export function NotepadModule({
  projectId,
  notes,
  tasks = [],
  onNotesChange,
  onTasksChange,
  onNavigateToTab,
}: NotepadModuleProps) {
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(
    notes.length > 0 ? notes[0].id : null
  );
  const [currentTitle, setCurrentTitle] = React.useState("");
  const [currentContent, setCurrentContent] = React.useState("");
  const [currentDescription, setCurrentDescription] = React.useState<string | null>(null);
  const [currentTags, setCurrentTags] = React.useState("");
  const [isPinned, setIsPinned] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "unsaved">("saved");
  const [viewMode, setViewMode] = React.useState<"interactive" | "markdown" | "split">("interactive");
  const [searchNotes, setSearchNotes] = React.useState("");
  const [mobileView, setMobileView] = React.useState<"list" | "editor">(notes.length > 0 ? "editor" : "list");

  // Multi-tier AI description generation tracking (15 words -> tier 1, 30 words -> tier 2, 50 words -> tier 3)
  const noteDescTiersRef = React.useRef<{ [noteId: string]: number }>({});
  const descAiTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isGeneratingDescRef = React.useRef(false);
  const latestDescriptionRef = React.useRef<string | null>(null);

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

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
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

  // Trigger AI to generate / refine note description
  const triggerAiDescriptionGeneration = React.useCallback(
    async (noteId: string, title: string, content: string, targetTier: number) => {
      if (!noteId || isGeneratingDescRef.current) return;
      isGeneratingDescRef.current = true;
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate_note_description",
            text: content.slice(0, 3000),
            context: title || "Untitled Note",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const generatedDesc = data.result?.trim();
          if (generatedDesc) {
            noteDescTiersRef.current[noteId] = targetTier;
            if (latestActiveIdRef.current === noteId) {
              setCurrentDescription(generatedDesc);
              latestDescriptionRef.current = generatedDesc;
            }
            onNotesChange(
              notes.map((n) => (n.id === noteId ? { ...n, description: generatedDesc } : n))
            );
            await fetch(`/api/projects/${projectId}/notes/${noteId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ description: generatedDesc }),
            });
          }
        }
      } catch (err) {
        console.error("Auto description generation failed:", err);
      } finally {
        isGeneratingDescRef.current = false;
      }
    },
    [projectId, notes, onNotesChange]
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
          triggerAiDescriptionGeneration(noteId, title, content, tier);
        }, 1000);
      }
    },
    [notes, onNotesChange, triggerAiDescriptionGeneration]
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
          onNotesChange(
            notes.map((n) => (n.id === noteId ? { ...n, ...data.note } : n))
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

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (descAiTimeoutRef.current) clearTimeout(descAiTimeoutRef.current);
    };
  }, []);

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
        if (document.activeElement === textareaRef.current || document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          handleUndo();
        }
      }
      // Redo Shortcut
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && e.shiftKey)
      ) {
        if (document.activeElement === textareaRef.current || document.activeElement?.tagName !== "INPUT") {
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
    if (!slashMenu || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const slashStart = slashMenu.slashStartPos;
    const cursorPos = textarea.selectionStart;

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
      textarea.focus();
      const newCursorPos = slashStart + insertion.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
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

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
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
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }, 10);
  };

  // Live Auto-Formatting & Smart Keys on Textarea
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;

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
            textarea.setSelectionRange(Math.max(lineStart, selectionStart - 2), Math.max(lineStart, selectionEnd - 2));
          }, 0);
        }
      } else {
        // Indent 2 spaces
        const newContent = value.substring(0, lineStart) + "  " + value.substring(lineStart);
        setCurrentContent(newContent);
        latestContentRef.current = newContent;
        scheduleAutoSave();
        setTimeout(() => {
          textarea.setSelectionRange(selectionStart + 2, selectionEnd + 2);
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
            textarea.setSelectionRange(lineStart, lineStart);
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
          textarea.setSelectionRange(selectionStart + continuation.length, selectionStart + continuation.length);
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
          textarea.setSelectionRange(newPos, newPos);
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
            textarea.setSelectionRange(lineStart, lineStart);
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
          textarea.setSelectionRange(selectionStart + continuation.length, selectionStart + continuation.length);
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
            textarea.setSelectionRange(lineStart, lineStart);
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
          textarea.setSelectionRange(selectionStart + continuation.length, selectionStart + continuation.length);
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
            textarea.setSelectionRange(lineStart, lineStart);
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
          textarea.setSelectionRange(selectionStart + continuation.length, selectionStart + continuation.length);
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
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
          return;
        }
      }
    }
  };

  // Textarea Change Handler (debounced history snapshot & slash command detection & /--checkbox auto-transform)
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;

    // Auto-detect and transform inline /--checkbox ... --/ syntax
    let nextVal = val;
    if (nextVal.includes("/--checkbox") && nextVal.includes("--/")) {
      nextVal = nextVal.replace(/\/--checkbox\s*(.*?)\s*--\//gi, "- [ ] $1");
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
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = currentContent.substring(start, end).trim();

    if (selected.length > 1) {
      setBubbleToolbar({
        isOpen: true,
        x: Math.min(window.innerWidth - 340, Math.max(300, window.innerWidth / 2 - 160)),
        y: 120,
        selectedText: selected,
        start,
        end,
      });
    } else {
      setBubbleToolbar(null);
    }
  };

  // Right-Click Context Menu for Selection AI (Supports Markdown mode textarea and Interactive mode lines / multi-line selection)
  const handleContextMenu = (
    e: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement | HTMLDivElement>,
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
      // 3. Markdown mode textarea
      const textarea = textareaRef.current || (target as HTMLTextAreaElement);
      if (!textarea) return;

      const selStart = textarea.selectionStart ?? 0;
      const selEnd = textarea.selectionEnd ?? 0;
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
      const menuWidth = Math.min(290, window.innerWidth - 20);
      const menuHeight = Math.min(460, window.innerHeight - 30);
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
            if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(start ?? 0, (start ?? 0) + replacementText.length);
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

  // Update line text in Interactive Document mode
  const updateLineContent = (lineIndex: number, newText: string, lineType: string, isChecked?: boolean) => {
    const lines = currentContent.split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;

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

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const formatted = presetText !== undefined ? `- [ ] ${presetText}\n` : "- [ ] ";

    const newContent = currentContent.substring(0, start) + formatted + currentContent.substring(end);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newContent);

    setCurrentContent(newContent);
    latestContentRef.current = newContent;
    scheduleAutoSave();

    setTimeout(() => {
      textarea.focus();
      const newPos = start + formatted.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCurrentTitle(val);
    latestTitleRef.current = val;
    scheduleAutoSave();
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
                  className="w-full text-2xl sm:text-3xl font-extrabold text-gray-950 bg-transparent border-none outline-none focus:bg-blue-50/50 rounded px-1 -mx-1 py-0 leading-tight"
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
                  className="w-full text-xl sm:text-2xl font-bold text-indigo-950 bg-transparent border-none outline-none focus:bg-blue-50/50 rounded px-1 -mx-1 py-0 leading-snug"
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
                  className="w-full text-lg font-bold text-gray-800 bg-transparent border-none outline-none focus:bg-blue-50/50 rounded px-1 -mx-1 py-0 leading-snug"
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
                  "group flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2 py-0.5 px-1.5 rounded-md transition border border-transparent",
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
                <div className="relative flex items-center gap-1.5 shrink-0 pl-6 sm:pl-0 self-end sm:self-start sm:mt-0">
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTaskAiMenu(activeTaskAiMenu?.lineIdx === idx ? null : { lineIdx: idx, taskText });
                      }}
                      disabled={isThisExecuting || taskAiLoadingIdx === idx}
                      title="AI Tools (Grammar, Hinglish → English, Professional, Deliverables)"
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition border cursor-pointer shadow-xs whitespace-nowrap",
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
                      <span>{isEmailTask ? "Draft Email" : "AI Tools"}</span>
                      <ChevronDown className="w-2.5 h-2.5 opacity-70 ml-0.5" />
                    </button>

                    {/* AI Task Actions Dropdown Menu */}
                    {activeTaskAiMenu?.lineIdx === idx && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1.5 z-50 w-64 sm:w-72 bg-white rounded-xl border-2 border-gray-200 p-1.5 shadow-xl space-y-1 animate-in fade-in zoom-in-95 duration-100 select-none text-left max-h-[min(340px,calc(100vh-140px))] overflow-y-auto"
                      >
                        <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100 flex items-center justify-between">
                          <span>Task AI Actions</span>
                          <button
                            type="button"
                            onClick={() => setActiveTaskAiMenu(null)}
                            className="text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {[
                          {
                            id: "grammar",
                            label: "Fix Grammar & Spelling",
                            desc: "English grammar and spelling correction",
                            icon: CheckCheck,
                            color: "text-emerald-600 bg-emerald-50",
                          },
                          {
                            id: "hinglish_to_english",
                            label: "Translate Hinglish → English",
                            desc: "Convert Hindi/Hinglish into formal English",
                            icon: Languages,
                            color: "text-blue-600 bg-blue-50",
                          },
                          {
                            id: "professional",
                            label: "Company Standard / Professional",
                            desc: "Formal corporate executive tone",
                            icon: Briefcase,
                            color: "text-purple-600 bg-purple-50",
                          },
                          {
                            id: "english_to_simple",
                            label: "Simplify for Client",
                            desc: "Clear plain English explanation",
                            icon: Smile,
                            color: "text-amber-600 bg-amber-50",
                          },
                          {
                            id: "make_short",
                            label: "Make Shorter (Short Version)",
                            desc: "Concise & punchy task text",
                            icon: Scissors,
                            color: "text-rose-600 bg-rose-50",
                          },
                          {
                            id: "execute_task",
                            label: isEmailTask ? "Draft Email Deliverable" : "Generate Task Deliverable",
                            desc: isEmailTask ? "Full email template with subject & body" : "Draft AI solution or template modal",
                            icon: isEmailTask ? Mail : Sparkles,
                            color: "text-amber-700 bg-amber-100",
                          },
                        ].map((action) => {
                          const Icon = action.icon;
                          return (
                            <button
                              key={action.id}
                              type="button"
                              onClick={() => {
                                setActiveTaskAiMenu(null);
                                if (action.id === "execute_task") {
                                  handleExecuteTaskWithAi(taskText, idx);
                                } else {
                                  handleApplyAiToTaskLabel(action.id, taskText, idx);
                                }
                              }}
                              className="group/item w-full text-left p-1.5 rounded-lg hover:bg-blue-50/80 transition flex items-start gap-2.5 cursor-pointer"
                            >
                              <div className={cn("p-1 rounded shrink-0 mt-0.5", action.color)}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-gray-900 group-hover/item:text-blue-600 leading-tight">
                                  {action.label}
                                </div>
                                <div className="text-[10px] text-gray-400 group-hover/item:text-gray-600 font-medium truncate mt-0.5">
                                  {action.desc}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSyncTaskToWorkspace(taskText)}
                    title="Sync to Project Tasks board"
                    className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs transition border border-gray-200 cursor-pointer"
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
            </div>
          );
        })}

        {/* Quick Document Action Buttons at Bottom */}
        <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-t border-gray-100 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleInsertCheckbox()}
            className="gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer active:scale-95 transition-all shadow-xs justify-center"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>+ Add Task Checkbox</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleInsertCheckbox("create email template for: ")}
            className="gap-1.5 text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200 cursor-pointer active:scale-95 transition-all shadow-xs justify-center"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>+ Add Email Template Task</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => insertLineAfter(activeInteractiveLineRef.current.lineIdx ?? rawLines.length - 1, "paragraph", "")}
            className="gap-1.5 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer active:scale-95 transition-all justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Line</span>
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
              const isSelected = note.id === activeNoteId;
              const words = countWords(note.content);
              const hasAiDescription = words >= 15 && Boolean(note.description);
              const fullNoteSnippet = hasAiDescription
                ? note.description!
                : (note.content.replace(/[#*`_>\[\]]/g, "").trim() || "Empty note...");

              return (
                <div
                  key={note.id}
                  onClick={() => handleSelectNote(note.id)}
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
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded transition-opacity"
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
      {activeNoteId ? (
        <div
          className={cn(
            "flex-1 flex-col bg-white overflow-hidden relative",
            mobileView === "list" ? "hidden lg:flex" : "flex"
          )}
          ref={editorContainerRef}
        >
          {/* Note Controls Top Bar */}
          <div className="p-2.5 sm:p-4 border-b-2 border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-2">
              {/* Left: Mobile Back Button + Title & Tags */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
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
                  <input
                    type="text"
                    value={currentTitle}
                    onChange={handleTitleChange}
                    placeholder="Note Title..."
                    className="w-full text-base sm:text-2xl font-extrabold text-gray-900 border-none outline-none placeholder:text-gray-300 bg-transparent truncate"
                  />
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
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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
                  className="hidden sm:flex h-8 px-2 text-xs"
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
                  className="hidden sm:flex h-8 px-2 text-xs"
                  title="Download Note (.md)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Export</span>
                </Button>
              </div>
            </div>
          </div>

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
            <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-md border-2 border-gray-200 shrink-0 ml-auto">
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
                <span>Interactive</span>
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
                title="Raw Markdown Textarea"
              >
                <PenTool className="w-3 h-3" />
                <span>Markdown</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={cn(
                  "hidden md:flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded transition cursor-pointer whitespace-nowrap",
                  viewMode === "split"
                    ? "bg-[#3B82F6] text-white"
                    : "text-gray-600 hover:text-gray-900"
                )}
                title="Split side-by-side view"
              >
                <Layers className="w-3 h-3" />
                <span>Split</span>
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

            {/* 2. Raw Markdown Textarea View */}
            {viewMode === "markdown" && (
              <div className="flex-1 flex flex-col p-4 sm:p-6 relative overflow-hidden bg-white">
                <textarea
                  ref={textareaRef}
                  value={currentContent}
                  onChange={handleContentChange}
                  onKeyDown={handleEditorKeyDown}
                  onSelect={handleSelectText}
                  onContextMenu={handleContextMenu}
                  placeholder="Start typing your notes...&#10;&#10;✨ Shortcuts:&#10;• Type '/--checkbox create email templete --/' for Instant Checkbox&#10;• Type '/' for Notion-Style Slash Commands&#10;• Type '- ' for Bullet Points&#10;• Type '1. ' for Numbered Lists&#10;• Type '[] ' for To-Do Checklist&#10;• Type '# ' for Large Heading"
                  className="w-full flex-1 h-full min-h-0 p-4 sm:p-5 rounded-xl bg-[#F8FAFC] text-gray-900 font-mono text-sm leading-relaxed border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] resize-none selection:bg-blue-100"
                />
              </div>
            )}

            {/* 3. Split Mode: Textarea + Live Interactive Document */}
            {viewMode === "split" && (
              <>
                <div className="flex-1 flex flex-col p-4 sm:p-6 relative overflow-hidden bg-white border-r-2 border-gray-200 md:w-1/2">
                  <textarea
                    ref={textareaRef}
                    value={currentContent}
                    onChange={handleContentChange}
                    onKeyDown={handleEditorKeyDown}
                    onSelect={handleSelectText}
                    onContextMenu={handleContextMenu}
                    placeholder="Start typing your notes..."
                    className="w-full flex-1 h-full min-h-0 p-4 rounded-xl bg-[#F8FAFC] text-gray-900 font-mono text-sm leading-relaxed border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] resize-none"
                  />
                </div>
                <div className="flex-1 p-6 sm:p-8 overflow-y-auto bg-white md:w-1/2">
                  <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-gray-100">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-[#3B82F6] px-2 py-0.5 rounded">
                        Interactive Preview
                      </span>
                      <span className="text-xs text-gray-400">({readTimeMin} min read)</span>
                    </div>
                    {renderInteractiveDocument()}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bottom Notepad Info Bar */}
          <div className="px-6 py-2 bg-[#F3F4F6] border-t-2 border-gray-200 flex items-center justify-between text-xs font-bold text-gray-500 shrink-0">
            <div className="flex items-center gap-4">
              <span>{wordCount} words</span>
              <span>{charCount} characters</span>
              <span className="hidden sm:inline text-gray-400">• {readTimeMin} min read</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-gray-400">💡 Type <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">/--checkbox task --/</code> or click Checkbox</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px]">Ctrl+Z</kbd> Undo</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px]">Ctrl+S</kbd> Save</span>
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
              style={{ top: `${bubbleToolbar.y}px`, left: `${bubbleToolbar.x}px` }}
              className="absolute z-40 bg-[#111827] text-white px-2 py-1.5 rounded-xl border border-gray-700 shadow-2xl flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => applyFormatting("**", "**")}
                className="p-1.5 rounded hover:bg-gray-800 text-gray-200 font-bold transition cursor-pointer"
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("*", "*")}
                className="p-1.5 rounded hover:bg-gray-800 text-gray-200 italic transition cursor-pointer"
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleAiActionOnSelection("convert_to_checkbox")}
                className="p-1.5 rounded hover:bg-gray-800 text-blue-400 font-bold transition flex items-center gap-1 text-xs cursor-pointer"
                title="Convert selection to Task Checkbox"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="text-[10px]">Checkbox</span>
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("`", "`")}
                className="p-1.5 rounded hover:bg-gray-800 text-emerald-400 font-mono transition cursor-pointer"
                title="Inline Code"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("==", "==")}
                className="p-1.5 rounded hover:bg-gray-800 text-amber-400 transition cursor-pointer"
                title="Highlight"
              >
                <Highlighter className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-gray-700 mx-1" />

              <button
                type="button"
                onClick={() => handleAiActionOnSelection("execute_task")}
                disabled={isAiProcessingSelection}
                className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                title="AI: Generate Deliverable (Email template, etc.)"
              >
                {isAiProcessingSelection && activeAiAction === "execute_task" ? (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                ) : (
                  <Sparkles className="w-3 h-3 text-amber-400" />
                )}
                <span>AI Deliverable</span>
              </button>

              <button
                type="button"
                onClick={() => handleAiActionOnSelection("make_short")}
                disabled={isAiProcessingSelection}
                className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                title="Make selection shorter and concise"
              >
                {isAiProcessingSelection && activeAiAction === "make_short" ? (
                  <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                ) : (
                  <Scissors className="w-3 h-3 text-rose-400" />
                )}
                <span>Shorten</span>
              </button>
            </div>
          )}

          {/* Right-Click AI Menu on Selection */}
          {contextMenu && contextMenu.isOpen && (
            <div
              style={{
                top: `${contextMenu.y}px`,
                left: `${contextMenu.x}px`,
                maxHeight: "calc(100vh - 24px)",
              }}
              className="fixed z-50 w-72 sm:w-80 bg-[#111827] text-white rounded-xl border-2 border-gray-700 p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-100 select-none flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-2.5 py-1.5 border-b border-gray-800 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">
                      AI & Task Actions
                    </span>
                    <span className="text-xs text-gray-300 font-medium truncate block max-w-[180px]">
                      "{contextMenu.selectedText}"
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setContextMenu(null)}
                  className="p-1 text-gray-400 hover:text-white rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Actions List with smooth scrolling and compact padding */}
              <div className="py-1 space-y-0.5 overflow-y-auto max-h-[min(380px,calc(100vh-120px))] pr-0.5">
                {[
                  {
                    id: "convert_to_checkbox",
                    label: "Convert to Task Checkbox",
                    desc: "Turn into interactive - [ ] task",
                    icon: CheckSquare,
                    color: "text-blue-400 bg-blue-950/60",
                  },
                  {
                    id: "execute_task",
                    label: "Generate Task Deliverable",
                    desc: "Email draft, template, or code",
                    icon: Sparkles,
                    color: "text-amber-400 bg-amber-950/60",
                  },
                  {
                    id: "make_short",
                    label: "Make Shorter (Short Version)",
                    desc: "Short, concise & punchy",
                    icon: Scissors,
                    color: "text-rose-400 bg-rose-950/60",
                  },
                  {
                    id: "hinglish_to_english",
                    label: "Translate Hinglish → English",
                    desc: "Hindi/Hinglish to standard English",
                    icon: Languages,
                    color: "text-blue-400 bg-blue-950/60",
                  },
                  {
                    id: "professional",
                    label: "Corporate Professional Tone",
                    desc: "Formal executive business tone",
                    icon: Briefcase,
                    color: "text-purple-400 bg-purple-950/60",
                  },
                  {
                    id: "grammar",
                    label: "Fix Grammar & Spelling",
                    desc: "Fix typos, tense & sentence flow",
                    icon: CheckCheck,
                    color: "text-emerald-400 bg-emerald-950/60",
                  },
                  {
                    id: "english_to_simple",
                    label: "Simplify for Client",
                    desc: "Easy, crystal clear explanation",
                    icon: Smile,
                    color: "text-amber-400 bg-amber-950/60",
                  },
                  {
                    id: "summarize",
                    label: "Summarize Selection",
                    desc: "Crisp bullet points summary",
                    icon: FileText,
                    color: "text-indigo-400 bg-indigo-950/60",
                  },
                ].map((action) => {
                  const Icon = action.icon;
                  const isCurrentAction = isAiProcessingSelection && activeAiAction === action.id;
                  return (
                    <button
                      key={action.id}
                      disabled={isAiProcessingSelection}
                      onClick={() => handleAiActionOnSelection(action.id)}
                      className="w-full text-left p-1.5 rounded-lg hover:bg-gray-800/90 transition-all flex items-center gap-2 group cursor-pointer disabled:opacity-50"
                    >
                      <div className={cn("p-1 rounded transition shrink-0", action.color)}>
                        {isCurrentAction ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        ) : (
                          <Icon className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-gray-100 group-hover:text-amber-300 leading-tight">
                          {action.label}
                        </div>
                        <div className="text-[10px] text-gray-400 font-medium truncate">
                          {action.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-2.5 py-1 border-t border-gray-800 text-[10px] text-gray-400 font-medium flex items-center justify-between shrink-0">
                <span>Selected text will be replaced</span>
                <span className="text-[9px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">Esc to close</span>
              </div>
            </div>
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
