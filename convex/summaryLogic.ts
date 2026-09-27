export const MAX_SUMMARY_ITEMS = 5;
export const MAX_SUMMARY_ITEM_CHARS = 80;
const MAX_PROMPT_TITLES = 100;
const MAX_TITLE_CHARS = 200;

// Day-string bounds that bound the summaries index scan for one month.
export function monthRange(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${next.year}-${pad(next.month)}-01`,
  };
}

// Model output is untrusted: plain short items, markers stripped, hard caps.
export function clampSummary(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .map((line) => line.replace(/^([-*•]|\d+\.)\s*/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, MAX_SUMMARY_ITEM_CHARS))
    .slice(0, MAX_SUMMARY_ITEMS)
    .join("\n");
}

// Caps keep a runaway group from bloating the prompt.
export function buildPrompt(args: {
  day: string;
  repo: string;
  branch: string;
  titles: string[];
}): string {
  const bullets = args.titles
    .slice(0, MAX_PROMPT_TITLES)
    .map((title) => `- ${title.slice(0, MAX_TITLE_CHARS)}`)
    .join("\n");
  return [
    `Repo: ${args.repo}`,
    `Branch: ${args.branch || "(unknown)"}`,
    `Day: ${args.day}`,
    "Commits:",
    bullets,
  ].join("\n");
}
