"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { summarizeBrief, type DailyBriefSummary } from "@/lib/daily-brief";
import { type LocalBrief, type LocalNote, type LocalProject, NotepadDB } from "./db";
import { LocalStore } from "./store";
import { SyncEngine, type SyncState } from "./sync";

interface LocalData {
  db: NotepadDB;
  store: LocalStore;
  sync: SyncEngine;
}

const LocalDataContext = React.createContext<LocalData | null>(null);

// Opens the user's local database and keeps it syncing while mounted
export function LocalDataProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [value] = React.useState<LocalData>(() => {
    const db = new NotepadDB(userId);
    const sync = new SyncEngine(db);
    const store = new LocalStore(db, () => sync.schedule());
    return { db, store, sync };
  });

  React.useEffect(() => {
    value.sync.start();
    return () => {
      value.sync.stop();
      value.db.close();
    };
  }, [value]);

  return <LocalDataContext.Provider value={value}>{children}</LocalDataContext.Provider>;
}

export function useLocalData(): LocalData {
  const value = React.useContext(LocalDataContext);
  if (!value) throw new Error("useLocalData must be used inside LocalDataProvider");
  return value;
}

export function useSyncState(): SyncState {
  const { sync } = useLocalData();
  return React.useSyncExternalStore(
    React.useCallback((onChange) => sync.subscribe(onChange), [sync]),
    () => sync.getState(),
    () => sync.getState()
  );
}

const byPinnedThenRecent = (a: LocalNote, b: LocalNote) =>
  Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt);

// useLiveQuery keeps returning the previous result while a query with new inputs runs, so each
// result carries the key it was read for and a mismatch is reported as "still loading" (undefined)
function useKeyedLiveQuery<T>(key: string, query: () => Promise<T>, deps: unknown[]): T | undefined {
  const result = useLiveQuery(async () => ({ key, value: await query() }), deps);
  return result && result.key === key ? result.value : undefined;
}

// undefined while the first read is in flight
export function useLocalNotes(projectId: string | null): LocalNote[] | undefined {
  const { db } = useLocalData();
  return useKeyedLiveQuery(
    projectId ?? "",
    async () =>
      projectId
        ? (await db.notes.where("projectId").equals(projectId).toArray())
            .filter((n) => !n.deleted)
            .sort(byPinnedThenRecent)
        : [],
    [db, projectId]
  );
}

// Projects in sidebar order, with note counts taken from this device (includes unsynced notes)
export function useLocalProjects(): LocalProject[] | undefined {
  const { db } = useLocalData();
  return useLiveQuery(async () => {
    const [projects, notes] = await Promise.all([db.projects.toArray(), db.notes.toArray()]);
    const counts = new Map<string, number>();
    for (const note of notes) {
      if (!note.deleted) counts.set(note.projectId, (counts.get(note.projectId) ?? 0) + 1);
    }
    return projects
      .map((p) => ({ ...p, notesCount: counts.get(p.id) ?? 0 }))
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }, [db]);
}

// Days with a brief in a project, newest first
export function useBriefIndex(projectId: string): DailyBriefSummary[] | undefined {
  const { db } = useLocalData();
  return useKeyedLiveQuery(
    projectId,
    async () =>
      (await db.briefs.where("projectId").equals(projectId).toArray())
        .filter((b) => b.content.trim())
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((b) => summarizeBrief(b.date, b.content)),
    [db, projectId]
  );
}

// undefined while loading, null when the day has no brief
export function useLocalBrief(projectId: string, date: string): LocalBrief | null | undefined {
  const { db } = useLocalData();
  return useKeyedLiveQuery(
    `${projectId}|${date}`,
    async () => (await db.briefs.get([projectId, date])) ?? null,
    [db, projectId, date]
  );
}
