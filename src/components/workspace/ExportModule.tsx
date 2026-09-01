"use client";

import * as React from "react";
import {
  Printer,
  Copy,
  Download,
  FileText,
  HelpCircle,
  Calendar,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

interface ExportModuleProps {
  project: {
    id: string;
    name: string;
    clientName?: string | null;
    description?: string | null;
    notes: any[];
    questions: any[];
    meetings: any[];
    tasks: any[];
  };
}

export function ExportModule({ project }: ExportModuleProps) {
  const [exportType, setExportType] = React.useState<"FULL" | "MEETING_PREP" | "QA_MATRIX" | "NOTES">("FULL");

  const handlePrint = () => {
    window.print();
  };

  const generateMarkdown = (): string => {
    let md = `# ${project.name}\n`;
    if (project.clientName) md += `**Client:** ${project.clientName}\n`;
    if (project.description) md += `**Description:** ${project.description}\n`;
    md += `**Export Date:** ${new Date().toLocaleDateString()}\n\n---\n\n`;

    if (exportType === "FULL" || exportType === "NOTES") {
      md += `## 📝 Project Notes & Notepad\n\n`;
      project.notes.forEach((note) => {
        md += `### ${note.title}\n`;
        if (note.tags) md += `*Tags: ${note.tags}* | *Updated: ${formatDate(note.updatedAt)}*\n\n`;
        md += `${note.content}\n\n---\n\n`;
      });
    }

    if (exportType === "FULL" || exportType === "QA_MATRIX" || exportType === "MEETING_PREP") {
      md += `## ❓ Client Questions & Decisions\n\n`;
      const activeQuestions = project.questions.filter((q) => q.status !== "DELETED");
      const questionsToInclude =
        exportType === "MEETING_PREP"
          ? activeQuestions.filter((q) => q.forNextMeeting || q.status !== "ANSWERED")
          : activeQuestions;

      questionsToInclude.forEach((q, idx) => {
        md += `### ${idx + 1}. [${q.status.replace("_", " ")}] ${q.title}\n`;
        md += `- **Category:** ${q.category} | **Priority:** ${q.priority}\n`;
        if (q.details) md += `- **Details:** ${q.details}\n`;
        if (q.answers && q.answers.length > 0) {
          q.answers.forEach((ans: any) => {
            md += `- **Answer (${ans.author || "Client"}):** ${ans.content}\n`;
          });
        } else {
          md += `- **Answer:** *Pending discussion*\n`;
        }
        md += `\n`;
      });
      md += `---\n\n`;
    }

    if (exportType === "FULL") {
      md += `## 📅 Meeting Logs & Minutes\n\n`;
      project.meetings.forEach((m) => {
        md += `### ${m.title} (${formatDateTime(m.meetingDate)})\n`;
        if (m.purpose) md += `- **Purpose:** ${m.purpose}\n`;
        if (m.attendees) md += `- **Attendees:** ${m.attendees}\n`;
        if (m.notes) md += `\n**Meeting Minutes:**\n${m.notes}\n\n`;
      });
      md += `---\n\n`;

      md += `## ✅ Follow-up Tasks & Action Items\n\n`;
      project.tasks.forEach((t) => {
        const checkbox = t.status === "COMPLETED" ? "[x]" : "[ ]";
        md += `- ${checkbox} **[${t.priority}]** ${t.title}${t.dueDate ? ` *(Due: ${formatDate(t.dueDate)})*` : ""}\n`;
        if (t.description) md += `  - ${t.description}\n`;
      });
    }

    return md;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(generateMarkdown());
    toast.success("Markdown copied to clipboard!");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Control Bar (Hidden on Print) */}
      <div className="no-print bg-[#F3F4F6] p-5 rounded-lg border-2 border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#3B82F6]" />
            <span>Export & Print Hub</span>
          </h2>
          <p className="text-xs text-gray-600 font-medium mt-0.5">
            Generate clean, professional print documents or copy formatted Markdown for client presentations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value as any)}
            className="h-10 px-3 rounded-md bg-white text-xs font-bold text-gray-900 border-2 border-transparent outline-none cursor-pointer"
          >
            <option value="FULL">Full Project Dossier</option>
            <option value="MEETING_PREP">Next Meeting Agenda Only</option>
            <option value="QA_MATRIX">Questions & Answers Matrix</option>
            <option value="NOTES">Notepad / Notes Only</option>
          </select>

          <Button
            variant="secondary"
            size="md"
            onClick={handleCopyMarkdown}
            className="gap-1.5 text-xs"
          >
            <Copy className="w-4 h-4" />
            <span>Copy Markdown</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handlePrint}
            className="gap-1.5 text-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </Button>
        </div>
      </div>

      {/* Printable Sheet Canvas */}
      <div className="bg-white rounded-lg p-8 sm:p-12 border-2 border-gray-200 shadow-none print:p-0 print:border-none">
        {/* Document Header */}
        <div className="border-b-4 border-gray-900 pb-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold tracking-widest text-[#3B82F6] uppercase block">
                Project Documentation & Meeting Report
              </span>
              <h1 className="text-3xl font-extrabold text-gray-900 mt-1">
                {project.name}
              </h1>
              {project.clientName && (
                <p className="text-sm font-bold text-gray-700 mt-1">
                  Client: {project.clientName}
                </p>
              )}
            </div>
            <div className="text-right text-xs font-semibold text-gray-500">
              <p>Generated: {new Date().toLocaleDateString()}</p>
              <p className="font-bold text-gray-800 uppercase mt-0.5">
                {exportType.replace("_", " ")}
              </p>
            </div>
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 font-medium mt-3 leading-relaxed">
              {project.description}
            </p>
          )}
        </div>

        {/* Section: Notes */}
        {(exportType === "FULL" || exportType === "NOTES") && project.notes.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-extrabold text-gray-900 uppercase tracking-wide border-b-2 border-gray-300 pb-2 mb-4">
              1. Project Notes & Notepad
            </h2>
            <div className="space-y-6">
              {project.notes.map((n) => (
                <div key={n.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-gray-900">{n.title}</h3>
                    {n.tags && (
                      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded font-semibold text-gray-700">
                        {n.tags}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">
                    {n.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Client Questions & Answers */}
        {(exportType === "FULL" || exportType === "QA_MATRIX" || exportType === "MEETING_PREP") && (
          <div className="mb-10">
            <h2 className="text-xl font-extrabold text-gray-900 uppercase tracking-wide border-b-2 border-gray-300 pb-2 mb-4">
              2. Client Questions & Verified Decisions
            </h2>
            <div className="space-y-4">
              {project.questions.filter((q) => q.status !== "DELETED").map((q, idx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-lg border-2 border-gray-200 bg-white"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-extrabold text-gray-500">
                      Q{idx + 1} • {q.category}
                    </span>
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-800">
                      {q.status.replace("_", " ")}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-gray-900">{q.title}</h4>
                  {q.details && (
                    <p className="text-xs text-gray-500 mt-0.5">{q.details}</p>
                  )}

                  {q.answers && q.answers.length > 0 ? (
                    <div className="mt-3 pl-3 border-l-4 border-[#10B981] space-y-1">
                      {q.answers.map((ans: any) => (
                        <div key={ans.id}>
                          <span className="text-[11px] font-extrabold uppercase text-[#065F46]">
                            Decision ({ans.author || "Client"}):
                          </span>
                          <p className="text-xs text-gray-800 font-medium">
                            {ans.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 pl-3 border-l-4 border-amber-400 text-xs font-semibold text-amber-800">
                      Pending Client Response
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Meetings */}
        {exportType === "FULL" && project.meetings.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-extrabold text-gray-900 uppercase tracking-wide border-b-2 border-gray-300 pb-2 mb-4">
              3. Meeting Minutes & Call History
            </h2>
            <div className="space-y-4">
              {project.meetings.map((m) => (
                <div key={m.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-gray-900">{m.title}</h4>
                    <span className="text-xs font-semibold text-gray-500">
                      {formatDateTime(m.meetingDate)}
                    </span>
                  </div>
                  {m.purpose && (
                    <p className="text-xs text-gray-600 mt-1">
                      <strong>Purpose:</strong> {m.purpose}
                    </p>
                  )}
                  {m.attendees && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      <strong>Attendees:</strong> {m.attendees}
                    </p>
                  )}
                  {m.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-800 whitespace-pre-wrap">
                      <strong>Minutes:</strong> {m.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Follow-up Tasks */}
        {exportType === "FULL" && project.tasks.length > 0 && (
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 uppercase tracking-wide border-b-2 border-gray-300 pb-2 mb-4">
              4. Follow-up Tasks & Commitments
            </h2>
            <div className="divide-y divide-gray-200">
              {project.tasks.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold">
                      {t.status === "COMPLETED" ? "[✔]" : "[ ]"}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        t.status === "COMPLETED" ? "line-through text-gray-400" : "text-gray-900"
                      }`}
                    >
                      {t.title}
                    </span>
                  </div>
                  <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
