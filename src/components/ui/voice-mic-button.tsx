"use client";

import * as React from "react";
import { Mic, MicOff, Loader2, Sparkles, ChevronDown, Check, Volume2, Globe, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface VoiceMicButtonProps {
  onTranscript: (finalText: string) => void;
  onInterimTranscript?: (interimText: string) => void;
  variant?: "rose" | "primary" | "secondary" | "amber" | "emerald" | "outline" | "ghost" | "gradient";
  size?: "sm" | "md" | "lg";
  className?: string;
  defaultMode?: "codemix" | "translate" | "transcribe";
  label?: string;
  showModeSelector?: boolean;
}

export function VoiceMicButton({
  onTranscript,
  onInterimTranscript,
  variant = "rose",
  size = "sm",
  className,
  defaultMode = "codemix",
  label = "Voice (Live)",
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
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleSendToSarvam(audioBlob);
      };

      // Real-time Live Speech Recognition
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
        <button
          type="button"
          onClick={stopRecording}
          className="h-8 px-2 sm:px-3 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-bold flex items-center gap-1.5 sm:gap-2 shadow-sm shadow-red-500/30 animate-pulse cursor-pointer select-none transition-all shrink-0"
          title="Click to stop and finalize with Sarvam AI"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span className="hidden sm:inline">Live ({formatTimer(recordingSeconds)})</span>
          <span className="sm:hidden text-[11px]">{formatTimer(recordingSeconds)}</span>
          <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded uppercase font-semibold">Stop</span>
        </button>
      ) : isProcessing ? (
        <button
          type="button"
          disabled
          className="h-8 px-2 sm:px-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 sm:gap-2 cursor-wait select-none shrink-0"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600 shrink-0" />
          <span className="hidden sm:inline">Processing Voice...</span>
          <span className="sm:hidden text-[11px]">Processing...</span>
        </button>
      ) : (
        <div className="inline-flex items-center rounded-lg shadow-xs overflow-hidden border border-rose-200 bg-rose-50/70 hover:bg-rose-100/80 transition-colors shrink-0">
          <button
            type="button"
            onClick={startRecording}
            className={cn(
              "h-8 px-2 sm:px-2.5 text-xs font-semibold text-rose-700 flex items-center gap-1.5 cursor-pointer transition-colors select-none",
              className
            )}
            title="Real-Time Voice Dictation (Speak Hindi -> Generates Hinglish in real-time)"
          >
            <Mic className="w-3.5 h-3.5 text-rose-600 shrink-0" strokeWidth={2.2} />
            {label && <span className="hidden sm:inline">{label}</span>}
          </button>

          {showModeSelector && (
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="h-8 px-1 sm:px-1.5 border-l border-rose-200 text-rose-600 hover:text-rose-800 hover:bg-rose-200/50 flex items-center justify-center transition-colors cursor-pointer"
              title="Change Voice Mode"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Mode Selector Dropdown (Light, Modern Card) */}
      {isMenuOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white text-gray-900 rounded-xl border border-gray-200 p-1.5 shadow-xl animate-in fade-in zoom-in-95 select-none">
          <div className="px-2.5 py-1.5 border-b border-gray-100 text-[10px] font-extrabold uppercase tracking-wider text-rose-600 flex items-center justify-between">
            <span>Sarvam AI Speech Mode</span>
            <Sparkles className="w-3 h-3 text-rose-500" />
          </div>

          <div className="py-1 space-y-1">
            {[
              {
                id: "codemix",
                label: "Speak Hindi → Live Hinglish",
                desc: "Real-time typing of Hindi in Roman/English alphabet",
                badge: "Default",
              },
              {
                id: "translate",
                label: "Speak Hindi → English",
                desc: "Translates Hindi voice directly into formal English",
                badge: "Translate",
              },
              {
                id: "transcribe",
                label: "Devanagari Hindi (हिंदी)",
                desc: "Transcribes Hindi in traditional Devanagari script",
                badge: "Hindi",
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
                className={cn(
                  "w-full text-left p-2 rounded-lg transition-all duration-150 flex items-start justify-between gap-2 cursor-pointer group",
                  mode === item.id ? "bg-rose-50/80 text-rose-900 font-semibold" : "hover:bg-gray-50 text-gray-700"
                )}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5 flex-wrap">
                    <span className={mode === item.id ? "text-rose-700" : "text-gray-900 group-hover:text-rose-600"}>
                      {item.label}
                    </span>
                    {mode === item.id && <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-gray-500 font-normal mt-0.5">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
