// Remembers what the user had open (project, and the note within each project) so reopening
// the app lands in the same place. Storage can be unavailable (private mode, blocked site
// data, server render), so every access is best-effort and failures are ignored.

const PROJECT_KEY = "notepad:lastProjectId";
const noteKey = (projectId: string) => `notepad:lastNoteId:${projectId}`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked: remembering is a convenience, not a requirement
  }
}

export const getLastProjectId = () => read(PROJECT_KEY);
export const setLastProjectId = (projectId: string) => write(PROJECT_KEY, projectId);

export const getLastNoteId = (projectId: string) => read(noteKey(projectId));
export const setLastNoteId = (projectId: string, noteId: string) => write(noteKey(projectId), noteId);
