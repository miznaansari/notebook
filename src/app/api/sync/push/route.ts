import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDateKey } from "@/lib/daily-brief";

const MAX_ITEMS = 500;
// A device clock running ahead could otherwise win every conflict forever
const MAX_CLOCK_LEAD_MS = 60_000;

interface IncomingNote {
  id: string;
  projectId: string;
  title?: string;
  content?: string;
  description?: string | null;
  isPinned?: boolean;
  tags?: string | null;
  createdAt?: string;
  updatedAt: string;
}

interface IncomingBrief {
  projectId: string;
  date: string;
  content: string;
  updatedAt: string;
}

const noteSelect = {
  id: true,
  projectId: true,
  title: true,
  content: true,
  description: true,
  isPinned: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} as const;

function editTime(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(Math.min(ms, Date.now() + MAX_CLOCK_LEAD_MS));
}

// POST /api/sync/push { notes, deletedNoteIds, briefs } - Apply a device's local changes.
// Last edit wins: each change carries the time it was made on the device; a change older than
// the server's copy is answered "stale" with that copy, which the device then adopts.
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const notes: IncomingNote[] = Array.isArray(body.notes) ? body.notes.slice(0, MAX_ITEMS) : [];
    const deletedNoteIds: string[] = Array.isArray(body.deletedNoteIds)
      ? body.deletedNoteIds.filter((id: unknown) => typeof id === "string").slice(0, MAX_ITEMS)
      : [];
    const briefs: IncomingBrief[] = Array.isArray(body.briefs) ? body.briefs.slice(0, MAX_ITEMS) : [];

    const ownedProjectIds = new Set(
      (await db.project.findMany({ where: { userId: auth.userId }, select: { id: true } })).map((p) => p.id)
    );
    const touchedProjects = new Set<string>();

    const noteResults = [];
    for (const incoming of notes) {
      const at = editTime(incoming?.updatedAt);
      if (typeof incoming?.id !== "string" || !at || !ownedProjectIds.has(incoming.projectId)) {
        noteResults.push({ id: incoming?.id, status: "rejected" as const });
        continue;
      }

      const existing = await db.note.findUnique({ where: { id: incoming.id }, select: noteSelect });
      if (existing && !ownedProjectIds.has(existing.projectId)) {
        noteResults.push({ id: incoming.id, status: "rejected" as const });
        continue;
      }
      if (existing && existing.updatedAt > at) {
        noteResults.push({ id: incoming.id, status: "stale" as const, server: existing });
        continue;
      }

      const data = {
        projectId: incoming.projectId,
        title: (incoming.title ?? "").trim() || "Untitled Note",
        content: incoming.content ?? "",
        description: incoming.description?.trim() || null,
        isPinned: Boolean(incoming.isPinned),
        tags: incoming.tags?.trim() || null,
        updatedAt: at,
      };
      if (existing) {
        await db.note.update({ where: { id: incoming.id }, data });
      } else {
        await db.note.create({ data: { ...data, id: incoming.id, createdAt: editTime(incoming.createdAt) ?? at } });
      }
      touchedProjects.add(incoming.projectId);
      noteResults.push({ id: incoming.id, status: "applied" as const });
    }

    if (deletedNoteIds.length > 0) {
      await db.note.deleteMany({ where: { id: { in: deletedNoteIds }, project: { userId: auth.userId } } });
    }

    const briefResults = [];
    for (const incoming of briefs) {
      const at = editTime(incoming?.updatedAt);
      if (!at || !ownedProjectIds.has(incoming?.projectId) || !isDateKey(incoming?.date ?? "")) {
        briefResults.push({ projectId: incoming?.projectId, date: incoming?.date, status: "rejected" as const });
        continue;
      }
      const key = { projectId_date: { projectId: incoming.projectId, date: incoming.date } };
      const existing = await db.dailyBrief.findUnique({
        where: key,
        select: { projectId: true, date: true, content: true, updatedAt: true },
      });
      if (existing && existing.updatedAt > at) {
        briefResults.push({ projectId: incoming.projectId, date: incoming.date, status: "stale" as const, server: existing });
        continue;
      }

      const content = typeof incoming.content === "string" ? incoming.content : "";
      if (!content.trim()) {
        await db.dailyBrief.deleteMany({ where: { projectId: incoming.projectId, date: incoming.date } });
      } else {
        await db.dailyBrief.upsert({
          where: key,
          create: { projectId: incoming.projectId, date: incoming.date, content, updatedAt: at },
          update: { content, updatedAt: at },
        });
      }
      touchedProjects.add(incoming.projectId);
      briefResults.push({ projectId: incoming.projectId, date: incoming.date, status: "applied" as const });
    }

    if (touchedProjects.size > 0) {
      await db.project.updateMany({ where: { id: { in: [...touchedProjects] } }, data: { updatedAt: new Date() } });
    }

    return NextResponse.json({ notes: noteResults, deletedNoteIds, briefs: briefResults });
  } catch (error) {
    console.error("Error applying sync push:", error);
    return NextResponse.json({ error: "Failed to save changes" }, { status: 500 });
  }
}
