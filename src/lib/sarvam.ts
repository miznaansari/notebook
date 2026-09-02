import WebSocket from "ws";
import { SarvamAIClient } from "sarvamai";

export { SarvamAIClient };

export interface SarvamSttResponse {
  transcript: string;
  language_code?: string;
  model_used?: string;
  method?: "websocket" | "http";
}

export type SarvamSttMode = "transcribe" | "translate" | "codemix" | "verbatim" | "translit";

export interface SarvamTtsOptions {
  text: string;
  model?: "bulbul:v3" | "bulbul:v2" | string;
  target_language_code?: string;
  speaker?: string;
  pace?: number;
  speech_sample_rate?: number | string;
  temperature?: number;
  timeoutMs?: number;
}

export interface SarvamTtsResponse {
  audioBuffer: Buffer;
  contentType: string;
  model: string;
  durationEstimateSeconds?: number;
}

/**
 * Text-to-Speech Synthesis via Sarvam AI WebSocket (bulbul:v3 streaming).
 * Reference: https://docs.sarvam.ai/api/getting-started/welcome
 */
export async function synthesizeSpeechWithSarvamWs(
  options: SarvamTtsOptions
): Promise<SarvamTtsResponse> {
  const apiKey = process.env.SARVAM_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("SARVAM_API_KEY is not configured in environment variables.");
  }

  const {
    text,
    model = "bulbul:v3",
    target_language_code = "hi-IN",
    speaker = "shubh",
    pace = 1,
    speech_sample_rate = 22050,
    temperature = 0.6,
    timeoutMs = 30000,
  } = options;

  if (!text || !text.trim()) {
    throw new Error("Text content is required for speech synthesis.");
  }

  const wsUrl = `wss://api.sarvam.ai/text-to-speech/ws?model=${encodeURIComponent(
    model
  )}&send_completion_event=true`;

  return new Promise((resolve, reject) => {
    const audioChunks: Buffer[] = [];
    let isCompleted = false;

    const ws = new WebSocket(wsUrl, {
      headers: {
        "Api-Subscription-Key": apiKey.trim(),
      },
    });

    const timer = setTimeout(() => {
      if (!isCompleted) {
        isCompleted = true;
        try {
          ws.close();
        } catch (_) {}
        if (audioChunks.length > 0) {
          resolve({
            audioBuffer: Buffer.concat(audioChunks),
            contentType: "audio/mp3",
            model,
          });
        } else {
          reject(new Error("Sarvam AI TTS WebSocket connection timed out."));
        }
      }
    }, timeoutMs);

    ws.on("open", () => {
      try {
        // 1. Send Configuration
        ws.send(
          JSON.stringify({
            type: "config",
            data: {
              model,
              target_language_code,
              speaker,
              pace,
              speech_sample_rate: String(speech_sample_rate),
              temperature,
            },
          })
        );

        // 2. Send Text Content
        ws.send(
          JSON.stringify({
            type: "text",
            data: {
              text: text.trim(),
            },
          })
        );

        // 3. Send Flush to indicate end of input stream
        ws.send(JSON.stringify({ type: "flush" }));
      } catch (sendErr) {
        clearTimeout(timer);
        isCompleted = true;
        try {
          ws.close();
        } catch (_) {}
        reject(sendErr);
      }
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "audio" && msg.data?.audio) {
          audioChunks.push(Buffer.from(msg.data.audio, "base64"));
        } else if (msg.type === "event" && msg.data?.event_type === "final") {
          clearTimeout(timer);
          isCompleted = true;
          try {
            ws.close();
          } catch (_) {}
          resolve({
            audioBuffer: Buffer.concat(audioChunks),
            contentType: "audio/mp3",
            model,
          });
        } else if (msg.type === "error") {
          clearTimeout(timer);
          isCompleted = true;
          try {
            ws.close();
          } catch (_) {}
          const errorMsg =
            msg.data?.message || msg.message || "Sarvam TTS WebSocket reported an error.";
          reject(new Error(`Sarvam AI TTS Error: ${errorMsg}`));
        }
      } catch (parseErr) {
        console.warn("Failed to parse Sarvam TTS message frame:", parseErr);
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      if (!isCompleted) {
        isCompleted = true;
        reject(err);
      }
    });

    ws.on("close", () => {
      clearTimeout(timer);
      if (!isCompleted) {
        isCompleted = true;
        if (audioChunks.length > 0) {
          resolve({
            audioBuffer: Buffer.concat(audioChunks),
            contentType: "audio/mp3",
            model,
          });
        } else {
          reject(new Error("Sarvam TTS WebSocket closed unexpectedly without audio data."));
        }
      }
    });
  });
}

