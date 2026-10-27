// Daily Brief helpers shared by the API routes and the notepad UI.
// A brief is keyed by the user's local calendar day as "YYYY-MM-DD"; keys sort as strings.

export interface DailyBriefSummary {
  date: string;
  preview: string;
  tasksDone: number;
  tasksTotal: number;
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateKey(value: string): boolean {
  const match = value.match(DATE_KEY);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDateKey(date) === value;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Local midnight of the key's day (never parse keys with `new Date(key)`: that reads them as UTC)
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function formatBriefDate(key: string, style: "long" | "short" = "long"): string {
  return fromDateKey(key).toLocaleDateString(undefined, style === "long"
    ? { weekday: "long", day: "numeric", month: "short", year: "numeric" }
    : { weekday: "short", day: "numeric", month: "short" });
}

const TASK_LINE = /^\s*-\s*\[([ xX])?\]/;

export function summarizeBrief(date: string, content: string): DailyBriefSummary {
  let tasksDone = 0;
  let tasksTotal = 0;
  for (const line of content.split("\n")) {
    const task = line.match(TASK_LINE);
    if (task) {
      tasksTotal++;
      if (task[1] === "x" || task[1] === "X") tasksDone++;
    }
  }
  const preview = content
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*-\s*\[[ xX]?\]\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return { date, preview, tasksDone, tasksTotal };
}

// Unchecked "- [ ] ..." lines from a brief, for carrying them over to today
export function openTaskLines(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => /^\s*-\s*\[ ?\]\s*\S/.test(line))
    .map((line) => line.trim());
}

export const DAILY_BRIEF_TEMPLATE = "## Top priorities\n- [ ] \n\n## Meetings\n- \n\n## Notes\n";

// Inline markdown a pasted summary shouldn't carry: [[links]], emphasis, code, highlight, underline
function plainInline(text: string): string {
  return text
    .replace(/\[\[([^[\]\n]+?)\]\]/g, "$1")
    .replace(/(\*\*|__|~~|==)(.+?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<\/?u>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// One point per meaningful brief line. Headings are dropped; unchecked tasks are marked pending.
export function briefToPoints(content: string): string[] {
  const points: string[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || /^#{1,6}\s/.test(line) || line === "---") continue;

    let text = line;
    let pending = false;
    const task = line.match(/^-\s*\[([ xX])?\]\s*(.*)$/);
    if (task) {
      pending = !(task[1] === "x" || task[1] === "X");
      text = task[2];
    } else {
      text = text.replace(/^(?:[-*•]|\d+[.)])(?:\s+|$)/, "").replace(/^>\s*/, "");
    }

    text = plainInline(text);
    if (text) points.push(pending ? `${text} (pending)` : text);
  }
  return points;
}

// "Project name" followed by "- point" lines, one block per project that has points
export function buildWorkSummary(entries: { projectName: string; content: string }[]): string {
  return entries
    .map((entry) => ({ name: entry.projectName, points: briefToPoints(entry.content) }))
    .filter((entry) => entry.points.length > 0)
    .map((entry) => `${entry.name}\n${entry.points.map((point) => `- ${point}`).join("\n")}`)
    .join("\n\n");
}
