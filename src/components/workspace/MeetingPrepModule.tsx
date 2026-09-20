"use client";

import * as React from "react";
import {
  Sparkles,
  Plus,
  Copy,
  Printer,
  Calendar,
  Layers,
  CheckCircle2,
  HelpCircle,
  Clock,
  ArrowRight,
  Download,
  Edit2,
  Trash2,
  Loader2,
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AIMagicButton } from "@/components/ui/ai-magic-button";
import { VoiceMicButton } from "@/components/ui/voice-mic-button";
import { SYSTEM_TEMPLATES } from "@/lib/templates";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface MeetingPrepModuleProps {
  projectId: string;
  projectName: string;
  clientName?: string | null;
  questions: any[];
  categories?: any[];
  onQuestionsChange: (questions: any[]) => void;
  onCategoriesChange?: (categories: any[]) => void;
  onNavigateToMeetings: () => void;
  onScheduleMeetingWithQuestions: (questionIds: string[]) => void;
}

export function MeetingPrepModule({
  projectId,
  projectName,
  clientName,
  questions,
  categories = [],
  onQuestionsChange,
  onCategoriesChange,
  onNavigateToMeetings,
  onScheduleMeetingWithQuestions,
}: MeetingPrepModuleProps) {
  // Local Today's date string YYYY-MM-DD
  const getTodayDateStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayDateStr();
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
  const [isPickModalOpen, setIsPickModalOpen] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(SYSTEM_TEMPLATES[0].id);
  const [isImporting, setIsImporting] = React.useState(false);

  // Quick Add State (defaults to Today's date)
  const [quickQuestionText, setQuickQuestionText] = React.useState("");
  const [quickQuestionCategory, setQuickQuestionCategory] = React.useState("User Management");
  const [quickQuestionDate, setQuickQuestionDate] = React.useState<string>(todayStr);
  const [quickPriority, setQuickPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");
  const [customCatInput, setCustomCatInput] = React.useState("");
  const [isAddingQuestion, setIsAddingQuestion] = React.useState(false);
  const [deletingQuestionIds, setDeletingQuestionIds] = React.useState<{ [key: string]: boolean }>({});
  const quickQuestionTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Filters & Search
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");
  const [dateFilter, setDateFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Auto-grow textarea dynamically when text is long or multi-line
  React.useEffect(() => {
    if (quickQuestionTextareaRef.current) {
      quickQuestionTextareaRef.current.style.height = "auto";
      quickQuestionTextareaRef.current.style.height = `${Math.min(
        Math.max(quickQuestionTextareaRef.current.scrollHeight, 44),
        140
      )}px`;
    }
  }, [quickQuestionText]);

  // Drag and Drop state
  const [draggedQuestionId, setDraggedQuestionId] = React.useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = React.useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = React.useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = React.useState(false);

  // Edit question modal state
  const [editingQuestion, setEditingQuestion] = React.useState<any | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDetails, setEditDetails] = React.useState("");
  const [editCategory, setEditCategory] = React.useState("User Management");
  const [editDate, setEditDate] = React.useState<string>(todayStr);
  const [editCustomCatInput, setEditCustomCatInput] = React.useState("");
  const [editPriority, setEditPriority] = React.useState<string>("MEDIUM");
  const [editStatus, setEditStatus] = React.useState<string>("PENDING");
  const [editForNextMeeting, setEditForNextMeeting] = React.useState(true);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  // Dynamic list of categories from DB, prop and active questions
  const allCategoryNames = React.useMemo(() => {
    const list = [
      "General",
      "User Management",
      "Payment",
      "Reports",
      "Technical",
      "Architecture",
      ...(categories?.map((c: any) => c.name) || []),
      ...questions.map((q) => q.category),
    ].filter(Boolean);
    return Array.from(new Set(list));
  }, [categories, questions]);

  // Helper to extract question date key
  const getQuestionDateKey = (q: any): string => {
    if (q.meeting?.meetingDate) {
      return new Date(q.meeting.meetingDate).toISOString().slice(0, 10);
    }
    if (q.createdAt) {
      return new Date(q.createdAt).toISOString().slice(0, 10);
    }
    return "UNDATED";
  };

  // Questions in meeting prep (excluding soft-deleted)
  const nextMeetingQuestions = React.useMemo(() => {
    return questions.filter((q) => q.status !== "DELETED");
  }, [questions]);

  // Filtered questions based on Search, Category, and Date filters
  const filteredQuestions = React.useMemo(() => {
    return nextMeetingQuestions.filter((q) => {
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = q.title?.toLowerCase().includes(query);
        const matchesDetails = q.details?.toLowerCase().includes(query);
        const matchesCat = q.category?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDetails && !matchesCat) return false;
      }

      // Category filter
      if (categoryFilter !== "ALL" && q.category !== categoryFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== "ALL") {
        const qDate = getQuestionDateKey(q);
        if (dateFilter === "TODAY" && qDate !== todayStr) return false;
        if (dateFilter === "YESTERDAY" && qDate !== yesterdayStr) return false;
        if (dateFilter === "UPCOMING" && qDate <= todayStr) return false;
        if (dateFilter === "UNDATED" && qDate !== "UNDATED") return false;
      }

      return true;
    });
  }, [nextMeetingQuestions, searchQuery, categoryFilter, dateFilter, todayStr, yesterdayStr]);

  // Unified Grouping: Date Groups containing Category Sub-sections
  const groupedHierarchy = React.useMemo(() => {
    const dateGroups: { [dateKey: string]: { [cat: string]: any[] } } = {};

    filteredQuestions.forEach((q) => {
      const dateKey = getQuestionDateKey(q);
      const cat = q.category || "General";

      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = {};
      }
      if (!dateGroups[dateKey][cat]) {
        dateGroups[dateKey][cat] = [];
      }
      dateGroups[dateKey][cat].push(q);
    });

    const sortedDateKeys = Object.keys(dateGroups).sort((a, b) => {
      if (a === todayStr) return -1;
      if (b === todayStr) return 1;
      if (a === "UNDATED") return 1;
      if (b === "UNDATED") return -1;
      return b.localeCompare(a);
    });

    return sortedDateKeys.map((dateKey) => {
      const catObj = dateGroups[dateKey];
      const categoriesInDate = Object.keys(catObj).map((catName) => ({
        categoryName: catName,
        questions: catObj[catName],
      }));

      const totalQuestionsInDate = categoriesInDate.reduce(
        (sum, c) => sum + c.questions.length,
        0
      );

      return {
        dateKey,
        totalCount: totalQuestionsInDate,
        categories: categoriesInDate,
      };
    });
  }, [filteredQuestions, todayStr]);

  // Format Date Group Header
  const formatDateGroupHeader = (dateKey: string) => {
    if (dateKey === "UNDATED") {
      return {
        title: "Earlier / Undated Agenda Items",
        badge: "Backlog",
        badgeColor: "bg-gray-100 text-gray-700 border-gray-200",
        isToday: false,
      };
    }

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

    return {
      title: dateFormatted,
      badge: dateKey > todayStr ? "Upcoming" : "Past Date",
      badgeColor: dateKey > todayStr ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-700 border-slate-200",
      isToday: false,
    };
  };

  const handleImportTemplate = async () => {
    setIsImporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/import-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Template imported successfully!");
        setIsTemplateModalOpen(false);

        // Refresh questions list
        const refreshRes = await fetch(`/api/projects/${projectId}/questions`);
        if (refreshRes.ok) {
          const qData = await refreshRes.json();
          onQuestionsChange(qData.questions);
        }
      } else {
        toast.error("Failed to import template");
      }
    } catch (err) {
      toast.error("Failed to import template");
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddQuickQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuestionText.trim()) return;

    const catToUse =
      quickQuestionCategory === "__CUSTOM__"
        ? customCatInput.trim() || "General"
        : quickQuestionCategory;

    setIsAddingQuestion(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickQuestionText.trim(),
          category: catToUse,
          date: quickQuestionDate || todayStr,
          priority: quickPriority,
          status: "PENDING",
          forNextMeeting: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onQuestionsChange([data.question, ...questions]);
        setQuickQuestionText("");
        setCustomCatInput("");
        if (quickQuestionCategory === "__CUSTOM__") {
          setQuickQuestionCategory(catToUse);
        }
        toast.success("Question added to Meeting Agenda!");
      } else {
        toast.error("Failed to add question");
      }
    } catch (err) {
      toast.error("Failed to add question");
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const handleToggleDiscussed = async (questionId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ANSWERED" ? "PENDING" : "ANSWERED";
    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        onQuestionsChange(
          questions.map((q) =>
            q.id === questionId ? { ...q, status: newStatus } : q
          )
        );
        toast.success(
          newStatus === "ANSWERED"
            ? "Question marked as Discussed/Answered!"
            : "Question marked as Pending"
        );
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleReorderQuestions = async (
    draggedId: string,
    targetId: string | null,
    targetCategory: string
  ) => {
    const list = [...nextMeetingQuestions];
    const draggedIndex = list.findIndex((q) => q.id === draggedId);
    if (draggedIndex === -1) return;

    const [draggedItem] = list.splice(draggedIndex, 1);
    draggedItem.category = targetCategory;

    if (targetId) {
      const targetIndex = list.findIndex((q) => q.id === targetId);
      if (targetIndex !== -1) {
        list.splice(targetIndex, 0, draggedItem);
      } else {
        list.push(draggedItem);
      }
    } else {
      list.push(draggedItem);
    }

    const updatedQuestions = list.map((q, idx) => ({
      ...q,
      orderIndex: idx,
    }));

    onQuestionsChange(
      questions.map((q) => {
        const found = updatedQuestions.find((item) => item.id === q.id);
        return found || q;
      })
    );

    setIsSavingOrder(true);
    try {
      await fetch(`/api/projects/${projectId}/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reorderedQuestions: updatedQuestions.map((q) => ({
            id: q.id,
            orderIndex: q.orderIndex,
            category: q.category,
          })),
        }),
      });
    } catch (err) {
      toast.error("Failed to save new order");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleMoveQuestion = (
    questionId: string,
    direction: "up" | "down",
    category: string
  ) => {
    const catQuestions = nextMeetingQuestions.filter((q) => q.category === category);
    const currentIndex = catQuestions.findIndex((q) => q.id === questionId);
    if (currentIndex === -1) return;

    if (direction === "up" && currentIndex > 0) {
      const targetQuestion = catQuestions[currentIndex - 1];
      handleReorderQuestions(questionId, targetQuestion.id, category);
    } else if (direction === "down" && currentIndex < catQuestions.length - 1) {
      const targetQuestion = catQuestions[currentIndex + 1];
      const afterTarget = catQuestions[currentIndex + 2];
      handleReorderQuestions(
        questionId,
        afterTarget ? afterTarget.id : null,
        category
      );
    }
  };

  const handleRemoveFromAgenda = async (questionId: string) => {
    onQuestionsChange(
      questions.map((q) =>
        q.id === questionId ? { ...q, forNextMeeting: false } : q
      )
    );

    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forNextMeeting: false }),
      });

      if (res.ok) {
        const data = await res.json();
        onQuestionsChange(
          questions.map((q) => (q.id === questionId ? data.question : q))
        );
        toast.success("Question removed from meeting agenda");
      } else {
        onQuestionsChange(
          questions.map((q) =>
            q.id === questionId ? { ...q, forNextMeeting: true } : q
          )
        );
        toast.error("Failed to remove question from agenda");
      }
    } catch (err) {
      onQuestionsChange(
        questions.map((q) =>
          q.id === questionId ? { ...q, forNextMeeting: true } : q
        )
      );
      toast.error("Failed to remove question from agenda");
    }
  };

  const handleClearEntireAgenda = async () => {
    if (nextMeetingQuestions.length === 0) return;
    if (!confirm(`Are you sure you want to remove all ${nextMeetingQuestions.length} questions from the meeting agenda?`)) return;

    try {
      const promises = nextMeetingQuestions.map((q) =>
        fetch(`/api/projects/${projectId}/questions/${q.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forNextMeeting: false }),
        })
      );
      await Promise.all(promises);

      onQuestionsChange(
        questions.map((q) => ({ ...q, forNextMeeting: false }))
      );
      toast.success("Cleared all questions from meeting agenda!");
    } catch (err) {
      toast.error("Failed to clear agenda");
    }
  };

  const handleStatusChange = async (questionId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        onQuestionsChange(
          questions.map((q) =>
            q.id === questionId ? { ...q, status: newStatus } : q
          )
        );
        toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleOpenEditModal = (q: any) => {
    setEditingQuestion(q);
    setEditTitle(q.title || "");
    setEditDetails(q.details || "");
    setEditCategory(q.category || "General");
    setEditDate(getQuestionDateKey(q) === "UNDATED" ? todayStr : getQuestionDateKey(q));
    setEditCustomCatInput("");
    setEditPriority(q.priority || "MEDIUM");
    setEditStatus(q.status || "PENDING");
    setEditForNextMeeting(Boolean(q.forNextMeeting));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion || !editTitle.trim()) return;

    const catToUse =
      editCategory === "__CUSTOM__"
        ? editCustomCatInput.trim() || "General"
        : editCategory;

    setIsSavingEdit(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/questions/${editingQuestion.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim(),
            details: editDetails.trim() || null,
            category: catToUse,
            date: editDate || todayStr,
            priority: editPriority,
            status: editStatus,
            forNextMeeting: editForNextMeeting,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        onQuestionsChange(
          questions.map((q) => (q.id === editingQuestion.id ? data.question : q))
        );
        toast.success("Question updated successfully!");
        setEditingQuestion(null);
      } else {
        toast.error("Failed to update question");
      }
    } catch (err) {
      toast.error("Failed to update question");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    setDeletingQuestionIds((prev) => ({ ...prev, [questionId]: true }));
    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${questionId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onQuestionsChange(questions.filter((q) => q.id !== questionId));
        toast.success("Question deleted successfully");
      } else {
        toast.error("Failed to delete question");
      }
    } catch (err) {
      toast.error("Failed to delete question");
    } finally {
      setDeletingQuestionIds((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleCopyAgendaMarkdown = () => {
    let md = `# Next Meeting – Client Questions Agenda\n\n`;
    md += `**Project:** ${projectName}\n`;
    if (clientName) md += `**Client:** ${clientName}\n`;
    md += `**Generated on:** ${new Date().toLocaleDateString()}\n\n`;
    md += `---\n\n`;

    groupedHierarchy.forEach(({ dateKey, categories }) => {
      const header = formatDateGroupHeader(dateKey);
      md += `## 📅 ${header.title}\n\n`;
      categories.forEach(({ categoryName, questions: catQs }) => {
        md += `### 🏷️ ${categoryName}\n\n`;
        catQs.forEach((q) => {
          md += `- **[${q.status.replace("_", " ")}]** ${q.title} (Priority: ${q.priority})\n`;
          if (q.details) md += `  - *Context:* ${q.details}\n`;
          if (q.answers && q.answers.length > 0) {
            q.answers.forEach((a: any) => {
              md += `  - *Answer (${a.author || "Client"}):* ${a.content}\n`;
            });
          }
        });
        md += `\n`;
      });
      md += `---\n\n`;
    });

    navigator.clipboard.writeText(md);
    toast.success("Meeting agenda copied to clipboard in Markdown format!");
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="bg-[#EFF6FF] border-2 border-[#3B82F6] rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#3B82F6] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
              Meeting Preparation
            </h2>
            <p className="text-xs font-medium text-gray-600">
              Prepare topics and questions categorized and grouped date-wise for your client meetings.
            </p>
          </div>
        </div>

        {/* Short & Organized Action Buttons */}
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:items-center gap-1.5 shrink-0 w-full lg:w-auto">
          {/* Gemini AI Auto Generate */}
          <Button
            variant="amber"
            size="sm"
            onClick={async () => {
              toast.info("Generating meeting questions...");
              try {
                const res = await fetch("/api/ai", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "generate_questions",
                    text: `Project: ${projectName}`,
                    context: "Focus on upcoming client meeting agenda and technical decisions",
                  }),
                });
                const data = await res.json();
                if (res.ok && Array.isArray(data.result)) {
                  const saveRes = await fetch(`/api/projects/${projectId}/questions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      questions: data.result.map((q: any) => ({
                        ...q,
                        forNextMeeting: true,
                        date: todayStr,
                      })),
                    }),
                  });
                  if (saveRes.ok) {
                    const saveJson = await saveRes.json();
                    onQuestionsChange([...saveJson.questions, ...questions]);
                    toast.success(`Generated ${data.result.length} questions!`);
                  }
                }
              } catch (err) {
                toast.error("Failed to generate questions");
              }
            }}
            className="gap-1.5 text-xs h-8.5 sm:h-8 px-2.5 justify-center w-full sm:w-auto"
            title="Generate meeting questions with AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-900" />
            <span>AI Questions</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTemplateModalOpen(true)}
            className="gap-1.5 text-xs h-8.5 sm:h-8 px-2.5 bg-white justify-center w-full sm:w-auto"
            title="Load standard templates"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Templates</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPickModalOpen(true)}
            className="gap-1.5 text-xs h-8.5 sm:h-8 px-2.5 bg-white text-blue-700 hover:bg-blue-50 border-blue-200 justify-center w-full sm:w-auto"
            title="Select questions from project Q&A"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>From Q&A</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyAgendaMarkdown}
            className="gap-1.5 text-xs h-8.5 sm:h-8 px-2.5 justify-center w-full sm:w-auto"
            title="Copy agenda to clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy</span>
          </Button>

          {nextMeetingQuestions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearEntireAgenda}
              className="gap-1.5 text-xs h-8.5 sm:h-8 px-2.5 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 border-rose-200 justify-center w-full sm:w-auto"
              title="Clear all questions"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </Button>
          )}

          <Button
            variant="emerald"
            size="sm"
            onClick={() =>
              onScheduleMeetingWithQuestions(nextMeetingQuestions.map((q) => q.id))
            }
            className="gap-1.5 text-xs h-8.5 sm:h-8 px-2.5 justify-center w-full sm:w-auto col-span-2 xs:col-span-1"
            title="Schedule meeting with these questions"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Quick Add Question Bar with Default Today's Date & Editable Date Selector */}
      {/* ========================================================================= */}
      <form
        onSubmit={handleAddQuickQuestion}
        className="bg-white p-3 sm:p-4 rounded-xl border-2 border-gray-200 shadow-sm flex flex-col md:flex-row gap-2.5 items-stretch md:items-center"
      >
        {/* Main Auto-Growing Textarea with Voice Dictation & AI Magic */}
        <div className="relative flex-1 w-full flex items-start">
          <textarea
            ref={quickQuestionTextareaRef}
            id="meeting-quick-question-input"
            rows={1}
            placeholder="Speak or type meeting question (e.g. Sandbox credentials kaun send karega)..."
            value={quickQuestionText}
            onChange={(e) => setQuickQuestionText(e.target.value)}
            disabled={isAddingQuestion}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddQuickQuestion(e);
              }
            }}
            className="w-full min-h-[44px] max-h-36 py-2.5 pl-4 pr-36 rounded-xl bg-[#F3F4F6] text-sm font-medium text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition disabled:opacity-50 resize-none leading-relaxed"
          />
          <div className="absolute right-2 top-1.5 flex items-center gap-1">
            <VoiceMicButton
              onInterimTranscript={(interim) => {
                setQuickQuestionText(interim);
              }}
              onTranscript={(transcript) => {
                setQuickQuestionText(transcript);
              }}
              variant="ghost"
              size="sm"
            />
            <AIMagicButton
              getText={() => quickQuestionText}
              onResult={(res) => setQuickQuestionText(res)}
              context="Client Meeting Agenda Question"
              variant="ghost"
              size="sm"
              allowedActions={["hinglish_to_english", "professional", "make_short", "grammar", "english_to_simple"]}
            />
          </div>
        </div>

        {/* Category Selector */}
        <div className="flex items-center gap-2">
          <select
            value={quickQuestionCategory}
            onChange={(e) => setQuickQuestionCategory(e.target.value)}
            disabled={isAddingQuestion}
            className="h-11 px-3 rounded-xl bg-[#F3F4F6] text-xs font-bold text-gray-800 outline-none border-2 border-transparent focus:bg-white focus:border-[#3B82F6] truncate cursor-pointer"
          >
            {allCategoryNames.map((c) => (
              <option key={c} value={c}>
                🏷️ {c}
              </option>
            ))}
            <option value="__CUSTOM__">+ Add Custom Category...</option>
          </select>

          {quickQuestionCategory === "__CUSTOM__" && (
            <input
              type="text"
              placeholder="Category name..."
              value={customCatInput}
              onChange={(e) => setCustomCatInput(e.target.value)}
              className="h-11 px-3 rounded-xl bg-white border-2 border-blue-500 text-xs font-bold text-gray-900 outline-none w-36"
              autoFocus
            />
          )}
        </div>

        {/* Priority Selector */}
        <select
          value={quickPriority}
          onChange={(e) => setQuickPriority(e.target.value as any)}
          disabled={isAddingQuestion}
          className="h-11 px-3 rounded-xl bg-[#F3F4F6] text-xs font-bold text-gray-700 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] cursor-pointer"
        >
          <option value="URGENT">🔥 Urgent</option>
          <option value="HIGH">🔴 High</option>
          <option value="MEDIUM">🟡 Medium</option>
          <option value="LOW">🟢 Low</option>
        </select>

        {/* Date Selector (Default: Today's Date, Changeable Anytime) */}
        <div
          className="flex items-center gap-1.5 bg-[#F3F4F6] px-3 h-11 rounded-xl border-2 border-transparent focus-within:bg-white focus-within:border-[#3B82F6] shrink-0"
          title="Meeting/Agenda Date (Defaults to Today)"
        >
          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <input
            type="date"
            value={quickQuestionDate}
            onChange={(e) => setQuickQuestionDate(e.target.value)}
            disabled={isAddingQuestion}
            className="bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isAddingQuestion || !quickQuestionText.trim()}
          className="h-11 px-4 rounded-xl gap-1.5 text-xs font-bold shrink-0"
        >
          {isAddingQuestion ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Adding...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Add to Agenda</span>
            </>
          )}
        </Button>
      </form>

      {/* ========================================================================= */}
      {/* Category + Date Filter Toolbar */}
      {/* ========================================================================= */}
      <div className="bg-white p-3.5 rounded-xl border-2 border-gray-200 flex flex-col gap-3 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search agenda questions or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8 pr-4 rounded-lg bg-[#F3F4F6] text-xs font-medium text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition"
            />
          </div>

          {/* Date Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Date:
            </span>
            {[
              { id: "ALL", label: "All Dates" },
              { id: "TODAY", label: "Today" },
              { id: "YESTERDAY", label: "Yesterday" },
              { id: "UPCOMING", label: "Upcoming" },
              { id: "UNDATED", label: "Backlog" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDateFilter(tab.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer",
                  dateFilter === tab.id
                    ? "bg-[#3B82F6] text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-gray-100">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Category:
          </span>
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer",
              categoryFilter === "ALL"
                ? "bg-gray-900 text-white shadow-xs"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            )}
          >
            All Categories ({nextMeetingQuestions.length})
          </button>
          {allCategoryNames.map((cat) => {
            const count = nextMeetingQuestions.filter((q) => q.category === cat).length;
            if (count === 0 && categoryFilter !== cat) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1",
                  categoryFilter === cat
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                )}
              >
                <span>{cat}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  categoryFilter === cat ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-700"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Unified Category + Date Wise Agenda View */}
      {/* ========================================================================= */}
      {nextMeetingQuestions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-300">
          <Sparkles className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900">No meeting questions prepared yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Click "Load Template" to import standard questions, or type/speak questions using the quick bar above (defaults to Today).
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsTemplateModalOpen(true)}
            className="mt-4 text-xs gap-1.5"
          >
            <Layers className="w-4 h-4" />
            <span>Load Discovery Template</span>
          </Button>
        </div>
      ) : groupedHierarchy.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200">
          <HelpCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-800">No questions match the selected filters</p>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("ALL");
              setDateFilter("ALL");
              setSearchQuery("");
            }}
            className="text-xs font-bold text-blue-600 hover:underline mt-2 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedHierarchy.map(({ dateKey, totalCount, categories: dateCategories }) => {
            const header = formatDateGroupHeader(dateKey);

            return (
              <div
                key={dateKey}
                className={cn(
                  "bg-white rounded-2xl border-2 transition-all duration-200 overflow-hidden shadow-sm",
                  header.isToday ? "border-[#3B82F6] ring-2 ring-blue-500/10" : "border-gray-200"
                )}
              >
                {/* Date Group Header */}
                <div className="bg-[#F8FAFC] px-5 py-3.5 border-b-2 border-gray-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "p-2 rounded-xl flex items-center justify-center font-bold text-xs",
                        header.isToday ? "bg-blue-600 text-white shadow-xs" : "bg-gray-100 text-gray-700"
                      )}
                    >
                      <Calendar className="w-4 h-4" />
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">
                        {header.title}
                      </h3>
                      <span
                        className={cn(
                          "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                          header.badgeColor
                        )}
                      >
                        {header.badge}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                    <span className="bg-white px-2.5 py-1 rounded-md border border-gray-200 text-[11px] font-bold">
                      {totalCount} Questions • {dateCategories.length} Categories
                    </span>
                  </div>
                </div>

                {/* Category Sub-Sections inside this Date */}
                <div className="p-3 sm:p-5 space-y-5 divide-y divide-gray-100">
                  {dateCategories.map(({ categoryName, questions: catQuestions }, catIdx) => (
                    <div key={categoryName} className={cn("space-y-2.5", catIdx > 0 && "pt-4")}>
                      {/* Category Header Bar */}
                      <div className="flex items-center justify-between bg-[#F3F4F6] px-3.5 py-2 rounded-lg border border-gray-200/80">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                            {categoryName}
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                          {catQuestions.length} {catQuestions.length === 1 ? "Question" : "Questions"}
                        </span>
                      </div>

                      {/* Question Items in this Date + Category */}
                      <div className="space-y-2">
                        <AnimatePresence>
                          {catQuestions.map((q, catQuestionIndex) => {
                            const isDeleting = Boolean(deletingQuestionIds[q.id]);
                            const isBeingDragged = draggedQuestionId === q.id;
                            const isDragTarget = dragOverQuestionId === q.id;
                            const isFirstInCategory = catQuestionIndex === 0;
                            const isLastInCategory = catQuestionIndex === catQuestions.length - 1;

                            return (
                              <motion.div
                                key={q.id}
                                layout="position"
                                draggable={!isDeleting}
                                onDragStart={(e: any) => {
                                  setDraggedQuestionId(q.id);
                                  if (e.dataTransfer) {
                                    e.dataTransfer.setData("text/plain", q.id);
                                    e.dataTransfer.effectAllowed = "move";
                                  }
                                }}
                                onDragOver={(e: any) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                                  if (dragOverQuestionId !== q.id) setDragOverQuestionId(q.id);
                                  if (dragOverCategory !== categoryName) setDragOverCategory(categoryName);
                                }}
                                onDragLeave={() => {
                                  if (dragOverQuestionId === q.id) setDragOverQuestionId(null);
                                }}
                                onDrop={(e: any) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (draggedQuestionId && draggedQuestionId !== q.id) {
                                    handleReorderQuestions(draggedQuestionId, q.id, categoryName);
                                  }
                                }}
                                onDragEnd={() => {
                                  setDraggedQuestionId(null);
                                  setDragOverQuestionId(null);
                                  setDragOverCategory(null);
                                }}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18, ease: "easeOut" }}
                                className={cn(
                                  "p-3 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 transition-all group select-none shadow-2xs",
                                  q.status === "ANSWERED"
                                    ? "bg-emerald-50/50 border-emerald-200"
                                    : "bg-white hover:bg-gray-50 border-gray-200",
                                  isDeleting && "opacity-50 pointer-events-none grayscale select-none ring-2 ring-red-300",
                                  isBeingDragged && "opacity-30 scale-[0.98] border-dashed border-blue-400 bg-blue-50/30",
                                  isDragTarget && "border-t-4 border-t-[#3B82F6] shadow-sm bg-blue-50/40"
                                )}
                              >
                                {/* Left Details Block */}
                                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                  {/* Drag Handle */}
                                  <div
                                    className="text-gray-300 group-hover:text-gray-600 cursor-grab active:cursor-grabbing p-1 -ml-1 mt-0.5 shrink-0 transition"
                                    title="Drag to rearrange agenda order"
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </div>

                                  <input
                                    type="checkbox"
                                    checked={q.status === "ANSWERED" || q.status === "ASKED"}
                                    onChange={() => handleToggleDiscussed(q.id, q.status)}
                                    disabled={isDeleting}
                                    title={
                                      q.status === "ANSWERED"
                                        ? "Marked Discussed (Click to mark Pending)"
                                        : "Click to mark as Discussed"
                                    }
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 mt-1 cursor-pointer shrink-0"
                                  />

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <p
                                        className={cn(
                                          "text-sm font-bold leading-snug break-words",
                                          q.status === "ANSWERED"
                                            ? "text-emerald-950 line-through opacity-80"
                                            : "text-gray-900"
                                        )}
                                      >
                                        {q.title}
                                      </p>
                                      <span
                                        className={cn(
                                          "text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0",
                                          q.priority === "URGENT"
                                            ? "bg-red-100 text-red-700"
                                            : q.priority === "HIGH"
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-blue-100 text-blue-700"
                                        )}
                                      >
                                        {q.priority}
                                      </span>
                                    </div>

                                    {q.details && (
                                      <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap break-words">
                                        {q.details}
                                      </p>
                                    )}
                                    {q.answers && q.answers.length > 0 && (
                                      <div className="mt-2 pl-3 border-l-2 border-emerald-500">
                                        <span className="text-[10px] font-extrabold uppercase text-emerald-800">
                                          Latest Decision:
                                        </span>
                                        <p className="text-xs text-emerald-900 font-medium whitespace-pre-wrap break-words">
                                          {q.answers[q.answers.length - 1].content}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right Action Controls: Reorder Up/Down, Status, Edit, Delete */}
                                <div className="shrink-0 flex items-center justify-between sm:justify-end gap-1.5 pt-2 sm:pt-0 border-t border-gray-100 sm:border-0 w-full sm:w-auto">
                                  {/* 1-Tap Reorder Buttons */}
                                  <div className="flex items-center sm:flex-col sm:-my-1 gap-1 sm:gap-0">
                                    <button
                                      type="button"
                                      disabled={isDeleting || isFirstInCategory}
                                      onClick={() => handleMoveQuestion(q.id, "up", categoryName)}
                                      title="Move up in agenda"
                                      className="p-1 sm:p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20 transition bg-gray-50 sm:bg-transparent rounded"
                                    >
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isDeleting || isLastInCategory}
                                      onClick={() => handleMoveQuestion(q.id, "down", categoryName)}
                                      title="Move down in agenda"
                                      className="p-1 sm:p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20 transition bg-gray-50 sm:bg-transparent rounded"
                                    >
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <select
                                    value={q.status}
                                    disabled={isDeleting}
                                    onChange={(e) => handleStatusChange(q.id, e.target.value)}
                                    className={cn(
                                      "h-7 px-2 rounded text-[11px] font-bold border-none outline-none cursor-pointer transition",
                                      q.status === "ANSWERED"
                                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                        : q.status === "NEED_FOLLOWUP"
                                        ? "bg-rose-100 text-rose-800 hover:bg-rose-200"
                                        : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                    )}
                                  >
                                    <option value="PENDING">Pending</option>
                                    <option value="ASKED">Asked</option>
                                    <option value="ANSWERED">Answered</option>
                                    <option value="NEED_FOLLOWUP">Need Follow-up</option>
                                  </select>

                                  <div className="flex items-center gap-0.5">
                                    {/* Edit Button */}
                                    <button
                                      type="button"
                                      disabled={isDeleting}
                                      onClick={() => handleOpenEditModal(q)}
                                      title="Edit question details & date"
                                      className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Remove from Agenda button */}
                                    <button
                                      type="button"
                                      disabled={isDeleting}
                                      onClick={() => handleRemoveFromAgenda(q.id)}
                                      title="Remove from meeting agenda (Keep question in Client Q&A)"
                                      className="p-1.5 rounded text-gray-400 hover:text-amber-700 hover:bg-amber-50 transition cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Delete Question (Soft Delete) */}
                                    <button
                                      type="button"
                                      disabled={isDeleting}
                                      onClick={() => handleDeleteQuestion(q.id)}
                                      title="Delete question permanently (Soft delete)"
                                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                    >
                                      {isDeleting ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {/* Quick Add to this Specific Category + Date */}
                        <button
                          type="button"
                          onClick={() => {
                            setQuickQuestionCategory(categoryName);
                            setQuickQuestionDate(dateKey === "UNDATED" ? todayStr : dateKey);
                            const el = document.getElementById("meeting-quick-question-input");
                            if (el) {
                              el.focus();
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                            }
                          }}
                          className="w-full py-2 px-3 border border-dashed border-gray-300 rounded-lg text-[11px] font-bold text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-center gap-1.5 transition cursor-pointer mt-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add question to {categoryName} ({dateKey === todayStr ? "Today" : dateKey})</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* Edit Question Modal (with Category, Priority, and Editable Date) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(editingQuestion)}
        onClose={() => setEditingQuestion(null)}
        title="Edit Meeting Agenda Question"
        description="Update question details, category, date, priority, and meeting agenda status."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Question *
              </label>
              <div className="flex items-center gap-1.5">
                <VoiceMicButton
                  onInterimTranscript={(interim) => {
                    setEditTitle(interim);
                  }}
                  onTranscript={(transcript) => {
                    setEditTitle(transcript);
                  }}
                  variant="ghost"
                  size="sm"
                  label="Speak"
                />
                <AIMagicButton
                  getText={() => editTitle}
                  onResult={(res) => setEditTitle(res)}
                  context="Meeting agenda question"
                  variant="ghost"
                  size="sm"
                  allowedActions={["hinglish_to_english", "professional", "make_short", "grammar", "english_to_simple"]}
                />
              </div>
            </div>
            <Input
              placeholder="e.g., Payment gateway kaunsa use karna hai?"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Additional Details / Context
              </label>
              <div className="flex items-center gap-1.5">
                <VoiceMicButton
                  onInterimTranscript={(interim) => {
                    setEditDetails(interim);
                  }}
                  onTranscript={(transcript) => {
                    setEditDetails(transcript);
                  }}
                  variant="ghost"
                  size="sm"
                  label="Dictate"
                />
                <AIMagicButton
                  getText={() => editDetails}
                  onResult={(res) => setEditDetails(res)}
                  context={`Question context for: ${editTitle}`}
                  variant="ghost"
                  size="sm"
                />
              </div>
            </div>
            <Textarea
              placeholder="Context or decision notes..."
              value={editDetails}
              onChange={(e) => setEditDetails(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Category
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full h-11 px-3 rounded-md bg-[#F3F4F6] text-sm font-semibold text-gray-800 outline-none border-2 border-transparent focus:bg-white focus:border-[#3B82F6]"
              >
                {allCategoryNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__CUSTOM__">+ Add Custom Category...</option>
              </select>
              {editCategory === "__CUSTOM__" && (
                <input
                  type="text"
                  placeholder="Enter custom category name..."
                  value={editCustomCatInput}
                  onChange={(e) => setEditCustomCatInput(e.target.value)}
                  className="w-full h-10 px-3 mt-2 rounded-md bg-white border-2 border-blue-400 text-sm font-semibold text-gray-900 outline-none"
                  autoFocus
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Agenda Date
              </label>
              <div className="flex items-center gap-1.5 bg-[#F3F4F6] px-3 h-11 rounded-md border-2 border-transparent focus-within:bg-white focus-within:border-[#3B82F6]">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-gray-800 outline-none w-full cursor-pointer"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Priority
              </label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                className="w-full h-11 px-3 rounded-md bg-[#F3F4F6] text-sm font-semibold text-gray-800 outline-none border-2 border-transparent focus:bg-white focus:border-[#3B82F6]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full h-11 px-3 rounded-md bg-[#F3F4F6] text-sm font-semibold text-gray-800 outline-none border-2 border-transparent focus:bg-white focus:border-[#3B82F6]"
              >
                <option value="PENDING">Pending</option>
                <option value="ASKED">Asked</option>
                <option value="ANSWERED">Answered</option>
                <option value="NEED_FOLLOWUP">Need Follow-up</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="edit-for-next-meeting"
              checked={editForNextMeeting}
              onChange={(e) => setEditForNextMeeting(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600"
            />
            <label
              htmlFor="edit-for-next-meeting"
              className="text-xs font-bold text-gray-800 cursor-pointer"
            >
              Include in Next Meeting Agenda
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingQuestion(null)}
              disabled={isSavingEdit}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSavingEdit}>
              {isSavingEdit ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Discovery Template Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Load Standard Question Pack"
        description="Instantly populate your meeting agenda with industry-standard discovery questions."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {SYSTEM_TEMPLATES.map((tmpl) => (
              <label
                key={tmpl.id}
                onClick={() => setSelectedTemplateId(tmpl.id)}
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition",
                  selectedTemplateId === tmpl.id
                    ? "border-[#3B82F6] bg-blue-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <input
                  type="radio"
                  name="template_select"
                  checked={selectedTemplateId === tmpl.id}
                  onChange={() => setSelectedTemplateId(tmpl.id)}
                  className="mt-1 text-blue-600"
                />
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{tmpl.title}</h4>
                  <p className="text-xs text-gray-600 mt-0.5">{tmpl.description}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => setIsTemplateModalOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleImportTemplate}
              disabled={isImporting}
              className="gap-1.5"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Import Pack</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pick from Q&A Modal */}
      <Modal
        isOpen={isPickModalOpen}
        onClose={() => setIsPickModalOpen(false)}
        title="Add Questions from Project Q&A"
        description="Select existing questions to include in the next meeting agenda."
        maxWidth="lg"
      >
        <div className="space-y-4">
          {questions.filter((q) => q.status !== "DELETED").length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">
              No questions found in this project.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-gray-100">
              {questions
                .filter((q) => q.status !== "DELETED")
                .map((q) => {
                  const isInAgenda = Boolean(q.forNextMeeting);
                  return (
                    <div
                      key={q.id}
                      className="pt-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 truncate">
                            {q.title}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-gray-100 rounded text-gray-600">
                            {q.category}
                          </span>
                        </div>
                        {q.details && (
                          <p className="text-gray-500 truncate mt-0.5">{q.details}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={isInAgenda ? "secondary" : "outline"}
                        className="text-[11px] h-7 px-2 shrink-0"
                        onClick={async () => {
                          const newSetting = !isInAgenda;
                          onQuestionsChange(
                            questions.map((item) =>
                              item.id === q.id
                                ? { ...item, forNextMeeting: newSetting }
                                : item
                            )
                          );
                          try {
                            await fetch(`/api/projects/${projectId}/questions/${q.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ forNextMeeting: newSetting }),
                            });
                            toast.success(
                              newSetting ? "Added to Agenda" : "Removed from Agenda"
                            );
                          } catch (err) {
                            toast.error("Failed to update");
                          }
                        }}
                      >
                        {isInAgenda ? "In Agenda ✓" : "+ Add to Agenda"}
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <Button variant="primary" onClick={() => setIsPickModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
