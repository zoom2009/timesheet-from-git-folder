# AI Branch Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each branch group in the dashboard gets a `สรุปด้วย AI` button that generates a ≤120-character English summary of that day's commits on that branch via the Convex AI Gateway (`z-ai/glm-5.2:free`), stored in Convex per (day, repo, branch).

**Architecture:** A new `summaries` table (one row per day+repo+branch) with one composite index. A public Convex action mints a gateway token with `getServiceToken("ai-gateway")` and calls the OpenAI-compatible chat completions endpoint with plain `fetch` (zero new dependencies), clamps the reply to 120 chars, and upserts the row through an internal mutation. The client reads rows reactively via `useQuery` and triggers generation via `useAction`.

**Tech Stack:** Convex 1.46 (schema, query/action/internalMutation, AI Gateway), Next.js 16 client components, React 19, Tailwind 4, bun:test.

**PROJECT RULE — no commits:** This repo forbids automatic commits. Do NOT run `git commit` in any task. Leave everything in the working tree; the user reviews and commits manually.

**Spec:** `docs/superpowers/specs/2026-09-27-ai-branch-summary-design.md`

---

## File Structure

- Create `convex/summaryLogic.test.ts` — bun tests for the pure helpers.
- Create `convex/summaryLogic.ts` — pure helpers: `monthRange`, `clampSummary`, `buildPrompt`.
- Create `convex/schema.ts` — `summaries` table + `by_day_and_repo_and_branch` index.
- Create `convex/summaries.ts` — `listByMonth` query, `summarizeBranch` action, `upsert` internal mutation.
- Create `app/ConvexClientProvider.tsx` — client wrapper around `ConvexProvider`.
- Modify `app/layout.tsx` — wrap `{children}` in the provider.
- Modify `app/page.tsx` — per-branch button, reactive summaries, per-branch busy/error state.

Helpers live under `convex/` because Convex functions cannot import from `lib/`; the test imports `convex/summaryLogic.ts` directly, so `bun test` needs no mocks. The Convex CLI ignores `*.test.ts` files.

---

### Task 1: Pure helpers (TDD)

**Files:**
- Create: `convex/summaryLogic.test.ts`
- Create: `convex/summaryLogic.ts`

- [ ] **Step 1: Write the failing test**

Create `convex/summaryLogic.test.ts`:

```ts
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
  test("collapses whitespace runs and trims", () => {
    expect(clampSummary("  fixed\n\nlogin   bug  ")).toBe("fixed login bug");
  });

  test("caps at 120 characters", () => {
    expect(clampSummary("x".repeat(150))).toBe("x".repeat(120));
  });

  test("keeps text of exactly 120 characters intact", () => {
    expect(clampSummary("y".repeat(120))).toBe("y".repeat(120));
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test convex/summaryLogic.test.ts`
Expected: FAIL — `Cannot find module './summaryLogic'` (the module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `convex/summaryLogic.ts`:

```ts
export const MAX_SUMMARY_CHARS = 120;
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

// Model output is untrusted: one line, no stray whitespace, hard 120-char cap.
export function clampSummary(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY_CHARS);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test convex/summaryLogic.test.ts`
Expected: 8 pass, 0 fail.

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: 18 pass, 0 fail (10 existing in `lib/commits.test.ts` + 8 new).

---

### Task 2: Schema

**Files:**
- Create: `convex/schema.ts`

- [ ] **Step 1: Write the schema**

Create `convex/schema.ts`:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One row per day+repo+branch; day is the Bangkok "YYYY-MM-DD" the UI groups by.
  summaries: defineTable({
    day: v.string(),
    repo: v.string(),
    branch: v.string(),
    summary: v.string(),
  }).index("by_day_and_repo_and_branch", ["day", "repo", "branch"]),
});
```

- [ ] **Step 2: Push the schema to the dev deployment**

Run: `bunx convex dev --once`
Expected: exit code 0; output confirms deploy to `dev:your-deployment` and the regenerated `convex/_generated/dataModel.d.ts` now contains a `summaries` table entry (check with `grep -n summaries convex/_generated/dataModel.d.ts`).

If the CLI prompts for login or an interactive choice, STOP and ask the user to run `bunx convex dev --once` in their own terminal, then continue when they confirm.

---

### Task 3: Convex functions

**Files:**
- Create: `convex/summaries.ts`

- [ ] **Step 1: Write the functions**

Create `convex/summaries.ts`:

```ts
import { getServiceToken } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";
import { buildPrompt, clampSummary, monthRange } from "./summaryLogic";

