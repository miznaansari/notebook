"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar, ProjectSummary } from "@/components/layout/Sidebar";
import { WorkspaceHeader, WorkspaceTab } from "@/components/workspace/WorkspaceHeader";
import { NotepadModule } from "@/components/workspace/NotepadModule";
import { QuestionsModule } from "@/components/workspace/QuestionsModule";
import { MeetingPrepModule } from "@/components/workspace/MeetingPrepModule";
import { MeetingsModule } from "@/components/workspace/MeetingsModule";
import { TasksModule } from "@/components/workspace/TasksModule";
import { TemplatesModule } from "@/components/workspace/TemplatesModule";
import { ExportModule } from "@/components/workspace/ExportModule";
import { MobileWorkspaceSkeleton } from "@/components/workspace/MobileWorkspaceSkeleton";
import { WorkSummaryDialog } from "@/components/workspace/WorkSummaryDialog";
import { getLastProjectId, setLastProjectId } from "@/lib/last-open";
import { LocalDataProvider, useLocalData, useLocalNotes, useLocalProjects, useSyncState } from "@/lib/local-db/context";
import {
  deleteLocalData,
  parseRememberedUser,
  readRememberedUserRaw,
  rememberUser,
  type SessionUser,
} from "@/lib/local-db/db";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FolderPlus } from "lucide-react";

const PROJECT_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#111827", // Dark Gray
];

