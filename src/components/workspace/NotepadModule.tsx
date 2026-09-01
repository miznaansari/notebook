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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AIMagicButton } from "@/components/ui/ai-magic-button";
import { VoiceMicButton } from "@/components/ui/voice-mic-button";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  tags?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotepadModuleProps {
  projectId: string;
  notes: NoteItem[];
  onNotesChange: (updatedNotes: NoteItem[]) => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
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

export function NotepadModule({ projectId, notes, onNotesChange }: NotepadModuleProps) {
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(
    notes.length > 0 ? notes[0].id : null
  );
  const [currentTitle, setCurrentTitle] = React.useState("");
  const [currentContent, setCurrentContent] = React.useState("");
  const [currentTags, setCurrentTags] = React.useState("");
  const [isPinned, setIsPinned] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "unsaved">("saved");
  const [viewMode, setViewMode] = React.useState<"edit" | "preview" | "split">("edit");
  const [searchNotes, setSearchNotes] = React.useState("");
  const [mobileView, setMobileView] = React.useState<"list" | "editor">(notes.length > 0 ? "editor" : "list");

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

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const editorContainerRef = React.useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Refs to track absolute latest state without stale closure or prop-overwrite issues
  const latestContentRef = React.useRef("");
  const latestTitleRef = React.useRef("");
  const latestTagsRef = React.useRef("");
  const latestPinnedRef = React.useRef(false);
  const latestActiveIdRef = React.useRef<string | null>(null);
  const lastLoadedNoteIdRef = React.useRef<string | null>(null);

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

  // Flush pending save immediately to server
  const saveNoteToServer = React.useCallback(
    async (noteId: string, title: string, content: string, tags: string, pinned: boolean) => {
      if (!noteId) return;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/projects/${projectId}/notes/${noteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || "Untitled Note",
            content,
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

    autoSaveTimeoutRef.current = setTimeout(() => {
      if (latestActiveIdRef.current) {
        saveNoteToServer(
          latestActiveIdRef.current,
          latestTitleRef.current,
          latestContentRef.current,
          latestTagsRef.current,
          latestPinnedRef.current
        );
      }
    }, 1200);
  }, [saveNoteToServer]);

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
        setCurrentTags(targetNote.tags || "");
        setIsPinned(targetNote.isPinned);
        setSaveStatus("saved");

        latestTitleRef.current = targetNote.title;
        latestContentRef.current = targetNote.content;
        latestTagsRef.current = targetNote.tags || "";
        latestPinnedRef.current = targetNote.isPinned;
        latestActiveIdRef.current = targetNote.id;
        lastLoadedNoteIdRef.current = targetNote.id;

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

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Y, Escape)
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setSlashMenu(null);
        setBubbleToolbar(null);
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
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [saveNoteToServer, handleUndo, handleRedo]);

  // Slash Command Definitions (Notion Style)
  const slashCommands = React.useMemo(
    () => [
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
        id: "todo",
        title: "To-do Checklist",
        description: "Task item with interactive box (- [ ] )",
        icon: CheckSquare,
        prefix: "- [ ] ",
        suffix: "",
        color: "text-rose-500 bg-rose-50",
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

      // B) Numbered List: 1. Item
      const numMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (numMatch) {
        const indent = numMatch[1];
        const currentNum = parseInt(numMatch[2], 10);
        const itemText = numMatch[3];

        if (itemText.trim().length === 0) {
          // Empty number item: Exit list mode
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

        // Continue numbered list
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
          // Empty bullet item: Exit bullet mode
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

        // Continue bullet point
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
          // Empty quote line: Exit quote block
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

        // Continue quote block
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

    // 5. Live Space Key Auto-Transformations (# , ## , - , [] , 1. , > )
    if (e.key === " " && selectionStart === selectionEnd) {
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const linePrefix = value.substring(lineStart, selectionStart);

      const triggers: Array<{ pattern: string; replaceWith: string }> = [
        { pattern: "###", replaceWith: "### " },
        { pattern: "##", replaceWith: "## " },
        { pattern: "#", replaceWith: "# " },
        { pattern: "-", replaceWith: "- " },
        { pattern: "*", replaceWith: "- " },
        { pattern: "[]", replaceWith: "- [ ] " },
        { pattern: "[ ]", replaceWith: "- [ ] " },
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

  // Textarea Change Handler (debounced history snapshot & slash command detection)
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCurrentContent(val);
    latestContentRef.current = val;
    scheduleAutoSave();

    // Debounce history snapshot for typing
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      pushHistorySnapshot(val);
    }, 600);

    // Detect Slash Command trigger (/)
    const lineStart = val.lastIndexOf("\n", cursorPos - 1) + 1;
    const currentLine = val.substring(lineStart, cursorPos);

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

  // Right-Click Context Menu for Selection AI
  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentContent.substring(start, end).trim();

    if (selectedText.length > 0) {
      e.preventDefault();
      const menuWidth = 290;
      const menuHeight = 330;
      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

      setContextMenu({
        isOpen: true,
        x: Math.max(10, x),
        y: Math.max(10, y),
        selectedText,
        selectionStart: start,
        selectionEnd: end,
      });
    } else {
      setContextMenu(null);
    }
  };

  // Execute AI action on selected text range
  const handleAiActionOnSelection = async (action: string) => {
    const targetSelected = contextMenu?.selectedText || bubbleToolbar?.selectedText;
    const start = contextMenu?.selectionStart ?? bubbleToolbar?.start;
    const end = contextMenu?.selectionEnd ?? bubbleToolbar?.end;

    if (!targetSelected || start === undefined || end === undefined) return;

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
        const before = currentContent.substring(0, start);
        const after = currentContent.substring(end);
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

        toast.success(`Selected text updated with AI!`, {
          action: {
            label: "Undo (Ctrl+Z)",
            onClick: () => handleUndo(),
          },
          duration: 5000,
        });

        setContextMenu(null);
        setBubbleToolbar(null);

        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(start, start + replacementText.length);
          }
        }, 50);
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

  // Toggle Interactive Checkbox item (in both Preview and Editor)
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
    } else {
      return;
    }

    const newFull = lines.join("\n");
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    pushHistorySnapshot(currentContent);
    pushHistorySnapshot(newFull);

    setCurrentContent(newFull);
    latestContentRef.current = newFull;
    scheduleAutoSave();
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
      newPinned
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
      latestPinnedRef.current
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
        latestPinnedRef.current
      );
    }
    setActiveNoteId(noteId);
    setMobileView("editor");
  };

  const handleCreateNote = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Note",
          content: "# New Note\n\nStart typing here... Tip: Type `/` for slash commands or `- ` for instant bullet points!",
          tags: "General",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onNotesChange([data.note, ...notes]);
        lastLoadedNoteIdRef.current = null;
        setActiveNoteId(data.note.id);
        setMobileView("editor");
        toast.success("New note created");
      }
    } catch (err) {
      toast.error("Failed to create note");
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

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchNotes.toLowerCase()) ||
      n.content.toLowerCase().includes(searchNotes.toLowerCase()) ||
      (n.tags && n.tags.toLowerCase().includes(searchNotes.toLowerCase()))
  );

  const wordCount = currentContent.trim() ? currentContent.trim().split(/\s+/).length : 0;
  const charCount = currentContent.length;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  // Render Rich Markdown Preview with Clickable Tasks & Callout cards
  const renderRichPreview = () => {
    const lines = currentContent.split("\n");
    return (
      <div className="space-y-2 font-sans text-gray-900 leading-relaxed">
        {lines.map((line, idx) => {
          // 1. Heading 1
          if (line.startsWith("# ")) {
            return (
              <h1 key={idx} className="text-2xl sm:text-3xl font-extrabold text-gray-950 pt-3 pb-1 border-b-2 border-gray-200 mt-2">
                {line.substring(2)}
              </h1>
            );
          }
          // 2. Heading 2
          if (line.startsWith("## ")) {
            return (
              <h2 key={idx} className="text-xl sm:text-2xl font-bold text-gray-900 pt-2 pb-0.5 mt-3 text-indigo-950">
                {line.substring(3)}
              </h2>
            );
          }
          // 3. Heading 3
          if (line.startsWith("### ")) {
            return (
              <h3 key={idx} className="text-lg font-bold text-gray-800 pt-1 mt-2">
                {line.substring(4)}
              </h3>
            );
          }
          // 4. Checkbox Task item
          if (line.match(/^(\s*)-\s*\[([ xX])?\]\s*(.*)$/)) {
            const isChecked = line.includes("- [x]") || line.includes("- [X]");
            const text = line.replace(/^(\s*)-\s*\[([ xX])?\]\s*/, "");
            return (
              <div
                key={idx}
                onClick={() => toggleCheckbox(idx)}
                className="flex items-start gap-2.5 py-1 px-1.5 rounded-lg hover:bg-gray-50 transition cursor-pointer select-none group"
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center mt-1 transition-all shrink-0",
                    isChecked
                      ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                      : "border-gray-400 bg-white group-hover:border-[#3B82F6]"
                  )}
                >
                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium transition-all",
                    isChecked ? "line-through text-gray-400" : "text-gray-800"
                  )}
                >
                  {text || <span className="text-gray-300 italic">Empty task</span>}
                </span>
              </div>
            );
          }
          // 5. Bullet List
          if (line.match(/^(\s*)([-*•])\s+(.*)$/)) {
            const text = line.replace(/^(\s*)([-*•])\s+/, "");
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-2 py-0.5 text-sm text-gray-800">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] mt-2 shrink-0" />
                <span>{text}</span>
              </div>
            );
          }
          // 6. Numbered List
          if (line.match(/^(\s*)(\d+)\.\s+(.*)$/)) {
            const match = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
            const num = match ? match[2] : "1";
            const text = match ? match[3] : "";
            return (
              <div key={idx} className="flex items-start gap-2 pl-2 py-0.5 text-sm text-gray-800">
                <span className="font-bold text-[#3B82F6] text-xs mt-0.5 shrink-0 min-w-[16px]">{num}.</span>
                <span>{text}</span>
              </div>
            );
          }
          // 7. Callout Box / Key Note
          if (line.startsWith("> 💡") || line.startsWith("> ⚠️") || line.startsWith("> 📌")) {
            return (
              <div key={idx} className="my-2 p-3.5 bg-amber-50/80 border-l-4 border-amber-500 rounded-r-lg text-sm text-amber-950 font-medium">
                {line.substring(2)}
              </div>
            );
          }
          // 8. Standard Blockquote
          if (line.startsWith("> ")) {
            return (
              <blockquote key={idx} className="my-2 pl-4 py-1 border-l-4 border-gray-300 italic text-gray-600 text-sm">
                {line.substring(2)}
              </blockquote>
            );
          }
          // 9. Divider Rule
          if (line.trim() === "---") {
            return <hr key={idx} className="my-4 border-t-2 border-gray-200" />;
          }
          // 10. Code Block Line
          if (line.startsWith("```")) {
            return (
              <div key={idx} className="text-xs font-mono bg-gray-900 text-emerald-400 px-3 py-1.5 rounded-t-md mt-2">
                {line}
              </div>
            );
          }
          // 11. Empty Line
          if (line.trim() === "") {
            return <div key={idx} className="h-3" />;
          }
          // 12. Standard Paragraph
          return (
            <p key={idx} className="text-sm text-gray-800 leading-relaxed">
              {line}
            </p>
          );
        })}
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
              className="gap-1 text-xs h-7 px-2"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={3} />
              <span>New Note</span>
            </Button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter notes by title or tags..."
              value={searchNotes}
              onChange={(e) => setSearchNotes(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 rounded-md bg-[#F3F4F6] text-xs font-semibold text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition-all"
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
                className="mt-3 text-xs w-full"
              >
                Create Note
              </Button>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isSelected = note.id === activeNoteId;
              return (
                <div
                  key={note.id}
                  onClick={() => handleSelectNote(note.id)}
                  className={cn(
                    "group p-3.5 rounded-lg cursor-pointer transition-all duration-200 select-none relative",
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

                  <p className="text-xs text-gray-500 line-clamp-2 mt-1.5 font-normal">
                    {note.content.replace(/[#*`_>\[\]]/g, "").slice(0, 90) || "Empty note..."}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400 font-medium">
                    <span>{formatDate(note.updatedAt)}</span>
                    {note.tags && (
                      <span className="truncate max-w-[120px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">
                        {note.tags}
                      </span>
                    )}
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
                      className="text-[11px] sm:text-xs text-gray-600 font-medium placeholder:text-gray-400 border-none outline-none w-full bg-transparent truncate"
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

                {/* Live Voice STT Dictation */}
                <VoiceMicButton
                  onTranscript={(transcript) => {
                    if (typingTimerRef.current) {
                      clearTimeout(typingTimerRef.current);
                      typingTimerRef.current = null;
                    }
                    const textarea = textareaRef.current;
                    let newContent = "";
                    let newPos = 0;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const before = currentContent.substring(0, start);
                      const after = currentContent.substring(end);
                      const separator = before && !before.endsWith("\n") && !before.endsWith(" ") ? " " : "";
                      newContent = before + separator + transcript + after;
                      newPos = start + separator.length + transcript.length;
                    } else {
                      const separator = currentContent && !currentContent.endsWith("\n") ? "\n\n" : "";
                      newContent = currentContent + separator + transcript;
                    }

                    pushHistorySnapshot(currentContent);
                    pushHistorySnapshot(newContent);
                    setCurrentContent(newContent);
                    latestContentRef.current = newContent;
                    scheduleAutoSave();

                    if (textarea && newPos > 0) {
                      setTimeout(() => {
                        textarea.focus();
                        textarea.setSelectionRange(newPos, newPos);
                      }, 50);
                    }

                    toast.success("Voice transcript inserted", {
                      action: {
                        label: "Undo (Ctrl+Z)",
                        onClick: () => handleUndo(),
                      },
                      duration: 4000,
                    });
                  }}
                  variant="rose"
                  size="sm"
                  label="Voice"
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
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1" />

              {/* Text Formats */}
              <button
                type="button"
                onClick={() => applyFormatting("**", "**")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition font-bold"
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("*", "*")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition italic"
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("~~", "~~")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Strikethrough (Ctrl+Shift+X)"
              >
                <Strikethrough className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("==", "==")}
                className="p-1.5 rounded hover:bg-gray-200 text-amber-600 transition"
                title="Highlight Marker"
              >
                <Highlighter className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1" />

              {/* Headings */}
              <button
                type="button"
                onClick={() => applyFormatting("# ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Heading 1 (#)"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("## ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Heading 2 (##)"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("### ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Heading 3 (###)"
              >
                <Heading3 className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1" />

              {/* Lists & Tasks */}
              <button
                type="button"
                onClick={() => applyFormatting("- ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Bullet List (-)"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("1. ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Numbered List (1.)"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("- [ ] ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Task Checklist (- [ ])"
              >
                <CheckSquare className="w-4 h-4 text-[#3B82F6]" />
              </button>

              <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1" />

              {/* Blocks */}
              <button
                type="button"
                onClick={() => applyFormatting("> 💡 **Note:** ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-amber-600 transition"
                title="Callout Box"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("> ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Quote (>)"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("```\n", "\n```")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Code Block"
              >
                <Code className="w-4 h-4" />
              </button>
            </div>

            {/* View Mode Toggle Switch */}
            <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-md border-2 border-gray-200 shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => setViewMode("edit")}
                className={cn(
                  "px-2 py-0.5 text-xs font-bold rounded transition",
                  viewMode === "edit"
                    ? "bg-[#3B82F6] text-white"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={cn(
                  "px-2 py-0.5 text-xs font-bold rounded transition",
                  viewMode === "preview"
                    ? "bg-[#3B82F6] text-white"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={cn(
                  "hidden md:block px-2 py-0.5 text-xs font-bold rounded transition",
                  viewMode === "split"
                    ? "bg-[#3B82F6] text-white"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Split
              </button>
            </div>
          </div>

          {/* Editor & Live Preview Canvas */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* Editor Area */}
            {(viewMode === "edit" || viewMode === "split") && (
              <div
                className={cn(
                  "flex-1 flex flex-col p-4 sm:p-6 relative overflow-hidden bg-white",
                  viewMode === "split" && "border-r-2 border-gray-200 md:w-1/2"
                )}
              >
                <textarea
                  ref={textareaRef}
                  value={currentContent}
                  onChange={handleContentChange}
                  onKeyDown={handleEditorKeyDown}
                  onSelect={handleSelectText}
                  onContextMenu={handleContextMenu}
                  placeholder="Start typing your notes...&#10;&#10;✨ Tip: Type '/' for Slash Commands&#10;• Type '- ' for Bullet Points&#10;• Type '1. ' for Numbered Lists&#10;• Type '[] ' for To-Do Checklist&#10;• Type '# ' for Large Heading"
                  className="w-full flex-1 h-full min-h-0 p-4 sm:p-5 rounded-xl bg-[#F8FAFC] text-gray-900 font-mono text-sm leading-relaxed border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] resize-none selection:bg-blue-100"
                />
              </div>
            )}

            {/* Rich Preview Area */}
            {(viewMode === "preview" || viewMode === "split") && (
              <div
                className={cn(
                  "flex-1 p-6 sm:p-8 overflow-y-auto bg-white",
                  viewMode === "split" && "md:w-1/2"
                )}
              >
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-gray-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-[#3B82F6] px-2 py-0.5 rounded">
                      Live Rich Preview
                    </span>
                    <span className="text-xs text-gray-400">({readTimeMin} min read)</span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 pb-2 mb-4">
                    {currentTitle || "Untitled Note"}
                  </h1>

                  {renderRichPreview()}
                </div>
              </div>
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
              <span className="hidden md:inline text-gray-400">💡 Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px] font-mono">/</kbd> for quick menu</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px]">Ctrl+Z</kbd> Undo</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px]">Ctrl+S</kbd> Save</span>
            </div>
          </div>

          {/* 🪄 Notion-Style Slash Command Palette Popover */}
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
                className="p-1.5 rounded hover:bg-gray-800 text-gray-200 font-bold transition"
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("*", "*")}
                className="p-1.5 rounded hover:bg-gray-800 text-gray-200 italic transition"
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("~~", "~~")}
                className="p-1.5 rounded hover:bg-gray-800 text-gray-200 transition"
                title="Strikethrough"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("`", "`")}
                className="p-1.5 rounded hover:bg-gray-800 text-emerald-400 font-mono transition"
                title="Inline Code"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("==", "==")}
                className="p-1.5 rounded hover:bg-gray-800 text-amber-400 transition"
                title="Highlight"
              >
                <Highlighter className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-gray-700 mx-1" />

              <button
                type="button"
                onClick={() => handleAiActionOnSelection("make_short")}
                disabled={isAiProcessingSelection}
                className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold flex items-center gap-1 transition"
                title="Make selection shorter and concise"
              >
                {isAiProcessingSelection && activeAiAction === "make_short" ? (
                  <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                ) : (
                  <Scissors className="w-3 h-3 text-rose-400" />
                )}
                <span>Shorten</span>
              </button>

              <button
                type="button"
                onClick={() => handleAiActionOnSelection("professional")}
                disabled={isAiProcessingSelection}
                className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1 transition"
              >
                {isAiProcessingSelection && activeAiAction === "professional" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-amber-400" />
                )}
                <span>AI Polish</span>
              </button>
            </div>
          )}

          {/* Right-Click AI Menu on Selection */}
          {contextMenu && contextMenu.isOpen && (
            <div
              style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
              className="fixed z-50 w-72 bg-[#111827] text-white rounded-xl border-2 border-gray-700 p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-100 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">
                      AI on Selection
                    </span>
                    <span className="text-xs text-gray-300 font-medium truncate block max-w-[180px]">
                      "{contextMenu.selectedText}"
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setContextMenu(null)}
                  className="p-1 text-gray-400 hover:text-white rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Actions List */}
              <div className="py-1.5 space-y-1">
                {[
                  {
                    id: "make_short",
                    label: "Make Shorter (Short Version)",
                    desc: "Isko aur short, concise & punchy kar do",
                    icon: Scissors,
                    color: "text-rose-400",
                  },
                  {
                    id: "hinglish_to_english",
                    label: "Translate Hinglish → English",
                    desc: "Convert Hindi/Hinglish to English",
                    icon: Languages,
                    color: "text-blue-400",
                  },
                  {
                    id: "professional",
                    label: "Company Standard / Professional",
                    desc: "Formal corporate executive tone",
                    icon: Briefcase,
                    color: "text-purple-400",
                  },
                  {
                    id: "grammar",
                    label: "Fix Grammar & Spelling",
                    desc: "Correct typos and errors",
                    icon: CheckCheck,
                    color: "text-emerald-400",
                  },
                  {
                    id: "english_to_simple",
                    label: "Simplify for Client",
                    desc: "Clear plain English explanation",
                    icon: Smile,
                    color: "text-amber-400",
                  },
                  {
                    id: "summarize",
                    label: "Summarize Selection",
                    desc: "Crisp bullet points summary",
                    icon: FileText,
                    color: "text-indigo-400",
                  },
                ].map((action) => {
                  const Icon = action.icon;
                  const isCurrentAction = isAiProcessingSelection && activeAiAction === action.id;
                  return (
                    <button
                      key={action.id}
                      disabled={isAiProcessingSelection}
                      onClick={() => handleAiActionOnSelection(action.id)}
                      className="w-full text-left p-2 rounded-lg hover:bg-gray-800 transition-all flex items-start gap-2.5 group cursor-pointer disabled:opacity-50"
                    >
                      <div className={cn("p-1 rounded bg-gray-800 group-hover:bg-gray-700 transition shrink-0 mt-0.5", action.color)}>
                        {isCurrentAction ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        ) : (
                          <Icon className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-100 group-hover:text-amber-300 leading-tight">
                          {action.label}
                        </div>
                        <div className="text-[10px] text-gray-400 font-medium truncate mt-0.5">
                          {action.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-3 py-1.5 border-t border-gray-800 text-[10px] text-gray-400 font-medium flex items-center justify-between">
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
              className="mt-5"
            >
              Create New Note
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
