// Note-to-note references written as [[Note Title]]. Links resolve by title (case-insensitive),
// and renaming a note rewrites links that point at it (see the note PUT route).

export const NOTE_LINK_PATTERN = /\[\[([^[\]\n]+?)\]\]/g;

// Titles that mean "not named yet": never used as link targets or rename sources
export const DEFAULT_NOTE_TITLES = ["", "new note", "untitled note", "untitled"];

export const normalizeNoteTitle = (title: string) => title.trim().toLowerCase();

export const isDefaultNoteTitle = (title: string) => DEFAULT_NOTE_TITLES.includes(normalizeNoteTitle(title));

export interface NoteLinkMatch {
  title: string;
  from: number;
  to: number;
}

export function findNoteLinks(text: string): NoteLinkMatch[] {
  const matches: NoteLinkMatch[] = [];
  for (const match of text.matchAll(NOTE_LINK_PATTERN)) {
    const title = match[1].trim();
    if (title) matches.push({ title, from: match.index, to: match.index + match[0].length });
  }
  return matches;
}

// Unique link titles in order of first appearance
export function extractNoteLinkTitles(text: string): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const { title } of findNoteLinks(text)) {
    const key = normalizeNoteTitle(title);
    if (!seen.has(key)) {
      seen.add(key);
      titles.push(title);
    }
  }
  return titles;
}

export function relinkNoteTitle(content: string, oldTitle: string, newTitle: string): string {
  const oldKey = normalizeNoteTitle(oldTitle);
  return content.replace(NOTE_LINK_PATTERN, (whole, title: string) =>
    normalizeNoteTitle(title) === oldKey ? `[[${newTitle.trim()}]]` : whole
  );
}
