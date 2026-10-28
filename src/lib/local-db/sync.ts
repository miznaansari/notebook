import type { LocalBrief, LocalNote, LocalProject, NotepadDB } from "./db";

// Sync protocol (see /api/sync/*):
//  1. push   - dirty notes/briefs and pending deletes go up. The server keeps whichever version was
//              edited last (by the edit time recorded on the device) and answers "applied" or
//              "stale" (+ its newer copy, which replaces ours).
//  2. pull   - the project list, then a manifest of every note/brief id + updatedAt. Rows whose
//              updatedAt differs are downloaded; rows missing on the server were deleted on another
//              device and are removed here (unless edited here meanwhile, then they're re-created).
// A row edited while a request is in flight keeps its dirty flag and goes up next round.

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  hasSyncedOnce: boolean;
}

type ServerNote = Omit<LocalNote, "dirty" | "deleted" | "synced">;
type ServerBrief = Omit<LocalBrief, "dirty" | "synced">;

interface PushResult {
  notes: { id: string; status: "applied" | "stale" | "rejected"; server?: ServerNote }[];
  deletedNoteIds: string[];
  briefs: { projectId: string; date: string; status: "applied" | "stale" | "rejected"; server?: ServerBrief | null }[];
}

const PERIODIC_SYNC_MS = 30_000;
const PULL_CHUNK = 200;
const LAST_SYNCED_KEY = "lastSyncedAt";

const noteFromServer = (n: ServerNote): LocalNote => ({
  id: n.id,
  projectId: n.projectId,
  title: n.title,
  content: n.content,
  description: n.description ?? null,
  isPinned: Boolean(n.isPinned),
  tags: n.tags ?? null,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
  dirty: 0,
  deleted: 0,
  synced: 1,
});

const briefFromServer = (b: ServerBrief): LocalBrief => ({
  projectId: b.projectId,
  date: b.date,
  content: b.content,
  updatedAt: b.updatedAt,
  dirty: 0,
  synced: 1,
});

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

