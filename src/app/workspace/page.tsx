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

export default function WorkspacePage() {
  const router = useRouter();
  const [user, setUser] = React.useState<{ id: string; name: string; email: string } | null>(null);
  const [projects, setProjects] = React.useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [activeProjectData, setActiveProjectData] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>("notes");
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);
  const [isLoadingProject, setIsLoadingProject] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

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

  // Fetch current user and initial project list (in parallel)
  React.useEffect(() => {
    const init = async () => {
      try {
        const [meRes, projRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/projects")]);
        if (!meRes.ok) {
          router.push("/login");
          return;
        }
        const meData = await meRes.json();
        setUser(meData.user);

        if (projRes.ok) {
          const projData = await projRes.json();
          setProjects(projData.projects || []);
          if (projData.projects?.length > 0) {
            setSelectedProjectId(projData.projects[0].id);
          }
        }
      } catch (err) {
        toast.error("Failed to initialize session");
      } finally {
        setIsLoadingUser(false);
      }
    };
    init();
  }, [router]);

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
        toast.error("Failed to load project details");
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

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
            Loading Workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-white">
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
        onArchiveProject={(id, status) => handleToggleArchiveProject(id, status)}
        onReorderProjects={handleReorderProjects}
        archivingProjectId={archivingProjectId}
        isOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* Right Main Workspace View (Full remaining height & width for children) */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        {isLoadingProject ? (
          /* Skeleton shaped like the workspace so the switch feels instant */
          <div
            className="flex-1 flex flex-col overflow-hidden animate-pulse"
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
        ) : activeProjectData ? (
          <>
            {/* Ultra-Compact Active Project Header & Tabs */}
            <WorkspaceHeader
              project={activeProjectData}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onEditProject={() => setIsEditProjectModalOpen(true)}
              onArchiveProject={() => handleToggleArchiveProject()}
              isArchiving={archivingProjectId === activeProjectData.id}
              onDeleteProject={handleDeleteProject}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            {/* Children Workspace Modules (Takes 100% of remaining screen). Keyed by project so
                switching to a cached project still remounts modules with fresh local state. */}
            <div key={activeProjectData.id} className="flex-1 overflow-y-auto bg-white">
              {activeTab === "notes" && (
                <NotepadModule
                  projectId={activeProjectData.id}
                  notes={activeProjectData.notes || []}
                  tasks={activeProjectData.tasks || []}
                  onNotesChange={(newNotes) => {
                    updateProjectData(activeProjectData.id, { notes: newNotes });
                  }}
                  onTasksChange={(newTasks) => {
                    updateProjectData(activeProjectData.id, { tasks: newTasks });
                  }}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === "questions" && (
                <QuestionsModule
                  projectId={activeProjectData.id}
                  questions={activeProjectData.questions || []}
                  categories={activeProjectData.categories || []}
                  onQuestionsChange={(newQuestions) => {
                    updateProjectData(activeProjectData.id, { questions: newQuestions });
                  }}
                  onCategoriesChange={(newCategories) => {
                    updateProjectData(activeProjectData.id, { categories: newCategories });
                  }}
                />
              )}

              {activeTab === "meeting-prep" && (
                <MeetingPrepModule
                  projectId={activeProjectData.id}
                  projectName={activeProjectData.name}
                  clientName={activeProjectData.clientName}
                  questions={activeProjectData.questions || []}
                  categories={activeProjectData.categories || []}
                  onQuestionsChange={(newQuestions) => {
                    updateProjectData(activeProjectData.id, { questions: newQuestions });
                  }}
                  onCategoriesChange={(newCategories) => {
                    updateProjectData(activeProjectData.id, { categories: newCategories });
                  }}
                  onNavigateToMeetings={() => setActiveTab("meetings")}
                  onScheduleMeetingWithQuestions={handleScheduleFromPrep}
                />
              )}

              {activeTab === "meetings" && (
                <MeetingsModule
                  projectId={activeProjectData.id}
                  projectName={activeProjectData.name}
                  clientName={activeProjectData.clientName}
                  tasks={activeProjectData.tasks || []}
                  meetings={activeProjectData.meetings || []}
                  questions={activeProjectData.questions || []}
                  preSelectedQuestionIds={preSelectedMeetingQuestions}
                  onTasksChange={(newTasks) => {
                    updateProjectData(activeProjectData.id, { tasks: newTasks });
                  }}
                  onMeetingsChange={(newMeetings) => {
                    updateProjectData(activeProjectData.id, { meetings: newMeetings });
                    setPreSelectedMeetingQuestions([]);
                  }}
                  onNotesChange={(newNotes) => {
                    updateProjectData(activeProjectData.id, { notes: newNotes });
                  }}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === "tasks" && (
                <TasksModule
                  projectId={activeProjectData.id}
                  tasks={activeProjectData.tasks || []}
                  meetings={activeProjectData.meetings || []}
                  onTasksChange={(newTasks) => {
                    updateProjectData(activeProjectData.id, { tasks: newTasks });
                  }}
                />
              )}

              {activeTab === "templates" && (
                <TemplatesModule
                  projectId={activeProjectData.id}
                  onQuestionsImported={() => fetchProjectDetails(activeProjectData.id)}
                />
              )}

              {activeTab === "export" && (
                <ExportModule project={activeProjectData} />
              )}
            </div>
          </>
        ) : (
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
        )}
      </main>

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
