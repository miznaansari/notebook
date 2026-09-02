import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/projects/[id]/tasks
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

    const tasks = await db.followUpTask.findMany({
      where: { projectId },
      include: {
        meeting: {
          select: { id: true, title: true, meetingDate: true },
        },
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// POST /api/projects/[id]/tasks - Create task
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

    // Bulk creation support: { tasks: [...] }
    if (Array.isArray(body.tasks) && body.tasks.length > 0) {
      const validTasks = body.tasks
        .filter((t: any) => t && t.title && t.title.trim())
        .map((t: any) => ({
          title: t.title.trim(),
          description: t.description?.trim() || null,
          priority: t.priority || "MEDIUM",
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          meetingId: t.meetingId || null,
          status: t.status || "PENDING",
          projectId,
        }));

      if (validTasks.length === 0) {
        return NextResponse.json({ error: "No valid tasks provided." }, { status: 400 });
      }

      // Create each task and include meeting info
      const createdTasks = await Promise.all(
        validTasks.map((t: any) =>
          db.followUpTask.create({
            data: t,
            include: {
              meeting: {
                select: { id: true, title: true, meetingDate: true },
              },
            },
          })
        )
      );

      await db.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({ tasks: createdTasks, count: createdTasks.length }, { status: 201 });
    }

    // Single task creation
    const { title, description, priority, dueDate, meetingId, status } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Task title is required." }, { status: 400 });
    }

    const task = await db.followUpTask.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
        meetingId: meetingId || null,
        status: status || "PENDING",
        projectId,
      },
      include: {
        meeting: {
          select: { id: true, title: true, meetingDate: true },
        },
      },
    });

    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create task(s)" }, { status: 500 });
  }
}
