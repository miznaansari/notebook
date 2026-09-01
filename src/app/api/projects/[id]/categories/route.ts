import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const DEFAULT_CATEGORIES = [
  "General",
  "User Management",
  "Payment",
  "Reports",
  "Technical",
  "Architecture",
];

// GET /api/projects/[id]/categories - List all categories for project
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
      include: {
        categories: {
          orderBy: { name: "asc" },
        },
        questions: {
          where: { status: { not: "DELETED" } },
          select: { category: true },
        },
      },
    });

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Seed default categories if project has no categories yet
    let dbCategories = project.categories;
    if (dbCategories.length === 0) {
      for (const catName of DEFAULT_CATEGORIES) {
        await db.questionCategory.create({
          data: { name: catName, projectId },
        });
      }
      dbCategories = await db.questionCategory.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
      });
    }

    // Merge any distinct category strings already used in questions
    const questionCatNames = Array.from(new Set(project.questions.map((q) => q.category).filter(Boolean)));
    const existingNames = new Set(dbCategories.map((c) => c.name.toLowerCase()));

    for (const qCat of questionCatNames) {
      if (!existingNames.has(qCat.toLowerCase())) {
        const created = await db.questionCategory.create({
          data: { name: qCat, projectId },
        });
        dbCategories.push(created);
        existingNames.add(qCat.toLowerCase());
      }
    }

    return NextResponse.json({ categories: dbCategories });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

// POST /api/projects/[id]/categories - Create a new category
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
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    // Check if category already exists (case-insensitive)
    const existing = await db.questionCategory.findFirst({
      where: {
        projectId,
        name,
      },
    });

    if (existing) {
      return NextResponse.json({ category: existing, message: "Category already exists" });
    }

    const newCategory = await db.questionCategory.create({
      data: {
        name,
        projectId,
      },
    });

    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/categories - Delete category
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    const project = await db.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    await db.questionCategory.delete({
      where: { id: categoryId, projectId },
    });

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
