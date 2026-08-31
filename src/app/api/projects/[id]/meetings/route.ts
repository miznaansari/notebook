import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/projects/[id]/meetings
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

    const meetings = await db.meeting.findMany({
      where: { projectId },
      include: {
        meetingQuestions: {
          include: {
            question: {
              include: {
                answers: true,
              },
            },
          },
        },
        tasks: true,
      },
      orderBy: {
        meetingDate: "desc",
      },
    });

    return NextResponse.json({ meetings });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }
}

// POST /api/projects/[id]/meetings - Create meeting
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
    const { title, meetingDate, purpose, location, attendees, notes, status, linkedQuestionIds, autoCreateTasks } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Meeting title is required." }, { status: 400 });
    }

    const meeting = await db.meeting.create({
      data: {
        title: title.trim(),
        meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
        purpose: purpose?.trim() || null,
        location: location?.trim() || "Google Meet",
        attendees: attendees?.trim() || null,
        notes: notes || "",
        status: status || "SCHEDULED",
        projectId,
        meetingQuestions: Array.isArray(linkedQuestionIds) && linkedQuestionIds.length > 0
          ? {
              create: linkedQuestionIds.map((qid: string) => ({
                questionId: qid,
              })),
            }
          : undefined,
      },
      include: {
        meetingQuestions: {
          include: {
            question: true,
          },
        },
      },
    });

    // Optional follow-up task generation
    if (Array.isArray(autoCreateTasks) && autoCreateTasks.length > 0) {
      for (const t of autoCreateTasks) {
        if (!t.title || !t.title.trim()) continue;
        await db.followUpTask.create({
          data: {
            title: t.title.trim(),
            description: t.description || null,
            priority: t.priority || "MEDIUM",
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            projectId,
            meetingId: meeting.id,
          },
        });
      }
    }

    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error: any) {
    console.error("Meeting creation error:", error);
    return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
  }
}