/**
 * Speech-to-Text Transcription via Sarvam AI WebSocket.
 */
/**
 * Real-time Speech-to-Text Transcription via Sarvam AI Realtime WebSocket.
 * Reference: https://docs.sarvam.ai/api/getting-started/welcome
 */
export async function transcribeAudioWithSarvamWs(
  audioBuffer: Buffer | Blob | Uint8Array,
  filename: string = "recording.webm",
  mode: SarvamSttMode = "transcribe",
  languageCode: string = "hi-IN",
  timeoutMs: number = 20000
): Promise<SarvamSttResponse> {
  const apiKey = process.env.SARVAM_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("SARVAM_API_KEY is not configured in environment variables.");
  }

  let rawBuffer: Buffer;
  if (Buffer.isBuffer(audioBuffer)) {
    rawBuffer = audioBuffer;
  } else if (audioBuffer instanceof Blob) {
    const arrayBuf = await audioBuffer.arrayBuffer();
    rawBuffer = Buffer.from(arrayBuf);
  } else {
    rawBuffer = Buffer.from(audioBuffer);
  }

  const lang = !languageCode || languageCode === "unknown" || languageCode === "auto" ? "hi-IN" : languageCode;
  const isWav = filename.toLowerCase().endsWith(".wav");
  const encoding = isWav ? "audio/wav" : "linear16";

  const wsUrl = `wss://api.sarvam.ai/speech-to-text-realtime/ws?model=saaras:v3-realtime&language_code=${encodeURIComponent(
    lang
  )}&mode=${encodeURIComponent(mode || "transcribe")}&sample_rate=16000&stream_type=balanced&encoding=${encoding}`;

  return new Promise((resolve, reject) => {
    let isFinished = false;
    let partialTranscript = "";
    let finalTranscript = "";
    let detectedLanguage = lang;
    let streamInterval: NodeJS.Timeout | null = null;

    const ws = new WebSocket(wsUrl, {
      headers: {
        "api-subscription-key": apiKey.trim(),
        "Api-Subscription-Key": apiKey.trim(),
      },
    });

    const cleanup = () => {
      if (streamInterval) {
        clearInterval(streamInterval);
        streamInterval = null;
      }
      try {
        ws.close();
      } catch (_) {}
    };

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        cleanup();
        const res = (finalTranscript || partialTranscript).trim();
        if (res) {
          resolve({
            transcript: res,
            language_code: detectedLanguage,
            model_used: "saaras:v3-realtime",
            method: "websocket",
          });
        } else {
          reject(new Error("Sarvam AI Realtime STT WebSocket connection timed out."));
        }
      }
    }, timeoutMs);

    ws.on("open", () => {
      try {
        const chunkSize = 3200; // ~100ms of 16kHz mono 16-bit audio
        let offset = 0;

        streamInterval = setInterval(() => {
          if (offset >= rawBuffer.length) {
            if (streamInterval) clearInterval(streamInterval);
            streamInterval = null;
            try {
              ws.send(JSON.stringify({ event: "end" }));
            } catch (_) {}
            return;
          }

          const chunk = rawBuffer.subarray(offset, offset + chunkSize);
          try {
            ws.send(
              JSON.stringify({
                event: "audio_input",
                audio: chunk.toString("base64"),
              })
            );
          } catch (sendErr) {
            if (streamInterval) clearInterval(streamInterval);
          }
          offset += chunkSize;
        }, 50);
      } catch (err) {
        clearTimeout(timer);
        isFinished = true;
        cleanup();
        reject(err);
      }
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.event === "transcript.partial") {
          if (msg.text) {
            partialTranscript = msg.text;
          }
        } else if (msg.event === "transcript.final") {
          if (msg.text) {
            finalTranscript = msg.text;
          }
          clearTimeout(timer);
          isFinished = true;
          cleanup();
          resolve({
            transcript: (finalTranscript || partialTranscript).trim(),
            language_code: msg.language_code || detectedLanguage,
            model_used: "saaras:v3-realtime",
            method: "websocket",
          });
        } else if (msg.event === "error") {
          clearTimeout(timer);
          isFinished = true;
          cleanup();
          reject(new Error(`Sarvam STT Realtime Error: ${msg.message || "Unknown error"}`));
        } else if (msg.transcript || msg.data?.transcript) {
          // Fallback legacy event formats
          const text = msg.transcript || msg.data?.transcript;
          if (text) {
            finalTranscript = text;
          }
        }
      } catch (parseErr) {
        // Non-JSON frame
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      if (!isFinished) {
        isFinished = true;
        cleanup();
        reject(err);
      }
    });

    ws.on("close", () => {
      clearTimeout(timer);
      if (!isFinished) {
        isFinished = true;
        cleanup();
        const res = (finalTranscript || partialTranscript).trim();
        if (res) {
          resolve({
            transcript: res,
            language_code: detectedLanguage,
            model_used: "saaras:v3-realtime",
            method: "websocket",
          });
        } else {
          reject(new Error("Sarvam STT WebSocket completed without transcript."));
        }
      }
    });
  });
}

