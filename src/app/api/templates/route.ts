import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { SYSTEM_TEMPLATES } from "@/lib/templates";

// GET /api/templates
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    let customTemplates: any[] = [];

    if (auth) {
      customTemplates = await db.questionTemplate.findMany({
        where: { userId: auth.userId },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({
      systemTemplates: SYSTEM_TEMPLATES,
      customTemplates,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

// POST /api/templates - Create custom template
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { title, description, content } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const template = await db.questionTemplate.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        content: typeof content === "string" ? content : JSON.stringify(content),
        userId: auth.userId,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
