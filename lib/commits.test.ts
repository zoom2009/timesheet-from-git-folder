import { describe, expect, test } from "bun:test";
import { availableYears, bangkokDay, groupByBranch, groupByDay, parseLog } from "./commits";

// git log puts \x1f between fields and \x1e after each record.
const rec = (ref: string, hash: string, iso: string, title: string) =>
  `${ref}\x1f${hash}\x1f${iso}\x1f${title}\x1e`;

describe("parseLog", () => {
  test("parses multiple records", () => {
    const raw =
      rec("refs/heads/develop", "a1", "2026-09-26T16:57:52+07:00", "feat: one") +
      rec("refs/heads/feature/x", "b2", "2026-09-25T10:00:00+07:00", "fix: two");
    expect(parseLog("repo-x", raw)).toEqual([
      { repo: "repo-x", hash: "a1", iso: "2026-09-26T16:57:52+07:00", title: "feat: one", branch: "develop" },
      { repo: "repo-x", hash: "b2", iso: "2026-09-25T10:00:00+07:00", title: "fix: two", branch: "feature/x" },
    ]);
  });

  test("cleans branch refs", () => {
    const raw =
      rec("refs/heads/develop", "a1", "2026-09-26T16:57:52+07:00", "one") +
      rec("refs/remotes/origin/fixbug/x", "b2", "2026-09-25T10:00:00+07:00", "two") +
      rec("refs/tags/v1.0", "c3", "2026-09-24T10:00:00+07:00", "three");
    expect(parseLog("repo-x", raw).map((c) => c.branch)).toEqual(["develop", "fixbug/x", "v1.0"]);
  });

  test("trims the newline git puts between records", () => {
    const raw =
      rec("refs/heads/main", "a1", "2026-09-26T16:57:52+07:00", "feat: one") +
      "\n" +
      rec("refs/heads/main", "b2", "2026-09-25T10:00:00+07:00", "fix: two");
    const commits = parseLog("repo-x", raw);
    expect(commits.map((c) => c.hash)).toEqual(["a1", "b2"]);
    expect(commits.map((c) => c.branch)).toEqual(["main", "main"]);
  });

  test("keeps thai titles and quotes", () => {
    const raw = rec("refs/heads/chore/x", "c3", "2026-09-24T09:00:00+07:00", 'แก้บั๊ก "player" (ด่วน)');
    expect(parseLog("repo-x", raw)[0].title).toBe('แก้บั๊ก "player" (ด่วน)');
  });

  test("empty output gives no commits", () => {
    expect(parseLog("repo-x", "")).toEqual([]);
  });
});

describe("bangkokDay", () => {
  test("late UTC commit lands on the next bangkok day", () => {
    expect(bangkokDay("2026-09-27T23:30:00Z")).toBe("2026-09-28");
  });

  test("early +07 commit stays on the same day", () => {
    expect(bangkokDay("2026-09-27T00:30:00+07:00")).toBe("2026-09-27");
  });
});

describe("groupByDay", () => {
  const commits = [
    { repo: "b", hash: "1", iso: "2026-09-26T10:00:00+07:00", title: "b1", branch: "develop" },
    { repo: "a", hash: "2", iso: "2026-09-26T09:00:00+07:00", title: "a1", branch: "develop" },
    { repo: "a", hash: "3", iso: "2026-09-26T08:00:00+07:00", title: "a2", branch: "develop" },
    { repo: "a", hash: "4", iso: "2026-09-24T08:00:00+07:00", title: "a3", branch: "develop" },
    { repo: "z", hash: "5", iso: "2026-08-31T08:00:00+07:00", title: "z1", branch: "develop" },
  ];

  test("filters to the month and sorts days newest first", () => {
    expect(groupByDay(commits, 2026, 9).map((g) => g.day)).toEqual(["2026-09-26", "2026-09-24"]);
  });

  test("groups repos by count desc, then name, keeping commit order", () => {
    const day = groupByDay(commits, 2026, 9)[0];
    expect(day.repos.map((r) => r.name)).toEqual(["a", "b"]);
    expect(day.repos[0].commits.map((c) => c.title)).toEqual(["a1", "a2"]);
  });

  test("keeps other months when selected", () => {
    expect(groupByDay(commits, 2026, 8).map((g) => g.day)).toEqual(["2026-08-31"]);
  });
});

describe("groupByBranch", () => {
  const commits = [
    { repo: "r", hash: "1", iso: "2026-09-26T10:00:00+07:00", title: "newest", branch: "feature/x" },
    { repo: "r", hash: "2", iso: "2026-09-26T09:00:00+07:00", title: "middle", branch: "develop" },
    { repo: "r", hash: "3", iso: "2026-09-26T08:00:00+07:00", title: "oldest", branch: "feature/x" },
  ];

  test("groups commits by branch in first-seen order", () => {
    const groups = groupByBranch(commits);
    expect(groups.map((g) => g.branch)).toEqual(["feature/x", "develop"]);
    expect(groups[0].commits.map((c) => c.title)).toEqual(["newest", "oldest"]);
  });

  test("empty input gives no groups", () => {
    expect(groupByBranch([])).toEqual([]);
  });
});

describe("availableYears", () => {
  test("lists years desc after bangkok conversion", () => {
    const commits = [
      { repo: "r", hash: "1", iso: "2025-01-01T00:30:00+07:00", title: "x", branch: "main" },
      { repo: "r", hash: "2", iso: "2026-06-01T00:30:00+07:00", title: "y", branch: "main" },
      { repo: "r", hash: "3", iso: "2026-02-01T00:30:00+07:00", title: "z", branch: "main" },
    ];
    expect(availableYears(commits)).toEqual([2026, 2025]);
  });
});
