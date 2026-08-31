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
  Share2,
  Clock,
  Briefcase,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}

export function WorkspaceHeader({
  project,
  activeTab,
  onTabChange,
  onEditProject,
  onDeleteProject,
}: WorkspaceHeaderProps) {
  const pendingQuestions = project.questions.filter(
    (q) => q.status === "PENDING" || q.status === "NEED_FOLLOWUP"
  ).length;
  const nextMeetingQuestions = project.questions.filter((q) => q.forNextMeeting).length;
  const pendingTasks = project.tasks.filter((t) => t.status !== "COMPLETED").length;

  const tabs: { id: WorkspaceTab; label: string; icon: any; count?: number; countVariant?: any }[] = [
    {
      id: "notes",
      label: "Notepad / Notes",
      icon: FileText,
      count: project.notes.length,
    },
    {
      id: "questions",
      label: "Client Q&A",
      icon: HelpCircle,
      count: project.questions.length,
    },
    {
      id: "meeting-prep",
      label: "Next Meeting Prep",
      icon: Sparkles,
      count: nextMeetingQuestions > 0 ? nextMeetingQuestions : undefined,
      countVariant: "emerald",
    },
    {
      id: "meetings",
      label: "Meetings Log",
      icon: Calendar,
      count: project.meetings.length,
    },
    {
      id: "tasks",
      label: "Follow-up Tasks",
      icon: CheckSquare,
      count: pendingTasks > 0 ? pendingTasks : undefined,
      countVariant: "warning",
    },
    {
      id: "templates",
      label: "Templates",
      icon: Briefcase,
    },
    {
      id: "export",
      label: "Export & Print",
      icon: Printer,
    },
  ];

  return (
    <div className="bg-white border-b-2 border-gray-200">
      {/* Top Banner with Project Meta */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="w-4 h-12 rounded-sm shrink-0 mt-0.5"
              style={{ backgroundColor: project.color || "#3B82F6" }}
            />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {project.name}
                </h1>
                {project.clientName && (
                  <Badge variant="primary" className="text-xs">
                    Client: {project.clientName}
                  </Badge>
                )}
                {pendingQuestions > 0 && (
                  <Badge variant="warning" className="text-xs">
                    {pendingQuestions} Questions Pending
                  </Badge>
                )}
              </div>
              {project.description && (
                <p className="text-sm font-medium text-gray-600 mt-1 max-w-3xl">
                  {project.description}
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {onEditProject && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onEditProject}
                className="gap-1 text-xs"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Project</span>
              </Button>
            )}
            {onDeleteProject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDeleteProject}
                className="text-red-600 hover:bg-red-50 hover:text-red-700 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="px-4 sm:px-6 lg:px-8 flex overflow-x-auto no-scrollbar gap-1 border-t border-gray-100">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 border-b-4 select-none cursor-pointer",
                isActive
                  ? "border-[#3B82F6] text-[#3B82F6] bg-blue-50/50"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-[#3B82F6]" : "text-gray-400")} strokeWidth={2.5} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "ml-1 text-[11px] px-1.5 py-0.2 rounded font-extrabold",
                    isActive
                      ? "bg-[#3B82F6] text-white"
                      : "bg-gray-100 text-gray-600"
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
  );
}
