import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/projects/[id]/questions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const forNextMeeting = searchParams.get("forNextMeeting");
    const query = searchParams.get("q");

    // Verify ownership
    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const questions = await db.question.findMany({
      where: {
        projectId,
        status: status && status !== "ALL" ? status : { not: "DELETED" },
        category: category && category !== "ALL" ? category : undefined,
        forNextMeeting: forNextMeeting === "true" ? true : undefined,
        OR: query
          ? [
              { title: { contains: query } },
              { details: { contains: query } },
              { category: { contains: query } },
            ]
          : undefined,
      },
      include: {
        answers: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [
        { orderIndex: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ questions });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

// POST /api/projects/[id]/questions - Create single question or batch questions
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

    // Check if batch creation
    if (Array.isArray(body.questions)) {
      const createdQuestions = [];
      for (const q of body.questions) {
        if (!q.title || !q.title.trim()) continue;
        const newQ = await db.question.create({
          data: {
            title: q.title.trim(),
            details: q.details?.trim() || null,
            category: q.category?.trim() || "General",
            status: q.status || "PENDING",
            priority: q.priority || "MEDIUM",
            forNextMeeting: Boolean(q.forNextMeeting),
            projectId,
            answers: q.suggestedAnswer
              ? {
                  create: [
                    {
                      content: q.suggestedAnswer.trim(),
                      author: "Client",
                    },
                  ],
                }
              : undefined,
          },
          include: {
            answers: true,
          },
        });
        createdQuestions.push(newQ);
      }

      await db.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({ questions: createdQuestions, count: createdQuestions.length }, { status: 201 });
    }

    const { title, details, category, status, priority, forNextMeeting, initialAnswer } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Question title is required." }, { status: 400 });
    }

    const categoryName = category?.trim() || "General";

    // Auto-create category in DB if it doesn't exist
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

    const question = await db.question.create({
      data: {
        title: title.trim(),
        details: details?.trim() || null,
        category: categoryName,
        status: status || "PENDING",
        priority: priority || "MEDIUM",
        forNextMeeting: Boolean(forNextMeeting),
        projectId,
        answers: initialAnswer
          ? {
              create: [
                {
                  content: initialAnswer.trim(),
                  author: "Client",
                },
              ],
            }
          : undefined,
      },
      include: {
        answers: true,
      },
    });

    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/questions - Batch reorder questions and update categories
export async function PATCH(
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
    const { items } = body; // Array of { id: string, orderIndex: number, category?: string }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Invalid items array" }, { status: 400 });
    }

    // Execute bulk updates in a transaction
    await db.$transaction(
      items.map((item) =>
        db.question.update({
          where: { id: item.id, projectId },
          data: {
            orderIndex: typeof item.orderIndex === "number" ? item.orderIndex : undefined,
            category: typeof item.category === "string" ? item.category : undefined,
          },
        })
      )
    );

    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed to reorder questions" }, { status: 500 });
  }
}
