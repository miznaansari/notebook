"use client";

import * as React from "react";
import { Mic, MicOff, Loader2, Sparkles, ChevronDown, Check, Volume2, Globe, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface VoiceMicButtonProps {
  onTranscript: (finalText: string) => void;
  onInterimTranscript?: (interimText: string) => void;
  variant?: "primary" | "secondary" | "amber" | "emerald" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  defaultMode?: "codemix" | "translate" | "transcribe";
  label?: string;
  showModeSelector?: boolean;
}

export function VoiceMicButton({
  onTranscript,
  onInterimTranscript,
  variant = "amber",
  size = "sm",
  className,
  defaultMode = "codemix",
  label,
  showModeSelector = true,
}: VoiceMicButtonProps) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const [mode, setMode] = React.useState<"codemix" | "translate" | "transcribe">(defaultMode);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [liveInterimSnippet, setLiveInterimSnippet] = React.useState("");

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const speechRecognitionRef = React.useRef<any>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Audio recording is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleSendToSarvam(audioBlob);
      };

      // Real-time Live Speech Recognition (Live Typing as you speak)
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognizer = new SpeechRecognition();
          recognizer.continuous = true;
          recognizer.interimResults = true;
          recognizer.lang = mode === "transcribe" ? "hi-IN" : "en-IN";

          recognizer.onresult = (event: any) => {
            let liveString = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              liveString += event.results[i][0].transcript;
            }
            if (liveString.trim()) {
              setLiveInterimSnippet(liveString.trim());
              if (onInterimTranscript) {
                onInterimTranscript(liveString.trim());
              }
            }
          };

          recognizer.onerror = (e: any) => {
            console.warn("Live speech recognition event:", e?.error);
          };

          recognizer.start();
          speechRecognitionRef.current = recognizer;
        } catch (recognitionErr) {
          console.warn("Live WebSpeech recognizer error:", recognitionErr);
        }
      }

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      setLiveInterimSnippet("");

      toast.info("🎙️ Real-time Live Listening... Speak now!");

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone error:", err);
      toast.error("Microphone access was denied or is unavailable.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSendToSarvam = async (blob: Blob) => {
    setIsProcessing(true);
    const modeLabel =
      mode === "translate"
        ? "Translating speech to English..."
        : mode === "transcribe"
        ? "Finalizing Hindi..."
        : "Finalizing Hinglish with Sarvam AI...";

    toast.info(`⏳ ${modeLabel}`);

    try {
      const formData = new FormData();
      formData.append("file", blob, "voice_input.webm");
      formData.append("mode", mode);

      const res = await fetch("/api/stt", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.transcript && data.transcript.trim()) {
        onTranscript(data.transcript.trim());
        toast.success("✅ Voice transcribed into Hinglish!");
      } else if (liveInterimSnippet) {
        // Fallback to live interim snippet if audio API had empty result
        onTranscript(liveInterimSnippet);
        toast.success("✅ Voice captured from live speech!");
      } else {
        toast.error(data.error || "No speech detected in audio.");
      }
    } catch (err: any) {
      if (liveInterimSnippet) {
        onTranscript(liveInterimSnippet);
        toast.success("✅ Voice captured!");
      } else {
        toast.error("Failed to connect to Sarvam AI STT service.");
      }
    } finally {
      setIsProcessing(false);
      setLiveInterimSnippet("");
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      {isRecording ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={stopRecording}
            className="h-8 px-3 rounded-md bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold flex items-center gap-2 animate-pulse cursor-pointer select-none transition-all"
            title="Click to stop and finalize with Sarvam AI"
          >
            <Radio className="w-3.5 h-3.5 animate-spin" />
            <span>Live ({formatTimer(recordingSeconds)})</span>
          </button>
        </div>
      ) : isProcessing ? (
        <button
          type="button"
          disabled
          className="h-8 px-3 rounded-md bg-[#F59E0B] text-amber-950 text-xs font-bold flex items-center gap-2 cursor-wait select-none opacity-90"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Sarvam AI...</span>
        </button>
      ) : (
        <div className="inline-flex items-center rounded-md overflow-hidden">
          <Button
            type="button"
            variant={variant}
            size={size}
            onClick={startRecording}
            className={cn("gap-1.5 text-xs select-none", showModeSelector && "rounded-r-none pr-2", className)}
            title="Real-Time Voice Dictation (Speak Hindi -> Generates Hinglish in real-time)"
          >
            <Mic className="w-3.5 h-3.5 text-current" />
            {label ? <span>{label}</span> : <span className="hidden sm:inline">Voice (Live Hinglish)</span>}
          </Button>

          {showModeSelector && (
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className={cn(
                "h-8 px-1.5 rounded-r-md border-l border-black/10 flex items-center justify-center transition-all cursor-pointer",
                variant === "amber" && "bg-[#F59E0B] text-amber-950 hover:bg-[#D97706]",
                variant === "primary" && "bg-[#3B82F6] text-white hover:bg-[#2563EB]",
                variant === "secondary" && "bg-[#F3F4F6] text-gray-800 hover:bg-gray-200",
                variant === "ghost" && "bg-transparent hover:bg-gray-100 text-gray-700"
              )}
              title="Change Voice Mode"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Mode Selector Dropdown */}
      {isMenuOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-[#111827] text-white rounded-xl border-2 border-gray-700 p-2 shadow-none animate-in fade-in select-none">
          <div className="px-2.5 py-1.5 border-b border-gray-800 text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
            Sarvam AI Live Speech Mode
          </div>

          <div className="py-1 space-y-1">
            {[
              {
                id: "codemix",
                label: "Speak Hindi → Live Hinglish (Default)",
                desc: "Live real-time typing of Hindi in Roman/English alphabet",
                tag: "Recommended",
              },
              {
                id: "translate",
                label: "Speak Hindi → Translate to English",
                desc: "Translates Hindi voice directly into formal English",
                tag: "Translate",
              },
              {
                id: "transcribe",
                label: "Devanagari Hindi (हिंदी)",
                desc: "Transcribes Hindi in traditional Devanagari script",
                tag: "Devanagari",
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode(item.id as any);
                  setIsMenuOpen(false);
                  toast.info(`Voice mode: ${item.label}`);
                }}
                className="w-full text-left p-2 rounded-lg hover:bg-gray-800 transition flex items-start justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-100 flex items-center gap-1.5 flex-wrap">
                    <span>{item.label}</span>
                    {mode === item.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium mt-0.5">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
