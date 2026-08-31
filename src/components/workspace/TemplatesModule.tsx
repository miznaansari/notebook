"use client";

import * as React from "react";
import {
  Briefcase,
  Layers,
  Plus,
  Check,
  FileCode,
  Sparkles,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SYSTEM_TEMPLATES } from "@/lib/templates";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TemplatesModuleProps {
  projectId: string;
  onQuestionsImported: () => void;
}

export function TemplatesModule({
  projectId,
  onQuestionsImported,
}: TemplatesModuleProps) {
  const [importingId, setImportingId] = React.useState<string | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = React.useState(false);
  const [customTitle, setCustomTitle] = React.useState("");
  const [customDesc, setCustomDesc] = React.useState("");
  const [customQuestionsText, setCustomQuestionsText] = React.useState(
`## Business Requirements
- Project ka main purpose kya hai?
- Target audience kaun hai?

## User Management
- Admin ke paas kya permissions hongi?
- Staff ke liye separate roles chahiye?

## Payment & Billing
- Kaunsa payment gateway use karna hai?
- Refund process kya hoga?

## Reports & Analytics
- Kaun-kaun se reports required hain?
- Reports PDF mein chahiye ya Excel mein?`
  );
  const [isCreatingCustom, setIsCreatingCustom] = React.useState(false);

  const handleImportSystemTemplate = async (templateId: string) => {
    setImportingId(templateId);
    try {
      const res = await fetch(`/api/projects/${projectId}/import-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Template imported successfully!");
        onQuestionsImported();
      } else {
        toast.error("Failed to import template");
      }
    } catch (err) {
      toast.error("Failed to import template");
    } finally {
      setImportingId(null);
    }
  };

  const handleCreateAndImportCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    setIsCreatingCustom(true);
    try {
      // Parse markdown-like template text into questions array
      const lines = customQuestionsText.split("\n");
      let currentCategory = "General";
      const parsedQuestions: any[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("##") || trimmed.startsWith("#")) {
          currentCategory = trimmed.replace(/^#+\s*/, "").trim();
        } else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          const qText = trimmed.replace(/^[-*]\s*/, "").trim();
          if (qText) {
            parsedQuestions.push({
              title: qText,
              category: currentCategory,
              status: "PENDING",
              priority: "HIGH",
              forNextMeeting: true,
            });
          }
        }
      }

      if (parsedQuestions.length === 0) {
        toast.error("Please add at least one question in bullet format (- Question)");
        return;
      }

      // Batch create in project
      const res = await fetch(`/api/projects/${projectId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: parsedQuestions }),
      });

      if (res.ok) {
        toast.success(`Created & imported ${parsedQuestions.length} custom questions!`);
        setIsCustomModalOpen(false);
        onQuestionsImported();
      } else {
        toast.error("Failed to create template questions");
      }
    } catch (err) {
      toast.error("Failed to process template");
    } finally {
      setIsCreatingCustom(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#3B82F6]" strokeWidth={2.5} />
            <span>Question Templates & Requirement Blueprints</span>
          </h2>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Accelerate your project discovery with curated question frameworks or create custom reusable blueprints.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsCustomModalOpen(true)}
          className="gap-2 shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
          <span>Create Custom Blueprint</span>
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SYSTEM_TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-white rounded-lg border-2 border-gray-200 p-6 flex flex-col justify-between hover:border-blue-500 transition-all duration-200"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded bg-blue-100 text-[#1D4ED8]">
                  {tpl.category}
                </span>
                <span className="text-xs font-bold text-gray-500">
                  {tpl.questions.length} Items
                </span>
              </div>

              <h3 className="text-lg font-bold text-gray-900 leading-snug">
                {tpl.title}
              </h3>

              <p className="text-xs text-gray-600 font-medium mt-2 leading-relaxed">
                {tpl.description}
              </p>

              {/* Sample Questions Preview */}
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase text-gray-400">
                  Includes:
                </span>
                {tpl.questions.slice(0, 3).map((q, idx) => (
                  <p key={idx} className="text-xs text-gray-700 font-semibold truncate flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    {q.title}
                  </p>
                ))}
                {tpl.questions.length > 3 && (
                  <p className="text-[11px] text-[#3B82F6] font-bold">
                    + {tpl.questions.length - 3} more questions
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="md"
              disabled={importingId === tpl.id}
              onClick={() => handleImportSystemTemplate(tpl.id)}
              className="mt-6 w-full gap-2 text-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>{importingId === tpl.id ? "Importing..." : "Import into Project"}</span>
            </Button>
          </div>
        ))}
      </div>

      {/* Custom Template Modal */}
      <Modal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        title="Create Custom Question Blueprint"
        description="Format categories with '## Category' and questions with bullet points '- Question'."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateAndImportCustom} className="space-y-4">
          <Input
            label="Blueprint Title *"
            placeholder="e.g., E-Commerce Store Discovery Template"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            required
          />

          <Textarea
            label="Questions Structure (Markdown Format) *"
            value={customQuestionsText}
            onChange={(e) => setCustomQuestionsText(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            required
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsCustomModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isCreatingCustom}
            >
              {isCreatingCustom ? "Processing..." : "Import Questions to Project"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
