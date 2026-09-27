# Git Timesheet Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **COMMIT POLICY — READ FIRST:** The user forbids commits. `git commit` (and amend/rebase/etc.) must NEVER be run. Every "Checkpoint" step means: leave all changes in the working tree, report the changed files, and wait for the user to review. Do not run `git add` either, unless the user asks.

**Goal:** A local Next.js dashboard that scans all git repos under `/Users/you/projects`, keeps only the user's own commits, and shows a Thai day-by-day summary for a user-selected year + month (both required).

**Architecture:** A `GET /api/commits` Route Handler (Node runtime) shells out to `git log` for every repo it finds and returns all ~1,505 commits as JSON. The client page (`app/page.tsx`) filters and groups them by Bangkok day in memory. Pure helpers live in `lib/commits.ts` (client-safe, unit-tested); all Node-only code lives in `lib/git-scan.ts` so the client bundle never imports `node:child_process`.

**Tech Stack:** Next.js 16.3.6 (App Router), React 19, TypeScript strict, Tailwind CSS 4, bun (runtime + built-in test runner). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-27-git-timesheet-dashboard-design.md`

---

## Verified facts (already checked on this machine — do not re-derive)

- 19 git repos exist under `~/projects` (2 non-git folders: `robot-framework`, `videos` — skipped silently).
- The user's 3 author emails: `you@example.com`, `you@work.example`, `you@ext.example`.
- Non-merge commits by the user across all repos: **1,505**. `example-repo` alone: 501. Newest commit is `2026-09-26T16:57:52+07:00` "feat: add analytics tracking plugin".
- The exact git command below was run and verified: fields are separated by `\x1f`, records end with `\x1e`, and git inserts a newline `\n` BETWEEN records (no final newline). `parseLog` trims the hash because of that inter-record `\n`.
- Next 16 route handlers (docs already read at `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`): `export async function GET()` in `app/api/commits/route.ts`; NOT cached by default; `Response.json()` works; no extra route config needed; Node runtime is the default so `node:child_process` works.
- `tsconfig.json` maps `@/*` to the project root, so `@/lib/commits` resolves.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `lib/commits.ts` | Create | Types + pure helpers: `parseLog`, `bangkokDay`, `groupByDay`, `availableYears` (client-safe) |
| `lib/commits.test.ts` | Create | bun tests for the pure helpers |
| `lib/git-scan.ts` | Create | Server-only: `TRUE_PROJECTS_DIR`, `AUTHOR_EMAILS`, `buildLogArgs`, `scanRepos` |
| `app/api/commits/route.ts` | Create | `GET /api/commits` handler |
| `app/page.tsx` | Replace | `"use client"` Thai dashboard UI |
| `app/layout.tsx` | Modify | `lang="th"`, metadata title "Timesheet" |

No other files change. One devDependency was added during Task 1 execution: `@types/bun@1.4.2` (type declarations for `bun:test` so `tsc --noEmit` passes; no runtime impact).

---

### Task 1: Pure helpers (`lib/commits.ts`) with tests

**Files:**
- Create: `lib/commits.test.ts`
- Create: `lib/commits.ts`

- [ ] **Step 1: Write the failing test file**

Create `lib/commits.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { availableYears, bangkokDay, groupByDay, parseLog } from "./commits";

// git log puts \x1f between fields and \x1e after each record.
const rec = (hash: string, iso: string, title: string) => `${hash}\x1f${iso}\x1f${title}\x1e`;

describe("parseLog", () => {
  test("parses multiple records", () => {
    const raw =
      rec("a1", "2026-09-26T16:57:52+07:00", "feat: one") +
      rec("b2", "2026-09-25T10:00:00+07:00", "fix: two");
    expect(parseLog("repo-x", raw)).toEqual([
      { repo: "repo-x", hash: "a1", iso: "2026-09-26T16:57:52+07:00", title: "feat: one" },
      { repo: "repo-x", hash: "b2", iso: "2026-09-25T10:00:00+07:00", title: "fix: two" },
    ]);
  });

  test("keeps thai titles and quotes", () => {
    const raw = rec("c3", "2026-09-24T09:00:00+07:00", 'แก้บั๊ก "player" (ด่วน)');
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
    { repo: "b", hash: "1", iso: "2026-09-26T10:00:00+07:00", title: "b1" },
    { repo: "a", hash: "2", iso: "2026-09-26T09:00:00+07:00", title: "a1" },
    { repo: "a", hash: "3", iso: "2026-09-26T08:00:00+07:00", title: "a2" },
    { repo: "a", hash: "4", iso: "2026-09-24T08:00:00+07:00", title: "a3" },
    { repo: "z", hash: "5", iso: "2026-08-31T08:00:00+07:00", title: "z1" },
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

describe("availableYears", () => {
  test("lists years desc after bangkok conversion", () => {
    const commits = [
      { repo: "r", hash: "1", iso: "2025-01-01T00:30:00+07:00", title: "x" },
      { repo: "r", hash: "2", iso: "2026-06-01T00:30:00+07:00", title: "y" },
      { repo: "r", hash: "3", iso: "2026-02-01T00:30:00+07:00", title: "z" },
    ];
    expect(availableYears(commits)).toEqual([2026, 2025]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from the project root `/Users/you/projects/timesheet`):

```bash
bun test lib/commits.test.ts
```

Expected: FAIL — module not found / cannot resolve `./commits`.

- [ ] **Step 3: Write `lib/commits.ts`**

Create `lib/commits.ts`:

```ts
export type Commit = { repo: string; hash: string; iso: string; title: string };

export type ScanError = { repo: string; message: string };

export type ScanResult = {
  scannedAt: string;
  repoCount: number;
  commits: Commit[];
  errors: ScanError[];
};

export type DayGroup = { day: string; repos: { name: string; commits: Commit[] }[] };

// git log puts \x1f between fields and \x1e after each record.
export function parseLog(repo: string, raw: string): Commit[] {
  return raw
    .split("\x1e")
    .filter((record) => record.trim() !== "")
    .map((record) => {
      const [hash, iso, ...titleParts] = record.split("\x1f");
      return { repo, hash, iso, title: titleParts.join("\x1f").trim() };
    });
}

// Fixed +07:00 formatter so a late-night commit groups on the right day.
const bangkokDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function bangkokDay(iso: string): string {
  return bangkokDate.format(new Date(iso));
}

export function groupByDay(commits: Commit[], year: number, month: number): DayGroup[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const byDay = new Map<string, Map<string, Commit[]>>();

  for (const commit of commits) {
    const day = bangkokDay(commit.iso);
    if (!day.startsWith(prefix)) continue;
    const dayRepos = byDay.get(day) ?? new Map<string, Commit[]>();
    const repoCommits = dayRepos.get(commit.repo) ?? [];
    repoCommits.push(commit);
    dayRepos.set(commit.repo, repoCommits);
    byDay.set(day, dayRepos);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, dayRepos]) => ({
      day,
      repos: [...dayRepos.entries()]
        .map(([name, repoCommits]) => ({ name, commits: repoCommits }))
        .sort((a, b) => b.commits.length - a.commits.length || a.name.localeCompare(b.name)),
    }));
}

export function availableYears(commits: Commit[]): number[] {
  const years = new Set(commits.map((c) => Number(bangkokDay(c.iso).slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
bun test lib/commits.test.ts
```

Expected: `10 pass, 0 fail` (9 planned + 1 regression test added post-review for the inter-record newline; see self-review notes).

- [ ] **Step 5: Checkpoint (no commit)**

Report to the user: `lib/commits.ts` and `lib/commits.test.ts` created, 9 tests pass. Leave changes in the working tree.

---

### Task 2: Server scan + API route

**Files:**
- Create: `lib/git-scan.ts`
- Create: `app/api/commits/route.ts`

- [ ] **Step 1: Write `lib/git-scan.ts`**

```ts
import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseLog, type Commit, type ScanError, type ScanResult } from "./commits";

export const TRUE_PROJECTS_DIR =
  process.env.TRUE_PROJECTS_DIR ?? "/Users/you/projects";

export const AUTHOR_EMAILS = [
  "you@example.com",
  "you@work.example",
  "you@ext.example",
];

export function buildLogArgs(dir: string): string[] {
  return [
    "-C",
    dir,
    "log",
    "--all",
    "--no-merges",
    "-i",
    ...AUTHOR_EMAILS.flatMap((email) => ["--author", email]),
    "--pretty=format:%H%x1f%aI%x1f%s%x1e",
  ];
}

function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { maxBuffer: 16 * 1024 * 1024, timeout: 30_000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

// git failures carry the useful text in stderr, not in .message.
function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "stderr" in err) {
    const stderr = String((err as { stderr?: unknown }).stderr ?? "").trim();
    if (stderr) return stderr;
  }
  return err instanceof Error ? err.message : String(err);
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await stat(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

export async function scanRepos(): Promise<ScanResult> {
  const entries = await readdir(TRUE_PROJECTS_DIR, { withFileTypes: true }).catch(() => {
    throw new Error(`อ่านโฟลเดอร์ไม่ได้: ${TRUE_PROJECTS_DIR}`);
  });

  const repos: { name: string; dir: string }[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(TRUE_PROJECTS_DIR, entry.name);
    if (await isGitRepo(dir)) repos.push({ name: entry.name, dir });
  }

  // ponytail: all repos scanned at once; add a concurrency cap if the repo count grows a lot.
  const results = await Promise.all(
    repos.map(async (repo) => {
      try {
        const stdout = await runGit(buildLogArgs(repo.dir));
        return { commits: parseLog(repo.name, stdout), errors: [] as ScanError[] };
      } catch (err) {
        return { commits: [] as Commit[], errors: [{ repo: repo.name, message: errorMessage(err) }] };
      }
    })
  );

  return {
    scannedAt: new Date().toISOString(),
    repoCount: repos.length,
    commits: results.flatMap((r) => r.commits),
    errors: results.flatMap((r) => r.errors),
  };
}
```

- [ ] **Step 2: Write `app/api/commits/route.ts`**

```ts
import { scanRepos } from "@/lib/git-scan";

export async function GET() {
  try {
    return Response.json(await scanRepos());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify the scan function alone (before touching the server)**

Run from the project root:

```bash
cd /Users/you/projects/timesheet && bun -e 'import("/Users/you/projects/timesheet/lib/git-scan.ts").then(async (m) => { const r = await m.scanRepos(); console.log(r.repoCount, r.commits.length, r.errors.length); })'
```

Expected output: `19 1505 0` (counts grow over time as the user commits; repos must be 19 and errors 0). Takes a few seconds.

- [ ] **Step 4: Start the dev server and hit the API**

Run in a background terminal:

```bash
cd /Users/you/projects/timesheet && bun run dev
```

Wait for "Ready", then:

```bash
curl -s http://localhost:3000/api/commits | head -c 200
```

Expected: JSON starting with `{"scannedAt":"20...","repoCount":19,"commits":[{"repo":...`. First request compiles the route and can take several seconds. Also confirm the response contains `"errors":[]`.

Keep the dev server running for Task 3.

- [ ] **Step 5: Checkpoint (no commit)**

Report: files created, scan returns 19 repos / 1,505 commits / 0 errors, API responds with the expected JSON shape.

---

### Task 3: Thai dashboard UI

**Files:**
- Replace: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

Full new content:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { availableYears, groupByDay, type Commit, type ScanError } from "@/lib/commits";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

type Scan =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      scannedAt: string;
      repoCount: number;
      commits: Commit[];
      errors: ScanError[];
    };

// "2026-09-26" → "26 กันยายน 2026"
function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${date} ${THAI_MONTHS[month - 1]} ${year}`;
}

const selectClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default function Home() {
  const [scan, setScan] = useState<Scan>({ status: "loading" });
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");

  const load = useCallback(async () => {
    setScan({ status: "loading" });
    try {
      const res = await fetch("/api/commits");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setScan({ status: "ready", ...(await res.json()) });
    } catch (err) {
      setScan({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const years = useMemo(
    () => (scan.status === "ready" ? availableYears(scan.commits) : []),
    [scan]
  );

  const groups = useMemo(() => {
    if (scan.status !== "ready" || !year || !month) return null;
    return groupByDay(scan.commits, Number(year), Number(month));
  }, [scan, year, month]);

  const totals = useMemo(() => {
    if (!groups) return null;
    const commits = groups.reduce(
      (sum, g) => sum + g.repos.reduce((n, r) => n + r.commits.length, 0),
      0
    );
    const repos = new Set(groups.flatMap((g) => g.repos.map((r) => r.name))).size;
    return { commits, repos, days: groups.length };
  }, [groups]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 font-sans">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timesheet</h1>
          {scan.status === "ready" && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              อ่านข้อมูล {scan.repoCount} repos · {scan.commits.length.toLocaleString()} commits ·{" "}
              {new Date(scan.scannedAt).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <button
          onClick={() => void load()}
          disabled={scan.status === "loading"}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          รีเฟรช
        </button>
      </header>

      {scan.status === "ready" && scan.errors.length > 0 && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          อ่านบาง repo ไม่สำเร็จ: {scan.errors.map((e) => e.repo).join(", ")}
        </p>
      )}

      <section className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          ปี
          <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
            <option value="">เลือกปี</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          เดือน
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectClass}>
            <option value="">เลือกเดือน</option>
            {THAI_MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mt-8">
        {scan.status === "loading" && (
          <p className="text-zinc-500 dark:text-zinc-400">กำลังอ่าน git history...</p>
        )}

        {scan.status === "error" && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            อ่านข้อมูลไม่สำเร็จ: {scan.message}
          </p>
        )}

        {scan.status === "ready" && !groups && (
          <p className="text-zinc-500 dark:text-zinc-400">เลือกปีและเดือนเพื่อดูข้อมูล</p>
        )}

        {groups &&
          totals &&
          (groups.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">ไม่มี commits ในเดือนนี้</p>
          ) : (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {totals.commits} commits · {totals.repos} repos · {totals.days} วัน
              </p>
              <ol className="mt-4 flex flex-col gap-6">
                {groups.map((group) => {
                  const dayCount = group.repos.reduce((n, r) => n + r.commits.length, 0);
                  return (
                    <li
                      key={group.day}
                      className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                        <h2 className="font-medium">{formatDay(group.day)}</h2>
                        <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium dark:bg-zinc-800">
                          {dayCount} commits
                        </span>
                      </div>
                      <div className="flex flex-col gap-4 px-4 py-4">
                        {group.repos.map((repo) => (
                          <div key={repo.name}>
                            <h3 className="text-sm font-semibold">
                              {repo.name}
                              <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                                {repo.commits.length} commits
                              </span>
                            </h3>
                            <ul className="mt-1.5 flex list-disc flex-col gap-0.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                              {repo.commits.map((commit) => (
                                <li key={commit.hash}>{commit.title}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

Change only these three spots (keep `LayoutProps<"/">` and everything else untouched):

1. Metadata:

```tsx
export const metadata: Metadata = {
  title: "Timesheet",
  description: "สรุป commits รายวันจากทุก git repo",
};
```

2. In the returned JSX, change the `<html>` opening tag's `lang` attribute from `"en"` to `"th"`.

- [ ] **Step 3: Verify in the browser**

With the dev server still running from Task 2, open `http://localhost:3000` and check:

1. Header shows `อ่านข้อมูล 19 repos · 1,505 commits · HH:MM`.
2. Both selects start on `เลือกปี` / `เลือกเดือน` and the body shows `เลือกปีและเดือนเพื่อดูข้อมูล`.
3. Pick `2026` + `กันยายน`: day cards appear newest first, e.g. `26 กันยายน 2026` includes repo `example-repo` with the commit `feat: add analytics tracking plugin`.
4. The summary line shows `N commits · N repos · N วัน` matching the cards.
5. Pick a month with no data in the selected year (e.g. `มกราคม` of the earliest year): shows `ไม่มี commits ในเดือนนี้`.
6. Click `รีเฟรช`: scan info timestamp updates.

- [ ] **Step 4: Lint and type check**

Run:

```bash
cd /Users/you/projects/timesheet && bun run lint && bunx tsc --noEmit
```

Expected: both exit clean, no errors. (`bunx tsc --noEmit` needs the dev server to have run at least once so `.next/types` exists for `LayoutProps` — it has.)

- [ ] **Step 5: Checkpoint (no commit)**

Report: UI files done, browser checks pass, lint + type check clean.

---

### Task 4: End-to-end cross-check against raw git

**Files:** none (verification only).

- [ ] **Step 1: Pick one day in the UI and count the same day from raw git**

For `example-repo`, day `2026-09-26` (Bangkok):

```bash
git -C /Users/you/projects/example-repo log --all --no-merges -i --author='you@example.com' --author='you@work.example' --author='you@ext.example' --pretty=format:'%aI %s%n' | grep '^2026-09-26T'
```

Expected: the same titles as the UI's `26 กันยายน 2026` card for `example-repo`, same count (2 commits: the Google Analytics one at 16:57 and the desktop-breakpoint fix at 14:50 seen during exploration — count may be higher if the repo changed since).

Note: a commit recorded with an offset other than `+07:00` would appear under a different ISO prefix here while still landing on the same Bangkok day in the UI; the unit tests already cover that conversion, so a mismatch only on such commits is expected.

- [ ] **Step 2: Final report (no commit)**

Summarize for the user: all files created/modified, test results (`bun test`), lint/type check results, the cross-check outcome. Remind the user the changes are uncommitted in the working tree and ready for their review and manual commit.

---

## Self-review notes

- Spec coverage: all repos scan (Task 2), 3-email author filter (Task 2), `--no-merges` / `--all` (Task 2), day summary with counts + titles (Task 3), required year+month filter (Task 3), refresh button (Task 3), Thai UI (Task 3), error handling incl. 30s timeout and partial-failure note (Tasks 2–3), config constants (Task 2), unit tests + manual cross-check (Tasks 1, 4).
- Type/name consistency: `Commit`, `ScanError`, `ScanResult`, `DayGroup`, `parseLog`, `bangkokDay`, `groupByDay`, `availableYears`, `scanRepos`, `buildLogArgs` are used with identical names and signatures across all tasks.
- No placeholder steps; every code step contains complete code.
- Post-review fix (applied and verified): git's `format:` mode inserts `\n` between records, so `parseLog` trims the hash (`hash: hash.trim()`); a regression test was added (suite is 10 tests); live API check shows 0/1505 malformed hashes.
- Task 3 post-review fixes (applied and verified): `bun run lint` failed with `react-hooks/set-state-in-effect` on the plan's `load()`-inside-effect pattern. Final `app/page.tsx` = module-level `loadCommits()` + `toErrorScan()`, with the effect and `refresh` using promise callbacks (`.then(setScan).catch(...)`); `refresh` still sets `{status:"loading"}` first (event handlers may). That is the only delta from the plan's Task 3 code block (4 hunks); everything else is byte-identical. Lint + tsc clean, browser checks passed.
- Post-completion enhancement (applied and verified): each commit now carries its branch via git's `%S` placeholder (the ref the commit was reached from in the `--all` walk), cleaned of `refs/heads/`, `refs/remotes/<remote>/`, and `refs/tags/` prefixes. The UI groups each repo's commits by branch under a muted branch subheader (`groupByBranch`, first-seen = most recent branch first) instead of repeating the branch per line. Suite is 13 tests.
