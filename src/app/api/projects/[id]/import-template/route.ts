import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { SYSTEM_TEMPLATES } from "@/lib/templates";

// POST /api/projects/[id]/import-template - Import question template into project
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
    const { templateId } = body;

    // Check system templates
    const sysTemplate = SYSTEM_TEMPLATES.find((t) => t.id === templateId);

    if (sysTemplate) {
      const createdQuestions = [];
      for (const q of sysTemplate.questions) {
        const createdQ = await db.question.create({
          data: {
            title: q.title,
            category: q.category,
            details: q.details || null,
            status: q.status || "PENDING",
            priority: q.priority || "MEDIUM",
            forNextMeeting: Boolean(q.forNextMeeting),
            projectId,
            answers: q.suggestedAnswer
              ? {
                  create: [
                    {
                      content: q.suggestedAnswer,
                      author: "Client",
                    },
                  ],
                }
              : undefined,
          },
        });
        createdQuestions.push(createdQ);
      }

      await db.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        count: createdQuestions.length,
        message: `Imported ${createdQuestions.length} questions from ${sysTemplate.title}`,
      });
    }

    // Check user custom templates
    const customTemplate = await db.questionTemplate.findFirst({
      where: { id: templateId, userId: auth.userId },
    });

    if (customTemplate) {
      try {
        const parsed = JSON.parse(customTemplate.content);
        if (Array.isArray(parsed)) {
          let count = 0;
          for (const item of parsed) {
            if (!item.title) continue;
            await db.question.create({
              data: {
                title: item.title,
                category: item.category || "General",
                details: item.details || null,
                status: item.status || "PENDING",
                priority: item.priority || "MEDIUM",
                forNextMeeting: Boolean(item.forNextMeeting),
                projectId,
              },
            });
            count++;
          }
          return NextResponse.json({
            success: true,
            count,
            message: `Imported ${count} questions from custom template`,
          });
        }
      } catch (err) {
        return NextResponse.json({ error: "Invalid template format" }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  } catch (error: any) {
    console.error("Error importing template:", error);
    return NextResponse.json({ error: "Failed to import template" }, { status: 500 });
  }
}
