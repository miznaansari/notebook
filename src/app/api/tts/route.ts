import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { synthesizeSpeechWithSarvamWs, SarvamTtsOptions } from "@/lib/sarvam";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const {
      text,
      model = "bulbul:v3",
      target_language_code = "hi-IN",
      speaker = "shubh",
      pace = 1,
      speech_sample_rate = 22050,
      format = "json", // "audio" or "json"
    } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text is required for TTS synthesis." }, { status: 400 });
    }

    const ttsOptions: SarvamTtsOptions = {
      text: text.trim(),
      model,
      target_language_code,
      speaker,
      pace: typeof pace === "number" ? pace : 1,
      speech_sample_rate: speech_sample_rate || 22050,
    };

    const result = await synthesizeSpeechWithSarvamWs(ttsOptions);

    if (format === "audio") {
      return new NextResponse(new Uint8Array(result.audioBuffer), {
        headers: {
          "Content-Type": result.contentType || "audio/mpeg",
          "Content-Length": result.audioBuffer.length.toString(),
          "Cache-Control": "no-cache",
        },
      });
    }

    return NextResponse.json({
      audio_base64: result.audioBuffer.toString("base64"),
      content_type: result.contentType,
      model: result.model,
      format: "mp3",
    });
  } catch (error: any) {
    console.error("TTS WebSocket API Route Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to synthesize speech with Sarvam AI TTS." },
      { status: 500 }
    );
  }
}