const GATEWAY_URL = "https://ai-gateway.convex.dev/v1/chat/completions";
const MODEL = "z-ai/glm-5.2:free";

const SYSTEM_PROMPT =
  "You summarize a developer's git work log. Reply with one factual line in English, " +
  "at most 120 characters. No quotes, no markdown, no explanation.";

export const listByMonth = query({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    const { start, end } = monthRange(args.year, args.month);
    return await ctx.db
      .query("summaries")
      .withIndex("by_day_and_repo_and_branch", (q) => q.gte("day", start).lt("day", end))
      .take(1000);
  },
});

export const summarizeBranch = action({
  args: {
    day: v.string(),
    repo: v.string(),
    branch: v.string(),
    titles: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    if (args.titles.length === 0) throw new Error("ไม่มี commits ให้สรุป");

    const token = await getServiceToken("ai-gateway");
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(args) },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`AI gateway ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error("AI gateway ตอบกลับว่างเปล่า");
    }

    const summary = clampSummary(text);
    await ctx.runMutation(internal.summaries.upsert, {
      day: args.day,
      repo: args.repo,
      branch: args.branch,
      summary,
    });
    return summary;
  },
});

export const upsert = internalMutation({
  args: {
    day: v.string(),
    repo: v.string(),
    branch: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("summaries")
      .withIndex("by_day_and_repo_and_branch", (q) =>
        q.eq("day", args.day).eq("repo", args.repo).eq("branch", args.branch)
      )
      .unique();
    if (existing) {
      await ctx.db.patch("summaries", existing._id, { summary: args.summary });
    } else {
      await ctx.db.insert("summaries", args);
    }
  },
});
```

- [ ] **Step 2: Push functions and regenerate types**

Run: `bunx convex dev --once`
Expected: exit code 0, functions deployed. Verify `grep -n summaries convex/_generated/api.d.ts` shows the new module.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

---

### Task 4: Convex client provider

**Files:**
- Create: `app/ConvexClientProvider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the provider**

Create `app/ConvexClientProvider.tsx`:

```tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

- [ ] **Step 2: Wrap the layout**

In `app/layout.tsx`, add the import after the existing `import "./globals.css";` line:

```tsx
import ConvexClientProvider from "./ConvexClientProvider";
```

and replace the body contents:

```tsx
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

---

### Task 5: Dashboard UI

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Extend the imports**

Replace the imports block at the top of `app/page.tsx` (currently `react`, then `@/lib/commits`) with:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  availableYears,
  bangkokDay,
  groupByBranch,
  groupByDay,
  type BranchGroup,
  type Commit,
  type ScanError,
} from "@/lib/commits";
```

- [ ] **Step 2: Add the small button style and key helper**

After the existing `buttonClass` constant, add:

```tsx
const smallButtonClass =
  "rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

function summaryKey(day: string, repo: string, branch: string): string {
  return `${day}|${repo}|${branch}`;
}
```

- [ ] **Step 3: Add action, state, query, and click handler**

Inside `Home`, after `const [month, setMonth] = useState("");` add:

```tsx
  const summarize = useAction(api.summaries.summarizeBranch);
  const [busySummary, setBusySummary] = useState<Record<string, boolean>>({});
  const [summaryError, setSummaryError] = useState<Record<string, string>>({});
```

After the `totals` memo, add:

```tsx
  const summaries = useQuery(
    api.summaries.listByMonth,
    year && month ? { year: Number(year), month: Number(month) } : "skip"
  );

  const summaryByKey = useMemo(
    () =>
      new Map(
        (summaries ?? []).map((row) => [summaryKey(row.day, row.repo, row.branch), row.summary])
      ),
    [summaries]
  );

  const runSummary = useCallback(
    (day: string, repoName: string, branchGroup: BranchGroup) => {
      const key = summaryKey(day, repoName, branchGroup.branch);
      setBusySummary((prev) => ({ ...prev, [key]: true }));
      setSummaryError((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      summarize({
        day,
        repo: repoName,
        branch: branchGroup.branch,
        titles: branchGroup.commits.map((commit) => commit.title),
      })
        .catch((err: unknown) => {
          setSummaryError((prev) => ({
            ...prev,
            [key]: err instanceof Error ? err.message : String(err),
          }));
        })
        .finally(() => {
          setBusySummary((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        });
    },
    [summarize]
  );
```

- [ ] **Step 4: Replace the branch JSX block**

Replace the branch block — the `<div className="mt-1.5 flex flex-col gap-2">` wrapper that contains `{groupByBranch(repo.commits).map(...)}` — with:

```tsx
                            <div className="mt-1.5 flex flex-col gap-2">
                              {groupByBranch(repo.commits).map((branchGroup) => {
                                const key = summaryKey(group.day, repo.name, branchGroup.branch);
                                const summary = summaryByKey.get(key);
                                const busy = busySummary[key] ?? false;
                                const error = summaryError[key];
                                return (
                                  <div key={branchGroup.branch}>
                                    <div className="flex items-center justify-between gap-2">
                                      <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                        {branchGroup.branch}
                                      </h4>
                                      <button
                                        onClick={() => runSummary(group.day, repo.name, branchGroup)}
                                        disabled={busy}
                                        className={smallButtonClass}
                                      >
                                        {busy ? "กำลังสรุป..." : summary ? "สรุปใหม่" : "สรุปด้วย AI"}
                                      </button>
                                    </div>
                                    {summary && (
                                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                        {summary}
                                      </p>
                                    )}
                                    {error && (
                                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                        สรุปไม่สำเร็จ: {error}
                                      </p>
                                    )}
                                    <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                                      {branchGroup.commits.map((commit) => (
                                        <li key={commit.hash}>{commit.title}</li>
                                      ))}
                                    </ul>
                                  </div>
                                );
                              })}
                            </div>
```

Notes: the `h4` is always rendered now (empty when the branch string is empty) so the button row keeps its alignment; no `useEffect` is added, so the `react-hooks/set-state-in-effect` rule stays satisfied.

- [ ] **Step 5: Typecheck, lint, and run tests**

Run: `bunx tsc --noEmit`
Expected: no errors.

Run: `bun run lint`
Expected: no errors.

Run: `bun test`
Expected: 18 pass, 0 fail.

---

### Task 6: End-to-end browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run in background: `bun dev`
Expected: Next.js ready on `http://localhost:3000` (no compile errors in the log).

- [ ] **Step 2: Verify the button flow in a browser**

Open `http://localhost:3000`, then:
1. Select ปี `2026` and เดือน `กันยายน`.
2. Find any branch group with a `สรุปด้วย AI` button and click it.
3. Expected: button shows `กำลังสรุป...` (disabled), then a summary text appears under the branch label within ~60s (the `:free` model can be slow).
4. Check the summary is ≤120 characters.
5. Reload the page → the summary is still shown and the button now says `สรุปใหม่`.
6. Click `สรุปใหม่` → the flow completes again; no red error text.
7. Check the browser console for React/Convex errors — expected: none.

If the UI shows `สรุปไม่สำเร็จ: AI gateway 4xx ... AiGatewayDisabled`, the team lacks gateway access (paid plan): STOP, report the exact message to the user, and do not retry.

- [ ] **Step 3: Verify the stored rows**

Run: `bunx convex data summaries`
Expected: one row per clicked (day, repo, branch) — clicking `สรุปใหม่` again must NOT create a second row for the same triple.

- [ ] **Step 4: Stop the dev server**

Stop the background `bun dev` process. Note for the user: to develop later, keep `bunx convex dev` running in one terminal (pushes Convex changes) and `bun dev` in another.

- [ ] **Step 5: Leave the working tree for review (no commit)**

List the changed/new files for the user:
`convex/schema.ts`, `convex/summaries.ts`, `convex/summaryLogic.ts`, `convex/summaryLogic.test.ts`, `app/ConvexClientProvider.tsx`, `app/layout.tsx`, `app/page.tsx`, plus regenerated `convex/_generated/*` files. Do not commit.

---

## Acceptance checklist

- [ ] `bun test` → 18 pass, 0 fail.
- [ ] `bunx tsc --noEmit` → clean.
- [ ] `bun run lint` → clean.
- [ ] Convex deploy succeeds on `dev:your-deployment`.
- [ ] Browser: click generate → summary ≤120 chars appears, persists across reload, `สรุปใหม่` replaces it.
- [ ] `bunx convex data summaries` shows exactly one row per (day, repo, branch).
