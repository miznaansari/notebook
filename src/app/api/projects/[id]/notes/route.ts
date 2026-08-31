import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/projects/[id]/notes
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;

    // Verify ownership
    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const notes = await db.note.findMany({
      where: { projectId },
      orderBy: [
        { isPinned: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return NextResponse.json({ notes });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

// POST /api/projects/[id]/notes - Create note
export async function POST(
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

    const body = await req.json();
    const { title, content, isPinned, tags } = body;

    const note = await db.note.create({
      data: {
        title: title?.trim() || "Untitled Note",
        content: content || "",
        isPinned: Boolean(isPinned),
        tags: tags?.trim() || null,
        projectId,
      },
    });

    // Touch project updatedAt
    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
