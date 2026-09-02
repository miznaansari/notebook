import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        { error: "SARVAM_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      apiKey: apiKey.trim(),
      model: "saaras:v3-realtime",
      wsEndpoint: "wss://api.sarvam.ai/speech-to-text-realtime/ws",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate STT session." },
      { status: 500 }
    );
  }
}
