"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileWorkspaceSkeletonProps {
  projectName?: string;
  projectColor?: string;
  onOpenSidebar?: () => void;
  className?: string;
}

const TAB_WIDTHS = [72, 58, 58, 76, 62];
const ACTION_WIDTHS = [28, 52, 60, 32, 32, 32];
const TASK_LINE_WIDTHS = ["75%", "58%", "68%"];

// Phone loading screen shaped like the notes editor (where the app lands), so content swaps in
// without a jump. The header is real: project name when known and a working menu button, so the
// user can switch projects while this one loads.
export function MobileWorkspaceSkeleton({
  projectName,
  projectColor,
  onOpenSidebar,
  className,
}: MobileWorkspaceSkeletonProps) {
  return (
    <div
      className={cn("flex-1 flex flex-col overflow-hidden bg-white", className)}
      aria-busy="true"
      aria-label="Loading project"
    >
      {/* Header row: same layout as the mobile WorkspaceHeader */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          disabled={!onOpenSidebar}
          aria-label="Open projects"
          className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 active:bg-gray-200 disabled:opacity-50 shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>
        {projectName ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: projectColor || "#3B82F6" }}
            />
            <span className="text-sm font-bold text-gray-900 truncate">{projectName}</span>
          </div>
        ) : (
          <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden animate-pulse">
        {/* Tab strip */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50/50 overflow-hidden shrink-0">
          {TAB_WIDTHS.map((width, i) => (
            <div
              key={i}
              className={cn("h-7 rounded-lg shrink-0", i === 0 ? "bg-blue-200" : "bg-gray-200")}
              style={{ width }}
            />
          ))}
        </div>

        {/* Note title + action buttons */}
        <div className="px-2.5 py-3 border-b-2 border-gray-200 space-y-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-gray-200 shrink-0" />
            <div className="h-5 w-44 rounded bg-gray-300" />
          </div>
          <div className="flex items-center gap-1.5 pl-9">
            {ACTION_WIDTHS.map((width, i) => (
              <div key={i} className="h-7 rounded-md bg-gray-200 shrink-0" style={{ width }} />
            ))}
          </div>
        </div>

        {/* Formatting toolbar */}
        <div className="h-10 bg-[#F3F4F6] border-b-2 border-gray-200 shrink-0" />

        {/* Note body */}
        <div className="p-4 space-y-3">
          <div className="h-6 w-1/2 rounded bg-gray-300" />
          <div className="h-3.5 w-full rounded bg-gray-200" />
          <div className="h-3.5 w-11/12 rounded bg-gray-200" />
          <div className="h-3.5 w-2/3 rounded bg-gray-200" />
          {TASK_LINE_WIDTHS.map((width, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-gray-200 shrink-0" />
              <div className="h-3.5 rounded bg-gray-200" style={{ width }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
