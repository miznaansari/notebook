import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDateKey } from "@/lib/daily-brief";

const MAX_ITEMS = 500;

// POST /api/sync/pull { noteIds, briefKeys: [{ projectId, date }] } - Full rows for the given ids
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const noteIds: string[] = Array.isArray(body.noteIds)
      ? body.noteIds.filter((id: unknown) => typeof id === "string").slice(0, MAX_ITEMS)
      : [];
    const briefKeys: { projectId: string; date: string }[] = Array.isArray(body.briefKeys)
      ? body.briefKeys
          .filter((k: { projectId?: unknown; date?: unknown }) => typeof k?.projectId === "string" && typeof k?.date === "string" && isDateKey(k.date))
          .slice(0, MAX_ITEMS)
      : [];

    const [notes, briefs] = await Promise.all([
      noteIds.length
        ? db.note.findMany({
            where: { id: { in: noteIds }, project: { userId: auth.userId } },
            select: {
              id: true,
              projectId: true,
              title: true,
              content: true,
              description: true,
              isPinned: true,
              tags: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : [],
      briefKeys.length
        ? db.dailyBrief.findMany({
            where: {
              project: { userId: auth.userId },
              OR: briefKeys.map((k) => ({ projectId: k.projectId, date: k.date })),
            },
            select: { projectId: true, date: true, content: true, updatedAt: true },
          })
        : [],
    ]);

    return NextResponse.json({ notes, briefs });
  } catch (error) {
    console.error("Error pulling sync data:", error);
    return NextResponse.json({ error: "Failed to pull notes" }, { status: 500 });
  }
}