export class SyncEngine {
  private state: SyncState = { status: "idle", lastSyncedAt: null, hasSyncedOnce: false };
  private listeners = new Set<(state: SyncState) => void>();
  private running: Promise<void> | null = null;
  private rerun = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private db: NotepadDB) {}

  getState() {
    return this.state;
  }

  subscribe(listener: (state: SyncState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  async start() {
    const lastSyncedAt = await this.db.getMeta(LAST_SYNCED_KEY);
    this.setState({ lastSyncedAt, hasSyncedOnce: lastSyncedAt !== null });

    window.addEventListener("online", this.onWake);
    window.addEventListener("focus", this.onWake);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.intervalTimer = setInterval(() => {
      if (document.visibilityState === "visible") this.syncNow();
    }, PERIODIC_SYNC_MS);
    return this.syncNow();
  }

  stop() {
    this.stopped = true;
    window.removeEventListener("online", this.onWake);
    window.removeEventListener("focus", this.onWake);
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private onWake = () => {
    this.syncNow();
  };

  private onVisibility = () => {
    // Leaving the tab: push now, the timer may not get to run in the background
    this.syncNow();
  };

  // Called after local edits: batch them into one push shortly after typing pauses
  schedule(delayMs = 2000) {
    if (this.stopped) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.syncNow(), delayMs);
  }

  // Single-flight: a call during a running sync queues exactly one more round
  syncNow(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.rerun = false;
        await this.cycle();
      } while (this.rerun && !this.stopped);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  async pendingChangeCount() {
    const [notes, briefs] = await Promise.all([
      this.db.notes.where("dirty").equals(1).count(),
      this.db.briefs.where("dirty").equals(1).count(),
    ]);
    return notes + briefs;
  }

  private async cycle() {
    if (!navigator.onLine) {
      this.setState({ status: "offline" });
      return;
    }
    this.setState({ status: "syncing" });
    try {
      await this.push();
      await this.pull();
      const at = new Date().toISOString();
      await this.db.setMeta(LAST_SYNCED_KEY, at);
      this.setState({ status: "idle", lastSyncedAt: at, hasSyncedOnce: true });
    } catch (err) {
      console.error("Sync failed:", err);
      this.setState({ status: navigator.onLine ? "error" : "offline" });
    }
  }

  private async push() {
    const [dirtyNotes, dirtyBriefs] = await Promise.all([
      this.db.notes.where("dirty").equals(1).toArray(),
      this.db.briefs.where("dirty").equals(1).toArray(),
    ]);
    if (dirtyNotes.length === 0 && dirtyBriefs.length === 0) return;

    const sentNotes = new Map(dirtyNotes.map((n) => [n.id, n.updatedAt]));
    const sentBriefs = new Map(dirtyBriefs.map((b) => [`${b.projectId}|${b.date}`, b.updatedAt]));

    const result = await postJson<PushResult>("/api/sync/push", {
      notes: dirtyNotes
        .filter((n) => !n.deleted)
        .map((n) => ({
          id: n.id,
          projectId: n.projectId,
          title: n.title,
          content: n.content,
          description: n.description,
          isPinned: n.isPinned,
          tags: n.tags,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        })),
      deletedNoteIds: dirtyNotes.filter((n) => n.deleted).map((n) => n.id),
      briefs: dirtyBriefs.map((b) => ({
        projectId: b.projectId,
        date: b.date,
        content: b.content,
        updatedAt: b.updatedAt,
      })),
    });

    await this.db.transaction("rw", this.db.notes, this.db.briefs, async () => {
      for (const r of result.notes) {
        const local = await this.db.notes.get(r.id);
        // Edited again while the request was in flight: leave it dirty for the next push
        if (!local || local.updatedAt !== sentNotes.get(r.id)) continue;
        if (r.status === "applied") await this.db.notes.put({ ...local, dirty: 0, synced: 1 });
        else if (r.status === "stale" && r.server) await this.db.notes.put(noteFromServer(r.server));
        else if (r.status === "rejected") await this.db.notes.delete(r.id); // its project is gone
      }
      for (const id of result.deletedNoteIds) {
        const local = await this.db.notes.get(id);
        if (local?.deleted) await this.db.notes.delete(id);
      }
      for (const r of result.briefs) {
        const key: [string, string] = [r.projectId, r.date];
        const local = await this.db.briefs.get(key);
        if (!local || local.updatedAt !== sentBriefs.get(`${r.projectId}|${r.date}`)) continue;
        if (r.status === "applied") {
          if (local.content.trim()) await this.db.briefs.put({ ...local, dirty: 0, synced: 1 });
          else await this.db.briefs.delete(key);
        } else if (r.status === "stale") {
          if (r.server) await this.db.briefs.put(briefFromServer(r.server));
          else await this.db.briefs.delete(key);
        } else {
          await this.db.briefs.delete(key);
        }
      }
    });
  }

  private async pull() {
    const [projectData, manifest] = await Promise.all([
      getJson<{ projects: LocalProject[] }>("/api/projects"),
      getJson<{
        notes: { id: string; projectId: string; updatedAt: string }[];
        briefs: { projectId: string; date: string; updatedAt: string }[];
      }>("/api/sync/manifest"),
    ]);

    const projects = projectData.projects ?? [];
    await this.db.transaction("rw", this.db.projects, async () => {
      const keep = new Set(projects.map((p) => p.id));
      const stale = (await this.db.projects.toCollection().primaryKeys()).filter((id) => !keep.has(id));
      await this.db.projects.bulkDelete(stale);
      await this.db.projects.bulkPut(projects);
    });

    const [localNotes, localBriefs] = await Promise.all([this.db.notes.toArray(), this.db.briefs.toArray()]);
    const localNoteById = new Map(localNotes.map((n) => [n.id, n]));
    const localBriefByKey = new Map(localBriefs.map((b) => [`${b.projectId}|${b.date}`, b]));
    const serverNoteIds = new Set(manifest.notes.map((n) => n.id));
    const serverBriefKeys = new Set(manifest.briefs.map((b) => `${b.projectId}|${b.date}`));

    const noteIdsToFetch = manifest.notes
      .filter((s) => {
        const local = localNoteById.get(s.id);
        return !local || (!local.dirty && local.updatedAt !== s.updatedAt);
      })
      .map((s) => s.id);
    const briefKeysToFetch = manifest.briefs.filter((s) => {
      const local = localBriefByKey.get(`${s.projectId}|${s.date}`);
      return !local || (!local.dirty && local.updatedAt !== s.updatedAt);
    });

    const fetchedNotes: ServerNote[] = [];
    const fetchedBriefs: ServerBrief[] = [];
    for (let i = 0; i < Math.max(noteIdsToFetch.length, briefKeysToFetch.length); i += PULL_CHUNK) {
      const chunk = await postJson<{ notes: ServerNote[]; briefs: ServerBrief[] }>("/api/sync/pull", {
        noteIds: noteIdsToFetch.slice(i, i + PULL_CHUNK),
        briefKeys: briefKeysToFetch
          .slice(i, i + PULL_CHUNK)
          .map((b) => ({ projectId: b.projectId, date: b.date })),
      });
      fetchedNotes.push(...chunk.notes);
      fetchedBriefs.push(...chunk.briefs);
    }

    await this.db.transaction("rw", this.db.notes, this.db.briefs, async () => {
      for (const server of fetchedNotes) {
        const local = await this.db.notes.get(server.id);
        if (local?.dirty) continue; // edited while downloading: our version goes up next push
        await this.db.notes.put(noteFromServer(server));
      }
      for (const server of fetchedBriefs) {
        const local = await this.db.briefs.get([server.projectId, server.date]);
        if (local?.dirty) continue;
        await this.db.briefs.put(briefFromServer(server));
      }

      // Gone from the server = deleted on another device
      for (const local of await this.db.notes.toArray()) {
        if (!local.synced || serverNoteIds.has(local.id)) continue;
        if (local.dirty && !local.deleted) {
          // Edited here after it was deleted elsewhere: keep the edit by re-creating it
          await this.db.notes.put({ ...local, synced: 0 });
        } else {
          await this.db.notes.delete(local.id);
        }
      }
      for (const local of await this.db.briefs.toArray()) {
        if (!local.synced || serverBriefKeys.has(`${local.projectId}|${local.date}`)) continue;
        if (local.dirty && local.content.trim()) await this.db.briefs.put({ ...local, synced: 0 });
        else await this.db.briefs.delete([local.projectId, local.date]);
      }
    });
  }
}
