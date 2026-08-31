import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

// PUT /api/projects/[id]/meetings/[meetingId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId, meetingId } = await params;

    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const body = await req.json();
    const { title, meetingDate, purpose, location, attendees, notes, status, linkedQuestionIds } = body;

    // Update meeting details
    const updated = await db.meeting.update({
      where: { id: meetingId },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        meetingDate: meetingDate !== undefined ? new Date(meetingDate) : undefined,
        purpose: purpose !== undefined ? purpose?.trim() || null : undefined,
        location: location !== undefined ? location?.trim() || "Google Meet" : undefined,
        attendees: attendees !== undefined ? attendees?.trim() || null : undefined,
        notes: notes !== undefined ? notes : undefined,
        status: status !== undefined ? status : undefined,
      },
    });

    // Sync linked questions if provided
    if (Array.isArray(linkedQuestionIds)) {
      await db.meetingQuestion.deleteMany({
        where: { meetingId },
      });

      if (linkedQuestionIds.length > 0) {
        await db.meetingQuestion.createMany({
          data: linkedQuestionIds.map((qid: string) => ({
            meetingId,
            questionId: qid,
          })),
        });
      }
    }

    const completeMeeting = await db.meeting.findUnique({
      where: { id: meetingId },
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
    });

    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ meeting: completeMeeting });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/meetings/[meetingId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId, meetingId } = await params;

    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    await db.meeting.delete({
      where: { id: meetingId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete meeting" }, { status: 500 });
  }
}
