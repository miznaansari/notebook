import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/sync/manifest - Every note and daily brief id of the user with its updatedAt.
// Devices diff this against their local copy to find what to download and what was deleted.
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [notes, briefs] = await Promise.all([
      db.note.findMany({
        where: { project: { userId: auth.userId } },
        select: { id: true, projectId: true, updatedAt: true },
      }),
      db.dailyBrief.findMany({
        where: { project: { userId: auth.userId } },
        select: { projectId: true, date: true, updatedAt: true },
      }),
    ]);

    return NextResponse.json({ notes, briefs });
  } catch (error) {
    console.error("Error building sync manifest:", error);
    return NextResponse.json({ error: "Failed to build sync manifest" }, { status: 500 });
  }
}
