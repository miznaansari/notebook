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
  meeting?: { id: string; title: string } | null;
  createdAt: string;
}

interface TasksModuleProps {
  projectId: string;
  tasks: TaskItem[];
  meetings?: { id: string; title: string }[];
  onTasksChange: (tasks: TaskItem[]) => void;
}

export function TasksModule({
  projectId,
  tasks,
  meetings = [],
  onTasksChange,
}: TasksModuleProps) {
  const [filter, setFilter] = React.useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
  const [quickTitle, setQuickTitle] = React.useState("");
  const [quickPriority, setQuickPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");
  const [quickDueDate, setQuickDueDate] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState("");
  const [modalDesc, setModalDesc] = React.useState("");
  const [modalPriority, setModalPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [modalDueDate, setModalDueDate] = React.useState("");
  const [modalMeetingId, setModalMeetingId] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const pendingCount = tasks.filter((t) => t.status !== "COMPLETED").length;
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;

  const filteredTasks = tasks.filter((t) => {
    if (filter === "PENDING") return t.status !== "COMPLETED";
    if (filter === "COMPLETED") return t.status === "COMPLETED";
    return true;
  });

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
          nextStatus === "COMPLETED" ? "Task marked as done!" : "Task re-opened"
        );
      }
    } catch (err) {
      toast.error("Failed to update task");
    }
  };

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
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onTasksChange([data.task, ...tasks]);
        setQuickTitle("");
        setQuickDueDate("");
        toast.success("Follow-up task added!");
      }
    } catch (err) {
      toast.error("Failed to create task");
    }
  };

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
        setIsModalOpen(false);
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-[#10B981]" strokeWidth={2.5} />
            <span>Tasks & Follow-up Action Items</span>
          </h2>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Track post-meeting follow-ups, pending deliverables, and commitments for this project.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsModalOpen(true)}
          className="gap-2 shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
          <span>New Follow-up Task</span>
        </Button>
      </div>

      {/* Quick Add Bar */}
      <form
        onSubmit={handleQuickAddTask}
        className="bg-white p-4 rounded-lg border-2 border-gray-200 flex flex-col sm:flex-row gap-3 items-center"
      >
        <div className="relative flex-1 w-full flex items-center">
          <input
            type="text"
            placeholder="Speak or type follow-up task (e.g., Client se sandbox API key confirm karo)..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            className="w-full h-11 pl-4 pr-44 rounded-md bg-[#F3F4F6] text-sm font-medium text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <VoiceMicButton
              onTranscript={(transcript) => {
                setQuickTitle((prev) => (prev ? `${prev} ${transcript}` : transcript));
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

        <select
          value={quickPriority}
          onChange={(e) => setQuickPriority(e.target.value as any)}
          className="h-11 px-3 rounded-md bg-[#F3F4F6] text-sm font-semibold text-gray-800 outline-none w-full sm:w-auto"
        >
          <option value="LOW">Low Priority</option>
          <option value="MEDIUM">Medium Priority</option>
          <option value="HIGH">High Priority</option>
          <option value="URGENT">Urgent</option>
        </select>

        <input
          type="date"
          value={quickDueDate}
          onChange={(e) => setQuickDueDate(e.target.value)}
          className="h-11 px-3 rounded-md bg-[#F3F4F6] text-sm font-semibold text-gray-800 outline-none w-full sm:w-auto"
        />

        <Button
          type="submit"
          variant="emerald"
          size="md"
          className="w-full sm:w-auto gap-1 text-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </Button>
      </form>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: "ALL", label: `All Tasks (${tasks.length})` },
          { id: "PENDING", label: `Pending (${pendingCount})` },
          { id: "COMPLETED", label: `Completed (${completedCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={cn(
              "px-4 py-2 rounded-md text-xs font-bold transition-all duration-200 cursor-pointer select-none",
              filter === tab.id
                ? "bg-[#111827] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-lg border-2 border-dashed border-gray-300">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-gray-800">No tasks in this view</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            All follow-ups are completed or none have been logged yet.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border-2 border-gray-200 divide-y-2 divide-gray-100">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "COMPLETED";
            return (
              <div
                key={task.id}
                className={cn(
                  "p-4 flex items-start justify-between gap-4 transition hover:bg-gray-50",
                  isCompleted && "bg-gray-50/70"
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => handleToggleTask(task.id, task.status)}
                    className="mt-0.5 text-gray-400 hover:text-emerald-600 transition"
                  >
                    {isCompleted ? (
                      <CheckSquare className="w-5 h-5 text-[#10B981]" strokeWidth={2.5} />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" strokeWidth={2.5} />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-bold text-gray-900 leading-snug",
                        isCompleted && "line-through text-gray-400"
                      )}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={cn(
                          "text-[10px] font-extrabold px-2 py-0.5 rounded uppercase",
                          task.priority === "URGENT"
                            ? "bg-red-100 text-red-800"
                            : task.priority === "HIGH"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        )}
                      >
                        {task.priority} Priority
                      </span>

                      {task.dueDate && (
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          Due: {formatDate(task.dueDate)}
                        </span>
                      )}

                      {task.meeting && (
                        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          From: {task.meeting.title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for detailed task creation */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
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
                <option value="URGENT">Urgent</option>
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
                Link to Meeting (Optional)
              </label>
              <select
                value={modalMeetingId}
                onChange={(e) => setModalMeetingId(e.target.value)}
                className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
              >
                <option value="">None (Independent Task)</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
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
              onClick={() => setIsModalOpen(false)}
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
    </div>
  );
}
