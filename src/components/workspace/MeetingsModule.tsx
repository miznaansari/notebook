"use client";

import * as React from "react";
import {
  Calendar,
  CheckSquare,
  Square,
  Plus,
  Trash2,
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
  Share2,
  MessageSquare,
  Mail,
  Save,
  TrendingUp,
  Award,
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
  updatedAt?: string;
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

interface DailySummaryData {
  dateLabel: string;
  headline: string;
  completionRate: string;
  completedHighlights: string[];
  inProgressAndNext: string[];
  slackWhatsappFormat: string;
  clientEmailFormat: string;
  summaryNotesMarkdown: string;
}

interface MeetingsModuleProps {
  projectId: string;
  projectName?: string;
  clientName?: string | null;
  tasks?: TaskItem[];
  meetings?: { id: string; title: string; meetingDate?: string }[];
  questions?: any[];
  preSelectedQuestionIds?: string[];
  onTasksChange?: (tasks: TaskItem[]) => void;
  onMeetingsChange?: (meetings: any[]) => void;
  onNotesChange?: (notes: any[]) => void;
  onNavigateToTab?: (tab: any) => void;
}

export function MeetingsModule({
  projectId,
  projectName = "Project",
  clientName,
  tasks = [],
  meetings = [],
  questions = [],
  onTasksChange,
  onNotesChange,
  onNavigateToTab,
}: MeetingsModuleProps) {
  // Today's local date string formatted as YYYY-MM-DD
  const getTodayDateStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayDateStr();

  // Filters & Search
  const [filter, setFilter] = React.useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
  const [dateFilter, setDateFilter] = React.useState<"ALL" | "TODAY" | "YESTERDAY" | "UPCOMING" | "UNDATED">("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Quick Add State (defaults to today's date)
  const [quickTitle, setQuickTitle] = React.useState("");
  const [quickPriority, setQuickPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");
  const [quickDueDate, setQuickDueDate] = React.useState<string>(todayStr);
  const [quickMeetingId, setQuickMeetingId] = React.useState("");
  const voiceBaseQuickTitleRef = React.useRef<string | null>(null);
  const voiceBaseAiRawRef = React.useRef<string | null>(null);
  const quickTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea dynamically when text is long or multi-line
  React.useEffect(() => {
    if (quickTextareaRef.current) {
      quickTextareaRef.current.style.height = "auto";
      quickTextareaRef.current.style.height = `${Math.min(
        Math.max(quickTextareaRef.current.scrollHeight, 44),
        140
      )}px`;
    }
  }, [quickTitle]);

  // Manual Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState("");
  const [modalDesc, setModalDesc] = React.useState("");
  const [modalPriority, setModalPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [modalDueDate, setModalDueDate] = React.useState<string>(todayStr);
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

  // AI Task Generator & Bulk Extractor State
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
  const [aiStep, setAiStep] = React.useState<"input" | "review">("input");
  const [aiRawText, setAiRawText] = React.useState("");
  const [aiDefaultDueDate, setAiDefaultDueDate] = React.useState<string>(todayStr);
  const [aiDefaultMeetingId, setAiDefaultMeetingId] = React.useState("");
  const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);
  const [isCreatingAiTasks, setIsCreatingAiTasks] = React.useState(false);
  const [draftTasks, setDraftTasks] = React.useState<DraftTask[]>([]);

  // AI Daily Accomplishment Summary Modal State ("Aaj kya kya kiya")
  const [summaryModalOpen, setSummaryModalOpen] = React.useState(false);
  const [summaryTargetDate, setSummaryTargetDate] = React.useState<string>(todayStr);
  const [summaryData, setSummaryData] = React.useState<DailySummaryData | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
  const [activeSummaryTab, setActiveSummaryTab] = React.useState<"overview" | "whatsapp" | "email">("overview");

  // Sample templates for AI prompt
  const sampleTemplates = [
    {
      label: "⚡ Today's Daily Sprint Items",
      description: "Direct action items and deliverables for today",
      text: `Fix bulk account import validation issue.
Verify email verification token expiry.
Client requested demo for member invite module by 4 PM.
Review sandbox payment gateway webhooks.`,
    },
    {
      label: "🐞 Bug Reports & Issues",
      description: "User issues, error logs, and functional bugs",
      text: `Bulk account import option not working.
Skip onboarding not working.
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
      label: "📝 Meeting Action Items",
      description: "Commitments and post-meeting follow-ups",
      text: `Confirm sandbox payment gateway credentials with client by Friday.
Backend team to optimize member search SQL query.
Send updated API documentation and postman collection to mobile app team.
Schedule follow-up sprint demo for next Tuesday 4 PM.`,
    },
  ];

  // Quick statistics calculation
  const totalCount = tasks.length;
  const pendingCount = tasks.filter((t) => t.status !== "COMPLETED").length;
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;

  const todayTasks = tasks.filter((t) => {
    if (!t.dueDate) return false;
    const taskDate = new Date(t.dueDate).toISOString().slice(0, 10);
    return taskDate === todayStr;
  });
  const todayCompletedCount = todayTasks.filter((t) => t.status === "COMPLETED").length;
  const todayTotalCount = todayTasks.length;
  const todayCompletionRate =
    todayTotalCount > 0 ? Math.round((todayCompletedCount / todayTotalCount) * 100) : 0;

  // Filter tasks by text search and status
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

    if (dateFilter === "TODAY") {
      if (!t.dueDate) return false;
      return new Date(t.dueDate).toISOString().slice(0, 10) === todayStr;
    }
    if (dateFilter === "YESTERDAY") {
      if (!t.dueDate) return false;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      return new Date(t.dueDate).toISOString().slice(0, 10) === yesterdayStr;
    }
    if (dateFilter === "UPCOMING") {
      if (!t.dueDate) return false;
      return new Date(t.dueDate).toISOString().slice(0, 10) > todayStr;
    }
    if (dateFilter === "UNDATED") {
      return !t.dueDate;
    }

    return true;
  });

  // Group filtered tasks by Date Key (e.g. "2026-09-03", "2026-09-02", "UNDATED")
  const groupedByDate = React.useMemo(() => {
    const groups: { [key: string]: TaskItem[] } = {};

    filteredTasks.forEach((t) => {
      let key = "UNDATED";
      if (t.dueDate) {
        key = new Date(t.dueDate).toISOString().slice(0, 10);
      }
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(t);
    });

    // Ensure Today's group is present if we are in "ALL" or "TODAY" mode
    if ((dateFilter === "ALL" || dateFilter === "TODAY") && !groups[todayStr]) {
      groups[todayStr] = [];
    }

    // Sort group keys: Today first, then other dates descending, then UNDATED last
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === todayStr) return -1;
      if (b === todayStr) return 1;
      if (a === "UNDATED") return 1;
      if (b === "UNDATED") return -1;
      return b.localeCompare(a);
    });

    return sortedKeys.map((key) => ({
      dateKey: key,
      tasks: groups[key],
    }));
  }, [filteredTasks, todayStr, dateFilter]);

  // Format Date Header Labels
  const formatGroupHeader = (dateKey: string) => {
    if (dateKey === "UNDATED") {
      return {
        title: "No Due Date / Backlog",
        badge: "Backlog",
        badgeColor: "bg-gray-100 text-gray-700",
        isToday: false,
      };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const dateObj = new Date(`${dateKey}T00:00:00`);
    const dateFormatted = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (dateKey === todayStr) {
      return {
        title: `Today — ${dateFormatted}`,
        badge: "Today",
        badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
        isToday: true,
      };
    }

    if (dateKey === yesterdayStr) {
      return {
        title: `Yesterday — ${dateFormatted}`,
        badge: "Yesterday",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        isToday: false,
      };
    }

    if (dateKey === tomorrowStr) {
      return {
        title: `Tomorrow — ${dateFormatted}`,
        badge: "Tomorrow",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
        isToday: false,
      };
    }

    return {
      title: dateFormatted,
      badge: dateKey > todayStr ? "Upcoming" : "Past Date",
      badgeColor: dateKey > todayStr ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700",
      isToday: false,
    };
  };

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
        onTasksChange?.(
          tasks.map((t) => (t.id === taskId ? { ...t, status: nextStatus as any } : t))
        );
        toast.success(
          nextStatus === "COMPLETED" ? "Task completed! Great progress 🎉" : "Task re-opened"
        );
      } else {
        toast.error("Failed to update task status.");
      }
    } catch (err) {
      toast.error("Network error while updating task.");
    }
  };

  // Quick Add Task Submit
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickTitle.trim(),
          priority: quickPriority,
          dueDate: quickDueDate ? `${quickDueDate}T23:59:59` : null,
          meetingId: quickMeetingId || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.task) {
        onTasksChange?.([data.task, ...tasks]);
        setQuickTitle("");
        toast.success("Task added to today's list!");
      } else {
        toast.error(data.error || "Failed to add task");
      }
    } catch (err) {
      toast.error("Error creating task.");
    }
  };

  // Manual Add Modal Submit
  const handleManualAdd = async (e: React.FormEvent) => {
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
          dueDate: modalDueDate ? `${modalDueDate}T23:59:59` : null,
          meetingId: modalMeetingId || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.task) {
        onTasksChange?.([data.task, ...tasks]);
        setIsAddModalOpen(false);
        setModalTitle("");
        setModalDesc("");
        setModalPriority("MEDIUM");
        toast.success("Task created successfully!");
      } else {
        toast.error(data.error || "Failed to create task");
      }
    } catch (err) {
      toast.error("Error creating task");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Task Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
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
          dueDate: editDueDate ? `${editDueDate}T23:59:59` : null,
          meetingId: editMeetingId || null,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.task) {
        onTasksChange?.(tasks.map((t) => (t.id === editingTask.id ? data.task : t)));
        setEditingTask(null);
        toast.success("Task updated successfully!");
      } else {
        toast.error(data.error || "Failed to update task");
      }
    } catch (err) {
      toast.error("Error updating task");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onTasksChange?.(tasks.filter((t) => t.id !== taskId));
        toast.success("Task deleted.");
      } else {
        toast.error("Failed to delete task.");
      }
    } catch (err) {
      toast.error("Error deleting task.");
    }
  };

  // Trigger AI Daily Summary ("Aaj kya kya kiya") for a given Date Group
  const handleGenerateDailySummary = async (dateKey: string, groupTasks: TaskItem[]) => {
    setSummaryTargetDate(dateKey);
    setSummaryModalOpen(true);
    setSummaryData(null);
    setIsGeneratingSummary(true);
    setActiveSummaryTab("overview");

    const header = formatGroupHeader(dateKey);
    const dateLabel = header.title;

    if (groupTasks.length === 0) {
      setIsGeneratingSummary(false);
      setSummaryData({
        dateLabel,
        headline: `No tasks logged yet for ${dateLabel}.`,
        completionRate: "0/0 Tasks",
        completedHighlights: ["No completed tasks on this date."],
        inProgressAndNext: ["Add tasks using the Quick Add bar or AI Task Extractor."],
        slackWhatsappFormat: `📅 *Daily Standup — ${dateLabel}*\n\n✅ *What I Did:*\n• No tasks logged yet\n\n⏳ *Next Priorities:*\n• Plan and add today's sprint items`,
        clientEmailFormat: `Subject: Daily Status Update - ${projectName} (${dateLabel})\n\nHi Team,\n\nHere is the daily status overview for ${dateLabel}. Currently planning upcoming task deliverables.\n\nBest regards,`,
        summaryNotesMarkdown: `# Daily Work Summary — ${dateLabel}\n\n*No tasks logged yet for this date.*`,
      });
      return;
    }

    try {
      const formattedTasksPayload = groupTasks
        .map(
          (t, idx) =>
            `${idx + 1}. [${t.status}] ${t.title} (Priority: ${t.priority})${t.description ? ` - Details: ${t.description}` : ""
            }`
        )
        .join("\n");

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_daily_summary",
          text: formattedTasksPayload,
          context: `${projectName} (Date: ${dateLabel})`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        const resObj = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
        setSummaryData({
          dateLabel,
          headline: resObj.headline || `Accomplishments Summary for ${dateLabel}`,
          completionRate: resObj.completionRate || `${groupTasks.filter((t) => t.status === "COMPLETED").length}/${groupTasks.length} Completed`,
          completedHighlights: Array.isArray(resObj.completedHighlights) ? resObj.completedHighlights : [],
          inProgressAndNext: Array.isArray(resObj.inProgressAndNext) ? resObj.inProgressAndNext : [],
          slackWhatsappFormat: resObj.slackWhatsappFormat || "",
          clientEmailFormat: resObj.clientEmailFormat || "",
          summaryNotesMarkdown: resObj.summaryNotesMarkdown || "",
        });
        toast.success("✨ AI Daily Accomplishment Summary generated!");
      } else {
        throw new Error(data.error || "Failed to generate summary");
      }
    } catch (err: any) {
      console.error("AI Daily Summary Error:", err);
      toast.error("Failed to generate AI summary. Showing standard overview.");
      const done = groupTasks.filter((t) => t.status === "COMPLETED");
      const pending = groupTasks.filter((t) => t.status !== "COMPLETED");
      setSummaryData({
        dateLabel,
        headline: `Completed ${done.length} of ${groupTasks.length} tasks on ${dateLabel}.`,
        completionRate: `${done.length}/${groupTasks.length} Tasks (${Math.round((done.length / groupTasks.length) * 100)}%)`,
        completedHighlights: done.map((t) => t.title),
        inProgressAndNext: pending.map((t) => t.title),
        slackWhatsappFormat: `📅 *Daily Standup (${dateLabel})*\n\n✅ *What I Did Today:*\n${done.map((t) => `• ${t.title}`).join("\n") || "• None"}\n\n⏳ *In Progress / Tomorrow:*\n${pending.map((t) => `• ${t.title}`).join("\n") || "• None"}`,
        clientEmailFormat: `Subject: Daily Update: ${projectName} - ${dateLabel}\n\nHi Team,\n\nToday we completed the following items:\n${done.map((t) => `• ${t.title}`).join("\n")}\n\nPending Next Steps:\n${pending.map((t) => `• ${t.title}`).join("\n")}`,
        summaryNotesMarkdown: `# Daily Summary — ${dateLabel}\n\n## Completed\n${done.map((t) => `- [x] ${t.title}`).join("\n")}\n\n## In Progress\n${pending.map((t) => `- [ ] ${t.title}`).join("\n")}`,
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Save AI Summary to Notepad as a Note
  const handleSaveSummaryAsNote = async () => {
    if (!summaryData) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Daily Work Summary — ${summaryData.dateLabel}`,
          content: summaryData.summaryNotesMarkdown || summaryData.slackWhatsappFormat,
          tags: "Standup, Daily Summary, Tasks Log",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Summary saved into Notepad notes! 📝");
        if (data.note && onNotesChange) {
          fetch(`/api/projects/${projectId}`)
            .then((r) => r.json())
            .then((d) => {
              if (d?.project?.notes) onNotesChange(d.project.notes);
            })
            .catch(() => {});
        }
      } else {
        toast.error("Failed to save note.");
      }
    } catch (err) {
      toast.error("Error saving summary to notepad.");
    }
  };

  // AI Task Generator: Extract tasks from raw unstructured text
  const handleExtractAiTasks = async () => {
    if (!aiRawText.trim()) {
      toast.error("Please paste or dictate some raw text/notes first.");
      return;
    }

    setIsGeneratingAi(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract_tasks",
          text: aiRawText.trim(),
          context: `Project: ${projectName}`,
        }),
      });

      const data = await res.json();

      if (res.ok && Array.isArray(data.result)) {
        const extracted: DraftTask[] = data.result.map((item: any, idx: number) => ({
          id: `draft_${Date.now()}_${idx}`,
          title: item.title || `Task item ${idx + 1}`,
          description: item.description || "",
          priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(item.priority?.toUpperCase())
            ? (item.priority.toUpperCase() as any)
            : "MEDIUM",
          dueDate: aiDefaultDueDate,
          meetingId: aiDefaultMeetingId,
          selected: true,
        }));

        if (extracted.length === 0) {
          toast.error("No actionable tasks could be extracted. Try providing more details.");
          return;
        }

        setDraftTasks(extracted);
        setAiStep("review");
        toast.success(`Gemini AI parsed ${extracted.length} structured task(s)!`);
      } else {
        toast.error(data.error || "Failed to extract tasks.");
      }
    } catch (err) {
      toast.error("Failed to extract tasks.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // AI Task Generator: Bulk commit selected tasks
  const handleCreateBulkAiTasks = async () => {
    const selected = draftTasks.filter((t) => t.selected && t.title.trim());
    if (selected.length === 0) {
      toast.error("Please select at least one task to create.");
      return;
    }

    setIsCreatingAiTasks(true);
    try {
      const payload = selected.map((t) => ({
        title: t.title.trim(),
        description: t.description.trim() || null,
        priority: t.priority,
        dueDate: t.dueDate ? `${t.dueDate}T23:59:59` : null,
        meetingId: t.meetingId || null,
      }));

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: payload }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.tasks)) {
        onTasksChange?.([...data.tasks, ...tasks]);
        setIsAiModalOpen(false);
        setAiStep("input");
        setAiRawText("");
        setDraftTasks([]);
        toast.success(`Created ${data.count || selected.length} task(s) on ${aiDefaultDueDate}! 🚀`);
      } else {
        toast.error(data.error || "Failed to create bulk tasks.");
      }
    } catch (err) {
      toast.error("Error creating bulk tasks.");
    } finally {
      setIsCreatingAiTasks(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <Flame className="w-3 h-3 text-red-600 fill-red-500 animate-pulse" /> Urgent
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3 text-amber-600" /> High
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 text-blue-500" /> Medium
          </span>
        );
      case "LOW":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Low
          </span>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] min-h-0">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ========================================================================= */}
        {/* 1. HERO HEADER: Title, Date Metrics, & Top Actions                        */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Calendar className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Today&apos;s Tasks &amp; Daily Work Log
              </h1>
              <Badge variant="secondary" className="font-bold bg-blue-50 text-blue-700 border-blue-200">
                Date-wise Tracking
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              Manage day-by-day deliverables, track task completion, and generate instant AI standup summaries (&quot;Aaj kya kya kiya&quot;).
            </p>
          </div>

          {/* Quick Metrics Badge Pill */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200/80 rounded-xl p-2.5 sm:px-4 shrink-0">
            <div className="text-left">
              <div className="text-[11px] uppercase font-bold text-gray-400">Today&apos;s Progress</div>
              <div className="text-base font-extrabold text-gray-900">
                {todayCompletedCount} / {todayTotalCount}{" "}
                <span className="text-xs font-semibold text-gray-500 font-normal">
                  ({todayCompletionRate}%)
                </span>
              </div>
            </div>
            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${todayCompletionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. QUICK ADD TASK BAR (With Voice STT + AI Magic + Date Picker)           */}
        {/* ========================================================================= */}
        <form
          onSubmit={handleQuickAdd}
          className="bg-white rounded-2xl border border-blue-200/80 p-3 sm:p-4 shadow-sm shadow-blue-500/5 flex flex-col md:flex-row items-stretch md:items-center gap-2.5"
        >
          {/* Main Title Auto-Growing Textarea with Speech-to-Text & AI Magic Button */}
          <div className="relative flex-1 flex items-start">
            <textarea
              ref={quickTextareaRef}
              rows={1}
              placeholder="Type or speak today's task (e.g. Fix bulk account import, client sandbox key)..."
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickAdd(e);
                }
              }}
              className="w-full min-h-[44px] max-h-36 py-2.5 pl-4 pr-36 rounded-xl bg-[#F3F4F6] text-sm font-medium text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition resize-none leading-relaxed"
            />
            <div className="absolute right-2 top-1.5 flex items-center gap-1">
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
                context="Daily task action item"
                variant="ghost"
                size="sm"
                allowedActions={["hinglish_to_english", "professional", "make_short", "grammar", "english_to_simple"]}
              />
            </div>
          </div>

          {/* Priority Dropdown */}
          <select
            value={quickPriority}
            onChange={(e) => setQuickPriority(e.target.value as any)}
            className="h-11 px-3 rounded-xl bg-[#F3F4F6] text-xs font-bold text-gray-700 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] cursor-pointer"
          >
            <option value="URGENT">🔥 Urgent</option>
            <option value="HIGH">🔴 High Priority</option>
            <option value="MEDIUM">🟡 Medium Priority</option>
            <option value="LOW">🟢 Low Priority</option>
          </select>

          {/* Date Selector (Defaults to Today) */}
          <div className="flex items-center gap-1 bg-[#F3F4F6] px-2.5 rounded-xl border-2 border-transparent focus-within:bg-white focus-within:border-[#3B82F6]">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="date"
              value={quickDueDate}
              onChange={(e) => setQuickDueDate(e.target.value)}
              className="h-11 bg-transparent text-xs font-semibold text-gray-800 outline-none cursor-pointer"
              title="Assign task date"
            />
          </div>

          {/* Meeting / Link (Optional) */}
          {meetings.length > 0 && (
            <select
              value={quickMeetingId}
              onChange={(e) => setQuickMeetingId(e.target.value)}
              className="h-11 px-3 rounded-xl bg-[#F3F4F6] text-xs font-medium text-gray-600 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] max-w-[150px] truncate cursor-pointer"
            >
              <option value="">No Meeting Link</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          )}

          {/* Action Buttons: Add Task & AI Bulk Extractor */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="submit"
              variant="primary"
              className="h-11 px-4 text-xs font-bold shadow-sm shadow-blue-500/20"
              disabled={!quickTitle.trim()}
            >
              <Plus className="w-4 h-4 mr-1" />
              <span>Add Task</span>
            </Button>

            <Button
              type="button"
              variant="amber"
              onClick={() => {
                setAiStep("input");
                setDraftTasks([]);
                setAiRawText("");
                setAiDefaultDueDate(todayStr);
                setIsAiModalOpen(true);
              }}
              className="h-11 px-3.5 text-xs font-bold shadow-sm shadow-amber-500/10"
              title="Extract multiple structured tasks using Gemini AI"
            >
              <Sparkles className="w-4 h-4 mr-1 text-amber-900" />
              <span className="hidden sm:inline">AI Task Generator</span>
              <span className="sm:hidden">AI</span>
            </Button>
          </div>
        </form>

        {/* ========================================================================= */}
        {/* 3. FILTERING & DATE NAVIGATION STRIP                                      */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "ALL", label: `All (${totalCount})` },
              { id: "PENDING", label: `Pending (${pendingCount})` },
              { id: "COMPLETED", label: `Completed (${completedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                  filter === tab.id
                    ? "bg-gray-900 text-white shadow-xs"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date Quick Jump Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
              {[
                { id: "ALL", label: "All Dates" },
                { id: "TODAY", label: "Today" },
                { id: "YESTERDAY", label: "Yesterday" },
                { id: "UPCOMING", label: "Upcoming" },
                { id: "UNDATED", label: "Undated" },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDateFilter(d.id as any)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer",
                    dateFilter === d.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-gray-600 hover:bg-gray-200/60"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#F9FAFB] text-xs font-medium text-gray-900 placeholder:text-gray-400 border border-gray-200 outline-none focus:bg-white focus:border-[#3B82F6]"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setModalTitle("");
                setModalDesc("");
                setModalPriority("MEDIUM");
                setModalDueDate(todayStr);
                setIsAddModalOpen(true);
              }}
              className="h-8 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Add</span>
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. DATE-WISE GROUPED TASK SECTIONS WITH AI SUMMARY OPTION                 */}
        {/* ========================================================================= */}
        <div className="space-y-6">
          {groupedByDate.map(({ dateKey, tasks: groupTasks }) => {
            const header = formatGroupHeader(dateKey);
            const groupDone = groupTasks.filter((t) => t.status === "COMPLETED").length;
            const groupTotal = groupTasks.length;
            const groupPct = groupTotal > 0 ? Math.round((groupDone / groupTotal) * 100) : 0;

            return (
              <div
                key={dateKey}
                className={cn(
                  "bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs",
                  header.isToday
                    ? "border-blue-300 ring-2 ring-blue-500/10"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                {/* Date Group Header Card */}
                <div className="p-4 sm:px-6 bg-gradient-to-r from-gray-50/80 to-white border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "p-2 rounded-xl flex items-center justify-center font-bold text-xs",
                        header.isToday
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                          : "bg-gray-100 text-gray-700"
                      )}
                    >
                      <CalendarDays className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">
                          {header.title}
                        </h2>
                        <span
                          className={cn(
                            "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                            header.badgeColor
                          )}
                        >
                          {header.badge}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-medium flex items-center gap-2 mt-0.5">
                        <span>
                          {groupDone} of {groupTotal} tasks completed ({groupPct}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Summary Button for this Date Group */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="amber"
                      size="sm"
                      onClick={() => handleGenerateDailySummary(dateKey, groupTasks)}
                      className="h-8 px-3 text-xs font-bold shadow-xs bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 border-none cursor-pointer"
                      title="Generate AI Standup & Accomplishment Summary for this date"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      <span>✨ AI Summary </span>
                    </Button>
                  </div>
                </div>

                {/* Tasks List for this Date */}
                <div className="divide-y divide-gray-100">
                  {groupTasks.length === 0 ? (
                    <div className="py-8 px-4 text-center text-gray-400 space-y-2">
                      <Clock className="w-7 h-7 mx-auto text-gray-300 stroke-[1.5]" />
                      <p className="text-xs font-medium">No tasks logged for {header.title}.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickDueDate(dateKey !== "UNDATED" ? dateKey : todayStr);
                          toast.info(`Ready to add task for ${header.title}`);
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        + Add task for this date
                      </button>
                    </div>
                  ) : (
                    groupTasks.map((task) => {
                      const isCompleted = task.status === "COMPLETED";

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "p-3.5 sm:px-6 flex items-start justify-between gap-3 group transition-colors",
                            isCompleted ? "bg-gray-50/50" : "hover:bg-blue-50/20"
                          )}
                        >
                          {/* Left: Checkbox + Title + Description + Badges */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => handleToggleTask(task.id, task.status)}
                              className="mt-0.5 text-gray-400 hover:text-blue-600 active:scale-95 transition shrink-0 cursor-pointer"
                              title={isCompleted ? "Mark as Incomplete" : "Mark as Completed"}
                            >
                              {isCompleted ? (
                                <CheckSquare className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400 hover:text-blue-600" />
                              )}
                            </button>

                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={cn(
                                    "text-sm font-bold tracking-tight text-gray-900 transition-all",
                                    isCompleted && "line-through text-gray-400 font-normal"
                                  )}
                                >
                                  {task.title}
                                </span>
                                {getPriorityBadge(task.priority)}
                                {task.meeting && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                                    <Tag className="w-2.5 h-2.5" />
                                    {task.meeting.title}
                                  </span>
                                )}
                              </div>

                              {task.description && (
                                <p
                                  className={cn(
                                    "text-xs text-gray-600 leading-relaxed font-normal",
                                    isCompleted && "line-through text-gray-400"
                                  )}
                                >
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right: Actions (Edit / Delete) */}
                          <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTask(task);
                                setEditTitle(task.title);
                                setEditDesc(task.description || "");
                                setEditPriority(task.priority);
                                setEditDueDate(
                                  task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
                                );
                                setEditMeetingId(task.meetingId || "");
                                setEditStatus(task.status);
                              }}
                              title="Edit Task"
                              className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              title="Delete Task"
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* 5. MODAL: AI DAILY ACCOMPLISHMENT SUMMARY ("Aaj kya kya kiya")            */}
        {/* ========================================================================= */}
        <Modal
          isOpen={summaryModalOpen}
          onClose={() => setSummaryModalOpen(false)}
          title={`✨ AI Work Accomplishment Summary — ${summaryData?.dateLabel || "Today"}`}
          description="Instant standup summary and deliverables report based on tasks completed on this date."
          maxWidth="2xl"
        >
          {isGeneratingSummary ? (
            <div className="py-14 text-center space-y-4">
              <div className="relative inline-flex">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center animate-pulse text-amber-600">
                  <Sparkles className="w-6 h-6 animate-spin" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-900">
                  Gemini AI is analyzing today&apos;s tasks &amp; achievements...
                </h3>
                <p className="text-xs text-gray-500">
                  Structuring completed milestones, progress highlights, and standup messages.
                </p>
              </div>
            </div>
          ) : summaryData ? (
            <div className="space-y-5">
              {/* Executive Headline Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-blue-700">
                    <Award className="w-4 h-4 text-blue-600" />
                    <span>Executive Summary </span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    {summaryData.completionRate}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-relaxed">
                  {summaryData.headline}
                </p>
              </div>

              {/* Format Selector Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200">
                {[
                  { id: "overview", label: "🏆 Accomplishments & Deliverables", icon: Award },
                  { id: "whatsapp", label: "💬 WhatsApp / Slack Standup", icon: MessageSquare },
                  { id: "email", label: "✉️ Client Status Email", icon: Mail },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeSummaryTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveSummaryTab(tab.id as any)}
                      className={cn(
                        "flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer",
                        isActive
                          ? "bg-white text-gray-900 shadow-xs"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Overview Breakdown */}
              {activeSummaryTab === "overview" && (
                <div className="space-y-4">
                  {/* Completed items */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Completed Work Highlights ({summaryData.completedHighlights.length})</span>
                    </h4>
                    <div className="space-y-1.5 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                      {summaryData.completedHighlights.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No tasks completed yet on this date.</p>
                      ) : (
                        summaryData.completedHighlights.map((hl, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs font-medium text-emerald-950">
                            <span className="text-emerald-600 font-bold">•</span>
                            <span>{hl}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* In Progress / Next steps */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>In-Progress / Upcoming Priorities ({summaryData.inProgressAndNext.length})</span>
                    </h4>
                    <div className="space-y-1.5 bg-amber-50/50 border border-amber-100 rounded-xl p-3">
                      {summaryData.inProgressAndNext.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No pending tasks for this date.</p>
                      ) : (
                        summaryData.inProgressAndNext.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs font-medium text-amber-950">
                            <span className="text-amber-600 font-bold">•</span>
                            <span>{item}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: WhatsApp / Slack Format */}
              {activeSummaryTab === "whatsapp" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">Team Chat Standup Format</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(summaryData.slackWhatsappFormat);
                        toast.success("Standup copied to clipboard! 📋");
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy for Slack / WhatsApp</span>
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-gray-900 text-emerald-400 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                    {summaryData.slackWhatsappFormat}
                  </pre>
                </div>
              )}

              {/* Tab 3: Client Status Email */}
              {activeSummaryTab === "email" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">Executive Client Update Email</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(summaryData.clientEmailFormat);
                        toast.success("Email draft copied to clipboard! ✉️");
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Email Draft</span>
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                    {summaryData.clientEmailFormat}
                  </pre>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveSummaryAsNote}
                  className="text-xs font-bold text-blue-600 hover:bg-blue-50 border-blue-200"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  <span>Save as Note in Notepad</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        activeSummaryTab === "email"
                          ? summaryData.clientEmailFormat
                          : summaryData.slackWhatsappFormat
                      );
                      toast.success("Copied to clipboard!");
                    }}
                    className="text-xs font-bold"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    <span>Copy Text</span>
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setSummaryModalOpen(false)}
                    className="text-xs font-bold"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </Modal>

        {/* ========================================================================= */}
        {/* 6. MODAL: AI TASK GENERATOR & BULK EXTRACTOR                              */}
        {/* ========================================================================= */}
        <Modal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          title="✨ AI Task Generator & Bulk Extractor"
          description="Paste raw meeting notes, bug lists, client feedback, or speak into microphone to extract structured tasks."
          maxWidth="2xl"
        >
          {aiStep === "input" ? (
            <div className="space-y-4">
              {/* Sample Templates Strip */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-gray-700">
                  Quick-Load Templates
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sampleTemplates.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => {
                        setAiRawText(t.text);
                        toast.info(`Loaded ${t.label}`);
                      }}
                      className="text-left p-2.5 rounded-xl border border-gray-200 hover:border-amber-400 hover:bg-amber-50/50 transition cursor-pointer group"
                    >
                      <div className="text-xs font-bold text-gray-900 group-hover:text-amber-800">
                        {t.label}
                      </div>
                      <div className="text-[10px] text-gray-500 line-clamp-1">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Raw Input Textarea with Mic Button */}
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
                  rows={6}
                  placeholder={`Paste any unstructured text here, for example:\n\nBulk account import option not working.\nSkip onboarding not working\nIs email validation system live?\nIf user is not registered and another user want to invite then in that case user should receive invitation email.`}
                  value={aiRawText}
                  onChange={(e) => setAiRawText(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-[#F9FAFB] text-sm font-medium text-gray-900 placeholder:text-gray-400 border-2 border-gray-200 outline-none focus:bg-white focus:border-[#3B82F6] transition resize-y font-mono"
                />
              </div>

              {/* Assign Date for Extracted Tasks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Assign Due Date</label>
                  <Input
                    type="date"
                    value={aiDefaultDueDate}
                    onChange={(e) => setAiDefaultDueDate(e.target.value)}
                  />
                </div>
                {meetings.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">Link to Meeting (Optional)</label>
                    <select
                      value={aiDefaultMeetingId}
                      onChange={(e) => setAiDefaultMeetingId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-800 outline-none focus:border-blue-500"
                    >
                      <option value="">None</option>
                      {meetings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={() => setIsAiModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="amber"
                  onClick={handleExtractAiTasks}
                  disabled={isGeneratingAi || !aiRawText.trim()}
                  className="font-bold shadow-sm"
                >
                  {isGeneratingAi ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      <span>Gemini AI is Extracting Tasks...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      <span>Extract Tasks with Gemini AI</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Step 2: Review & Bulk Add */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="text-xs font-bold text-gray-800">
                  Select and review extracted tasks before creating ({draftTasks.filter((t) => t.selected).length} selected)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftTasks((prev) => prev.map((t) => ({ ...t, selected: true })))}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setDraftTasks((prev) => prev.map((t) => ({ ...t, selected: false })))}
                    className="text-xs font-bold text-gray-500 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {draftTasks.map((draft, idx) => (
                  <div
                    key={draft.id}
                    className={cn(
                      "p-3 rounded-xl border transition-all duration-150 flex items-start gap-3",
                      draft.selected
                        ? "bg-amber-50/40 border-amber-300/80 ring-1 ring-amber-400/20"
                        : "bg-gray-50 border-gray-200 opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(e) =>
                        setDraftTasks((prev) =>
                          prev.map((t) => (t.id === draft.id ? { ...t, selected: e.target.checked } : t))
                        )
                      }
                      className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />

                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          value={draft.title}
                          onChange={(e) =>
                            setDraftTasks((prev) =>
                              prev.map((t) => (t.id === draft.id ? { ...t, title: e.target.value } : t))
                            )
                          }
                          className="h-8 text-xs font-bold flex-1"
                        />
                        <select
                          value={draft.priority}
                          onChange={(e) =>
                            setDraftTasks((prev) =>
                              prev.map((t) =>
                                t.id === draft.id ? { ...t, priority: e.target.value as any } : t
                              )
                            )
                          }
                          className="h-8 px-2 rounded-md border border-gray-200 text-xs font-bold bg-white cursor-pointer"
                        >
                          <option value="URGENT">🔥 Urgent</option>
                          <option value="HIGH">🔴 High</option>
                          <option value="MEDIUM">🟡 Medium</option>
                          <option value="LOW">🟢 Low</option>
                        </select>
                      </div>

                      {draft.description && (
                        <input
                          type="text"
                          value={draft.description}
                          onChange={(e) =>
                            setDraftTasks((prev) =>
                              prev.map((t) =>
                                t.id === draft.id ? { ...t, description: e.target.value } : t
                              )
                            )
                          }
                          placeholder="Task details..."
                          className="w-full h-7 px-2 text-[11px] text-gray-600 bg-white/80 rounded border border-gray-200"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAiStep("input")}
                  disabled={isCreatingAiTasks}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  <span>Back to Edit Prompt</span>
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCreateBulkAiTasks}
                  disabled={isCreatingAiTasks || draftTasks.filter((t) => t.selected).length === 0}
                  className="font-bold shadow-sm"
                >
                  {isCreatingAiTasks ? (
                    "Creating Tasks..."
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      <span>Create {draftTasks.filter((t) => t.selected).length} Tasks</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ========================================================================= */}
        {/* 7. MODAL: MANUAL ADD TASK                                                 */}
        {/* ========================================================================= */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add New Project Task"
          description="Create a manual follow-up task with due date and priority."
          maxWidth="lg"
        >
          <form onSubmit={handleManualAdd} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Task Title *</label>
              <Input
                placeholder="e.g. Fix bulk account import error"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Description / Details (Optional)</label>
              <textarea
                rows={3}
                placeholder="Optional context, steps to reproduce, or deliverable outcome..."
                value={modalDesc}
                onChange={(e) => setModalDesc(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-gray-200 text-xs text-gray-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Priority</label>
                <select
                  value={modalPriority}
                  onChange={(e) => setModalPriority(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-xs font-bold text-gray-800 bg-white"
                >
                  <option value="URGENT">🔥 Urgent</option>
                  <option value="HIGH">🔴 High</option>
                  <option value="MEDIUM">🟡 Medium</option>
                  <option value="LOW">🟢 Low</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Due Date</label>
                <Input
                  type="date"
                  value={modalDueDate}
                  onChange={(e) => setModalDueDate(e.target.value)}
                />
              </div>
            </div>

            {meetings.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Link to Meeting</label>
                <select
                  value={modalMeetingId}
                  onChange={(e) => setModalMeetingId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-xs text-gray-800 bg-white"
                >
                  <option value="">None</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting || !modalTitle.trim()}>
                {isSubmitting ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* ========================================================================= */}
        {/* 8. MODAL: EDIT TASK                                                       */}
        {/* ========================================================================= */}
        <Modal
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          title="Edit Task Details"
          description="Update task title, description, priority, date, or status."
          maxWidth="lg"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Task Title *</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Description</label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-gray-200 text-xs text-gray-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full h-10 px-2.5 rounded-lg border border-gray-200 text-xs font-bold bg-white"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as any)}
                  className="w-full h-10 px-2.5 rounded-lg border border-gray-200 text-xs font-bold bg-white"
                >
                  <option value="URGENT">🔥 Urgent</option>
                  <option value="HIGH">🔴 High</option>
                  <option value="MEDIUM">🟡 Medium</option>
                  <option value="LOW">🟢 Low</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Due Date</label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
            </div>

            {meetings.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Meeting</label>
                <select
                  value={editMeetingId}
                  onChange={(e) => setEditMeetingId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-xs text-gray-800 bg-white"
                >
                  <option value="">None</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  if (editingTask) {
                    handleDeleteTask(editingTask.id);
                    setEditingTask(null);
                  }
                }}
              >
                Delete Task
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingTask(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isEditSubmitting || !editTitle.trim()}>
                  {isEditSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
