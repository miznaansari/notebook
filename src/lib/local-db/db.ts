import Dexie, { type Table } from "dexie";
import type { ProjectSummary } from "@/components/layout/Sidebar";

// Local-first storage: projects, notes and daily briefs live in IndexedDB (one database per
// user) and the UI reads them from here. SyncEngine (./sync.ts) reconciles with the server.
// Flags are 0/1 numbers because IndexedDB can't index booleans.

export interface LocalNote {
  id: string;
  projectId: string;
  title: string;
  content: string;
  description: string | null;
  isPinned: boolean;
  tags: string | null;
  createdAt: string;
  updatedAt: string; // when it was last edited, on whichever device edited it
  dirty: 0 | 1; // has local changes the server hasn't accepted yet
  deleted: 0 | 1; // deleted on this device; row removed once the server confirms
  synced: 0 | 1; // known to exist on the server
}

export interface LocalBrief {
  projectId: string;
  date: string;
  content: string; // "" while a deletion is waiting to be pushed
  updatedAt: string;
  dirty: 0 | 1;
  synced: 0 | 1;
}

export type LocalProject = ProjectSummary & { createdAt?: string; updatedAt?: string };

interface MetaRow {
  key: string;
  value: string;
}

export class NotepadDB extends Dexie {
  projects!: Table<LocalProject, string>;
  notes!: Table<LocalNote, string>;
  briefs!: Table<LocalBrief, [string, string]>;
  meta!: Table<MetaRow, string>;

  constructor(userId: string) {
    super(databaseName(userId));
    this.version(1).stores({
      projects: "id",
      notes: "id, projectId, dirty",
      briefs: "[projectId+date], projectId, date, dirty",
      meta: "key",
    });
  }

  async getMeta(key: string): Promise<string | null> {
    return (await this.meta.get(key))?.value ?? null;
  }

  async setMeta(key: string, value: string) {
    await this.meta.put({ key, value });
  }
}

const databaseName = (userId: string) => `notepad-${userId}`;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

// The signed-in user is remembered so the workspace can open their local data (and work offline)
// before /api/auth/me answers; that request still decides whether the session is valid.
// Login and register overwrite it, so a different user never sees the previous one's copy.
const LAST_USER_KEY = "notepad:lastUser";

// Raw JSON string, so useSyncExternalStore gets a stable snapshot
export function readRememberedUserRaw(): string | null {
  try {
    return window.localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function parseRememberedUser(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    return typeof user?.id === "string" ? user : null;
  } catch {
    return null;
  }
}

export function rememberUser(user: SessionUser) {
  try {
    window.localStorage.setItem(LAST_USER_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email }));
  } catch {
    // Without storage the workspace just waits for /api/auth/me before showing local data
  }
}

// Logout: nothing of this user's stays on the device
export async function deleteLocalData(userId: string) {
  try {
    window.localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // ignore
  }
  await Dexie.delete(databaseName(userId));
}

export function nowIso() {
  return new Date().toISOString();
}

// IDs are created on the device so notes can be made offline. crypto.randomUUID needs a secure
// context (https/localhost); phones testing over a LAN IP fall back to getRandomValues.
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
