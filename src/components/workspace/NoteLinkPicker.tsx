"use client";

import * as React from "react";
import { FileText, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDefaultNoteTitle, normalizeNoteTitle } from "@/lib/note-links";

export interface LinkableNote {
  id: string;
  title: string;
}

// Viewport rect the picker attaches to (caret, line, or button)
export interface PickerAnchor {
  left: number;
  top: number;
  bottom: number;
}

interface NoteLinkPickerProps {
  notes: LinkableNote[];
  anchor: PickerAnchor;
  excludeNoteId?: string | null;
  initialQuery?: string;
  onSelect: (title: string) => void;
  // "escape" hands focus back to the editor; "outside" leaves it where the user clicked
  onClose: (reason: "escape" | "outside") => void;
}

const MAX_RESULTS = 8;

// Searchable list of notes to reference. Picking one inserts [[Title]]; typing a name that
// doesn't exist yet links a new note, which is created the first time the link is clicked.
export function NoteLinkPicker({ notes, anchor, excludeNoteId, initialQuery = "", onSelect, onClose }: NoteLinkPickerProps) {
  const [query, setQuery] = React.useState(initialQuery);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const options = React.useMemo(() => {
    const q = normalizeNoteTitle(query);
    const matches = notes
      .filter((n) => n.id !== excludeNoteId && !isDefaultNoteTitle(n.title))
      .filter((n) => !q || n.title.toLowerCase().includes(q))
      .sort((a, b) => Number(b.title.toLowerCase().startsWith(q)) - Number(a.title.toLowerCase().startsWith(q)))
      .slice(0, MAX_RESULTS)
      .map((n) => ({ key: n.id, title: n.title, isNew: false }));
    const exact = notes.some((n) => normalizeNoteTitle(n.title) === q);
    if (q && !exact && !isDefaultNoteTitle(query)) {
      matches.push({ key: "__new__", title: query.trim(), isNew: true });
    }
    return matches;
  }, [notes, query, excludeNoteId]);

  const safeIndex = Math.min(activeIndex, Math.max(0, options.length - 1));

  // Below the anchor, flipped above when there's no room; clamped inside the viewport
  React.useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const margin = 8;
    const { width, height } = el.getBoundingClientRect();
    let top = anchor.bottom + 6;
    if (top + height > window.innerHeight - margin) top = anchor.top - height - 6;
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
    const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin));
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [anchor, options.length]);

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose("outside");
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  const choose = (index: number) => {
    const option = options[index];
    if (option) onSelect(option.title);
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Link to a note"
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 w-72 max-w-[calc(100vw-16px)] bg-white rounded-xl border-2 border-gray-200 shadow-xl p-1 select-none"
    >
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-100">
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((safeIndex + 1) % Math.max(1, options.length));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((safeIndex - 1 + options.length) % Math.max(1, options.length));
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              choose(safeIndex);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onClose("escape");
            }
          }}
          placeholder="Link to note..."
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div role="listbox" className="max-h-64 overflow-y-auto py-1 space-y-0.5">
        {options.length === 0 ? (
          <p className="px-2.5 py-3 text-xs text-gray-400 text-center">Type a note title to link it</p>
        ) : (
          options.map((option, index) => (
            <button
              key={option.key}
              type="button"
              role="option"
              aria-selected={index === safeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs font-semibold transition cursor-pointer",
                index === safeIndex ? "bg-blue-50 text-[#3B82F6]" : "text-gray-700"
              )}
            >
              {option.isNew ? (
                <Plus className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <FileText className={cn("w-3.5 h-3.5 shrink-0", index === safeIndex ? "text-[#3B82F6]" : "text-gray-400")} />
              )}
              <span className="truncate">
                {option.isNew ? <>Link new note &ldquo;{option.title}&rdquo;</> : option.title}
              </span>
            </button>
          ))
        )}
      </div>

      <p className="px-2.5 pt-1 pb-0.5 border-t border-gray-100 text-[10px] font-medium text-gray-400">
        ↑↓ to choose · Enter to link · Esc to close
      </p>
    </div>
  );
}
