import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { generateWithGemini } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { action, text, context } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    let prompt = "";
    let systemInstruction = "You are an expert project management, technical writing, and business communication AI assistant. Always output only the requested text directly without conversational chatter or markdown fences unless asked.";

    switch (action) {
      case "grammar":
        prompt = `Please correct all grammar, spelling, typos, and punctuation in the following text while strictly preserving its original intent:\n\n${text}`;
        systemInstruction = "You are a professional copyeditor. Return only the corrected text without any preamble or quotes.";
        break;

      case "professional":
        prompt = `Please rewrite the following project notes/question in an executive, company-standard, professional business tone:\n\n${text}`;
        systemInstruction = "You are a senior technical project manager. Make the text sound polished, clear, authoritative, and corporate standard. Return only the revised text.";
        break;

      case "hinglish_to_english":
        prompt = `Translate the following Hinglish (Hindi in English/Roman script) into clear, natural, and professional English for project management and client communication:\n\n${text}`;
        systemInstruction = "You are a bilingual English-Hindi project manager. Accurately translate Hinglish queries, notes, and questions into formal, precise English. Return only the translated English text.";
        break;

      case "english_to_simple":
        prompt = `Simplify the following technical requirements/notes into crystal-clear, easy-to-understand plain English suitable for non-technical clients:\n\n${text}`;
        systemInstruction = "You are a clear communicator. Remove unnecessary technical jargon and explain concepts in plain, direct English. Return only the simplified text.";
        break;

      case "summarize":
        prompt = `Please provide a concise, bullet-point summary of the following meeting notes or notepad content with key decisions and takeaways:\n\n${text}`;
        systemInstruction = "You are an executive assistant. Produce a clean, structured bullet-point summary highlighting decisions made, current blockers, and next steps.";
        break;

      case "suggest_answer":
        prompt = `For this client question in a web/software project:\nQuestion: "${text}"\nContext: "${context || ""}"\n\nSuggest a recommended, industry standard, best-practice answer and clarification to propose to the client. Keep it concise (2-4 sentences).`;
        systemInstruction = "You are a software architect and consultant. Provide a crisp, practical, best-practice recommendation.";
        break;

      case "generate_questions":
        prompt = `Based on the following project details:\nProject: "${text}"\nNotes/Context: "${context || ""}"\n\nGenerate 6 smart, structured client discovery questions categorized under: User Management, Payment & Billing, Reports & Analytics, and Technical Architecture. Return in clean JSON format with an array of objects: [{"title": "...", "category": "...", "priority": "HIGH" | "MEDIUM" | "URGENT", "details": "..."}]`;
        systemInstruction = "You are a lead software business analyst. Return valid JSON only without markdown formatting.";
        break;

      case "extract_tasks":
        prompt = `Extract all actionable follow-up tasks and commitments from the following meeting minutes / notes:\n\n${text}\n\nReturn in clean JSON format with an array of objects: [{"title": "...", "priority": "HIGH" | "MEDIUM" | "LOW", "description": "..."}]`;
        systemInstruction = "You are a project coordinator. Extract clear, discrete action items. Return valid JSON only without markdown code blocks.";
        break;

      default:
        return NextResponse.json({ error: "Unsupported AI action" }, { status: 400 });
    }

    const { text: result, modelUsed } = await generateWithGemini(prompt, systemInstruction);

    // If json requested, attempt to parse
    if (action === "generate_questions" || action === "extract_tasks") {
      try {
        const cleanedJson = result.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedJson);
        return NextResponse.json({ result: parsed, modelUsed, raw: result });
      } catch (parseErr) {
        return NextResponse.json({ result, modelUsed });
      }
    }

    return NextResponse.json({ result: result.trim(), modelUsed });
  } catch (error: any) {
    console.error("AI API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process AI request with Gemini." },
      { status: 500 }
    );
  }
}
