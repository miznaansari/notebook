import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDefaultNoteTitle, normalizeNoteTitle, relinkNoteTitle } from "@/lib/note-links";

// GET /api/projects/[id]/notes/[noteId]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId, noteId } = await params;

    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const note = await db.note.findFirst({
      where: { id: noteId, projectId },
    });
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch note" }, { status: 500 });
  }
}

async function relinkProject(projectId: string, renamedNoteId: string, oldTitle: string, newTitle: string) {
  // `contains` narrows candidates (case-insensitive under the table collation); the exact rewrite happens in JS
  const needle = `[[${oldTitle.trim()}`;
  const [notes, briefs] = await Promise.all([
    db.note.findMany({
      where: { projectId, id: { not: renamedNoteId }, content: { contains: needle } },
      select: { id: true, content: true },
    }),
    db.dailyBrief.findMany({
      where: { projectId, content: { contains: needle } },
      select: { id: true, content: true },
    }),
  ]);

  const relinkedNotes: { id: string; content: string }[] = [];
  for (const n of notes) {
    const content = relinkNoteTitle(n.content, oldTitle, newTitle);
    if (content !== n.content) {
      await db.note.update({ where: { id: n.id }, data: { content } });
      relinkedNotes.push({ id: n.id, content });
    }
  }
  for (const b of briefs) {
    const content = relinkNoteTitle(b.content, oldTitle, newTitle);
    if (content !== b.content) {
      await db.dailyBrief.update({ where: { id: b.id }, data: { content } });
    }
  }
  return relinkedNotes;
}

// PUT /api/projects/[id]/notes/[noteId] - Auto-save / update
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId, noteId } = await params;

    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const existing = await db.note.findFirst({
      where: { id: noteId, projectId },
      select: { title: true },
    });
    if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    const body = await req.json();
    const { title, content, description, isPinned, tags } = body;

    const note = await db.note.update({
      where: { id: noteId },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        content: content !== undefined ? content : undefined,
        description: description !== undefined ? (description?.trim() || null) : undefined,
        isPinned: isPinned !== undefined ? Boolean(isPinned) : undefined,
        tags: tags !== undefined ? tags?.trim() || null : undefined,
      },
    });

    // Renamed: point [[Old Title]] links in this project's other notes and daily briefs at the new title.
    // Placeholder titles ("New Note", "Untitled Note") are skipped, so clearing a title mid-edit can't
    // hijack links. The caller merges relinkedNotes into its copy of the notes.
    let relinkedNotes: { id: string; content: string }[] = [];
    if (
      normalizeNoteTitle(existing.title) !== normalizeNoteTitle(note.title) &&
      !isDefaultNoteTitle(existing.title) &&
      !isDefaultNoteTitle(note.title)
    ) {
      relinkedNotes = await relinkProject(projectId, noteId, existing.title, note.title);
    }

    // Touch project
    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ note, relinkedNotes });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/notes/[noteId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId, noteId } = await params;

    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Scoped to the project, so a note id from another user's project can't be deleted through this one
    const { count } = await db.note.deleteMany({
      where: { id: noteId, projectId },
    });
    if (count === 0) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
