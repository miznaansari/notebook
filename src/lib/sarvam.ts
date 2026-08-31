export interface SarvamSttResponse {
  transcript: string;
  language_code?: string;
  model_used?: string;
}

export type SarvamSttMode = "transcribe" | "translate" | "codemix" | "verbatim";

/**
 * Transcribes or translates audio using Sarvam AI Speech-to-Text API (saaras:v3 with saaras:v2 fallback).
 * Reference: https://docs.sarvam.ai/api/getting-started/welcome
 */
export async function transcribeAudioWithSarvam(
  audioBuffer: Buffer | Blob | Uint8Array,
  filename: string = "recording.webm",
  mode: SarvamSttMode = "transcribe",
  languageCode?: string
): Promise<SarvamSttResponse> {
  const apiKey = process.env.SARVAM_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("SARVAM_API_KEY is not configured in .env file.");
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
        console.warn(`Sarvam STT model ${model} failed (${res.status}): ${errText}`);
        lastError = new Error(`Sarvam STT (${model}) ${res.status}: ${errText}`);
        continue;
      }

      const data = (await res.json()) as { transcript?: string; language_code?: string };
      if (data && typeof data.transcript === "string") {
        return {
          transcript: data.transcript,
          language_code: data.language_code,
          model_used: model,
        };
      }
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      console.warn(`Error attempting Sarvam STT with model ${model}:`, errorObj);
      lastError = errorObj;
    }
  }

  throw lastError || new Error("Failed to transcribe audio with Sarvam AI STT.");
}
