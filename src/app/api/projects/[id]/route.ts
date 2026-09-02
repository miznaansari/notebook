import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/projects/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await db.project.findFirst({
      where: {
        id,
        userId: auth.userId,
      },
      include: {
        notes: {
          orderBy: [
            { isPinned: "desc" },
            { updatedAt: "desc" },
          ],
        },
        questions: {
          where: {
            status: { not: "DELETED" },
          },
          include: {
            answers: {
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: [
            { orderIndex: "asc" },
            { createdAt: "desc" },
          ],
        },
        meetings: {
          include: {
            meetingQuestions: {
              include: {
                question: true,
              },
            },
            tasks: true,
          },
          orderBy: {
            meetingDate: "desc",
          },
        },
        tasks: {
          include: {
            meeting: {
              select: { id: true, title: true, meetingDate: true },
            },
          },
          orderBy: [
            { status: "asc" },
            { dueDate: "asc" },
            { createdAt: "desc" },
          ],
        },
        categories: {
          orderBy: { name: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

// PUT /api/projects/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, clientName, description, color, icon, isArchived } = body;

    const project = await db.project.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updated = await db.project.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        clientName: clientName !== undefined ? clientName?.trim() || null : undefined,
        description: description !== undefined ? description?.trim() || null : undefined,
        color: color !== undefined ? color : undefined,
        icon: icon !== undefined ? icon : undefined,
        isArchived: isArchived !== undefined ? isArchived : undefined,
      },
    });

    return NextResponse.json({ project: updated });
  } catch (error: any) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await db.project.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await db.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Project deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
