import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/projects - List all projects for current user
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("archived") === "true";
    const query = searchParams.get("q") || "";

    const projects = await db.project.findMany({
      where: {
        userId: auth.userId,
        isArchived: includeArchived ? undefined : false,
        OR: query
          ? [
              { name: { contains: query } },
              { clientName: { contains: query } },
              { description: { contains: query } },
            ]
          : undefined,
      },
      include: {
        _count: {
          select: {
            notes: true,
            questions: true,
            meetings: true,
            tasks: true,
          },
        },
        questions: {
          where: {
            status: { not: "DELETED" },
          },
          select: {
            status: true,
            forNextMeeting: true,
          },
        },
        tasks: {
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const formattedProjects = projects.map((p) => {
      const pendingQuestionsCount = p.questions.filter(
        (q) => q.status === "PENDING" || q.status === "NEED_FOLLOWUP"
      ).length;
      const forNextMeetingCount = p.questions.filter((q) => q.forNextMeeting).length;
      const pendingTasksCount = p.tasks.filter((t) => t.status !== "COMPLETED").length;

      return {
        id: p.id,
        name: p.name,
        clientName: p.clientName,
        description: p.description,
        color: p.color,
        icon: p.icon,
        isArchived: p.isArchived,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        notesCount: p._count.notes,
        questionsCount: p._count.questions,
        meetingsCount: p._count.meetings,
        tasksCount: p._count.tasks,
        pendingQuestionsCount,
        forNextMeetingCount,
        pendingTasksCount,
      };
    });

    return NextResponse.json({ projects: formattedProjects });
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

// POST /api/projects - Create new project
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, clientName, description, color, icon, initialNoteTitle, initialNoteContent } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await db.project.create({
      data: {
        name: name.trim(),
        clientName: clientName?.trim() || null,
        description: description?.trim() || null,
        color: color || "#3B82F6",
        icon: icon || "folder",
        userId: auth.userId,
        notes: {
          create: [
            {
              title: initialNoteTitle || "Project Overview",
              content: initialNoteContent || `# ${name.trim()} - Project Workspace\n\n- Client: ${clientName || "Not specified"}\n- Created: ${new Date().toLocaleDateString()}\n\n## Quick Notes & Requirements\n`,
              isPinned: true,
              tags: "Overview",
            },
          ],
        },
      },
      include: {
        notes: true,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
