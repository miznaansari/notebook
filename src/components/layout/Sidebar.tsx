"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  BookOpen,
  LogOut,
  User as UserIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  user: { id: string; name: string; email: string } | null;
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  user,
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  isOpen,
  onCloseMobile,
}: SidebarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error("Failed to log out");
    } finally {
      setIsLoggingOut(false);
    }
  };

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
          className="fixed inset-0 z-40 bg-[#111827]/60 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 w-72 sm:w-80 h-screen bg-[#F3F4F6] border-r-2 border-gray-200 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 shrink-0 select-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Top Brand Logo Section */}
        <div className="p-4 border-b-2 border-gray-200 bg-white flex items-center justify-between gap-2">
          <Link href="/workspace" className="flex items-center gap-2.5 group min-w-0">
            <div className="h-9 w-9 rounded-md bg-[#3B82F6] flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-105 shrink-0">
              <BookOpen className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <span className="text-base font-extrabold tracking-tight text-gray-900 block leading-tight truncate">
                NOTEPAD<span className="text-[#3B82F6]">.HUB</span>
              </span>
              <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase block truncate">
                AI Project Workspace
              </span>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Search Bar */}
        <div className="p-3 border-b-2 border-gray-200 bg-white space-y-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onNewProject}
            className="w-full gap-1.5 text-xs h-9 justify-center shadow-none"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            <span>New Project</span>
          </Button>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 rounded-md bg-[#F3F4F6] text-sm font-medium text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition-all"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
            <span>Projects ({projects.filter((p) => !p.isArchived).length})</span>
            {showArchived && <span className="text-[10px] text-amber-600 font-bold">Archived</span>}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="p-6 text-center bg-white rounded-lg border-2 border-dashed border-gray-300">
              <Folder className="w-7 h-7 text-gray-400 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-gray-600">No projects found</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {searchQuery ? "Try a different search" : "Click New Project to start"}
              </p>
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
                    "group relative p-3 rounded-lg cursor-pointer transition-all duration-200 select-none",
                    isSelected
                      ? "bg-white border-l-4 border-l-[#3B82F6] text-gray-900"
                      : "bg-white/60 hover:bg-white text-gray-700 hover:scale-[1.01]"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: project.color || "#3B82F6" }}
                      />
                      <div className="min-w-0">
                        <p className={cn("text-xs font-bold truncate leading-tight", isSelected ? "text-[#3B82F6]" : "text-gray-900")}>
                          {project.name}
                        </p>
                        {project.clientName && (
                          <p className="text-[10px] font-semibold text-gray-500 truncate mt-0.5">
                            {project.clientName}
                          </p>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
                        isSelected ? "text-[#3B82F6] translate-x-0.5" : "text-gray-300 group-hover:text-gray-600"
                      )}
                    />
                  </div>

                  {/* Badges / Counters */}
                  <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-gray-100 flex-wrap text-[10px] font-bold">
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      <FileText className="w-2.5 h-2.5" />
                      {project.notesCount}
                    </span>

                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-[#1D4ED8]">
                      <HelpCircle className="w-2.5 h-2.5" />
                      {project.questionsCount}
                    </span>

                    {project.pendingQuestionsCount > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-[#92400E]">
                        {project.pendingQuestionsCount} Pending
                      </span>
                    )}

                    {project.forNextMeetingCount > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-[#065F46]">
                        {project.forNextMeetingCount} Next Meet
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom User Profile & Logout Section */}
        <div className="p-3 border-t-2 border-gray-200 bg-white space-y-2">
          {/* Archived toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-gray-100 text-xs font-bold text-gray-600 transition"
          >
            <div className="flex items-center gap-1.5">
              <Archive className="w-3.5 h-3.5 text-gray-400" />
              <span>{showArchived ? "Active Projects" : "Archived Projects"}</span>
            </div>
            {projects.filter((p) => p.isArchived).length > 0 && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1">
                {projects.filter((p) => p.isArchived).length}
              </Badge>
            )}
          </button>

          {/* User & Logout Bar */}
          {user && (
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-md bg-[#10B981] text-white flex items-center justify-center font-bold text-xs shrink-0 select-none">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-gray-900 block truncate leading-tight">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium block truncate leading-tight">
                    {user.email}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Logout"
                className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600 transition shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