// The workspace for a signed-in user. Projects, notes and daily briefs come from the local
// IndexedDB copy (instant, works offline); the other tabs' data still loads from the server.
function Workspace({ user }: { user: SessionUser }) {
  const { db, sync } = useLocalData();
  const syncState = useSyncState();
  const localProjects = useLocalProjects();
  const projects: ProjectSummary[] = React.useMemo(() => localProjects ?? [], [localProjects]);

  // Project list edits made through the API are mirrored into the local copy right away
  const setProjects = (next: ProjectSummary[] | ((prev: ProjectSummary[]) => ProjectSummary[])) => {
    const list = typeof next === "function" ? next(projects) : next;
    db.transaction("rw", db.projects, async () => {
      await db.projects.clear();
      await db.projects.bulkPut(list);
    }).catch((err) => console.error("Failed to update local projects:", err));
  };

  // The project the user picked, else the one open last time, else the first
  const [pickedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const selectedProjectId = React.useMemo(() => {
    if (projects.length === 0) return null;
    if (pickedProjectId && projects.some((p) => p.id === pickedProjectId)) return pickedProjectId;
    const lastProjectId = getLastProjectId();
    return (projects.find((p) => p.id === lastProjectId) ?? projects[0]).id;
  }, [projects, pickedProjectId]);
  const notes = useLocalNotes(selectedProjectId);

  const [activeProjectData, setActiveProjectData] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>("notes");
  const [isLoadingProject, setIsLoadingProject] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isWorkSummaryOpen, setIsWorkSummaryOpen] = React.useState(false);

  // Modals state
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = React.useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = React.useState(false);
  const [projectName, setProjectName] = React.useState("");
  const [clientName, setClientName] = React.useState("");
  const [projectDesc, setProjectDesc] = React.useState("");
  const [projectColor, setProjectColor] = React.useState("#3B82F6");
  const [projectIsArchived, setProjectIsArchived] = React.useState(false);
  const [isSubmittingProject, setIsSubmittingProject] = React.useState(false);
  const [archivingProjectId, setArchivingProjectId] = React.useState<string | null>(null);

  // Question IDs passed from Meeting Prep to Meetings module
  const [preSelectedMeetingQuestions, setPreSelectedMeetingQuestions] = React.useState<string[]>([]);

  // Visited projects, shown instantly on revisit while a fresh copy loads in the background
  const projectCacheRef = React.useRef<Map<string, any>>(new Map());
  const projectFetchRef = React.useRef<AbortController | null>(null);

  const applyProjectData = React.useCallback((project: any) => {
    setActiveProjectData(project);
    setProjectName(project.name);
    setClientName(project.clientName || "");
    setProjectDesc(project.description || "");
    setProjectColor(project.color || "#3B82F6");
    setProjectIsArchived(project.isArchived || false);
  }, []);

  // Fetch full details of selected project. Each call aborts the one still pending, so clicking
  // through projects quickly only ever loads and renders the last one picked.
  const fetchProjectDetails = React.useCallback(
    async (id: string) => {
      projectFetchRef.current?.abort();
      const controller = new AbortController();
      projectFetchRef.current = controller;

      const cached = projectCacheRef.current.get(id);
      if (cached) {
        applyProjectData(cached);
        setIsLoadingProject(false);
      } else {
        setIsLoadingProject(true);
      }

      try {
        const res = await fetch(`/api/projects/${id}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          projectCacheRef.current.set(id, data.project);
          applyProjectData(data.project);
        } else {
          projectCacheRef.current.delete(id);
          toast.error("Project not found");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (navigator.onLine) toast.error("Failed to load project details");
      } finally {
        if (projectFetchRef.current === controller) {
          projectFetchRef.current = null;
          setIsLoadingProject(false);
        }
      }
    },
    [applyProjectData]
  );

  React.useEffect(() => {
    if (selectedProjectId) {
      setLastProjectId(selectedProjectId);
      fetchProjectDetails(selectedProjectId);
    }
    return () => projectFetchRef.current?.abort();
  }, [selectedProjectId, fetchProjectDetails]);

  // Keep the cache in step with local edits so a revisit shows them
  React.useEffect(() => {
    if (activeProjectData?.id) {
      projectCacheRef.current.set(activeProjectData.id, activeProjectData);
    }
  }, [activeProjectData]);

  // Apply a module's change to the project it came from. A save that resolves after the user has
  // switched projects updates that project's cached copy instead of leaking into the open one.
  const updateProjectData = React.useCallback((projectId: string, patch: Record<string, any>) => {
    const cached = projectCacheRef.current.get(projectId);
    if (cached) {
      projectCacheRef.current.set(projectId, { ...cached, ...patch });
    }
    setActiveProjectData((prev: any) => (prev?.id === projectId ? { ...prev, ...patch } : prev));
  }, []);

  // Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      toast.error("Project name is required");
      return;
    }

    setIsSubmittingProject(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          clientName: clientName.trim() || null,
          description: projectDesc.trim() || null,
          color: projectColor,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Project created successfully!");
        setIsNewProjectModalOpen(false);

        // Refresh project list
        const listRes = await fetch("/api/projects");
        if (listRes.ok) {
          const listData = await listRes.json();
          setProjects(listData.projects);
        }
        setSelectedProjectId(data.project.id);
        setProjectName("");
        setClientName("");
        setProjectDesc("");
        setProjectIsArchived(false);
      } else {
        toast.error("Failed to create project");
      }
    } catch (err) {
      toast.error("Failed to create project");
    } finally {
      setIsSubmittingProject(false);
    }
  };

  // Update Project
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !projectName.trim()) return;

    setIsSubmittingProject(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          clientName: clientName.trim() || null,
          description: projectDesc.trim() || null,
          color: projectColor,
          isArchived: projectIsArchived,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Project settings updated!");
        setIsEditProjectModalOpen(false);
        updateProjectData(selectedProjectId, {
          name: data.project.name,
          clientName: data.project.clientName,
          description: data.project.description,
          color: data.project.color,
          isArchived: data.project.isArchived,
        });
        fetchProjectDetails(selectedProjectId);

        // Refresh sidebar
        const listRes = await fetch("/api/projects");
        if (listRes.ok) {
          const listData = await listRes.json();
          setProjects(listData.projects);
        }
      }
    } catch (err) {
      toast.error("Failed to update project");
    } finally {
      setIsSubmittingProject(false);
    }
  };

  // Toggle Archive Project
  const handleToggleArchiveProject = async (id?: string, newStatus?: boolean) => {
    const targetId = id || selectedProjectId;
    if (!targetId) return;

    const proj = projects.find((p) => p.id === targetId) || activeProjectData;
    const targetStatus = newStatus !== undefined ? newStatus : !proj?.isArchived;

    setArchivingProjectId(targetId);
    try {
      const res = await fetch(`/api/projects/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: targetStatus }),
      });

      if (res.ok) {
        toast.success(targetStatus ? "Project archived successfully" : "Project restored from archive");

        // Optimistically update projects list and active project
        setProjects((prev) =>
          prev.map((p) => (p.id === targetId ? { ...p, isArchived: targetStatus } : p))
        );

        updateProjectData(targetId, { isArchived: targetStatus });
        if (targetId === selectedProjectId) {
          setProjectIsArchived(targetStatus);
        }

        // Silent background refresh of projects list
        const listRes = await fetch("/api/projects");
        if (listRes.ok) {
          const listData = await listRes.json();
          setProjects(listData.projects || []);
        }
      } else {
        toast.error("Failed to update project archive status");
      }
    } catch (err) {
      toast.error("Failed to update project archive status");
    } finally {
      setArchivingProjectId(null);
    }
  };

  // Delete Project
  const handleDeleteProject = async () => {
    if (!selectedProjectId) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete '${activeProjectData?.name}' and all its notes, questions, and meetings?`
      )
    )
      return;

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Project deleted successfully");
        projectCacheRef.current.delete(selectedProjectId);
        await db.notes.where("projectId").equals(selectedProjectId).delete();
        await db.briefs.where("projectId").equals(selectedProjectId).delete();
        const listRes = await fetch("/api/projects");
        if (listRes.ok) {
          const listData = await listRes.json();
          setProjects(listData.projects);
          setSelectedProjectId(listData.projects[0]?.id || null);
          if (!listData.projects[0]) setActiveProjectData(null);
        }
      }
    } catch (err) {
      toast.error("Failed to delete project");
    }
  };

  const handleScheduleFromPrep = (questionIds: string[]) => {
    setPreSelectedMeetingQuestions(questionIds);
    setActiveTab("meetings");
  };

  // Reorder Projects
  const handleReorderProjects = async (newProjects: ProjectSummary[]) => {
    // 1. Optimistic update
    setProjects(newProjects);

    // 2. Persist order to API
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: newProjects.map((p, idx) => ({
            id: p.id,
            orderIndex: idx,
          })),
        }),
      });

      if (!res.ok) {
        toast.error("Failed to save project order");
        // Rollback from server
        const listRes = await fetch("/api/projects");
        if (listRes.ok) {
          const listData = await listRes.json();
          setProjects(listData.projects || []);
        }
      }
    } catch (err) {
      toast.error("Failed to save project order");
    }
  };

  const localProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const details = activeProjectData?.id === selectedProjectId ? activeProjectData : null;
  // Local fields first, server details (fresher after edits) on top, local notes always
  const project = localProject
    ? {
        ...localProject,
        ...(details ?? {}),
        notes: notes ?? [],
        questions: details?.questions ?? [],
        meetings: details?.meetings ?? [],
        tasks: details?.tasks ?? [],
        categories: details?.categories ?? [],
      }
    : null;
  const isFirstSync = localProjects === undefined || (projects.length === 0 && !syncState.hasSyncedOnce);
  const firstSyncFailed = isFirstSync && (syncState.status === "error" || syncState.status === "offline");

  const openEditProject = () => {
    if (!project) return;
    setProjectName(project.name);
    setClientName(project.clientName || "");
    setProjectDesc(project.description || "");
    setProjectColor(project.color || "#3B82F6");
    setProjectIsArchived(project.isArchived || false);
    setIsEditProjectModalOpen(true);
  };

  const workspaceSkeleton = (
    <>
      {/* Phones: editor-shaped skeleton with a live header (menu button works while loading) */}
      <MobileWorkspaceSkeleton
        className="md:hidden"
        projectName={localProject?.name}
        projectColor={localProject?.color}
        onOpenSidebar={() => setIsSidebarOpen(true)}
      />
      {/* Skeleton shaped like the workspace so the switch feels instant */}
      <div
        className="flex-1 flex flex-col overflow-hidden animate-pulse max-md:hidden"
        aria-busy="true"
        aria-label="Loading project workspace"
      >
        <div className="px-4 py-3 border-b-2 border-gray-200 space-y-3 shrink-0">
          <div className="h-5 w-48 max-w-[60%] bg-gray-200 rounded" />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 w-20 bg-gray-100 rounded-md shrink-0" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="hidden lg:flex flex-col gap-2 w-72 border-r-2 border-gray-200 bg-[#F3F4F6] p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-lg" />
            ))}
          </div>
          <div className="flex-1 p-4 sm:p-8 space-y-3">
            <div className="h-7 w-1/3 bg-gray-200 rounded" />
            <div className="h-4 w-2/3 bg-gray-100 rounded" />
            <div className="h-4 w-1/2 bg-gray-100 rounded" />
            <div className="h-4 w-3/5 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    </>
  );

  // Q&A, meetings, tasks and the rest still come from the server
  const detailsPlaceholder = (
    <div className="p-6 sm:p-8">
      {isLoadingProject ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          <div className="h-7 w-1/3 bg-gray-200 rounded" />
          <div className="h-4 w-2/3 bg-gray-100 rounded" />
          <div className="h-4 w-1/2 bg-gray-100 rounded" />
        </div>
      ) : (
        <div className="max-w-sm mx-auto text-center py-10">
          <p className="text-sm font-bold text-gray-700">This tab needs a connection</p>
          <p className="text-xs text-gray-500 mt-1">Notes and the Daily Brief work offline; this part loads from the server.</p>
          {selectedProjectId && (
            <Button variant="primary" size="sm" className="mt-4" onClick={() => fetchProjectDetails(selectedProjectId)}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen max-md:h-dvh w-screen flex overflow-hidden bg-white">
      {/* Left Projects & User Sidebar (Includes Brand & Profile) */}
      <Sidebar
        user={user}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => setSelectedProjectId(id)}
        onNewProject={() => {
          setProjectName("");
          setClientName("");
          setProjectDesc("");
          setProjectColor("#3B82F6");
          setIsNewProjectModalOpen(true);
        }}
        onOpenWorkSummary={() => setIsWorkSummaryOpen(true)}
        onArchiveProject={(id, status) => handleToggleArchiveProject(id, status)}
        onReorderProjects={handleReorderProjects}
        syncState={syncState}
        onSyncNow={() => sync.syncNow()}
        prepareLogout={async () => {
          await sync.syncNow();
          const pending = await sync.pendingChangeCount();
          return (
            pending === 0 ||
            confirm(
              `${pending} change${pending === 1 ? " hasn't" : "s haven't"} synced yet and will be lost if you log out now. Log out anyway?`
            )
          );
        }}
        onLoggedOut={async () => {
          sync.stop();
          db.close();
          await deleteLocalData(user.id);
        }}
        archivingProjectId={archivingProjectId}
        isOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* Right Main Workspace View (Full remaining height & width for children) */}
      <main className="flex-1 flex flex-col h-screen max-md:h-dvh overflow-hidden bg-white">
        {isFirstSync ? (
          <>
            {firstSyncFailed && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs font-semibold text-amber-900 flex items-center justify-between gap-2 shrink-0">
                <span>Couldn&apos;t download your notes. Check your connection.</span>
                <button type="button" onClick={() => sync.syncNow()} className="font-bold underline cursor-pointer">
                  Retry
                </button>
              </div>
            )}
            {workspaceSkeleton}
          </>
        ) : projects.length === 0 ? (
          /* Empty State when no projects exist */
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="max-w-md">
              <div className="w-16 h-16 rounded-lg bg-blue-100 text-[#3B82F6] flex items-center justify-center mx-auto mb-4">
                <FolderPlus className="w-8 h-8" strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-extrabold text-gray-900">
                Welcome to Notepad Hub!
              </h2>
              <p className="text-sm font-medium text-gray-600 mt-1">
                Create your first project workspace to start taking notes, gathering client requirements, and preparing meeting agendas.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsNewProjectModalOpen(true)}
                className="mt-6 gap-2"
              >
                <FolderPlus className="w-5 h-5" />
                <span>Create First Project</span>
              </Button>
            </div>
          </div>
        ) : !project || notes === undefined ? (
          workspaceSkeleton
        ) : (
          <>
            {/* Ultra-Compact Active Project Header & Tabs */}
            <WorkspaceHeader
              project={project}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onEditProject={openEditProject}
              onArchiveProject={() => handleToggleArchiveProject()}
              isArchiving={archivingProjectId === project.id}
              onDeleteProject={handleDeleteProject}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            {/* Children Workspace Modules (Takes 100% of remaining screen). Keyed by project so
                switching projects remounts modules with fresh local state. */}
            <div key={project.id} className="flex-1 overflow-y-auto bg-white">
              {activeTab === "notes" && (
                <NotepadModule
                  projectId={project.id}
                  notes={notes}
                  tasks={project.tasks}
                  onTasksChange={(newTasks) => {
                    updateProjectData(project.id, { tasks: newTasks });
                  }}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === "questions" &&
                (details ? (
                  <QuestionsModule
                    projectId={project.id}
                    questions={project.questions}
                    categories={project.categories}
                    onQuestionsChange={(newQuestions) => {
                      updateProjectData(project.id, { questions: newQuestions });
                    }}
                    onCategoriesChange={(newCategories) => {
                      updateProjectData(project.id, { categories: newCategories });
                    }}
                  />
                ) : (
                  detailsPlaceholder
                ))}

              {activeTab === "meeting-prep" &&
                (details ? (
                  <MeetingPrepModule
                    projectId={project.id}
                    projectName={project.name}
                    clientName={project.clientName}
                    questions={project.questions}
                    categories={project.categories}
                    onQuestionsChange={(newQuestions) => {
                      updateProjectData(project.id, { questions: newQuestions });
                    }}
                    onCategoriesChange={(newCategories) => {
                      updateProjectData(project.id, { categories: newCategories });
                    }}
                    onNavigateToMeetings={() => setActiveTab("meetings")}
                    onScheduleMeetingWithQuestions={handleScheduleFromPrep}
                  />
                ) : (
                  detailsPlaceholder
                ))}

              {activeTab === "meetings" &&
                (details ? (
                  <MeetingsModule
                    projectId={project.id}
                    projectName={project.name}
                    clientName={project.clientName}
                    tasks={project.tasks}
                    meetings={project.meetings}
                    questions={project.questions}
                    preSelectedQuestionIds={preSelectedMeetingQuestions}
                    onTasksChange={(newTasks) => {
                      updateProjectData(project.id, { tasks: newTasks });
                    }}
                    onMeetingsChange={(newMeetings) => {
                      updateProjectData(project.id, { meetings: newMeetings });
                      setPreSelectedMeetingQuestions([]);
                    }}
                    // It saves summaries as notes through the API; pull them into the local copy
                    onNotesChange={() => sync.syncNow()}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                  />
                ) : (
                  detailsPlaceholder
                ))}

              {activeTab === "tasks" &&
                (details ? (
                  <TasksModule
                    projectId={project.id}
                    tasks={project.tasks}
                    meetings={project.meetings}
                    onTasksChange={(newTasks) => {
                      updateProjectData(project.id, { tasks: newTasks });
                    }}
                  />
                ) : (
                  detailsPlaceholder
                ))}

              {activeTab === "templates" && (
                <TemplatesModule
                  projectId={project.id}
                  onQuestionsImported={() => fetchProjectDetails(project.id)}
                />
              )}

              {activeTab === "export" && (details ? <ExportModule project={project} /> : detailsPlaceholder)}
            </div>
          </>
        )}
      </main>

      {/* Today's work summary across all projects */}
      {isWorkSummaryOpen && <WorkSummaryDialog onClose={() => setIsWorkSummaryOpen(false)} />}

      {/* New Project Modal */}
      <Modal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        title="Create New Project"
        description="Set up a dedicated workspace for your project, client discovery, and meetings."
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input
            label="Project Name *"
            placeholder="e.g., Pathology Software / Mobile App"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />

          <Input
            label="Client Name / Organization"
            placeholder="e.g., City Diagnostics / Acme Corp"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />

          <Textarea
            label="Project Description & Goals"
            placeholder="Brief scope, deliverables, or objectives..."
            value={projectDesc}
            onChange={(e) => setProjectDesc(e.target.value)}
            rows={2}
          />

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Workspace Accent Color
            </label>
            <div className="flex items-center gap-3">
              {PROJECT_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setProjectColor(col)}
                  className="w-8 h-8 rounded-full transition-transform duration-200 hover:scale-125 cursor-pointer flex items-center justify-center"
                  style={{
                    backgroundColor: col,
                    outline: projectColor === col ? "3px solid #111827" : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsNewProjectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmittingProject}
            >
              {isSubmittingProject ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditProjectModalOpen}
        onClose={() => setIsEditProjectModalOpen(false)}
        title="Edit Project Settings"
        description="Update project details, client name, or theme accent."
      >
        <form onSubmit={handleUpdateProject} className="space-y-4">
          <Input
            label="Project Name *"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />

          <Input
            label="Client Name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />

          <Textarea
            label="Description"
            value={projectDesc}
            onChange={(e) => setProjectDesc(e.target.value)}
            rows={2}
          />

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              {PROJECT_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setProjectColor(col)}
                  className="w-8 h-8 rounded-full transition-transform duration-200 hover:scale-125 cursor-pointer"
                  style={{
                    backgroundColor: col,
                    outline: projectColor === col ? "3px solid #111827" : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Archive Status Toggle */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-900">Archive this project</p>
              <p className="text-[11px] text-gray-500">
                Archived projects are hidden from the active list but can be restored anytime.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={projectIsArchived}
                onChange={(e) => setProjectIsArchived(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsEditProjectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmittingProject}
            >
              {isSubmittingProject ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const subscribeToNothing = () => () => {};

// Opens the signed-in user's local data. The user remembered on this device is used right away
// (instant open, works offline); /api/auth/me confirms the session in the background.
export default function WorkspacePage() {
  const router = useRouter();
  const rememberedRaw = React.useSyncExternalStore(subscribeToNothing, readRememberedUserRaw, () => null);
  const remembered = React.useMemo(() => parseRememberedUser(rememberedRaw), [rememberedRaw]);
  const [verifiedUser, setVerifiedUser] = React.useState<SessionUser | null>(null);
  const [authUnreachable, setAuthUnreachable] = React.useState(false);
  const [authAttempt, setAuthAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        rememberUser(data.user);
        setVerifiedUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setAuthUnreachable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router, authAttempt]);

  const user = verifiedUser ?? remembered;

  if (!user) {
    return (
      <>
        <div className="md:hidden h-dvh flex flex-col">
          <MobileWorkspaceSkeleton />
        </div>
        <div className="hidden md:flex min-h-screen items-center justify-center bg-[#F3F4F6]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
              Loading Workspace...
            </p>
          </div>
        </div>
        {authUnreachable && (
          <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:w-80 z-50 p-3 rounded-xl bg-white border-2 border-gray-200 shadow-xl text-xs font-semibold text-gray-700 flex items-center justify-between gap-2">
            <span>Can&apos;t reach the server. Check your connection.</span>
            <button
              type="button"
              onClick={() => {
                setAuthUnreachable(false);
                setAuthAttempt((n) => n + 1);
              }}
              className="font-bold text-[#3B82F6] cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <LocalDataProvider key={user.id} userId={user.id}>
      <Workspace user={user} />
    </LocalDataProvider>
  );
}
