"use client";

import * as React from "react";
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  Filter,
  Sparkles,
  Layers,
  Search,
  Edit2,
  CalendarDays,
  Tag,
  ArrowRight,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  ListFilter,
  Flame,
  FileText,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { AIMagicButton } from "@/components/ui/ai-magic-button";
import { VoiceMicButton } from "@/components/ui/voice-mic-button";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string | null;
  meetingId?: string | null;
  meeting?: { id: string; title: string; meetingDate?: string } | null;
  createdAt: string;
}

interface TasksModuleProps {
  projectId: string;
  tasks: TaskItem[];
  meetings?: { id: string; title: string; meetingDate?: string }[];
  onTasksChange: (tasks: TaskItem[]) => void;
}

interface DraftTask {
  id: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string;
  meetingId: string;
  selected: boolean;
}

export function TasksModule({
  projectId,
  tasks,
  meetings = [],
  onTasksChange,
}: TasksModuleProps) {
  // Main view filters & grouping
  const [filter, setFilter] = React.useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
  const [groupBy, setGroupBy] = React.useState<"NONE" | "MEETING" | "PRIORITY" | "STATUS">("NONE");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Quick Add State
  const [quickTitle, setQuickTitle] = React.useState("");
  const [quickPriority, setQuickPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");
  const [quickDueDate, setQuickDueDate] = React.useState("");
  const [quickMeetingId, setQuickMeetingId] = React.useState("");
  const voiceBaseQuickTitleRef = React.useRef<string | null>(null);
  const voiceBaseAiRawRef = React.useRef<string | null>(null);

  // Manual Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState("");
  const [modalDesc, setModalDesc] = React.useState("");
  const [modalPriority, setModalPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [modalDueDate, setModalDueDate] = React.useState("");
  const [modalMeetingId, setModalMeetingId] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Edit Task Modal State
  const [editingTask, setEditingTask] = React.useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [editPriority, setEditPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [editDueDate, setEditDueDate] = React.useState("");
  const [editMeetingId, setEditMeetingId] = React.useState("");
  const [editStatus, setEditStatus] = React.useState<"PENDING" | "IN_PROGRESS" | "COMPLETED">("PENDING");
  const [isEditSubmitting, setIsEditSubmitting] = React.useState(false);

  // AI Task Generator Modal State
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
  const [aiStep, setAiStep] = React.useState<"input" | "review">("input");
  const [aiRawText, setAiRawText] = React.useState("");
  const [aiDefaultMeetingId, setAiDefaultMeetingId] = React.useState("");
  const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);
  const [isCreatingAiTasks, setIsCreatingAiTasks] = React.useState(false);
  const [draftTasks, setDraftTasks] = React.useState<DraftTask[]>([]);

  // Sample templates for AI prompt
  const sampleTemplates = [
    {
      label: "🐞 Bug Reports / Issues",
      description: "User issues, error logs, and functional bugs",
      text: `Bulk account import option not working.
Skip onboarding not working
Is email validation system live?
If user is not registered and another user want to invite then in that case user should receive invitation email.
If admin invite another admin, another admin get error Failed to load members.`,
    },
    {
      label: "📋 Client Feedback & QA",
      description: "Feedback points and design adjustments",
      text: `Header logo is blurry on mobile devices.
Need to add export to CSV button on reports page.
Password reset email link expires too quickly (make it 24 hours).
Client requested dark mode toggle in navbar.`,
    },
    {
      label: "📝 Meeting Minutes Action Items",
      description: "Commitments and post-meeting follow-ups",
      text: `Confirm sandbox payment gateway credentials with client by Friday.
Backend team to optimize member search SQL query.
Send updated API documentation and postman collection to mobile app team.
Schedule follow-up sprint demo for next Tuesday 4 PM.`,
    },
  ];

  // Counts
  const pendingCount = tasks.filter((t) => t.status !== "COMPLETED").length;
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filter === "PENDING" && t.status === "COMPLETED") return false;
    if (filter === "COMPLETED" && t.status !== "COMPLETED") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchMeeting = t.meeting?.title.toLowerCase().includes(q);
      const matchPriority = t.priority.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchMeeting && !matchPriority) return false;
    }
    return true;
  });

  // Toggle Task Completion
  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        onTasksChange(
          tasks.map((t) => (t.id === taskId ? { ...t, status: nextStatus as any } : t))
        );
        toast.success(
          nextStatus === "COMPLETED" ? "Task marked as completed! 🎉" : "Task re-opened"
        );
      }
    } catch (err) {
      toast.error("Failed to update task");
    }
  };

  // Quick Add Task
  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickTitle.trim(),
          priority: quickPriority,
          dueDate: quickDueDate || null,
          meetingId: quickMeetingId || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onTasksChange([data.task, ...tasks]);
        setQuickTitle("");
        setQuickDueDate("");
        setQuickMeetingId("");
        toast.success("Follow-up task added!");
      }
    } catch (err) {
      toast.error("Failed to create task");
    }
  };

  // Modal Add Task
  const handleModalAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: modalTitle.trim(),
          description: modalDesc.trim() || null,
          priority: modalPriority,
          dueDate: modalDueDate || null,
          meetingId: modalMeetingId || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onTasksChange([data.task, ...tasks]);
        setIsAddModalOpen(false);
        setModalTitle("");
        setModalDesc("");
        setModalDueDate("");
        setModalMeetingId("");
        toast.success("Follow-up task created!");
      }
    } catch (err) {
      toast.error("Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Task Modal
  const handleOpenEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description || "");
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
    setEditMeetingId(task.meeting?.id || task.meetingId || "");
    setEditStatus(task.status);
  };

  // Save Edited Task
  const handleSaveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    setIsEditSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${editingTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          priority: editPriority,
          dueDate: editDueDate || null,
          meetingId: editMeetingId || null,
          status: editStatus,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onTasksChange(tasks.map((t) => (t.id === editingTask.id ? data.task : t)));
        setEditingTask(null);
        toast.success("Task updated successfully!");
      } else {
        toast.error("Failed to update task");
      }
    } catch (err) {
      toast.error("Failed to update task");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onTasksChange(tasks.filter((t) => t.id !== taskId));
        toast.success("Task deleted");
      }
    } catch (err) {
      toast.error("Failed to delete task");
    }
  };

  // AI Task Generation Trigger
  const handleGenerateTasksWithAi = async () => {
    if (!aiRawText.trim()) {
      toast.error("Please enter or paste some text, bug items, or notes first.");
      return;
    }

    setIsGeneratingAi(true);
    const selectedMeeting = meetings.find((m) => m.id === aiDefaultMeetingId);
    const meetingContext = selectedMeeting ? `Linked to Meeting: ${selectedMeeting.title}` : "";

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_tasks",
          text: aiRawText.trim(),
          context: meetingContext,
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.result) && data.result.length > 0) {
        const drafts: DraftTask[] = data.result.map((item: any, idx: number) => ({
          id: `draft-${Date.now()}-${idx}`,
          title: item.title || "Action Item",
          description: item.description || "",
          priority: (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(item.priority)
            ? item.priority
            : "MEDIUM") as any,
          dueDate: "",
          meetingId: aiDefaultMeetingId || "",
          selected: true,
        }));

        setDraftTasks(drafts);
        setAiStep("review");
        toast.success(`✨ Gemini AI generated ${drafts.length} structured action items!`);
      } else {
        toast.error(data.error || "Could not parse tasks from input. Try refining your text.");
      }
    } catch (err) {
      toast.error("Failed to generate tasks with AI");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Create Selected AI Tasks in Bulk
  const handleCreateSelectedAiTasks = async () => {
    const selectedDrafts = draftTasks.filter((t) => t.selected && t.title.trim());
    if (selectedDrafts.length === 0) {
      toast.error("Please select at least one task to create.");
      return;
    }

    setIsCreatingAiTasks(true);
    try {
      const payloadTasks = selectedDrafts.map((t) => ({
        title: t.title.trim(),
        description: t.description.trim() || null,
        priority: t.priority,
        dueDate: t.dueDate || null,
        meetingId: t.meetingId || null,
        status: "PENDING",
      }));

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: payloadTasks }),
      });

      if (res.ok) {
        const data = await res.json();
        const newTasks = data.tasks || [];
        onTasksChange([...newTasks, ...tasks]);
        setIsAiModalOpen(false);
        setAiRawText("");
        setDraftTasks([]);
        setAiStep("input");
        toast.success(`🎉 Created ${newTasks.length} follow-up tasks successfully!`);
      } else {
        const errJson = await res.json();
        toast.error(errJson.error || "Failed to create tasks");
      }
    } catch (err) {
      toast.error("Network error while creating tasks");
    } finally {
      setIsCreatingAiTasks(false);
    }
  };

  // Helper for priority badge styling
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <span className="bg-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase flex items-center gap-1"><Flame className="w-3 h-3 text-red-600" /> Urgent</span>;
      case "HIGH":
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">High Priority</span>;
      case "MEDIUM":
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">Medium</span>;
      case "LOW":
      default:
        return <span className="bg-gray-100 text-gray-700 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">Low</span>;
    }
  };

  // Render Grouped Tasks
  const renderTasks = () => {
    if (filteredTasks.length === 0) {
      return (
        <div className="p-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-300">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800">No tasks found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "No tasks match your search filter."
              : "All follow-up tasks are completed or none have been logged yet."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="amber"
              size="sm"
              onClick={() => {
                setAiStep("input");
                setIsAiModalOpen(true);
              }}
              className="gap-1.5 text-xs shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate with AI</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Manual Task</span>
            </Button>
          </div>
        </div>
      );
    }

    // Grouping by Meeting / Event
    if (groupBy === "MEETING") {
      const meetingGroups: { [key: string]: { meeting: { id: string; title: string; meetingDate?: string } | null; tasks: TaskItem[] } } = {};
      
      // Initialize groups for known meetings
      meetings.forEach((m) => {
        meetingGroups[m.id] = { meeting: m, tasks: [] };
      });
      meetingGroups["unassigned"] = { meeting: null, tasks: [] };

      // Distribute tasks
      filteredTasks.forEach((t) => {
        const mId = t.meeting?.id || t.meetingId || "unassigned";
        if (!meetingGroups[mId]) {
          meetingGroups[mId] = {
            meeting: t.meeting ? { id: t.meeting.id, title: t.meeting.title, meetingDate: t.meeting.meetingDate } : null,
            tasks: [],
          };
        }
        meetingGroups[mId].tasks.push(t);
      });

      const groupEntries = Object.entries(meetingGroups).filter(([_, g]) => g.tasks.length > 0);

      return (
        <div className="space-y-6">
          {groupEntries.map(([mId, group]) => {
            const isUnassigned = mId === "unassigned";
            const completedInGroup = group.tasks.filter((t) => t.status === "COMPLETED").length;

            return (
              <div
                key={mId}
                className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm"
              >
                {/* Event / Meeting Group Header */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100/60 p-4 border-b-2 border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm",
                      isUnassigned ? "bg-gray-200 text-gray-700" : "bg-blue-600 text-white"
                    )}>
                      {isUnassigned ? <Tag className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                        <span>{isUnassigned ? "General / Independent Tasks (No Meeting)" : group.meeting?.title}</span>
                      </h3>
                      {group.meeting?.meetingDate && (
                        <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          Event Date: {formatDate(group.meeting.meetingDate)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-full shadow-xs">
                      {completedInGroup}/{group.tasks.length} Done
                    </span>
                  </div>
                </div>

                {/* Group Tasks List */}
                <div className="divide-y-2 divide-gray-100">
                  {group.tasks.map((task) => renderTaskRow(task))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Grouping by Priority
    if (groupBy === "PRIORITY") {
      const priorityOrder: ("URGENT" | "HIGH" | "MEDIUM" | "LOW")[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
      const priorityGroups: { [key: string]: TaskItem[] } = {
        URGENT: [],
        HIGH: [],
        MEDIUM: [],
        LOW: [],
      };

      filteredTasks.forEach((t) => {
        const p = t.priority || "MEDIUM";
        if (priorityGroups[p]) priorityGroups[p].push(t);
        else priorityGroups["MEDIUM"].push(t);
      });

      return (
        <div className="space-y-6">
          {priorityOrder.map((pLevel) => {
            const list = priorityGroups[pLevel] || [];
            if (list.length === 0) return null;

            const headerBg =
              pLevel === "URGENT"
                ? "bg-red-50 text-red-900 border-red-200"
                : pLevel === "HIGH"
                ? "bg-amber-50 text-amber-900 border-amber-200"
                : pLevel === "MEDIUM"
                ? "bg-blue-50 text-blue-900 border-blue-200"
                : "bg-gray-50 text-gray-900 border-gray-200";

            return (
              <div key={pLevel} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
                <div className={cn("px-4 py-3 border-b-2 flex items-center justify-between font-extrabold text-xs uppercase tracking-wider", headerBg)}>
                  <div className="flex items-center gap-2">
                    {pLevel === "URGENT" && <Flame className="w-4 h-4 text-red-600" />}
                    <span>{pLevel} Priority ({list.length})</span>
                  </div>
                </div>
                <div className="divide-y-2 divide-gray-100">
                  {list.map((task) => renderTaskRow(task))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Grouping by Status
    if (groupBy === "STATUS") {
      const pendingList = filteredTasks.filter((t) => t.status !== "COMPLETED");
      const completedList = filteredTasks.filter((t) => t.status === "COMPLETED");

      return (
        <div className="space-y-6">
          {pendingList.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-amber-50/80 px-4 py-3 border-b-2 border-amber-200 flex items-center justify-between text-amber-900 font-extrabold text-xs uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Pending Follow-ups ({pendingList.length})</span>
                </div>
              </div>
              <div className="divide-y-2 divide-gray-100">
                {pendingList.map((task) => renderTaskRow(task))}
              </div>
            </div>
          )}

          {completedList.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-emerald-50/80 px-4 py-3 border-b-2 border-emerald-200 flex items-center justify-between text-emerald-900 font-extrabold text-xs uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Completed Action Items ({completedList.length})</span>
                </div>
              </div>
              <div className="divide-y-2 divide-gray-100">
                {completedList.map((task) => renderTaskRow(task))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Default Flat List View
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 divide-y-2 divide-gray-100 shadow-sm overflow-hidden">
        {filteredTasks.map((task) => renderTaskRow(task))}
      </div>
    );
  };

  // Render a Single Task Row
  const renderTaskRow = (task: TaskItem) => {
    const isCompleted = task.status === "COMPLETED";

    return (
      <div
        key={task.id}
        className={cn(
          "p-4 sm:p-5 flex items-start justify-between gap-4 transition-all duration-150 hover:bg-gray-50/80",
          isCompleted && "bg-gray-50/60 opacity-80"
        )}
      >
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <button
            onClick={() => handleToggleTask(task.id, task.status)}
            className="mt-0.5 text-gray-400 hover:text-emerald-600 transition shrink-0 cursor-pointer"
            title={isCompleted ? "Mark as pending" : "Mark as done"}
          >
            {isCompleted ? (
              <CheckSquare className="w-5 h-5 text-[#10B981]" strokeWidth={2.5} />
            ) : (
              <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" strokeWidth={2.5} />
            )}
          </button>

          <div className="min-w-0 flex-1 space-y-1.5">
            <p
              className={cn(
                "text-sm font-bold text-gray-900 leading-snug break-words",
                isCompleted && "line-through text-gray-400 font-medium"
              )}
            >
              {task.title}
            </p>

            {task.description && (
              <p
                className={cn(
                  "text-xs text-gray-600 leading-relaxed break-words whitespace-pre-line",
                  isCompleted && "line-through text-gray-400"
                )}
              >
                {task.description}
              </p>
            )}

            {/* Badges Row */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {getPriorityBadge(task.priority)}

              {task.dueDate && (
                <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1 border border-gray-200">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  Due: {formatDate(task.dueDate)}
                </span>
              )}

              {task.meeting ? (
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded flex items-center gap-1 shadow-xs">
                  <CalendarDays className="w-3 h-3 text-blue-500" />
                  <span>Event: {task.meeting.title}</span>
                </span>
              ) : (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
                  General / No Meeting
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <button
            onClick={() => handleOpenEditModal(task)}
            className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
            title="Edit task & event link"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteTask(task.id)}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border-2 border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-[#10B981]" strokeWidth={2.5} />
            <span>Tasks & Follow-up Action Items</span>
          </h2>
          <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1">
            Track post-meeting follow-ups, pending deliverables, and convert raw notes or bug lists into action items.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* AI Task Generator Button */}
          <Button
            variant="amber"
            size="md"
            onClick={() => {
              setAiStep("input");
              setIsAiModalOpen(true);
            }}
            className="gap-2 shadow-sm font-bold"
          >
            <Sparkles className="w-4 h-4 text-amber-950" />
            <span>AI Generate Tasks</span>
          </Button>

          {/* New Manual Task Button */}
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-2 font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Quick Add Bar with Meeting / Event Selector */}
      <form
        onSubmit={handleQuickAddTask}
        className="bg-white p-3 sm:p-4 rounded-xl border-2 border-gray-200 shadow-sm flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center"
      >
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            placeholder="Type or speak follow-up task (e.g. Fix bulk account import, client sandbox key)..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            className="w-full h-11 pl-4 pr-24 rounded-lg bg-[#F3F4F6] text-sm font-medium text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <VoiceMicButton
              onInterimTranscript={(interim) => {
                if (voiceBaseQuickTitleRef.current === null) {
                  voiceBaseQuickTitleRef.current = quickTitle;
                }
                const base = voiceBaseQuickTitleRef.current;
                const sep = base && !base.endsWith(" ") ? " " : "";
                setQuickTitle(base + sep + interim);
              }}
              onTranscript={(transcript) => {
                const base = voiceBaseQuickTitleRef.current !== null ? voiceBaseQuickTitleRef.current : quickTitle;
                voiceBaseQuickTitleRef.current = null;
                const sep = base && !base.endsWith(" ") ? " " : "";
                setQuickTitle(base + sep + transcript);
              }}
              variant="ghost"
              size="sm"
            />
            <AIMagicButton
              getText={() => quickTitle}
              onResult={(res) => setQuickTitle(res)}
              context="Project Follow-up Action Item"
              variant="ghost"
              size="sm"
              allowedActions={["hinglish_to_english", "professional", "make_short", "grammar", "english_to_simple"]}
            />
          </div>
        </div>

        {/* Meeting / Event Selector in Quick Add */}
        {meetings.length > 0 && (
          <select
            value={quickMeetingId}
            onChange={(e) => setQuickMeetingId(e.target.value)}
            className="h-11 px-3 rounded-lg bg-[#F3F4F6] text-xs font-bold text-gray-800 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] max-w-xs"
            title="Link to Meeting / Event"
          >
            <option value="">📁 No Event (General)</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                📅 {m.title}
              </option>
            ))}
          </select>
        )}

        <select
          value={quickPriority}
          onChange={(e) => setQuickPriority(e.target.value as any)}
          className="h-11 px-3 rounded-lg bg-[#F3F4F6] text-xs font-bold text-gray-800 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
        >
          <option value="LOW">Low Priority</option>
          <option value="MEDIUM">Medium Priority</option>
          <option value="HIGH">High Priority</option>
          <option value="URGENT">🔥 Urgent</option>
        </select>

        <input
          type="date"
          value={quickDueDate}
          onChange={(e) => setQuickDueDate(e.target.value)}
          className="h-11 px-3 rounded-lg bg-[#F3F4F6] text-xs font-bold text-gray-800 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
          title="Due Date"
        />

        <Button
          type="submit"
          variant="emerald"
          size="md"
          className="gap-1.5 text-xs font-bold shrink-0 shadow-sm h-11"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </Button>
      </form>

      {/* Filter and Grouping Bar */}
      <div className="bg-white p-3 rounded-xl border-2 border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "ALL", label: `All Tasks (${tasks.length})` },
            { id: "PENDING", label: `Pending (${pendingCount})` },
            { id: "COMPLETED", label: `Completed (${completedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer select-none whitespace-nowrap",
                filter === tab.id
                  ? "bg-[#111827] text-white shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grouping and Search Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative flex items-center min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#F3F4F6] text-xs font-medium text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
            />
          </div>

          {/* Group By Selector */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-200">
            <span className="text-[11px] font-bold text-gray-500 pl-1.5 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-gray-500" />
              <span>Group:</span>
            </span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="h-7 px-2 bg-white text-xs font-bold text-gray-800 rounded border border-gray-300 outline-none cursor-pointer"
            >
              <option value="NONE">List View</option>
              <option value="MEETING">📅 By Meeting / Event</option>
              <option value="PRIORITY">🔥 By Priority</option>
              <option value="STATUS">⚡ By Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List Content */}
      {renderTasks()}

      {/* ========================================================= */}
      {/* AI Task Generator & Bulk Import Modal */}
      {/* ========================================================= */}
      <Modal
        isOpen={isAiModalOpen}
        onClose={() => {
          if (!isGeneratingAi && !isCreatingAiTasks) {
            setIsAiModalOpen(false);
            setAiStep("input");
          }
        }}
        title="✨ AI Task Generator & Bulk Extractor"
        description="Paste raw bug reports, client feedback, bullet points, or meeting notes to automatically extract structured, prioritized follow-up tasks."
        maxWidth="3xl"
      >
        <div className="space-y-4">
          {aiStep === "input" ? (
            <div className="space-y-4">
              {/* Event / Meeting Link Selector */}
              {meetings.length > 0 && (
                <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-extrabold text-blue-900 block flex items-center gap-1">
                      <CalendarDays className="w-4 h-4 text-blue-600" />
                      <span>Link Generated Tasks to an Event / Meeting:</span>
                    </label>
                    <p className="text-[11px] text-blue-700 mt-0.5">
                      Choose which client meeting or discussion these tasks were born from.
                    </p>
                  </div>
                  <select
                    value={aiDefaultMeetingId}
                    onChange={(e) => setAiDefaultMeetingId(e.target.value)}
                    className="h-9 px-3 rounded-md bg-white border border-blue-300 text-xs font-bold text-gray-800 outline-none shadow-xs"
                  >
                    <option value="">📁 General (No Specific Meeting)</option>
                    {meetings.map((m) => (
                      <option key={m.id} value={m.id}>
                        📅 {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sample Templates Quick-Fill */}
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Try Quick Example:
                </span>
                <div className="flex flex-wrap gap-2">
                  {sampleTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAiRawText(tpl.text)}
                      className="text-xs font-semibold px-3 py-1.5 bg-gray-100 hover:bg-amber-100 hover:text-amber-900 text-gray-700 rounded-md border border-gray-200 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Raw Input Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-gray-500" />
                    <span>Paste Raw Text / Bug List / Meeting Notes *</span>
                  </label>
                  <VoiceMicButton
                    onInterimTranscript={(interim) => {
                      if (voiceBaseAiRawRef.current === null) {
                        voiceBaseAiRawRef.current = aiRawText;
                      }
                      const base = voiceBaseAiRawRef.current;
                      const sep = base && !base.endsWith("\n") && !base.endsWith(" ") ? "\n" : "";
                      setAiRawText(base + sep + interim);
                    }}
                    onTranscript={(transcript) => {
                      const base = voiceBaseAiRawRef.current !== null ? voiceBaseAiRawRef.current : aiRawText;
                      voiceBaseAiRawRef.current = null;
                      const sep = base && !base.endsWith("\n") && !base.endsWith(" ") ? "\n" : "";
                      setAiRawText(base + sep + transcript);
                    }}
                    variant="secondary"
                    size="sm"
                  />
                </div>
                <textarea
                  rows={8}
                  placeholder={`Paste any unstructured text here, for example:\n\nBulk account import option not working.\nSkip onboarding not working\nIs email validation system live?\nIf user is not registered and another user want to invite then in that case user should receive invitation email.\nIf admin invite another admin, another admin get error Failed to load members.`}
                  value={aiRawText}
                  onChange={(e) => setAiRawText(e.target.value)}
                  className="w-full p-3.5 rounded-lg bg-[#F9FAFB] text-sm font-medium text-gray-900 placeholder:text-gray-400 border-2 border-gray-200 outline-none focus:bg-white focus:border-[#3B82F6] transition resize-y font-mono"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsAiModalOpen(false)}
                  disabled={isGeneratingAi}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="amber"
                  size="md"
                  onClick={handleGenerateTasksWithAi}
                  disabled={isGeneratingAi || !aiRawText.trim()}
                  className="gap-2 font-bold shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isGeneratingAi ? "Gemini AI is Parsing Tasks..." : "Generate Tasks with AI"}</span>
                </Button>
              </div>
            </div>
          ) : (
            /* Step 2: Review and Customize AI Tasks */
            <div className="space-y-4">
              {/* Batch Controls Bar */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-gray-800">
                    <input
                      type="checkbox"
                      checked={draftTasks.length > 0 && draftTasks.every((t) => t.selected)}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setDraftTasks(draftTasks.map((t) => ({ ...t, selected: val })));
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>
                      Select All ({draftTasks.filter((t) => t.selected).length}/{draftTasks.length})
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Bulk Assign Meeting */}
                  {meetings.length > 0 && (
                    <select
                      onChange={(e) => {
                        const mVal = e.target.value;
                        setDraftTasks(draftTasks.map((t) => (t.selected ? { ...t, meetingId: mVal } : t)));
                        toast.info("Applied event to selected tasks");
                      }}
                      defaultValue=""
                      className="h-8 px-2 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700"
                    >
                      <option value="" disabled>
                        📅 Set Event for Selected...
                      </option>
                      <option value="">No Meeting (General)</option>
                      {meetings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Bulk Assign Priority */}
                  <select
                    onChange={(e) => {
                      const pVal = e.target.value as any;
                      if (!pVal) return;
                      setDraftTasks(draftTasks.map((t) => (t.selected ? { ...t, priority: pVal } : t)));
                      toast.info(`Set priority to ${pVal} for selected tasks`);
                    }}
                    defaultValue=""
                    className="h-8 px-2 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700"
                  >
                    <option value="" disabled>
                      🔥 Set Priority...
                    </option>
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              {/* Draft Tasks Card List */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {draftTasks.map((draft, idx) => (
                  <div
                    key={draft.id}
                    className={cn(
                      "p-3.5 rounded-lg border-2 transition-all space-y-2.5",
                      draft.selected
                        ? "bg-white border-blue-200 shadow-xs"
                        : "bg-gray-50/80 border-gray-200 opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDraftTasks(
                            draftTasks.map((t) => (t.id === draft.id ? { ...t, selected: checked } : t))
                          );
                        }}
                        className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                      />

                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={draft.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftTasks(
                                draftTasks.map((t) => (t.id === draft.id ? { ...t, title: val } : t))
                              );
                            }}
                            placeholder="Task title..."
                            className="flex-1 h-9 px-3 text-xs font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:border-blue-500 outline-none"
                          />

                          <select
                            value={draft.priority}
                            onChange={(e) => {
                              const p = e.target.value as any;
                              setDraftTasks(
                                draftTasks.map((t) => (t.id === draft.id ? { ...t, priority: p } : t))
                              );
                            }}
                            className={cn(
                              "h-9 px-2 text-xs font-extrabold rounded-md border outline-none",
                              draft.priority === "URGENT"
                                ? "bg-red-50 text-red-800 border-red-200"
                                : draft.priority === "HIGH"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                            )}
                          >
                            <option value="URGENT">🔥 Urgent</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => setDraftTasks(draftTasks.filter((t) => t.id !== draft.id))}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
                            title="Remove draft task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Description & Event / Due Date options */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-6">
                            <input
                              type="text"
                              value={draft.description}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraftTasks(
                                  draftTasks.map((t) => (t.id === draft.id ? { ...t, description: val } : t))
                                );
                              }}
                              placeholder="Optional context / deliverables..."
                              className="w-full h-8 px-2.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:border-blue-500 outline-none"
                            />
                          </div>

                          {meetings.length > 0 && (
                            <div className="sm:col-span-4">
                              <select
                                value={draft.meetingId}
                                onChange={(e) => {
                                  const mId = e.target.value;
                                  setDraftTasks(
                                    draftTasks.map((t) => (t.id === draft.id ? { ...t, meetingId: mId } : t))
                                  );
                                }}
                                className="w-full h-8 px-2 text-[11px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-md outline-none"
                              >
                                <option value="">📁 No Event (General)</option>
                                {meetings.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    📅 {m.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className={cn(meetings.length > 0 ? "sm:col-span-2" : "sm:col-span-6")}>
                            <input
                              type="date"
                              value={draft.dueDate}
                              onChange={(e) => {
                                const d = e.target.value;
                                setDraftTasks(
                                  draftTasks.map((t) => (t.id === draft.id ? { ...t, dueDate: d } : t))
                                );
                              }}
                              className="w-full h-8 px-2 text-[11px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-md outline-none"
                              title="Due Date"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Manual Draft Item button */}
              <button
                type="button"
                onClick={() => {
                  setDraftTasks([
                    ...draftTasks,
                    {
                      id: `draft-${Date.now()}`,
                      title: "",
                      description: "",
                      priority: "MEDIUM",
                      dueDate: "",
                      meetingId: aiDefaultMeetingId || "",
                      selected: true,
                    },
                  ]);
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Item</span>
              </button>

              {/* Bottom Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t-2 border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setAiStep("input")}
                  disabled={isCreatingAiTasks}
                  className="gap-1 text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Back to Raw Input</span>
                </Button>

                <Button
                  type="button"
                  variant="emerald"
                  size="md"
                  onClick={handleCreateSelectedAiTasks}
                  disabled={isCreatingAiTasks || draftTasks.filter((t) => t.selected).length === 0}
                  className="gap-2 font-bold shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isCreatingAiTasks
                      ? "Creating Tasks in Project..."
                      : `Create ${draftTasks.filter((t) => t.selected).length} Tasks`}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* Modal for Manual Single Task Creation */}
      {/* ========================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Follow-up Action Item"
        description="Create an actionable task linked to a client meeting or project requirement."
      >
        <form onSubmit={handleModalAddTask} className="space-y-4">
          <Input
            label="Task Title *"
            placeholder="e.g., Send revised database diagram to client"
            value={modalTitle}
            onChange={(e) => setModalTitle(e.target.value)}
            required
          />

          <Input
            label="Task Details / Instructions"
            placeholder="Optional context or deliverables..."
            value={modalDesc}
            onChange={(e) => setModalDesc(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Priority
              </label>
              <select
                value={modalPriority}
                onChange={(e) => setModalPriority(e.target.value as any)}
                className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">🔥 Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={modalDueDate}
                onChange={(e) => setModalDueDate(e.target.value)}
                className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
              />
            </div>
          </div>

          {meetings.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Link to Meeting / Event (Optional)
              </label>
              <select
                value={modalMeetingId}
                onChange={(e) => setModalMeetingId(e.target.value)}
                className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
              >
                <option value="">None (Independent Task)</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    📅 {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* Modal for Editing Existing Task */}
      {/* ========================================================= */}
      {editingTask && (
        <Modal
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          title="Edit Follow-up Task"
          description="Update task details, status, priority, or re-link to an event."
        >
          <form onSubmit={handleSaveEditTask} className="space-y-4">
            <Input
              label="Task Title *"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />

            <Input
              label="Task Details / Instructions"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Priority
                </label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as any)}
                  className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">🔥 Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Link to Meeting / Event
                </label>
                <select
                  value={editMeetingId}
                  onChange={(e) => setEditMeetingId(e.target.value)}
                  className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
                >
                  <option value="">None (Independent Task)</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      📅 {m.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-100">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setEditingTask(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isEditSubmitting}
              >
                {isEditSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
