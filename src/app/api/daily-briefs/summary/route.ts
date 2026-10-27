import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDateKey } from "@/lib/daily-brief";

// GET /api/daily-briefs/summary?date=YYYY-MM-DD - The day's brief from every project of the user,
// in sidebar order. The client sends its own local date, so "today" follows the user's clock.
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const date = req.nextUrl.searchParams.get("date") ?? "";
    if (!isDateKey(date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }

    const briefs = await db.dailyBrief.findMany({
      where: { date, project: { userId: auth.userId } },
      select: {
        content: true,
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ project: { orderIndex: "asc" } }, { project: { updatedAt: "desc" } }],
    });

    return NextResponse.json({
      date,
      projects: briefs.map((b) => ({
        projectId: b.project.id,
        projectName: b.project.name,
        color: b.project.color,
        content: b.content,
      })),
    });
  } catch (error) {
    console.error("Error building work summary:", error);
    return NextResponse.json({ error: "Failed to load today's briefs" }, { status: 500 });
  }
}
