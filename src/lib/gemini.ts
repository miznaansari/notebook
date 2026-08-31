const PRIMARY_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

export interface GeminiResponse {
  text: string;
  modelUsed: string;
}

export async function generateWithGemini(
  prompt: string,
  systemInstruction?: string
): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      "GEMINI_API_KEY is not configured in .env file. Please add your Gemini API key."
    );
  }

  // Helper to make Google Generative Language API call
  const callModel = async (model: string): Promise<string> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

    const body: any = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Model ${model} error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error(`Empty response from ${model}`);
    }

    return text;
  };

  // 1. Try Primary Model: gemini-3.5-flash-lite
  try {
    const text = await callModel(PRIMARY_MODEL);
    return { text, modelUsed: PRIMARY_MODEL };
  } catch (primaryError: any) {
    console.warn(
      `Primary model ${PRIMARY_MODEL} failed (${primaryError?.message}). Trying fallback ${FALLBACK_MODEL}...`
    );

    // 2. Try Fallback Model: gemini-3.1-flash-lite
    try {
      const text = await callModel(FALLBACK_MODEL);
      return { text, modelUsed: FALLBACK_MODEL };
    } catch (fallbackError: any) {
      console.error(`Fallback model ${FALLBACK_MODEL} also failed:`, fallbackError);
      throw new Error(
        `Gemini AI processing failed. (Primary: ${primaryError?.message}, Fallback: ${fallbackError?.message})`
      );
    }
  }
}
