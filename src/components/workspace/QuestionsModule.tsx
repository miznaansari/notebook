"use client";

import * as React from "react";
import {
  HelpCircle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit2,
  Calendar,
  Send,
  User,
  Check,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { AIMagicButton } from "@/components/ui/ai-magic-button";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export interface AnswerItem {
  id: string;
  content: string;
  author?: string | null;
  createdAt: string;
}

export interface QuestionItem {
  id: string;
  title: string;
  details?: string | null;
  category: string;
  status: "PENDING" | "ASKED" | "ANSWERED" | "NEED_FOLLOWUP";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  forNextMeeting: boolean;
  orderIndex: number;
  answers: AnswerItem[];
  createdAt: string;
  updatedAt: string;
}

interface QuestionsModuleProps {
  projectId: string;
  questions: QuestionItem[];
  onQuestionsChange: (updated: QuestionItem[]) => void;
}

export function QuestionsModule({
  projectId,
  questions,
  onQuestionsChange,
}: QuestionsModuleProps) {
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = React.useState<string | null>(null);

  // New question form state
  const [newTitle, setNewTitle] = React.useState("");
  const [newDetails, setNewDetails] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("User Management");
  const [customCategory, setCustomCategory] = React.useState("");
  const [newPriority, setNewPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [newForNextMeeting, setNewForNextMeeting] = React.useState(false);
  const [newInitialAnswer, setNewInitialAnswer] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Inline answer state
  const [newAnswerText, setNewAnswerText] = React.useState<{ [key: string]: string }>({});
  const [newAnswerAuthor, setNewAnswerAuthor] = React.useState<{ [key: string]: string }>({});
  const [isAddingAnswer, setIsAddingAnswer] = React.useState<{ [key: string]: boolean }>({});

  // Unique categories list
  const existingCategories = Array.from(
    new Set(["General", "User Management", "Payment", "Reports", "Technical", "Architecture", ...questions.map((q) => q.category)])
  );

  // Counts
  const pendingCount = questions.filter((q) => q.status === "PENDING").length;
  const askedCount = questions.filter((q) => q.status === "ASKED").length;
  const answeredCount = questions.filter((q) => q.status === "ANSWERED").length;
  const followUpCount = questions.filter((q) => q.status === "NEED_FOLLOWUP").length;

  const filteredQuestions = questions.filter((q) => {
    const matchesStatus = selectedStatus === "ALL" || q.status === selectedStatus;
    const matchesCategory = selectedCategory === "ALL" || q.category === selectedCategory;
    const matchesSearch =
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.details && q.details.toLowerCase().includes(searchQuery.toLowerCase())) ||
      q.answers.some((a) => a.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please enter a question");
      return;
    }

    setIsSubmitting(true);
    const categoryToUse = newCategory === "Custom" ? customCategory.trim() || "General" : newCategory;

    try {
      const res = await fetch(`/api/projects/${projectId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          details: newDetails.trim(),
          category: categoryToUse,
          priority: newPriority,
          forNextMeeting: newForNextMeeting,
          status: newInitialAnswer.trim() ? "ANSWERED" : "PENDING",
          initialAnswer: newInitialAnswer.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onQuestionsChange([data.question, ...questions]);
        toast.success("Question added successfully!");
        setIsAddModalOpen(false);
        setNewTitle("");
        setNewDetails("");
        setNewInitialAnswer("");
        setNewForNextMeeting(false);
      } else {
        toast.error("Failed to add question");
      }
    } catch (err) {
      toast.error("Failed to add question");
    } finally {
      setIsSubmitting(false);
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
            q.id === questionId ? { ...q, status: newStatus as any } : q
          )
        );
        toast.success(`Status changed to ${newStatus.replace("_", " ")}`);
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleToggleNextMeeting = async (questionId: string, currentVal: boolean) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forNextMeeting: !currentVal }),
      });

      if (res.ok) {
        onQuestionsChange(
          questions.map((q) =>
            q.id === questionId ? { ...q, forNextMeeting: !currentVal } : q
          )
        );
        toast.success(
          !currentVal
            ? "Question added to Next Meeting Agenda"
            : "Removed from Next Meeting Agenda"
        );
      }
    } catch (err) {
      toast.error("Failed to update");
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/questions/${questionId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onQuestionsChange(questions.filter((q) => q.id !== questionId));
        toast.success("Question deleted");
      }
    } catch (err) {
      toast.error("Failed to delete question");
    }
  };

  const handleAddAnswer = async (questionId: string) => {
    const text = newAnswerText[questionId];
    const author = newAnswerAuthor[questionId] || "Client";

    if (!text || !text.trim()) {
      toast.error("Please enter an answer");
      return;
    }

    setIsAddingAnswer((prev) => ({ ...prev, [questionId]: true }));

    try {
      const res = await fetch(
        `/api/projects/${projectId}/questions/${questionId}/answers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text.trim(),
            author,
            autoMarkAnswered: true,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        onQuestionsChange(
          questions.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  status: "ANSWERED",
                  answers: [...q.answers, data.answer],
                }
              : q
          )
        );
        setNewAnswerText((prev) => ({ ...prev, [questionId]: "" }));
        toast.success("Answer recorded and status marked as Answered!");
      }
    } catch (err) {
      toast.error("Failed to add answer");
    } finally {
      setIsAddingAnswer((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const handleDeleteAnswer = async (questionId: string, answerId: string) => {
    if (!confirm("Delete this answer?")) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/questions/${questionId}/answers?answerId=${answerId}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        onQuestionsChange(
          questions.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  answers: q.answers.filter((a) => a.id !== answerId),
                }
              : q
          )
        );
        toast.success("Answer removed");
      }
    } catch (err) {
      toast.error("Failed to delete answer");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ANSWERED":
        return <Badge variant="success">Answered</Badge>;
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      case "NEED_FOLLOWUP":
        return <Badge variant="danger">Need Follow-up</Badge>;
      case "ASKED":
        return <Badge variant="primary">Asked</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <span className="text-[10px] font-extrabold text-[#EF4444] bg-red-50 px-2 py-0.5 rounded">URGENT</span>;
      case "HIGH":
        return <span className="text-[10px] font-extrabold text-[#F59E0B] bg-amber-50 px-2 py-0.5 rounded">HIGH</span>;
      case "MEDIUM":
        return <span className="text-[10px] font-extrabold text-[#3B82F6] bg-blue-50 px-2 py-0.5 rounded">MED</span>;
      default:
        return <span className="text-[10px] font-extrabold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">LOW</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Filter and Actions Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-[#3B82F6]" strokeWidth={2.5} />
            <span>Client Questions & Answers</span>
          </h2>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Maintain questions to ask the client, record verified answers, and organize next meeting follow-ups.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0 self-start md:self-auto">
          {/* AI Smart Discovery Questions Generator */}
          <Button
            variant="amber"
            size="md"
            onClick={async () => {
              toast.info("Gemini AI is analyzing project and generating discovery questions...");
              try {
                const res = await fetch("/api/ai", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "generate_questions",
                    text: "Web & Software Application Requirements",
                    context: questions.map((q) => q.title).join(", "),
                  }),
                });
                const data = await res.json();
                if (res.ok && Array.isArray(data.result)) {
                  // Batch save generated questions
                  const saveRes = await fetch(`/api/projects/${projectId}/questions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ questions: data.result }),
                  });
                  if (saveRes.ok) {
                    const saveJson = await saveRes.json();
                    onQuestionsChange([...saveJson.questions, ...questions]);
                    toast.success(`Gemini AI generated ${data.result.length} new discovery questions!`);
                  }
                } else {
                  toast.error(data.error || "Could not generate questions");
                }
              } catch (err) {
                toast.error("Failed to generate AI questions");
              }
            }}
            className="gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-900" />
            <span>AI Generate Questions</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            <span>Add Client Question</span>
          </Button>
        </div>
      </div>

      {/* Status Filter Cards / Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { id: "ALL", label: "All Questions", count: questions.length, bg: "bg-white", activeBg: "bg-gray-900 text-white" },
          { id: "PENDING", label: "Pending", count: pendingCount, bg: "bg-[#FFFBEB]", activeBg: "bg-[#F59E0B] text-white" },
          { id: "ASKED", label: "Asked", count: askedCount, bg: "bg-[#EFF6FF]", activeBg: "bg-[#3B82F6] text-white" },
          { id: "ANSWERED", label: "Answered", count: answeredCount, bg: "bg-[#ECFDF5]", activeBg: "bg-[#10B981] text-white" },
          { id: "NEED_FOLLOWUP", label: "Need Follow-up", count: followUpCount, bg: "bg-[#FFF1F2]", activeBg: "bg-[#EF4444] text-white" },
        ].map((tab) => {
          const isSelected = selectedStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={cn(
                "p-3 rounded-lg text-left transition-all duration-200 cursor-pointer select-none",
                isSelected
                  ? tab.activeBg
                  : `${tab.bg} text-gray-800 hover:scale-[1.02]`
              )}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-80 truncate">
                {tab.label}
              </div>
              <div className="text-xl font-extrabold mt-0.5">{tab.count}</div>
            </button>
          );
        })}
      </div>

      {/* Search and Category Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#F3F4F6] p-3 rounded-lg">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search questions or answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md bg-white text-xs font-semibold text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:border-[#3B82F6] transition-all"
          />
        </div>

        {/* Category Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-gray-600 whitespace-nowrap">
            Category:
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 px-3 rounded-md bg-white text-xs font-bold text-gray-900 border-2 border-transparent focus:border-[#3B82F6] outline-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {existingCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {filteredQuestions.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-lg border-2 border-dashed border-gray-300">
            <HelpCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-gray-800">No questions match the filter</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Add your first question to discuss with the client or clear your active filters.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 text-xs"
            >
              Add Question
            </Button>
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const isExpanded = expandedQuestionId === q.id;
            return (
              <div
                key={q.id}
                className="bg-white rounded-lg p-5 border-2 border-gray-200 transition-all duration-200 hover:border-gray-300"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {q.category}
                      </span>
                      {getPriorityBadge(q.priority)}
                      {getStatusBadge(q.status)}
                      {q.forNextMeeting && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-[#D1FAE5] text-[#065F46] px-2 py-0.5 rounded">
                          <Sparkles className="w-3 h-3" />
                          Next Meeting Agenda
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                      {q.title}
                    </h3>

                    {q.details && (
                      <p className="text-xs text-gray-600 font-medium mt-1">
                        {q.details}
                      </p>
                    )}
                  </div>

                  {/* Actions & Status Dropdown */}
                  <div className="flex items-center gap-2 shrink-0 self-start">
                    <select
                      value={q.status}
                      onChange={(e) => handleStatusChange(q.id, e.target.value)}
                      className="h-8 px-2.5 rounded text-xs font-bold bg-[#F3F4F6] text-gray-900 border-none outline-none cursor-pointer hover:bg-gray-200 transition"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="ASKED">Asked</option>
                      <option value="ANSWERED">Answered</option>
                      <option value="NEED_FOLLOWUP">Need Follow-up</option>
                    </select>

                    <button
                      onClick={() => handleToggleNextMeeting(q.id, q.forNextMeeting)}
                      title={q.forNextMeeting ? "Remove from next meeting" : "Add to next meeting"}
                      className={cn(
                        "p-1.5 rounded transition-transform duration-200 hover:scale-110",
                        q.forNextMeeting
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-500 hover:text-gray-900"
                      )}
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      title="Delete question"
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-transform duration-200 hover:scale-110"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Answers Section */}
                <div className="mt-4 pt-3 border-t-2 border-gray-100">
                  {q.answers.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {q.answers.map((ans) => (
                        <div
                          key={ans.id}
                          className="bg-[#EFF6FF] p-3 rounded-md flex items-start justify-between gap-3 group"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded bg-[#3B82F6] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              {ans.author ? ans.author.charAt(0).toUpperCase() : "C"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-900">
                                  {ans.author || "Client Answer"}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  {formatDate(ans.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-800 font-medium mt-0.5 whitespace-pre-wrap">
                                {ans.content}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteAnswer(q.id, ans.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1 transition"
                            title="Delete answer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Answer Expandable Form */}
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <input
                      type="text"
                      placeholder="Type client answer or meeting decision here..."
                      value={newAnswerText[q.id] || ""}
                      onChange={(e) =>
                        setNewAnswerText((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddAnswer(q.id);
                      }}
                      className="flex-1 h-9 px-3 rounded-md bg-[#F3F4F6] text-xs font-medium text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition"
                    />

                    <select
                      value={newAnswerAuthor[q.id] || "Client"}
                      onChange={(e) =>
                        setNewAnswerAuthor((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      className="h-9 px-2 rounded-md bg-[#F3F4F6] text-xs font-bold text-gray-700 outline-none"
                    >
                      <option value="Client">Client</option>
                      <option value="Me">Me</option>
                      <option value="Discussion">Discussion</option>
                    </select>

                    <Button
                      variant="emerald"
                      size="sm"
                      onClick={() => handleAddAnswer(q.id)}
                      disabled={isAddingAnswer[q.id]}
                      className="gap-1 text-xs whitespace-nowrap"
                    >
                      <Send className="w-3 h-3" />
                      <span>Save Answer</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Question Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Client Question"
        description="Write a question to clarify with the client during meetings or project discovery."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateQuestion} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Question *
              </label>
              <AIMagicButton
                getText={() => newTitle}
                onResult={(res) => setNewTitle(res)}
                context="Client requirement question"
                variant="ghost"
                size="sm"
                allowedActions={["hinglish_to_english", "professional", "grammar", "english_to_simple"]}
              />
            </div>
            <Input
              placeholder="e.g., Payment gateway kaunsa use karna hai?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Additional Details / Context
              </label>
              <AIMagicButton
                getText={() => newDetails}
                onResult={(res) => setNewDetails(res)}
                context={`Question: ${newTitle}`}
                variant="ghost"
                size="sm"
              />
            </div>
            <Textarea
              placeholder="Optional context, references, or specific options to give the client..."
              value={newDetails}
              onChange={(e) => setNewDetails(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
              >
                <option value="User Management">User Management</option>
                <option value="Payment">Payment</option>
                <option value="Reports">Reports</option>
                <option value="Technical">Technical</option>
                <option value="Architecture">Architecture</option>
                <option value="General">General</option>
                <option value="Custom">+ Custom Category</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as any)}
                className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {newCategory === "Custom" && (
            <Input
              label="Custom Category Name"
              placeholder="e.g., Security, SMS Integration"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              required
            />
          )}

          <Textarea
            label="Initial Answer (If already known)"
            placeholder="e.g., Razorpay integration with UPI"
            value={newInitialAnswer}
            onChange={(e) => setNewInitialAnswer(e.target.value)}
            rows={2}
          />

          <label className="flex items-center gap-2.5 p-3 rounded-md bg-[#EFF6FF] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newForNextMeeting}
              onChange={(e) => setNewForNextMeeting(e.target.checked)}
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
              {isSubmitting ? "Adding..." : "Add Question"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
