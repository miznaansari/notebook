import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { summarizeBrief } from "@/lib/daily-brief";

// GET /api/projects/[id]/daily-briefs - Index of days that have a brief (for the history roller & calendar)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;

    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const briefs = await db.dailyBrief.findMany({
      where: { projectId },
      select: { date: true, content: true },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ briefs: briefs.map((b) => summarizeBrief(b.date, b.content)) });
  } catch (error) {
    console.error("Error fetching daily briefs:", error);
    return NextResponse.json({ error: "Failed to fetch daily briefs" }, { status: 500 });
  }
}
