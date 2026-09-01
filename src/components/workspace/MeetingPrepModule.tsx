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
  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
  const [isPickModalOpen, setIsPickModalOpen] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(SYSTEM_TEMPLATES[0].id);
  const [isImporting, setIsImporting] = React.useState(false);
  const [quickQuestionText, setQuickQuestionText] = React.useState("");
  const [quickQuestionCategory, setQuickQuestionCategory] = React.useState("User Management");
  const [customCatInput, setCustomCatInput] = React.useState("");
  const [isAddingQuestion, setIsAddingQuestion] = React.useState(false);
  const [deletingQuestionIds, setDeletingQuestionIds] = React.useState<{ [key: string]: boolean }>({});

  // Edit question modal state
  const [editingQuestion, setEditingQuestion] = React.useState<any | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDetails, setEditDetails] = React.useState("");
  const [editCategory, setEditCategory] = React.useState("User Management");
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

  // Questions in meeting prep (excluding soft-deleted)
  const nextMeetingQuestions = questions.filter(
    (q) => q.status !== "DELETED"
  );

  // Group questions by category
  const categoriesList = Array.from(new Set(nextMeetingQuestions.map((q) => q.category)));

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
          status: "PENDING",
          priority: "HIGH",
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
        toast.success("Question added to meeting agenda!");
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
    const nextStatus =
      currentStatus === "ANSWERED" || currentStatus === "ASKED" ? "PENDING" : "ANSWERED";

    // Instant optimistic update (does not remove from screen)
    onQuestionsChange(
      questions.map((q) => (q.id === questionId ? { ...q, status: nextStatus } : q))
    );

    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        toast.success(nextStatus === "ANSWERED" ? "Marked Discussed" : "Marked Pending");
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleToggleNextMeetingFlag = async (questionId: string, currentVal: boolean) => {
    // Instant optimistic update
    onQuestionsChange(
      questions.map((q) =>
        q.id === questionId ? { ...q, forNextMeeting: !currentVal } : q
      )
    );

    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forNextMeeting: !currentVal }),
      });

      if (res.ok) {
        const data = await res.json();
        onQuestionsChange(
          questions.map((q) => (q.id === questionId ? data.question : q))
        );
        toast.success(
          !currentVal
            ? "Added to Meeting Agenda"
            : "Removed from Meeting Agenda"
        );
      }
    } catch (err) {
      toast.error("Failed to update agenda flag");
    }
  };

  const handleRemoveFromAgenda = async (questionId: string) => {
    // Instant optimistic update
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
        onQuestionsChange(
          questions.map((q) =>
            q.id === questionId ? { ...q, status: "DELETED", forNextMeeting: false } : q
          ).filter((q) => q.status !== "DELETED")
        );
        toast.success("Question deleted successfully");
      } else {
        toast.error("Failed to delete question");
      }
    } catch (err) {
      toast.error("Failed to delete question");
    } finally {
      setDeletingQuestionIds((prev) => {
        const copy = { ...prev };
        delete copy[questionId];
        return copy;
      });
    }
  };

  const handleCopyAgendaMarkdown = () => {
    let md = `# Next Meeting – Client Questions Agenda\n\n`;
    md += `**Project:** ${projectName}\n`;
    if (clientName) md += `**Client:** ${clientName}\n`;
    md += `**Generated on:** ${new Date().toLocaleDateString()}\n\n`;
    md += `---\n\n`;

    categories.forEach((cat, index) => {
      const catQuestions = nextMeetingQuestions.filter((q) => q.category === cat);
      md += `### ${index + 1}. ${cat}\n\n`;
      catQuestions.forEach((q) => {
        md += `- **[${q.status.replace("_", " ")}]** ${q.title}\n`;
        if (q.details) md += `  - *Context:* ${q.details}\n`;
        if (q.answers && q.answers.length > 0) {
          q.answers.forEach((a: any) => {
            md += `  - *Answer (${a.author || "Client"}):* ${a.content}\n`;
          });
        }
      });
      md += `\n`;
    });

    navigator.clipboard.writeText(md);
    toast.success("Meeting agenda copied to clipboard in Markdown format!");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-[#EFF6FF] border-2 border-[#3B82F6] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#3B82F6] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
              Meeting Preparation
            </h2>
            <p className="text-xs font-medium text-gray-600">
              Prepare topics and questions for your upcoming client meeting.
            </p>
          </div>
        </div>

        {/* Short & Organized Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
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
                      questions: data.result.map((q: any) => ({ ...q, forNextMeeting: true })),
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
            className="gap-1.5 text-xs h-8 px-2.5"
            title="Generate meeting questions with AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-900" />
            <span>AI Questions</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTemplateModalOpen(true)}
            className="gap-1.5 text-xs h-8 px-2.5 bg-white"
            title="Load standard templates"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Templates</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPickModalOpen(true)}
            className="gap-1.5 text-xs h-8 px-2.5 bg-white text-blue-700 hover:bg-blue-50 border-blue-200"
            title="Select questions from project Q&A"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add from Q&A</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyAgendaMarkdown}
            className="gap-1.5 text-xs h-8 px-2.5"
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
              className="gap-1.5 text-xs h-8 px-2.5 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 border-rose-200"
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
            className="gap-1.5 text-xs h-8 px-2.5"
            title="Schedule meeting with these questions"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule</span>
          </Button>
        </div>
      </div>

      {/* Quick Add Question Bar */}
      <form
        onSubmit={handleAddQuickQuestion}
        className="bg-white p-4 rounded-lg border-2 border-gray-200 flex flex-col sm:flex-row gap-3 items-center"
      >
        <div className="relative flex-1 w-full flex items-center">
          <input
            id="meeting-quick-question-input"
            type="text"
            placeholder="Speak or type next meeting question (e.g. Kaunsa payment gateway sandbox use karna hai)..."
            value={quickQuestionText}
            onChange={(e) => setQuickQuestionText(e.target.value)}
            disabled={isAddingQuestion}
            className="w-full h-11 pl-4 pr-44 rounded-md bg-[#F3F4F6] text-xs font-semibold text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition disabled:opacity-50"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <VoiceMicButton
              onTranscript={(transcript) => {
                setQuickQuestionText((prev) => (prev ? `${prev} ${transcript}` : transcript));
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <select
            value={quickQuestionCategory}
            onChange={(e) => setQuickQuestionCategory(e.target.value)}
            disabled={isAddingQuestion}
            className="h-11 px-3 rounded-md bg-[#F3F4F6] text-xs font-bold text-gray-800 outline-none w-full sm:w-auto border-2 border-transparent focus:bg-white focus:border-[#3B82F6]"
          >
            {allCategoryNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__CUSTOM__">+ Add Custom Category...</option>
          </select>

          {quickQuestionCategory === "__CUSTOM__" && (
            <input
              type="text"
              placeholder="Type category..."
              value={customCatInput}
              onChange={(e) => setCustomCatInput(e.target.value)}
              className="h-11 px-3 rounded-md bg-white border-2 border-blue-500 text-xs font-bold text-gray-900 outline-none w-full sm:w-40"
              autoFocus
            />
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isAddingQuestion || !quickQuestionText.trim()}
          className="w-full sm:w-auto gap-1.5 text-xs shrink-0"
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

      {/* Structured Categorized Questions for Meeting */}
      {nextMeetingQuestions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-lg border-2 border-dashed border-gray-300">
          <Sparkles className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900">No meeting questions prepared yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Click "Load Template" to instantly import a complete requirement discovery pack, or type questions using the quick bar above.
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
      ) : (
        <div className="space-y-6">
          {categoriesList.map((category, idx) => {
            const categoryQuestions = nextMeetingQuestions.filter(
              (q) => q.category === category
            );
            return (
              <div
                key={category}
                className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden"
              >
                {/* Category Header */}
                <div className="bg-[#F3F4F6] px-5 py-3 border-b-2 border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-gray-900 text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-900">
                      {category}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-gray-500">
                    {categoryQuestions.length} Questions
                  </span>
                </div>

                {/* Question Items in this category */}
                <div className="divide-y-2 divide-gray-100 p-2 sm:p-4 space-y-2">
                  <AnimatePresence>
                    {categoryQuestions.map((q) => {
                      const isDeleting = Boolean(deletingQuestionIds[q.id]);
                      return (
                        <motion.div
                          key={q.id}
                          layout="position"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className={cn(
                            "p-3 rounded-md border flex items-start justify-between gap-3 transition-colors group",
                            q.status === "ANSWERED"
                              ? "bg-emerald-50/50 border-emerald-200"
                              : "bg-white hover:bg-gray-50 border-gray-200",
                            isDeleting && "opacity-50 pointer-events-none grayscale select-none ring-2 ring-red-300"
                          )}
                        >
                          <div className="flex items-start gap-3 flex-1">
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

                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p
                                  className={cn(
                                    "text-sm font-bold leading-snug",
                                    q.status === "ANSWERED"
                                      ? "text-emerald-950 line-through opacity-80"
                                      : "text-gray-900"
                                  )}
                                >
                                  {q.title}
                                </p>
                                <span
                                  className={cn(
                                    "text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded",
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
                                <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">
                                  {q.details}
                                </p>
                              )}
                              {q.answers && q.answers.length > 0 && (
                                <div className="mt-2 pl-3 border-l-2 border-emerald-500">
                                  <span className="text-[10px] font-extrabold uppercase text-emerald-800">
                                    Latest Decision:
                                  </span>
                                  <p className="text-xs text-emerald-900 font-medium whitespace-pre-wrap">
                                    {q.answers[q.answers.length - 1].content}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Action Controls: Status, Edit, Delete */}
                          <div className="shrink-0 flex items-center gap-1.5 self-start">
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

                            {/* Edit Button */}
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleOpenEditModal(q)}
                              title="Edit question details"
                              className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Remove from Agenda button */}
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleRemoveFromAgenda(q.id)}
                              title="Remove from meeting agenda (Keep question in Client Q&A)"
                              className="p-1.5 rounded text-gray-400 hover:text-amber-700 hover:bg-amber-50 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Question (Soft Delete) */}
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeleteQuestion(q.id)}
                              title="Delete question permanently (Soft delete)"
                              className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Quick Add to this Category */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickQuestionCategory(category);
                        const el = document.getElementById("meeting-quick-question-input");
                        if (el) {
                          el.focus();
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }}
                      className="w-full py-2.5 px-3 border-2 border-dashed border-gray-300 rounded-lg text-xs font-bold text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add question to {category}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Question Modal */}
      <Modal
        isOpen={Boolean(editingQuestion)}
        onClose={() => setEditingQuestion(null)}
        title="Edit Meeting Agenda Question"
        description="Update question details, category, priority, and meeting agenda status."
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
                  onTranscript={(transcript) => {
                    setEditTitle((prev) => (prev ? `${prev} ${transcript}` : transcript));
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
                  onTranscript={(transcript) => {
                    setEditDetails((prev) => (prev ? `${prev} ${transcript}` : transcript));
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Category
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full h-11 px-3 rounded-md bg-[#F3F4F6] text-xs font-bold text-gray-800 outline-none border-2 border-transparent focus:bg-white focus:border-[#3B82F6]"
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
                  className="w-full h-10 px-3 mt-2 rounded-md bg-white border-2 border-blue-400 text-xs font-bold text-gray-900 outline-none"
                  autoFocus
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Priority
              </label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                className="w-full h-11 px-3 rounded-md bg-[#F3F4F6] text-xs font-bold text-gray-800 outline-none border-2 border-transparent focus:bg-white focus:border-[#3B82F6]"
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
                className="w-full h-11 px-3 rounded-md bg-[#F3F4F6] text-xs font-bold text-gray-800 outline-none border-2 border-transparent focus:bg-white focus:border-[#3B82F6]"
              >
                <option value="PENDING">Pending</option>
                <option value="ASKED">Asked</option>
                <option value="ANSWERED">Answered</option>
                <option value="NEED_FOLLOWUP">Need Follow-up</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-md bg-[#EFF6FF] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={editForNextMeeting}
              onChange={(e) => setEditForNextMeeting(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-xs font-bold text-gray-900 block">
                Include in Next Meeting Agenda
              </span>
              <span className="text-[11px] text-gray-500">
                Flag this question to discuss in the upcoming client meeting.
              </span>
            </div>
          </label>

          <div className="flex items-center justify-between pt-4 border-t-2 border-gray-100">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                if (!editingQuestion) return;
                const qId = editingQuestion.id;
                setEditingQuestion(null);
                handleDeleteQuestion(qId);
              }}
              className="gap-1.5 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Question</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setEditingQuestion(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSavingEdit || !editTitle.trim()}
                className="gap-2"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Template Importer Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Load Question Template"
        description="Select a pre-built requirement template to instantly import standard questions into this project."
        maxWidth="xl"
      >
        <div className="space-y-4">
          <div className="space-y-3">
            {SYSTEM_TEMPLATES.map((tpl) => {
              const isSelected = selectedTemplateId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={cn(
                    "p-4 rounded-lg cursor-pointer border-2 transition-all duration-200",
                    isSelected
                      ? "border-[#3B82F6] bg-[#EFF6FF]"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-gray-200 text-gray-800">
                        {tpl.category}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900">{tpl.title}</h4>
                    </div>
                    <span className="text-xs font-bold text-[#3B82F6]">
                      {tpl.questions.length} Questions
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5">{tpl.description}</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsTemplateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={isImporting}
              onClick={handleImportTemplate}
              className="gap-2"
            >
              <Layers className="w-4 h-4" />
              <span>{isImporting ? "Importing..." : "Import Template Questions"}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pick Existing Questions into Agenda Modal */}
      <Modal
        isOpen={isPickModalOpen}
        onClose={() => setIsPickModalOpen(false)}
        title="Manage Agenda Questions"
        description="Select which questions from this project should be discussed in the upcoming meeting."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
            {questions.filter((q) => q.status !== "DELETED").length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs font-medium">
                No questions exist in this project yet. Add questions via the quick bar or Client Q&A tab.
              </div>
            ) : (
              questions
                .filter((q) => q.status !== "DELETED")
                .map((q) => {
                  const isInAgenda = Boolean(q.forNextMeeting);
                  return (
                    <div
                      key={q.id}
                      className={cn(
                        "p-3 rounded-lg border-2 flex items-start justify-between gap-3 transition",
                        isInAgenda
                          ? "bg-emerald-50 border-emerald-300"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isInAgenda}
                          onChange={() => handleToggleNextMeetingFlag(q.id, isInAgenda)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                              {q.category}
                            </span>
                            <span className="text-[10px] font-bold uppercase text-gray-500">
                              [{q.status.replace("_", " ")}]
                            </span>
                          </div>
                          <p className="text-xs font-bold text-gray-900 mt-0.5 leading-snug">
                            {q.title}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant={isInAgenda ? "danger" : "outline"}
                        size="sm"
                        onClick={() => handleToggleNextMeetingFlag(q.id, isInAgenda)}
                        className="text-[11px] h-7 px-2 shrink-0 gap-1"
                      >
                        {isInAgenda ? (
                          <>
                            <X className="w-3 h-3" />
                            <span>Remove</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t-2 border-gray-100">
            <span className="text-xs font-bold text-gray-600">
              {nextMeetingQuestions.length} questions currently on agenda
            </span>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsPickModalOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
