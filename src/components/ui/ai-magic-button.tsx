"use client";

import * as React from "react";
import {
  Sparkles,
  CheckCheck,
  Languages,
  Briefcase,
  FileText,
  HelpCircle,
  CheckSquare,
  ChevronDown,
  Loader2,
  Smile,
  Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface AIMagicButtonProps {
  getText: () => string;
  onResult: (result: string) => void;
  context?: string;
  size?: "sm" | "md" | "icon";
  variant?: "primary" | "secondary" | "outline" | "ghost" | "amber" | "emerald";
  className?: string;
  allowedActions?: Array<
    | "grammar"
    | "professional"
    | "hinglish_to_english"
    | "english_to_simple"
    | "summarize"
    | "make_short"
    | "suggest_answer"
  >;
}

export function AIMagicButton({
  getText,
  onResult,
  context,
  size = "sm",
  variant = "amber",
  className,
  allowedActions = [
    "grammar",
    "professional",
    "hinglish_to_english",
    "english_to_simple",
    "make_short",
    "summarize",
  ],
}: AIMagicButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = async (action: string) => {
    const text = getText();
    if (!text || !text.trim()) {
      toast.error("Please enter or select some text first!");
      return;
    }

    setIsLoading(true);
    setLoadingAction(action);
    setIsOpen(false);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text, context }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        onResult(data.result);
        toast.success(
          `AI (${data.modelUsed || "gemini-3.5-flash-lite"}): Action applied successfully!`
        );
      } else {
        toast.error(data.error || "Gemini AI processing failed");
      }
    } catch (err: any) {
      toast.error("AI Request failed. Please check your Gemini API key in .env");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const actionItems = [
    {
      id: "hinglish_to_english",
      label: "Translate Hinglish → English",
      desc: "Converts Hindi in English script into formal English",
      icon: Languages,
      color: "text-blue-600",
    },
    {
      id: "professional",
      label: "Company Standard / Professional",
      desc: "Refines tone to executive corporate standard",
      icon: Briefcase,
      color: "text-purple-600",
    },
    {
      id: "grammar",
      label: "Fix Grammar & Spelling",
      desc: "Corrects spelling mistakes and typos",
      icon: CheckCheck,
      color: "text-emerald-600",
    },
    {
      id: "english_to_simple",
      label: "Simplify for Client",
      desc: "Rewrites technical jargon into plain simple English",
      icon: Smile,
      color: "text-amber-600",
    },
    {
      id: "make_short",
      label: "Make Shorter (Short Version)",
      desc: "Condense & shorten text to be concise & punchy",
      icon: Scissors,
      color: "text-rose-600",
    },
    {
      id: "summarize",
      label: "Summarize into Key Points",
      desc: "Extracts crisp bullet-point takeaways",
      icon: FileText,
      color: "text-amber-600",
    },
    {
      id: "suggest_answer",
      label: "Suggest Best-Practice Answer",
      desc: "Proposes industry standard recommendation",
      icon: HelpCircle,
      color: "text-indigo-600",
    },
  ].filter((item) => allowedActions.includes(item.id as any));

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className={cn("gap-1.5 text-xs font-bold shrink-0", className)}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>AI Processing...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-amber-900" />
            <span>AI</span>
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white rounded-lg border-2 border-gray-200 p-1.5 space-y-1 shadow-none transition-transform duration-150">
          <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100 flex items-center justify-between">
            <span>AI Actions</span>
            <Sparkles className="w-3 h-3 text-amber-500" />
          </div>

          {actionItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAction(item.id)}
                className="w-full text-left p-2 rounded-md hover:bg-gray-100 transition-all duration-150 flex items-start gap-2.5 group cursor-pointer"
              >
                <div
                  className={cn(
                    "p-1 rounded bg-gray-100 group-hover:bg-white transition shrink-0 mt-0.5",
                    item.color
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-900 group-hover:text-blue-600 leading-tight">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
