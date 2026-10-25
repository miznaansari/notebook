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

      case "english_to_hinglish":
        prompt = `Translate the following English text into clear, natural, and conversational Hinglish (Hindi written in English/Latin/Roman script) commonly used in Indian software teams, business discussions, and day-to-day project communication:\n\n${text}`;
        systemInstruction = "You are a bilingual English-Hindi project manager. Accurately translate English queries, requirements, notes, tasks, and questions into natural, conversational Hinglish (Hindi written in English/Latin alphabet). Retain standard technical terms (such as API, database, backend, frontend, server, bug, login, payment gateway, deadline, etc.) in English as commonly done in Hinglish conversations. Return only the translated Hinglish text directly without any preamble, markdown formatting, or quotes.";
        break;

      case "english_to_simple":
        prompt = `Simplify the following technical requirements/notes into crystal-clear, easy-to-understand plain English suitable for non-technical clients:\n\n${text}`;
        systemInstruction = "You are a clear communicator. Remove unnecessary technical jargon and explain concepts in plain, direct English. Return only the simplified text.";
        break;

      case "summarize":
        prompt = `Please provide a concise, bullet-point summary of the following meeting notes or notepad content with key decisions and takeaways:\n\n${text}`;
        systemInstruction = "You are an executive assistant. Produce a clean, structured bullet-point summary highlighting decisions made, current blockers, and next steps.";
        break;

      case "make_short":
      case "shorten":
        prompt = `Please shorten the following text significantly to make it very concise, punchy, and brief while strictly preserving all essential facts, decisions, and core meaning. Eliminate wordiness, filler phrases, and redundancy:\n\n${text}`;
        systemInstruction = "You are an expert editor specializing in brevity and clarity. Condense the text into a clean, short, impactful version. Return only the shortened text directly without preamble or quotes.";
        break;

      case "generate_note_description":
      case "note_description":
        prompt = `Analyze the following note content and generate a crisp, concise, informative 1-sentence note description (maximum 15-20 words). The description should summarize the core purpose, topic, or key takeaways of the note so the user instantly understands it in note cards. Do NOT wrap in quotes, do NOT add conversational filler like "This note is about", do NOT use markdown symbols. Return only the clean description directly.\n\nNote Title: "${context || ""}"\n\nNote Content:\n${text}`;
        systemInstruction = "You are a senior technical writer. Return only the concise 1-sentence note description directly without any quotes or preamble.";
        break;

      case "generate_note_meta":
        prompt = `Analyze the following note content and generate:
1. "title": a short, specific note title (3-7 words, Title Case) naming the note's main topic. No quotes, no emojis, no trailing punctuation, no generic words like "Note" or "Notes".
2. "description": a crisp, informative 1-sentence description (maximum 15-20 words) summarizing the core purpose or key takeaways. No filler like "This note is about", no markdown symbols.

Return ONLY a valid JSON object: {"title": "...", "description": "..."}

Current Note Title: "${context || ""}"

Note Content:
${text}`;
        systemInstruction = "You are a senior technical writer. Return valid JSON only without markdown formatting.";
        break;

      case "execute_task":
      case "do_task":
      case "create_email_template":
        prompt = `You are an expert project lead, copywriter, and software consultant.
The user has assigned this task or requested this deliverable:
Task: "${text}"
Context / Project Note: "${context || ""}"

Instructions:
1. If the task is related to creating an email template (e.g., "create email templete", "client follow up email", "milestone update email", "meeting summary email"), create a polished, ready-to-send email template with:
   - **Subject:** Crisp and engaging subject line
   - **Salutation:** e.g., Hi [Client Name / Team],
   - **Body:** Clear, well-structured email content with key context and bullet points
   - **Call to Action (CTA) / Next Steps:** Specific deadlines or follow-ups
   - **Sign-off:** Professional closing
2. If the task is a technical requirement, QA item, documentation, or planning task, generate a direct, actionable solution, step-by-step checklist, or draft as required.
3. Keep the output clean, highly professional, practical, and formatted in clean markdown without conversational filler. Return the deliverable directly.`;
        systemInstruction = "You are an elite business communicator and technical lead. Provide direct, high-value, perfectly drafted deliverables for the requested task.";
        break;

      case "suggest_answer":
        prompt = `For this client question in a web/software project:\nQuestion: "${text}"\nContext: "${context || ""}"\n\nSuggest a recommended, industry standard, best-practice answer and clarification to propose to the client. Keep it concise (2-4 sentences).`;
        systemInstruction = "You are a software architect and consultant. Provide a crisp, practical, best-practice recommendation.";
        break;

      case "generate_questions":
        prompt = `Based on the following project details:\nProject: "${text}"\nNotes/Context: "${context || ""}"\n\nGenerate 6 smart, structured client discovery questions categorized under: User Management, Payment & Billing, Reports & Analytics, and Technical Architecture. Return in clean JSON format with an array of objects: [{"title": "...", "category": "...", "priority": "HIGH" | "MEDIUM" | "URGENT", "details": "..."}]`;
        systemInstruction = "You are a lead software business analyst. Return valid JSON only without markdown formatting.";
        break;

      case "generate_tasks":
      case "extract_tasks":
        prompt = `Analyze the following raw notes, bug reports, feature requests, or action items:

"""
${text}
"""

Context/Project: "${context || ""}"

Instructions:
1. Parse every distinct issue, bug, question, inquiry, or follow-up item into an actionable project task.
2. For each task, provide:
   - "title": A concise, clear, professional, and actionable task title (e.g., "Fix Bulk Account Import Failure", "Resolve Skip Onboarding Issue", "Verify Email Validation System Status", "Implement Invitation Email for Unregistered Users", "Fix Admin-to-Admin Invite Error").
   - "description": Contextual explanation, root cause / expected behavior, or deliverable details extracted from the text.
   - "priority": Auto-classify as "URGENT", "HIGH", "MEDIUM", or "LOW" based on urgency and severity (e.g. broken features, crash/errors, or blockers = HIGH/URGENT; questions/verifications = MEDIUM/LOW).
3. Return ONLY a valid JSON array of objects with the exact structure:
[
  {
    "title": "Task title here",
    "description": "Task description or details here",
    "priority": "HIGH"
  }
]
Do not include markdown explanation, code fences, or any other text outside the JSON array.`;
        systemInstruction = "You are an expert technical lead and project manager. Parse raw user inputs, bug lists, and notes into clean, actionable, structured task items. Always respond with pure valid JSON array only.";
        break;

      case "generate_daily_summary":
      case "standup_summary":
        prompt = `You are an executive project manager and technical lead.
Analyze the following list of tasks and activities for the date "${context || "Today"}":

"""
${text}
"""

Instructions:
Generate a comprehensive, crystal-clear, and professional Daily Work Accomplishment Summary ("Aaj kya kya kiya") based on the completed tasks and current status.

Provide the response in the following structured JSON format:
{
  "headline": "A punchy, 1-line executive overview of today's achievements",
  "completionRate": "e.g., 5/6 Tasks Completed (83%)",
  "completedHighlights": [
    "Brief bullet point of each major accomplishment and key outcome achieved today"
  ],
  "inProgressAndNext": [
    "Key items currently in progress, blockers, or planned for tomorrow"
  ],
  "slackWhatsappFormat": "Ready-to-copy WhatsApp / Slack standup message with clean emojis, date, What I Did Today, What's In Progress, and Blockers",
  "clientEmailFormat": "Professional corporate email draft suitable for sending to clients or stakeholders summarizing today's deliverables and milestone progress",
  "summaryNotesMarkdown": "Rich markdown text with headings, checklists, and notes formatted ready to be saved into a project Note"
}

Do not include markdown fences outside the JSON. Return only the valid JSON object.`;
        systemInstruction = "You are a senior engineering manager and technical lead. Create impactful, crisp, and executive daily accomplishment summaries. Return valid JSON only.";
        break;

      default:
        return NextResponse.json({ error: "Unsupported AI action" }, { status: 400 });
    }

    const { text: result, modelUsed } = await generateWithGemini(prompt, systemInstruction);

    // If json requested, attempt to parse
    if (
      action === "generate_questions" ||
      action === "extract_tasks" ||
      action === "generate_tasks" ||
      action === "generate_daily_summary" ||
      action === "standup_summary" ||
      action === "generate_note_meta"
    ) {
      try {
        let cleanedJson = result.trim();
        cleanedJson = cleanedJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        
        // Check if object or array
        const objectMatch = cleanedJson.match(/\{[\s\S]*\}/);
        const arrayMatch = cleanedJson.match(/\[[\s\S]*\]/);
        
        if (action === "generate_daily_summary" || action === "standup_summary" || action === "generate_note_meta") {
          if (objectMatch) cleanedJson = objectMatch[0];
        } else if (arrayMatch) {
          cleanedJson = arrayMatch[0];
        }
        
        const parsed = JSON.parse(cleanedJson);
        return NextResponse.json({ result: parsed, modelUsed, raw: result });
      } catch (parseErr) {
        console.error("AI JSON parse error:", parseErr, "Raw output:", result);
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
