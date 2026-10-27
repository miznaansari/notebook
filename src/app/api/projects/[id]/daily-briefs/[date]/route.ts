import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDateKey, summarizeBrief } from "@/lib/daily-brief";

async function authorize(req: NextRequest, params: Promise<{ id: string; date: string }>) {
  const auth = await getAuthUserFromRequest(req);
  if (!auth) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { id: projectId, date } = await params;
  if (!isDateKey(date)) {
    return { error: NextResponse.json({ error: "Date must be YYYY-MM-DD" }, { status: 400 }) };
  }

  const project = await db.project.findFirst({
    where: { id: projectId, userId: auth.userId },
  });
  if (!project) return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };

  return { projectId, date };
}

// GET /api/projects/[id]/daily-briefs/[date]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; date: string }> }
) {
  try {
    const result = await authorize(req, params);
    if ("error" in result) return result.error;

    const brief = await db.dailyBrief.findUnique({
      where: { projectId_date: { projectId: result.projectId, date: result.date } },
      select: { date: true, content: true, updatedAt: true },
    });

    return NextResponse.json({ brief });
  } catch (error) {
    console.error("Error fetching daily brief:", error);
    return NextResponse.json({ error: "Failed to fetch daily brief" }, { status: 500 });
  }
}

// PUT /api/projects/[id]/daily-briefs/[date] - Auto-save. Clearing a brief removes the day from history.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; date: string }> }
) {
  try {
    const result = await authorize(req, params);
    if ("error" in result) return result.error;
    const { projectId, date } = result;

    const body = await req.json();
    const content = typeof body.content === "string" ? body.content : "";

    if (!content.trim()) {
      await db.dailyBrief.deleteMany({ where: { projectId, date } });
      return NextResponse.json({ brief: null, summary: null });
    }

    const brief = await db.dailyBrief.upsert({
      where: { projectId_date: { projectId, date } },
      create: { projectId, date, content },
      update: { content },
      select: { date: true, content: true, updatedAt: true },
    });

    return NextResponse.json({ brief, summary: summarizeBrief(date, content) });
  } catch (error) {
    console.error("Error saving daily brief:", error);
    return NextResponse.json({ error: "Failed to save daily brief" }, { status: 500 });
  }
}
