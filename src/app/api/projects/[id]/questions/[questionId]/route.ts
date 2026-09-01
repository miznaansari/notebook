import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

// PUT /api/projects/[id]/questions/[questionId]
export async function PUT(
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
    const { title, details, category, status, priority, forNextMeeting, orderIndex } = body;

    const categoryName = category !== undefined ? category.trim() || "General" : undefined;

    if (categoryName) {
      const existingCat = await db.questionCategory.findFirst({
        where: { projectId, name: categoryName },
      });
      if (!existingCat) {
        await db.questionCategory.create({
          data: { name: categoryName, projectId },
        });
      }
    }

    const updated = await db.question.update({
      where: { id: questionId },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        details: details !== undefined ? details?.trim() || null : undefined,
        category: categoryName,
        status: status !== undefined ? status : undefined,
        priority: priority !== undefined ? priority : undefined,
        forNextMeeting: forNextMeeting !== undefined ? Boolean(forNextMeeting) : undefined,
        orderIndex: orderIndex !== undefined ? orderIndex : undefined,
      },
      include: {
        answers: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ question: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/questions/[questionId] - Soft delete question
export async function DELETE(
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

    // Soft delete: Mark question status as DELETED and remove from next meeting
    const updated = await db.question.update({
      where: { id: questionId },
      data: {
        status: "DELETED",
        forNextMeeting: false,
      },
    });

    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Question soft deleted", question: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
