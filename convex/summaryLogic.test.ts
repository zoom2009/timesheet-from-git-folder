import { describe, expect, test } from "bun:test";
import { buildPrompt, clampSummary, monthRange } from "./summaryLogic";

describe("monthRange", () => {
  test("start is the first day, end is the first day of the next month", () => {
    expect(monthRange(2026, 9)).toEqual({ start: "2026-09-01", end: "2026-10-01" });
  });

  test("december wraps to january of the next year", () => {
    expect(monthRange(2026, 12)).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });

  test("single-digit months are padded", () => {
    expect(monthRange(2026, 1).start).toBe("2026-01-01");
    expect(monthRange(2026, 1).end).toBe("2026-02-01");
  });
});

describe("clampSummary", () => {
  test("keeps one item per line and trims each", () => {
    expect(clampSummary("  fixed login bug \n added tests ")).toBe("fixed login bug\nadded tests");
  });

  test("collapses whitespace runs inside an item", () => {
    expect(clampSummary("fixed\n\nlogin   bug")).toBe("fixed\nlogin bug");
  });

  test("strips bullet and number prefixes", () => {
    expect(clampSummary("- fixed login\n• trimmed hash\n1. faster scan")).toBe(
      "fixed login\ntrimmed hash\nfaster scan"
    );
  });

  test("drops empty lines", () => {
    expect(clampSummary("one\n\n   \ntwo")).toBe("one\ntwo");
  });

  test("caps each item at 80 characters", () => {
    expect(clampSummary("x".repeat(150))).toBe("x".repeat(80));
  });

  test("keeps at most 5 items", () => {
    const six = Array.from({ length: 6 }, (_, i) => `item ${i}`).join("\n");
    expect(clampSummary(six)).toBe("item 0\nitem 1\nitem 2\nitem 3\nitem 4");
  });

  test("blank input becomes an empty string", () => {
    expect(clampSummary("   \n\n")).toBe("");
  });

  test("a single line stays a single item", () => {
    expect(clampSummary("fixed the login bug")).toBe("fixed the login bug");
  });
});

describe("buildPrompt", () => {
  test("includes repo, branch, day and every title as a bullet", () => {
    const prompt = buildPrompt({
      day: "2026-09-27",
      repo: "timesheet",
      branch: "main",
      titles: ["feat: add button", "fix: trim hash"],
    });
    expect(prompt).toContain("Repo: timesheet");
    expect(prompt).toContain("Branch: main");
    expect(prompt).toContain("Day: 2026-09-27");
    expect(prompt).toContain("- feat: add button");
    expect(prompt).toContain("- fix: trim hash");
  });

  test("caps at 100 titles and 200 chars per title", () => {
    const titles = Array.from({ length: 101 }, (_, i) => `title ${i}`);
    const prompt = buildPrompt({ day: "2026-09-27", repo: "r", branch: "b", titles });
    expect(prompt).toContain("- title 99");
    expect(prompt).not.toContain("- title 100");

    const long = buildPrompt({ day: "d", repo: "r", branch: "b", titles: ["z".repeat(250)] });
    expect(long).not.toContain("z".repeat(201));
    expect(long).toContain("z".repeat(200));
  });

  test("empty branch falls back to (unknown)", () => {
    const prompt = buildPrompt({ day: "d", repo: "r", branch: "", titles: ["a"] });
    expect(prompt).toContain("Branch: (unknown)");
  });
});
