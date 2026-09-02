import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { transcribeAudioWithSarvam, SarvamSttMode } from "@/lib/sarvam";
import { generateWithGemini } from "@/lib/gemini";
import { toHinglish } from "@/lib/hinglish-transliterator";

// Helper function to check if text contains Devanagari Hindi characters
function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

// Convert Devanagari Hindi text to clean, natural Hinglish (Roman alphabet)
async function convertDevanagariToHinglish(devanagariText: string): Promise<string> {
  const prompt = `Convert the following Hindi text written in Devanagari script into natural Hinglish (Hindi written in Roman/English alphabet).

Rules:
1. Do NOT translate into English words unless they are naturally used in Hinglish (e.g. "payment gateway", "meeting", "client", "login").
2. Write the Hindi words phonetically in standard English letters (e.g., "कल 10 बजे मीटिंग है" -> "Kal 10 baje meeting hai", "पेमेंट गेटवे रेजरपे रखो" -> "Payment gateway Razorpay rakho", "यूजर लॉगिन कैसे करेगा" -> "User login kaise karega").
3. Return ONLY the Hinglish text without any preamble, explanation, or quotes.

Hindi Text:
${devanagariText}`;

  const response = await generateWithGemini(
    prompt,
    "You are an expert Hindi to Hinglish transliteration engine. You always output clean Hinglish in standard English/Roman letters."
  );

  return response.text.trim();
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as SarvamSttMode) || "codemix";
    const languageCode = (formData.get("language_code") as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Call Sarvam AI STT
    const result = await transcribeAudioWithSarvam(
      buffer,
      file.name || "recording.webm",
      mode,
      languageCode
    );

    let finalTranscript = result.transcript;

    // If output is in Devanagari Hindi script and mode is not translate, convert directly to Hinglish
    if (containsDevanagari(finalTranscript) && mode !== "translate") {
      try {
        finalTranscript = toHinglish(finalTranscript);
        // If any residual Devanagari remains, refine with Gemini
        if (containsDevanagari(finalTranscript)) {
          finalTranscript = await convertDevanagariToHinglish(finalTranscript);
        }
      } catch (translitErr) {
        console.warn("Devanagari to Hinglish transliteration warning:", translitErr);
      }
    }

    return NextResponse.json({
      transcript: finalTranscript,
      language_code: result.language_code,
      model_used: result.model_used,
      mode,
    });
  } catch (error: any) {
    console.error("STT API Route Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process audio transcription with Sarvam AI STT." },
      { status: 500 }
    );
  }
}
