"use client";

import * as React from "react";
import {
  Folder,
  Plus,
  Search,
  CheckSquare,
  FileText,
  HelpCircle,
  Calendar,
  Layers,
  Archive,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ProjectSummary {
  id: string;
  name: string;
  clientName?: string | null;
  description?: string | null;
  color: string;
  icon: string;
  isArchived: boolean;
  notesCount: number;
  questionsCount: number;
  meetingsCount: number;
  tasksCount: number;
  pendingQuestionsCount: number;
  forNextMeetingCount: number;
  pendingTasksCount: number;
}

interface SidebarProps {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  isOpen,
  onCloseMobile,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.clientName && p.clientName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesArchive = showArchived ? p.isArchived : !p.isArchived;
    return matchesSearch && matchesArchive;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#111827]/50 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-30 w-72 sm:w-80 bg-[#F3F4F6] border-r-2 border-gray-200 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 pt-16 md:pt-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Top Action Bar */}
        <div className="p-4 border-b-2 border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-800">
                Projects ({projects.filter((p) => !p.isArchived).length})
              </h2>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={onNewProject}
              className="gap-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={3} />
              <span>New</span>
            </Button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-md bg-[#F3F4F6] text-xs font-semibold text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition-all"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredProjects.length === 0 ? (
            <div className="p-6 text-center bg-white rounded-lg border-2 border-dashed border-gray-300">
              <Folder className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-600">No projects found</p>
              <p className="text-[11px] text-gray-400 mt-1">
                {searchQuery ? "Try a different search" : "Create your first project to get started"}
              </p>
              {!searchQuery && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onNewProject}
                  className="mt-3 w-full text-xs"
                >
                  Create Project
                </Button>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isSelected = project.id === selectedProjectId;
              return (
                <div
                  key={project.id}
                  onClick={() => {
                    onSelectProject(project.id);
                    onCloseMobile();
                  }}
                  className={cn(
                    "group relative p-3.5 rounded-lg cursor-pointer transition-all duration-200 select-none",
                    isSelected
                      ? "bg-white border-l-4 border-l-[#3B82F6] text-gray-900"
                      : "bg-white/60 hover:bg-white text-gray-700 hover:scale-[1.01]"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-md shrink-0 transition-transform duration-200 group-hover:scale-125"
                        style={{ backgroundColor: project.color || "#3B82F6" }}
                      />
                      <div className="min-w-0">
                        <p className={cn("text-sm font-bold truncate leading-tight", isSelected ? "text-[#3B82F6]" : "text-gray-900")}>
                          {project.name}
                        </p>
                        {project.clientName && (
                          <p className="text-[11px] font-semibold text-gray-500 truncate mt-0.5">
                            {project.clientName}
                          </p>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      className={cn(
                        "w-4 h-4 shrink-0 transition-transform duration-200",
                        isSelected ? "text-[#3B82F6] translate-x-0.5" : "text-gray-300 group-hover:text-gray-600"
                      )}
                    />
                  </div>

                  {/* Badges / Counters */}
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-gray-100 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      <FileText className="w-2.5 h-2.5" />
                      {project.notesCount}
                    </span>

                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#1D4ED8]">
                      <HelpCircle className="w-2.5 h-2.5" />
                      {project.questionsCount}
                    </span>

                    {project.pendingQuestionsCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-[#92400E]">
                        {project.pendingQuestionsCount} Pending
                      </span>
                    )}

                    {project.forNextMeetingCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-[#065F46]">
                        {project.forNextMeetingCount} Next Meet
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Workspace Footer */}
        <div className="p-3 border-t-2 border-gray-200 bg-white">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full flex items-center justify-between p-2 rounded-md hover:bg-gray-100 text-xs font-bold text-gray-600 transition-all duration-200"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-gray-400" />
              <span>{showArchived ? "Show Active Projects" : "Show Archived"}</span>
            </div>
            {projects.filter((p) => p.isArchived).length > 0 && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                {projects.filter((p) => p.isArchived).length}
              </Badge>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
