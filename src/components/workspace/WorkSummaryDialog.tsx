"use client";

import * as React from "react";
import { AlertCircle, Check, ClipboardList, Copy, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AIMagicButton } from "@/components/ui/ai-magic-button";
import { briefToPoints, buildWorkSummary, formatBriefDate, toDateKey } from "@/lib/daily-brief";
import { flushOpenDailyBriefs } from "./DailyBriefPanel";
import { useLocalData } from "@/lib/local-db/context";

// The edited summary survives closing the dialog; one draft per day, kept in this browser only
const draftKey = (date: string) => `notepad:workSummaryDraft:${date}`;

function readDraft(date: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(date));
  } catch {
    return null;
  }
}

function writeDraft(date: string, text: string | null) {
  try {
    if (text === null) window.localStorage.removeItem(draftKey(date));
    else window.localStorage.setItem(draftKey(date), text);
  } catch {
    // Storage blocked: the draft just won't survive closing the dialog
  }
}

interface WorkSummaryDialogProps {
  onClose: () => void;
}

// Today's work across all projects, built from each project's Daily Brief:
//   Project name
//   - point
// Mounted only while open, so every open starts from fresh data.
export function WorkSummaryDialog({ onClose }: WorkSummaryDialogProps) {
  const { db, sync } = useLocalData();
  const [today] = React.useState(() => toDateKey(new Date()));
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [generated, setGenerated] = React.useState("");
  const [text, setText] = React.useState("");
  const [projectCount, setProjectCount] = React.useState(0);
  const [restoredDraft, setRestoredDraft] = React.useState(false);
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        // Save what's being typed, and give a sync a moment to bring in other devices' briefs
        // (offline, or if the server is slow, the summary uses what this device has)
        await flushOpenDailyBriefs();
        await Promise.race([sync.syncNow(), new Promise((resolve) => setTimeout(resolve, 3000))]);
        if (controller.signal.aborted) return;

        const [briefs, projects] = await Promise.all([
          db.briefs.where("date").equals(today).toArray(),
          db.projects.toArray(),
        ]);
        const contentByProject = new Map(briefs.filter((b) => b.content.trim()).map((b) => [b.projectId, b.content]));
        const data = {
          projects: projects
            .filter((p) => contentByProject.has(p.id))
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            .map((p) => ({ projectName: p.name, content: contentByProject.get(p.id)! })),
        };

        const summary = buildWorkSummary(data.projects);
        setGenerated(summary);
        setProjectCount(data.projects.filter((p) => briefToPoints(p.content).length > 0).length);

        // First open of the day's dialog restores an edited draft; Regenerate ignores it
        const draft = reloadNonce === 0 ? readDraft(today) : null;
        setRestoredDraft(draft !== null && draft !== summary);
        setText(draft ?? summary);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Failed to build work summary:", err);
        setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [today, reloadNonce, db, sync]);

  const updateText = (value: string) => {
    setText(value);
    writeDraft(today, value === generated ? null : value);
  };

  const regenerate = () => {
    if (text !== generated && !confirm("Replace your edits with a fresh summary from today's briefs?")) return;
    writeDraft(today, null);
    setStatus("loading");
    setReloadNonce((n) => n + 1);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Work summary copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  };

  const isEmpty = status === "ready" && generated === "" && text === "";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Today's Work Summary"
      description={`${formatBriefDate(today)} · from each project's Daily Brief`}
      maxWidth="2xl"
    >
      {status === "loading" && (
        <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Building summary">
          <div className="h-[45vh] min-h-56 rounded-xl bg-[#F8FAFC] p-4 space-y-3">
            <div className="h-4 w-40 rounded bg-gray-300" />
            <div className="h-3.5 w-3/4 rounded bg-gray-200" />
            <div className="h-3.5 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-32 rounded bg-gray-300 mt-6" />
            <div className="h-3.5 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center justify-center gap-3 text-center py-12">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm font-bold text-gray-700">Couldn&apos;t load today&apos;s briefs</p>
          <Button variant="primary" size="sm" onClick={regenerate} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center gap-2 text-center py-12 rounded-xl bg-[#F8FAFC]">
          <ClipboardList className="w-9 h-9 text-gray-300" />
          <p className="text-sm font-bold text-gray-700">No daily briefs written today</p>
          <p className="text-xs text-gray-500 max-w-xs">
            Add today&apos;s points in a project&apos;s Daily Brief (first item in its notes), then open this again.
          </p>
        </div>
      )}

      {status === "ready" && !isEmpty && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-500">
              {restoredDraft
                ? "Showing your edited version"
                : `${projectCount} ${projectCount === 1 ? "project" : "projects"} with a brief today`}
            </span>
            <div className="flex items-center gap-1.5">
              <AIMagicButton
                getText={() => text}
                onResult={updateText}
                context="Daily work summary grouped by project. Keep each project name on its own line followed by '- ' bullet points."
                allowedActions={["professional", "grammar", "make_short", "hinglish_to_english", "english_to_hinglish"]}
                variant="secondary"
                size="sm"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={regenerate}
                className="gap-1.5"
                title="Rebuild from today's briefs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="max-sm:hidden">Regenerate</span>
              </Button>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => updateText(e.target.value)}
            aria-label="Work summary"
            className="w-full h-[45vh] min-h-56 p-4 rounded-xl bg-[#F8FAFC] text-gray-900 text-sm leading-relaxed border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] resize-none"
          />

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" size="sm" onClick={copy} disabled={!text.trim()} className="gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
