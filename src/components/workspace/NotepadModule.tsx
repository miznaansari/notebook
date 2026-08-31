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
  CheckSquare,
  Code,
  Heading1,
  Heading2,
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

  // Context Menu State for Right-Click AI on selected text
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);
  const [isAiProcessingSelection, setIsAiProcessingSelection] = React.useState(false);
  const [activeAiAction, setActiveAiAction] = React.useState<string | null>(null);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Refs to track absolute latest state without stale closure or prop-overwrite issues
  const latestContentRef = React.useRef("");
  const latestTitleRef = React.useRef("");
  const latestTagsRef = React.useRef("");
  const latestPinnedRef = React.useRef(false);
  const latestActiveIdRef = React.useRef<string | null>(null);
  const lastLoadedNoteIdRef = React.useRef<string | null>(null);

  // Sync state ONLY when switching to a DIFFERENT active note
  React.useEffect(() => {
    if (!activeNoteId) {
      if (notes.length > 0) {
        setActiveNoteId(notes[0].id);
      }
      return;
    }

    // Only load from props if we switched to a different note
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
      }
    }
  }, [activeNoteId, notes]);

  // Flush pending save immediately
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

  // Debounced auto-save handler (always grabs latest from refs)
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

  // Clean up and flush on unmount or tab close
  React.useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcut Ctrl+S / Cmd+S & Escape to close context menu
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
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
    };

    const handleClickOutside = () => {
      setContextMenu(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [saveNoteToServer]);

  // Handle Right Click on Textarea
  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentContent.substring(start, end).trim();

    if (selectedText.length > 0) {
      e.preventDefault(); // Intercept browser default context menu

      // Screen boundary detection
      const menuWidth = 280;
      const menuHeight = 320;
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
      // If no text selected, close custom menu and let native menu work
      setContextMenu(null);
    }
  };

  // Execute AI action on ONLY the selected text range
  const handleAiActionOnSelection = async (action: string) => {
    if (!contextMenu || !contextMenu.selectedText) return;

    setIsAiProcessingSelection(true);
    setActiveAiAction(action);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          text: contextMenu.selectedText,
          context: `Selection in Note: "${currentTitle}"`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        const replacementText = data.result;
        const before = currentContent.substring(0, contextMenu.selectionStart);
        const after = currentContent.substring(contextMenu.selectionEnd);
        const newFullContent = before + replacementText + after;

        // Update state and mutable ref
        setCurrentContent(newFullContent);
        latestContentRef.current = newFullContent;
        scheduleAutoSave();

        toast.success(`Selected text updated with Gemini AI!`);
        setContextMenu(null);

        // Reselect replaced text in textarea
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(
              contextMenu.selectionStart,
              contextMenu.selectionStart + replacementText.length
            );
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

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCurrentTitle(val);
    latestTitleRef.current = val;
    scheduleAutoSave();
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCurrentContent(val);
    latestContentRef.current = val;
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
    if (noteId === activeNoteId) return;
    // Save current note before switching
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
  };

  const handleCreateNote = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Note",
          content: "# New Note\n\nStart typing your requirements, client notes, or ideas here...",
          tags: "General",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onNotesChange([data.note, ...notes]);
        lastLoadedNoteIdRef.current = null;
        setActiveNoteId(data.note.id);
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
        }
        toast.success("Note deleted");
      }
    } catch (err) {
      toast.error("Failed to delete note");
    }
  };

  // Helper to insert markdown formatting at cursor
  const insertFormatting = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentContent.substring(start, end) || "text";
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newContent =
      currentContent.substring(0, start) +
      replacement +
      currentContent.substring(end);

    setCurrentContent(newContent);
    latestContentRef.current = newContent;
    scheduleAutoSave();

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      );
    }, 10);
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

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-220px)] bg-white relative">
      {/* Left Note Index Column */}
      <div className="w-full lg:w-80 border-r-2 border-gray-200 bg-[#F3F4F6] flex flex-col shrink-0">
        <div className="p-4 border-b-2 border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#3B82F6]" strokeWidth={2.5} />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                Notes ({notes.length})
              </h3>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateNote}
              className="gap-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={3} />
              <span>New Note</span>
            </Button>
          </div>

          <input
            type="text"
            placeholder="Filter notes by title or tags..."
            value={searchNotes}
            onChange={(e) => setSearchNotes(e.target.value)}
            className="w-full h-9 px-3 rounded-md bg-[#F3F4F6] text-xs font-semibold text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition-all"
          />
        </div>

        {/* Notes Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[300px] lg:max-h-[calc(100vh-320px)]">
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
                      ? "bg-white border-l-4 border-l-[#3B82F6] text-gray-900"
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

      {/* Main Notepad Area */}
      {activeNoteId ? (
        <div className="flex-1 flex flex-col bg-white">
          {/* Note Controls Top Bar */}
          <div className="p-4 border-b-2 border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="flex-1 min-w-[240px]">
              <input
                type="text"
                value={currentTitle}
                onChange={handleTitleChange}
                placeholder="Note Title..."
                className="w-full text-xl sm:text-2xl font-extrabold text-gray-900 border-none outline-none placeholder:text-gray-300 bg-transparent"
              />
              <div className="flex items-center gap-2 mt-1">
                <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={currentTags}
                  onChange={handleTagsChange}
                  placeholder="Add tags separated by comma (e.g., Requirements, Payment, Ideas)..."
                  className="text-xs text-gray-600 font-medium placeholder:text-gray-400 border-none outline-none w-full bg-transparent"
                />
              </div>
            </div>

            {/* Auto-save badge & actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                onClick={handleManualSave}
                title="Click to save now (or press Ctrl+S)"
                className={cn(
                  "text-xs font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-md select-none cursor-pointer transition",
                  saveStatus === "saved" && "bg-emerald-50 text-emerald-800",
                  saveStatus === "saving" && "bg-blue-50 text-blue-800",
                  saveStatus === "unsaved" && "bg-amber-50 text-amber-900 hover:bg-amber-100"
                )}
              >
                {saveStatus === "saved" && (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10B981]" strokeWidth={3} />
                    <span>Saved</span>
                  </>
                )}
                {saveStatus === "saving" && (
                  <>
                    <Clock className="w-3.5 h-3.5 text-[#3B82F6] animate-spin" />
                    <span>Saving...</span>
                  </>
                )}
                {saveStatus === "unsaved" && (
                  <>
                    <Save className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>Save (Ctrl+S)</span>
                  </>
                )}
              </span>

              {/* Sarvam AI Real-Time Live Voice Dictation (STT) */}
              <VoiceMicButton
                onTranscript={(transcript) => {
                  const textarea = textareaRef.current;
                  if (textarea) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const before = currentContent.substring(0, start);
                    const after = currentContent.substring(end);
                    const separator = before && !before.endsWith("\n") && !before.endsWith(" ") ? " " : "";
                    const newContent = before + separator + transcript + after;
                    setCurrentContent(newContent);
                    latestContentRef.current = newContent;
                    scheduleAutoSave();
                    setTimeout(() => {
                      textarea.focus();
                      textarea.setSelectionRange(start + separator.length + transcript.length, start + separator.length + transcript.length);
                    }, 50);
                  } else {
                    const separator = currentContent && !currentContent.endsWith("\n") ? "\n\n" : "";
                    const newContent = currentContent + separator + transcript;
                    setCurrentContent(newContent);
                    latestContentRef.current = newContent;
                    scheduleAutoSave();
                  }
                }}
                variant="amber"
                size="sm"
                label="Voice (Live Hinglish)"
              />

              {/* Gemini AI Assistant */}
              <AIMagicButton
                getText={() => currentContent}
                onResult={(aiText) => {
                  setCurrentContent(aiText);
                  latestContentRef.current = aiText;
                  scheduleAutoSave();
                }}
                context={`Project Note: ${currentTitle}`}
                variant="secondary"
                size="sm"
              />

              <Button
                variant={isPinned ? "amber" : "secondary"}
                size="sm"
                onClick={handleTogglePin}
                className="gap-1 text-xs"
                title={isPinned ? "Unpin Note" : "Pin Note to Top"}
              >
                <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-current")} />
                <span className="hidden sm:inline">{isPinned ? "Pinned" : "Pin"}</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyNote}
                className="gap-1 text-xs"
                title="Copy Markdown"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadNote}
                className="gap-1 text-xs"
                title="Download Note (.md)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>

          {/* Formatting Ribbon */}
          <div className="px-4 py-2 bg-[#F3F4F6] border-b-2 border-gray-200 flex items-center justify-between gap-2 overflow-x-auto select-none">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => insertFormatting("# ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("## ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1" />
              <button
                type="button"
                onClick={() => insertFormatting("**", "**")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("*", "*")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1" />
              <button
                type="button"
                onClick={() => insertFormatting("- ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("- [ ] ", "")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Task Item"
              >
                <CheckSquare className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("```\n", "\n```")}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition"
                title="Code Block"
              >
                <Code className="w-4 h-4" />
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-md border-2 border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode("edit")}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold rounded transition",
                  viewMode === "edit"
                    ? "bg-[#3B82F6] text-white"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Editor
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold rounded transition",
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
                  "hidden md:block px-2.5 py-1 text-xs font-bold rounded transition",
                  viewMode === "split"
                    ? "bg-[#3B82F6] text-white"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Split
              </button>
            </div>
          </div>

          {/* Notepad Canvas */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* Editor Area */}
            {(viewMode === "edit" || viewMode === "split") && (
              <div
                className={cn(
                  "flex-1 flex flex-col p-4 sm:p-6 relative",
                  viewMode === "split" && "border-r-2 border-gray-200 md:w-1/2"
                )}
              >
                <textarea
                  ref={textareaRef}
                  value={currentContent}
                  onChange={handleContentChange}
                  onContextMenu={handleContextMenu}
                  placeholder="Start writing project notes, client ideas, requirements, technical snippets, meeting thoughts... Tip: Select any text and right-click to apply Gemini AI!"
                  className="w-full flex-1 p-4 rounded-lg bg-[#F3F4F6] text-gray-900 font-mono text-sm leading-relaxed border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] resize-none min-h-[400px]"
                />
              </div>
            )}

            {/* Preview Area */}
            {(viewMode === "preview" || viewMode === "split") && (
              <div
                className={cn(
                  "flex-1 p-6 overflow-y-auto bg-white",
                  viewMode === "split" && "md:w-1/2"
                )}
              >
                <div className="prose prose-blue max-w-none">
                  <h1 className="text-2xl font-extrabold text-gray-900 border-b-2 border-gray-200 pb-2 mb-4">
                    {currentTitle || "Untitled Note"}
                  </h1>
                  <div className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed text-sm">
                    {currentContent}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Notepad Info Bar */}
          <div className="px-6 py-2.5 bg-[#F3F4F6] border-t-2 border-gray-200 flex items-center justify-between text-xs font-bold text-gray-500">
            <div className="flex items-center gap-4">
              <span>{wordCount} words</span>
              <span>{charCount} characters</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-gray-400">💡 Select text + Right Click for Gemini AI</span>
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px]">Ctrl+S</kbd> to save anytime</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-12 text-center bg-white">
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

      {/* Custom Right-Click AI Menu on Selected Text */}
      {contextMenu && contextMenu.isOpen && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-72 bg-[#111827] text-white rounded-xl border-2 border-gray-700 p-2 shadow-none animate-in fade-in zoom-in-95 duration-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with selected snippet preview */}
          <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">
                  Gemini AI on Selection
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

          {/* AI Action Options */}
          <div className="py-1.5 space-y-1">
            {[
              {
                id: "hinglish_to_english",
                label: "Translate Hinglish → English",
                desc: "Convert selected Hindi/Hinglish to English",
                icon: Languages,
                color: "text-blue-400",
              },
              {
                id: "professional",
                label: "Company Standard / Professional",
                desc: "Make selection formal & corporate",
                icon: Briefcase,
                color: "text-purple-400",
              },
              {
                id: "grammar",
                label: "Fix Grammar & Spelling",
                desc: "Fix typos & errors in selection",
                icon: CheckCheck,
                color: "text-emerald-400",
              },
              {
                id: "english_to_simple",
                label: "Simplify for Client",
                desc: "Explain in plain English",
                icon: Smile,
                color: "text-amber-400",
              },
              {
                id: "summarize",
                label: "Summarize Selection",
                desc: "Condense selected paragraph",
                icon: FileText,
                color: "text-rose-400",
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

          {/* Footer status */}
          <div className="px-3 py-1.5 border-t border-gray-800 text-[10px] text-gray-400 font-medium flex items-center justify-between">
            <span>Only selected text will be replaced</span>
            <span className="text-[9px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
