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
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { AIMagicButton } from "@/components/ui/ai-magic-button";
import { VoiceMicButton } from "@/components/ui/voice-mic-button";
import { SYSTEM_TEMPLATES } from "@/lib/templates";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MeetingPrepModuleProps {
  projectId: string;
  projectName: string;
  clientName?: string | null;
  questions: any[];
  onQuestionsChange: (questions: any[]) => void;
  onNavigateToMeetings: () => void;
  onScheduleMeetingWithQuestions: (questionIds: string[]) => void;
}

export function MeetingPrepModule({
  projectId,
  projectName,
  clientName,
  questions,
  onQuestionsChange,
  onNavigateToMeetings,
  onScheduleMeetingWithQuestions,
}: MeetingPrepModuleProps) {
  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(SYSTEM_TEMPLATES[0].id);
  const [isImporting, setIsImporting] = React.useState(false);
  const [quickQuestionText, setQuickQuestionText] = React.useState("");
  const [quickQuestionCategory, setQuickQuestionCategory] = React.useState("User Management");

  // Questions marked for next meeting or still pending/need-followup
  const nextMeetingQuestions = questions.filter(
    (q) => q.forNextMeeting || q.status === "PENDING" || q.status === "NEED_FOLLOWUP"
  );

  // Group questions by category
  const categories = Array.from(new Set(nextMeetingQuestions.map((q) => q.category)));

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

    try {
      const res = await fetch(`/api/projects/${projectId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickQuestionText.trim(),
          category: quickQuestionCategory,
          status: "PENDING",
          priority: "HIGH",
          forNextMeeting: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onQuestionsChange([data.question, ...questions]);
        setQuickQuestionText("");
        toast.success("Question added to meeting agenda!");
      }
    } catch (err) {
      toast.error("Failed to add question");
    }
  };

  const handleToggleNextMeetingFlag = async (questionId: string, currentVal: boolean) => {
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
      }
    } catch (err) {
      toast.error("Failed to update question");
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
      <div className="bg-[#EFF6FF] border-2 border-[#3B82F6] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#3B82F6] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              Next Meeting Preparation & Client Questions
            </h2>
            <p className="text-xs sm:text-sm font-medium text-gray-700 mt-1 max-w-2xl">
              Organize topics and pending questions to ask the client in the upcoming meeting. You can load standard requirement templates, customize questions, and copy the agenda.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          {/* Gemini AI Auto Generate */}
          <Button
            variant="amber"
            size="sm"
            onClick={async () => {
              toast.info("Gemini AI is generating next meeting agenda questions...");
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
                    toast.success(`Gemini AI generated ${data.result.length} meeting agenda questions!`);
                  }
                }
              } catch (err) {
                toast.error("Failed to generate AI meeting questions");
              }
            }}
            className="gap-1.5 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-900" />
            <span>AI Generate Questions</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTemplateModalOpen(true)}
            className="gap-1.5 text-xs bg-white"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Load Template</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyAgendaMarkdown}
            className="gap-1.5 text-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Agenda</span>
          </Button>

          <Button
            variant="emerald"
            size="sm"
            onClick={() =>
              onScheduleMeetingWithQuestions(nextMeetingQuestions.map((q) => q.id))
            }
            className="gap-1.5 text-xs"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule Meeting</span>
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
            type="text"
            placeholder="Speak or type next meeting question (e.g. Kaunsa payment gateway sandbox use karna hai)..."
            value={quickQuestionText}
            onChange={(e) => setQuickQuestionText(e.target.value)}
            className="w-full h-11 pl-4 pr-44 rounded-md bg-[#F3F4F6] text-xs font-semibold text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] transition"
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

        <select
          value={quickQuestionCategory}
          onChange={(e) => setQuickQuestionCategory(e.target.value)}
          className="h-11 px-3 rounded-md bg-[#F3F4F6] text-xs font-bold text-gray-800 outline-none w-full sm:w-auto"
        >
          <option value="User Management">User Management</option>
          <option value="Payment">Payment</option>
          <option value="Reports">Reports</option>
          <option value="Technical">Technical</option>
          <option value="Architecture">Architecture</option>
          <option value="General">General</option>
        </select>

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full sm:w-auto gap-1 text-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add to Agenda</span>
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
          {categories.map((category, idx) => {
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
                  {categoryQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="p-3 rounded-md hover:bg-gray-50 flex items-start justify-between gap-3 transition"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={q.forNextMeeting}
                          onChange={() => handleToggleNextMeetingFlag(q.id, q.forNextMeeting)}
                          title="Toggle Next Meeting inclusion"
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
                        />

                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-snug">
                            {q.title}
                          </p>
                          {q.details && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {q.details}
                            </p>
                          )}
                          {q.answers && q.answers.length > 0 && (
                            <div className="mt-2 pl-3 border-l-2 border-emerald-500">
                              <span className="text-[10px] font-extrabold uppercase text-emerald-800">
                                Latest Decision:
                              </span>
                              <p className="text-xs text-emerald-900 font-medium">
                                {q.answers[q.answers.length - 1].content}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded",
                            q.status === "ANSWERED"
                              ? "bg-emerald-100 text-emerald-800"
                              : q.status === "NEED_FOLLOWUP"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {q.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
    </div>
  );
}
