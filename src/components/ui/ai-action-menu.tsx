"use client";

import * as React from "react";
import { ChevronRight, Loader2, Sparkles, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiMenuAction {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
}

export interface AiMenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: AiMenuAction[];
}

export type AiMenuEntry = AiMenuAction | AiMenuGroup | "divider";

interface AiActionMenuProps {
  title: string;
  subtitle?: string;
  entries: AiMenuEntry[];
  onSelect: (actionId: string) => void;
  onClose?: () => void;
  loadingActionId?: string | null;
  disabled?: boolean;
  footer?: React.ReactNode;
  // Side submenus try first; the other side is used only when the preferred one has no room
  submenuSide?: "left" | "right";
  className?: string;
  style?: React.CSSProperties;
}

const SUBMENU_WIDTH = 200;
const SUBMENU_ROW_HEIGHT = 30;

type SubmenuPlacement = { side: "right" | "left" | "inline"; alignBottom: boolean };

const isGroup = (entry: AiMenuEntry): entry is AiMenuGroup =>
  entry !== "divider" && "items" in entry;

const rowClass =
  "group/row w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-[#3B82F6] focus-visible:bg-blue-50 focus-visible:text-[#3B82F6] outline-none transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const iconClass = "w-3.5 h-3.5 shrink-0 text-gray-400 group-hover/row:text-[#3B82F6] group-focus-visible/row:text-[#3B82F6]";

// Compact AI menu: plain actions plus groups (e.g. Translate) whose options open in a
// flyout on hover or click. The flyout flips left / upward near viewport edges and falls
// back to an inline list when there is no room on either side (phones).
export function AiActionMenu({
  title,
  subtitle,
  entries,
  onSelect,
  onClose,
  loadingActionId,
  disabled,
  footer,
  submenuSide = "right",
  className,
  style,
}: AiActionMenuProps) {
  const [openGroupId, setOpenGroupId] = React.useState<string | null>(null);
  const [placement, setPlacement] = React.useState<SubmenuPlacement>({ side: "right", alignBottom: false });
  const rowRefs = React.useRef<{ [groupId: string]: HTMLDivElement | null }>({});
  const closeTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const openGroup = (group: AiMenuGroup) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    const rect = rowRefs.current[group.id]?.getBoundingClientRect();
    if (rect) {
      const fitsRight = rect.right + SUBMENU_WIDTH + 8 <= window.innerWidth;
      const fitsLeft = rect.left - SUBMENU_WIDTH - 8 >= 0;
      const submenuHeight = group.items.length * SUBMENU_ROW_HEIGHT + 12;
      const fits = { left: fitsLeft, right: fitsRight };
      const otherSide = submenuSide === "right" ? "left" : "right";
      setPlacement({
        side: fits[submenuSide] ? submenuSide : fits[otherSide] ? otherSide : "inline",
        alignBottom: rect.top + submenuHeight > window.innerHeight - 8,
      });
    }
    setOpenGroupId(group.id);
  };

  // Short delay so a diagonal move from the row into the flyout doesn't close it
  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpenGroupId(null), 150);
  };

  const renderAction = (action: AiMenuAction) => {
    const Icon = action.icon;
    const isLoading = loadingActionId === action.id;
    return (
      <button
        key={action.id}
        type="button"
        role="menuitem"
        title={action.hint}
        disabled={disabled}
        onClick={() => onSelect(action.id)}
        className={rowClass}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-[#3B82F6]" />
        ) : (
          <Icon className={iconClass} />
        )}
        <span className="truncate">{action.label}</span>
      </button>
    );
  };

  return (
    <div
      role="menu"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "w-56 bg-white rounded-xl border-2 border-gray-200 shadow-xl p-1 select-none text-left",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 px-2 pt-1 pb-1.5 mb-1 border-b border-gray-100">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
            <Sparkles className="w-3 h-3 text-[#3B82F6]" />
            <span>{title}</span>
          </div>
          {subtitle && (
            <div className="text-xs text-gray-600 font-medium truncate mt-0.5" title={subtitle}>
              &ldquo;{subtitle}&rdquo;
            </div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        {entries.map((entry, idx) => {
          if (entry === "divider") {
            return <div key={`divider-${idx}`} className="my-1 h-px bg-gray-100" />;
          }
          if (!isGroup(entry)) {
            return renderAction(entry);
          }

          const group = entry;
          const Icon = group.icon;
          const isOpen = openGroupId === group.id;
          const isChildLoading = group.items.some((item) => item.id === loadingActionId);

          return (
            <div
              key={group.id}
              ref={(el) => {
                rowRefs.current[group.id] = el;
              }}
              className="relative"
              // Hover only for a real mouse: a touch tap also fires enter events, which would fight the click toggle
              onPointerEnter={(e) => e.pointerType === "mouse" && openGroup(group)}
              onPointerLeave={(e) => e.pointerType === "mouse" && scheduleClose()}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                disabled={disabled}
                onClick={() => (isOpen && placement.side === "inline" ? setOpenGroupId(null) : openGroup(group))}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    openGroup(group);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    setOpenGroupId(null);
                  }
                }}
                className={cn(rowClass, isOpen && "bg-blue-50 text-[#3B82F6]")}
              >
                {isChildLoading ? (
                  <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-[#3B82F6]" />
                ) : (
                  <Icon className={cn(iconClass, isOpen && "text-[#3B82F6]")} />
                )}
                <span className="flex-1 truncate">{group.label}</span>
                <ChevronRight
                  className={cn(
                    "w-3.5 h-3.5 shrink-0 text-gray-300 group-hover/row:text-[#3B82F6] transition-transform",
                    isOpen && "text-[#3B82F6]",
                    isOpen && placement.side === "inline" && "rotate-90"
                  )}
                />
              </button>

              {isOpen &&
                (placement.side === "inline" ? (
                  <div role="menu" className="ml-3 pl-2 border-l-2 border-blue-100 space-y-0.5 my-0.5">
                    {group.items.map(renderAction)}
                  </div>
                ) : (
                  // Transparent padding bridges the gap so the pointer never "leaves" while crossing to the flyout
                  <div
                    className={cn(
                      "absolute z-10",
                      placement.side === "right" ? "left-full pl-1.5" : "right-full pr-1.5",
                      placement.alignBottom ? "bottom-0" : "top-0"
                    )}
                    style={{ width: SUBMENU_WIDTH }}
                  >
                    <div role="menu" className="bg-white rounded-xl border-2 border-gray-200 shadow-xl p-1 space-y-0.5">
                      {group.items.map(renderAction)}
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {footer && (
        <div className="mt-1 px-2 pt-1.5 pb-0.5 border-t border-gray-100 text-[10px] text-gray-400 font-medium">
          {footer}
        </div>
      )}
    </div>
  );
}
