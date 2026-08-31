import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/projects/[id]/questions/[questionId]/answers - Add answer
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId, questionId } = await params;

    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const body = await req.json();
    const { content, author, autoMarkAnswered } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Answer content cannot be empty." }, { status: 400 });
    }

    const answer = await db.answer.create({
      data: {
        content: content.trim(),
        author: author || "Client",
        questionId,
      },
    });

    // Optionally mark question as answered if requested
    if (autoMarkAnswered) {
      await db.question.update({
        where: { id: questionId },
        data: { status: "ANSWERED" },
      });
    }

    return NextResponse.json({ answer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to add answer" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/questions/[questionId]/answers - Delete answer
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;
    const { searchParams } = new URL(req.url);
    const answerId = searchParams.get("answerId");

    if (!answerId) return NextResponse.json({ error: "answerId is required" }, { status: 400 });

    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    await db.answer.delete({
      where: { id: answerId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete answer" }, { status: 500 });
  }
}
