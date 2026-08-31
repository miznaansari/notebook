"use client";

import * as React from "react";
import {
  FileText,
  HelpCircle,
  Calendar,
  CheckSquare,
  Sparkles,
  Printer,
  Edit,
  Trash2,
  Menu,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceTab =
  | "notes"
  | "questions"
  | "meeting-prep"
  | "meetings"
  | "tasks"
  | "templates"
  | "export";

interface WorkspaceHeaderProps {
  project: {
    id: string;
    name: string;
    clientName?: string | null;
    description?: string | null;
    color?: string;
    notes: any[];
    questions: any[];
    meetings: any[];
    tasks: any[];
  };
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  onEditProject?: () => void;
  onDeleteProject?: () => void;
  onToggleSidebar?: () => void;
}

export function WorkspaceHeader({
  project,
  activeTab,
  onTabChange,
  onEditProject,
  onDeleteProject,
  onToggleSidebar,
}: WorkspaceHeaderProps) {
  const nextMeetingQuestions = project.questions.filter((q) => q.forNextMeeting).length;
  const pendingTasks = project.tasks.filter((t) => t.status !== "COMPLETED").length;
  const mobileNavRef = React.useRef<HTMLDivElement>(null);

  const tabs: {
    id: WorkspaceTab;
    label: string;
    mobileLabel: string;
    icon: any;
    count?: number;
  }[] = [
    {
      id: "notes",
      label: "Notepad / Notes",
      mobileLabel: "Notes",
      icon: FileText,
      count: project.notes.length,
    },
    {
      id: "questions",
      label: "Client Q&A",
      mobileLabel: "Q&A",
      icon: HelpCircle,
      count: project.questions.length,
    },
    {
      id: "meeting-prep",
      label: "Next Meeting Prep",
      mobileLabel: "Prep",
      icon: Sparkles,
      count: nextMeetingQuestions > 0 ? nextMeetingQuestions : undefined,
    },
    {
      id: "meetings",
      label: "Meetings Log",
      mobileLabel: "Meetings",
      icon: Calendar,
      count: project.meetings.length,
    },
    {
      id: "tasks",
      label: "Follow-up Tasks",
      mobileLabel: "Tasks",
      icon: CheckSquare,
      count: pendingTasks > 0 ? pendingTasks : undefined,
    },
    {
      id: "templates",
      label: "Templates",
      mobileLabel: "Templates",
      icon: Briefcase,
    },
    {
      id: "export",
      label: "Export & Print",
      mobileLabel: "Export",
      icon: Printer,
    },
  ];

  // Auto-scroll active tab into view on mobile
  React.useEffect(() => {
    if (mobileNavRef.current) {
      const activeEl = mobileNavRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeTab]);

  return (
    <header className="sticky top-0 z-20 w-full bg-white border-b border-gray-200 shrink-0 select-none overflow-hidden">
      {/* ========================================================================= */}
      {/* 📱 MOBILE VIEW (< md): 2-Tier Clean Layout (Top Info + Swipeable Tab Strip) */}
      {/* ========================================================================= */}
      <div className="md:hidden overflow-hidden">
        {/* Tier 1: Mobile Project Info & Action Buttons */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700 transition shrink-0 border border-gray-200"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: project.color || "#3B82F6" }}
              />
              <h1 className="text-sm font-bold text-gray-900 truncate max-w-[140px]">
                {project.name}
              </h1>
              {project.clientName && (
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold truncate max-w-[90px]">
                  {project.clientName}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onEditProject && (
              <button
                onClick={onEditProject}
                title="Edit Project"
                className="p-1.5 text-gray-500 hover:text-gray-900 active:bg-gray-100 rounded-md transition"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteProject && (
              <button
                onClick={onDeleteProject}
                title="Delete Project"
                className="p-1.5 text-gray-400 hover:text-red-600 active:bg-red-50 rounded-md transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Swipeable Touch Tab Strip for Mobile */}
        <div
          ref={mobileNavRef}
          className="flex items-center gap-1 px-2 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth bg-gray-50/50 py-1"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-active={isActive ? "true" : "false"}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                    : "text-slate-600 hover:bg-white hover:text-slate-900 active:bg-gray-200"
                )}
              >
                <Icon
                  className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    isActive ? "text-white" : "text-slate-400"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span>{tab.mobileLabel}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-bold min-w-[16px] text-center leading-none",
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-gray-200 text-slate-700"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 💻 DESKTOP VIEW (>= md): Exact Photo Design + Placement                   */}
      {/* ========================================================================= */}
      <div className="hidden md:flex items-center justify-between px-3 sm:px-4 overflow-hidden">
        {/* Left: Hamburger & Project Title Meta */}
        <div className="flex items-center gap-2 min-w-0 py-2">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="md:hidden p-1.5 rounded-md hover:bg-gray-100 text-gray-700 transition shrink-0"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color || "#3B82F6" }}
            />
            <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">
              {project.name}
            </h1>
            {project.clientName && (
              <span className="hidden sm:inline-block text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold truncate max-w-[120px]">
                {project.clientName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {onEditProject && (
              <button
                onClick={onEditProject}
                title="Edit Project Details"
                className="p-1 text-gray-400 hover:text-gray-900 rounded hover:bg-gray-100 transition"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteProject && (
              <button
                onClick={onDeleteProject}
                title="Delete Project"
                className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Workspace Tabs with photo design */}
        <nav className="flex items-center overflow-x-auto overflow-y-hidden no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "group flex items-center gap-2 px-3 sm:px-3.5 py-3 text-xs sm:text-[13px] whitespace-nowrap transition-all duration-150 cursor-pointer border-b-2",
                  isActive
                    ? "bg-blue-50/70 text-blue-600 font-semibold border-blue-600"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 font-medium border-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "text-[11px] px-1.5 py-0.5 rounded font-bold min-w-[18px] text-center leading-none",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
