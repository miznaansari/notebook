import { isDefaultNoteTitle, normalizeNoteTitle, relinkNoteTitle } from "@/lib/note-links";
import { type LocalBrief, type LocalNote, type NotepadDB, newId, nowIso } from "./db";

export type NotePatch = Partial<Pick<LocalNote, "title" | "content" | "description" | "isPinned" | "tags">>;

// Writes go to IndexedDB first and are marked dirty; onLocalChange tells the sync engine to push.
export class LocalStore {
  constructor(
    private db: NotepadDB,
    private onLocalChange: () => void
  ) {}

  async createNote(
    projectId: string,
    data: { title: string; content: string; tags?: string | null; description?: string | null; isPinned?: boolean }
  ): Promise<LocalNote> {
    const at = nowIso();
    const note: LocalNote = {
      id: newId(),
      projectId,
      title: data.title,
      content: data.content,
      description: data.description ?? null,
      isPinned: data.isPinned ?? false,
      tags: data.tags ?? null,
      createdAt: at,
      updatedAt: at,
      dirty: 1,
      deleted: 0,
      synced: 0,
    };
    await this.db.notes.add(note);
    this.onLocalChange();
    return note;
  }

  // Unchanged fields don't bump updatedAt, so a no-op save can't win a sync conflict.
  // A title change rewrites [[Old Title]] links in the project's other notes and briefs;
  // returns the ids of notes that were relinked.
  async updateNote(id: string, patch: NotePatch): Promise<string[]> {
    const relinked: string[] = [];
    let changed = false;

    await this.db.transaction("rw", this.db.notes, this.db.briefs, async () => {
      const existing = await this.db.notes.get(id);
      if (!existing || existing.deleted) return;
      changed = (Object.keys(patch) as (keyof NotePatch)[]).some((key) => existing[key] !== patch[key]);
      if (!changed) return;

      const at = nowIso();
      await this.db.notes.put({ ...existing, ...patch, updatedAt: at, dirty: 1 });

      const newTitle = patch.title;
      if (
        newTitle === undefined ||
        normalizeNoteTitle(newTitle) === normalizeNoteTitle(existing.title) ||
        isDefaultNoteTitle(existing.title) ||
        isDefaultNoteTitle(newTitle)
      ) {
        return;
      }

      const siblings = await this.db.notes.where("projectId").equals(existing.projectId).toArray();
      for (const note of siblings) {
        if (note.id === id || note.deleted) continue;
        const content = relinkNoteTitle(note.content, existing.title, newTitle);
        if (content !== note.content) {
          await this.db.notes.put({ ...note, content, updatedAt: at, dirty: 1 });
          relinked.push(note.id);
        }
      }
      const briefs = await this.db.briefs.where("projectId").equals(existing.projectId).toArray();
      for (const brief of briefs) {
        const content = relinkNoteTitle(brief.content, existing.title, newTitle);
        if (content !== brief.content) {
          await this.db.briefs.put({ ...brief, content, updatedAt: at, dirty: 1 });
        }
      }
    });

    if (changed) this.onLocalChange();
    return relinked;
  }

  // Never-synced notes just disappear; synced ones stay hidden until the server confirms the delete
  async deleteNote(id: string) {
    const existing = await this.db.notes.get(id);
    if (!existing) return;
    if (existing.synced) {
      await this.db.notes.put({ ...existing, deleted: 1, dirty: 1, updatedAt: nowIso() });
    } else {
      await this.db.notes.delete(id);
    }
    this.onLocalChange();
  }

  async getBrief(projectId: string, date: string): Promise<LocalBrief | undefined> {
    return this.db.briefs.get([projectId, date]);
  }

  // Clearing a brief removes the day (pushed as a delete if the server already has it)
  async saveBrief(projectId: string, date: string, content: string) {
    const existing = await this.db.briefs.get([projectId, date]);
    if (existing && existing.content === content) return;
    if (!content.trim() && !existing?.synced) {
      if (existing) await this.db.briefs.delete([projectId, date]);
      return;
    }
    await this.db.briefs.put({
      projectId,
      date,
      content,
      updatedAt: nowIso(),
      dirty: 1,
      synced: existing?.synced ?? 0,
    });
    this.onLocalChange();
  }
}
