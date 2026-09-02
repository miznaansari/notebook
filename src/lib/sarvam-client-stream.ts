"use client";

import { toHinglish } from "@/lib/hinglish-transliterator";

export interface SarvamLiveStreamOptions {
  mode?: "codemix" | "translate" | "transcribe" | "translit";
  languageCode?: string;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: "connecting" | "listening" | "processing" | "closed") => void;
}

export class SarvamLiveSocketStreamer {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isStopping = false;
  private finalTranscriptReceived = false;
  private accumulatedFinalText = "";
  private currentPartialText = "";

  /**
   * Convert Float32 audio samples from Web Audio API into 16-bit Linear PCM bytes.
   */
  private floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); // little-endian
    }
    return buffer;
  }

  /**
   * Base64 encoder for browser binary buffers.
   */
  private bufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Start live streaming directly from microphone to Sarvam AI WebSocket.
   */
  public async start(options: SarvamLiveStreamOptions = {}) {
    const {
      mode = "codemix",
      languageCode = "hi-IN",
      onPartial,
      onFinal,
      onError,
      onStatusChange,
    } = options;

    this.isStopping = false;
    this.finalTranscriptReceived = false;
    this.accumulatedFinalText = "";
    this.currentPartialText = "";

    try {
      onStatusChange?.("connecting");

      // 1. Get authenticated session configuration from server
      const sessionRes = await fetch("/api/stt/session");
      if (!sessionRes.ok) {
        throw new Error("Could not retrieve STT session from server.");
      }
      const sessionData = await sessionRes.json();
      const apiKey = sessionData.apiKey;

      if (!apiKey) {
        throw new Error("SARVAM_API_KEY is missing on server.");
      }

      // 2. Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.mediaStream = stream;

      // 3. Connect to Sarvam AI Realtime WebSocket
      const lang = languageCode || "hi-IN";
      const wsUrl = `wss://api.sarvam.ai/speech-to-text-realtime/ws?model=saaras:v3-realtime&language_code=${encodeURIComponent(
        lang
      )}&mode=${encodeURIComponent(mode)}&sample_rate=16000&stream_type=balanced&encoding=linear16`;

      // Browser WebSocket Authentication using Subprotocol
      const socket = new WebSocket(wsUrl, [`api-subscription-key.${apiKey}`]);
      this.socket = socket;

      socket.onopen = () => {
        onStatusChange?.("listening");

        // 4. Initialize Web Audio API to process 16kHz PCM chunks
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass({ sampleRate: 16000 });
          this.audioContext = audioCtx;

          const source = audioCtx.createMediaStreamSource(stream);
          this.source = source;

          // 4096 samples = ~256ms chunk at 16kHz
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          this.processor = processor;

          processor.onaudioprocess = (e) => {
            if (this.isStopping || socket.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBuffer = this.floatTo16BitPCM(inputData);
            const base64Audio = this.bufferToBase64(pcmBuffer);

            socket.send(
              JSON.stringify({
                event: "audio_input",
                audio: base64Audio,
              })
            );
          };

          source.connect(processor);
          processor.connect(audioCtx.destination);
        } catch (audioErr: any) {
          console.error("Web Audio Context error:", audioErr);
          onError?.(audioErr);
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.event === "transcript.partial" && msg.text) {
            const rawText = msg.text.trim();
            const hinglishPartial = mode === "translate" ? rawText : toHinglish(rawText);
            this.currentPartialText = hinglishPartial;

            // Combine previous finalized text + current live partial text
            const fullLive = (
              (this.accumulatedFinalText ? this.accumulatedFinalText + " " : "") +
              hinglishPartial
            ).trim();

            onPartial?.(fullLive);
          } else if (msg.event === "transcript.final" && msg.text) {
            const rawText = msg.text.trim();
            const hinglishFinal = mode === "translate" ? rawText : toHinglish(rawText);

            if (hinglishFinal) {
              this.accumulatedFinalText = (
                (this.accumulatedFinalText ? this.accumulatedFinalText + " " : "") +
                hinglishFinal
              ).trim();
            }

            this.currentPartialText = "";
            this.finalTranscriptReceived = true;

            onFinal?.(this.accumulatedFinalText);
            onPartial?.(this.accumulatedFinalText);
          } else if (msg.event === "error") {
            console.error("Sarvam Realtime WS event error:", msg);
            onError?.(new Error(msg.message || "Sarvam STT WebSocket error."));
          }
        } catch (parseErr) {
          console.warn("Failed to parse Sarvam message frame:", parseErr);
        }
      };

      socket.onerror = (err) => {
        console.error("Sarvam STT WebSocket error:", err);
        onError?.(new Error("WebSocket connection error with Sarvam AI."));
      };

      socket.onclose = () => {
        onStatusChange?.("closed");
        const fullFinal = (
          (this.accumulatedFinalText ? this.accumulatedFinalText + " " : "") +
          this.currentPartialText
        ).trim();

        if (fullFinal) {
          onFinal?.(fullFinal);
        }
        this.cleanup();
      };
    } catch (err: any) {
      console.error("SarvamLiveSocketStreamer start error:", err);
      this.cleanup();
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Stop the live audio stream and commit final transcript.
   */
  public async stop(): Promise<string> {
    this.isStopping = true;

    // Send end signal to Sarvam WebSocket to flush final transcript
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({ event: "end" }));
      } catch (_) {}
    }

    // Give a short 400ms grace window for the final packet to arrive
    await new Promise((resolve) => setTimeout(resolve, 400));

    const totalText = (
      (this.accumulatedFinalText ? this.accumulatedFinalText + " " : "") +
      this.currentPartialText
    ).trim();

    this.cleanup();
    return toHinglish(totalText);
  }

  /**
   * Cleanup all audio nodes and sockets.
   */
  public cleanup() {
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch (_) {}
      this.processor = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch (_) {}
      this.source = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      this.mediaStream = null;
    }

    if (this.socket) {
      try {
        if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close();
        }
      } catch (_) {}
      this.socket = null;
    }
  }
}
