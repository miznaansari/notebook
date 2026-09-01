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
import { FolderPlus, Loader2 } from "lucide-react";

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
  const [isSubmittingProject, setIsSubmittingProject] = React.useState(false);

  // Question IDs passed from Meeting Prep to Meetings module
  const [preSelectedMeetingQuestions, setPreSelectedMeetingQuestions] = React.useState<string[]>([]);

  // Fetch current user and initial project list
  React.useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) {
          router.push("/login");
          return;
        }
        const meData = await meRes.json();
        setUser(meData.user);

        // Fetch projects
        const projRes = await fetch("/api/projects");
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

  // Fetch full details of selected project
  const fetchProjectDetails = React.useCallback(async (id: string) => {
    setIsLoadingProject(true);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveProjectData(data.project);
        setProjectName(data.project.name);
        setClientName(data.project.clientName || "");
        setProjectDesc(data.project.description || "");
        setProjectColor(data.project.color || "#3B82F6");
      } else {
        toast.error("Project not found");
      }
    } catch (err) {
      toast.error("Failed to load project details");
    } finally {
      setIsLoadingProject(false);
    }
  }, []);

  React.useEffect(() => {
    if (selectedProjectId) {
      fetchProjectDetails(selectedProjectId);
    }
  }, [selectedProjectId, fetchProjectDetails]);

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
        }),
      });

      if (res.ok) {
        toast.success("Project settings updated!");
        setIsEditProjectModalOpen(false);
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
        isOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* Right Main Workspace View (Full remaining height & width for children) */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        {isLoadingProject ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
              <span>Loading project workspace...</span>
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
              onDeleteProject={handleDeleteProject}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            {/* Children Workspace Modules (Takes 100% of remaining screen) */}
            <div className="flex-1 overflow-y-auto bg-white">
              {activeTab === "notes" && (
                <NotepadModule
                  projectId={activeProjectData.id}
                  notes={activeProjectData.notes || []}
                  onNotesChange={(newNotes) => {
                    setActiveProjectData((prev: any) => ({
                      ...prev,
                      notes: newNotes,
                    }));
                  }}
                />
              )}

              {activeTab === "questions" && (
                <QuestionsModule
                  projectId={activeProjectData.id}
                  questions={activeProjectData.questions || []}
                  categories={activeProjectData.categories || []}
                  onQuestionsChange={(newQuestions) => {
                    setActiveProjectData((prev: any) => ({
                      ...prev,
                      questions: newQuestions,
                    }));
                  }}
                  onCategoriesChange={(newCategories) => {
                    setActiveProjectData((prev: any) => ({
                      ...prev,
                      categories: newCategories,
                    }));
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
                    setActiveProjectData((prev: any) => ({
                      ...prev,
                      questions: newQuestions,
                    }));
                  }}
                  onCategoriesChange={(newCategories) => {
                    setActiveProjectData((prev: any) => ({
                      ...prev,
                      categories: newCategories,
                    }));
                  }}
                  onNavigateToMeetings={() => setActiveTab("meetings")}
                  onScheduleMeetingWithQuestions={handleScheduleFromPrep}
                />
              )}

              {activeTab === "meetings" && (
                <MeetingsModule
                  projectId={activeProjectData.id}
                  meetings={activeProjectData.meetings || []}
                  questions={activeProjectData.questions || []}
                  preSelectedQuestionIds={preSelectedMeetingQuestions}
                  onMeetingsChange={(newMeetings) => {
                    setActiveProjectData((prev: any) => ({
                      ...prev,
                      meetings: newMeetings,
                    }));
                    setPreSelectedMeetingQuestions([]);
                  }}
                />
              )}

              {activeTab === "tasks" && (
                <TasksModule
                  projectId={activeProjectData.id}
                  tasks={activeProjectData.tasks || []}
                  meetings={activeProjectData.meetings || []}
                  onTasksChange={(newTasks) => {
                    setActiveProjectData((prev: any) => ({
                      ...prev,
                      tasks: newTasks,
                    }));
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