/**
 * Fallback Speech-to-Text via HTTP REST API.
 */
export async function transcribeAudioWithSarvamHttp(
  audioBuffer: Buffer | Blob | Uint8Array,
  filename: string = "recording.webm",
  mode: SarvamSttMode = "transcribe",
  languageCode?: string
): Promise<SarvamSttResponse> {
  const apiKey = process.env.SARVAM_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("SARVAM_API_KEY is not configured in environment variables.");
  }

  const endpoint = "https://api.sarvam.ai/speech-to-text";
  const modelsToTry = ["saaras:v3", "saaras:v2"];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const formData = new FormData();

      let blob: Blob;
      if (audioBuffer instanceof Blob) {
        blob = audioBuffer;
      } else {
        const uint8 = new Uint8Array(audioBuffer);
        blob = new Blob([uint8], { type: "audio/webm" });
      }

      formData.append("file", blob, filename);
      formData.append("model", model);

      if (mode && mode !== "transcribe") {
        formData.append("mode", mode);
      }

      if (languageCode && languageCode !== "unknown" && languageCode !== "auto") {
        formData.append("language_code", languageCode);
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "api-subscription-key": apiKey.trim(),
        },
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`Sarvam STT (${model}) ${res.status}: ${errText}`);
        continue;
      }

      const data = (await res.json()) as { transcript?: string; language_code?: string };
      if (data && typeof data.transcript === "string") {
        return {
          transcript: data.transcript,
          language_code: data.language_code,
          model_used: model,
          method: "http",
        };
      }
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      lastError = errorObj;
    }
  }

  throw lastError || new Error("Failed to transcribe audio with Sarvam AI STT HTTP.");
}

/**
 * Main unified transcription function:
 * First attempts WebSocket streaming transcription; on error/timeout seamlessly uses HTTP REST API.
 */
export async function transcribeAudioWithSarvam(
  audioBuffer: Buffer | Blob | Uint8Array,
  filename: string = "recording.webm",
  mode: SarvamSttMode = "transcribe",
  languageCode?: string
): Promise<SarvamSttResponse> {
  try {
    const wsResult = await transcribeAudioWithSarvamWs(
      audioBuffer,
      filename,
      mode,
      languageCode || "hi-IN"
    );
    if (wsResult && wsResult.transcript && wsResult.transcript.trim()) {
      return wsResult;
    }
  } catch (_wsErr) {
    // Quiet fallback to HTTP REST API
  }

  // Resilient fallback to HTTP REST API
  return await transcribeAudioWithSarvamHttp(audioBuffer, filename, mode, languageCode);
}
