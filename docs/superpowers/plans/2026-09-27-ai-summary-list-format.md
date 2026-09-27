# AI Summary List Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI branch summaries become a short plain-language list — 1–5 items scaled to the work, each ≤ 80 characters, understandable without technical background — instead of one ≤ 120-character line.

**Architecture:** `clampSummary` becomes a list clamp (split lines, strip bullet/number markers, cap each item at 80 chars, keep first 5, rejoin with `\n`). The system prompt is rewritten for plain-English list output and `max_tokens` rises 200 → 300. The UI renders the stored string split on `\n` as a bullet list. No schema change, no migration.

**Tech Stack:** Convex 1.46 (action + AI Gateway), Next.js 16 client component, React 19, Tailwind 4, bun:test.

**PROJECT RULE — no commits:** This repo forbids automatic commits. Do NOT run `git commit` in any task. Leave everything in the working tree; the user reviews and commits manually.

**Existing working-tree change (keep it):** `convex/summaries.ts` has the 429 fallback slug set to `~deepseek/deepseek-v4-flash-latest` (the gateway's floating alias — the tilde is required, verified by probe; primary still `qwen/qwen3.7-flash` with `reasoning: {enabled: false}`). Do not revert it.

**Spec:** `docs/superpowers/specs/2026-09-27-ai-summary-list-format-design.md`

---

## File Structure

- Modify `convex/summaryLogic.ts` — replace `MAX_SUMMARY_CHARS` with `MAX_SUMMARY_ITEMS` / `MAX_SUMMARY_ITEM_CHARS`; rewrite `clampSummary`.
- Modify `convex/summaryLogic.test.ts` — replace the `clampSummary` describe block (3 old tests → 8 new).
- Modify `convex/summaries.ts` — `SYSTEM_PROMPT` rewrite, `max_tokens` 200 → 300.
- Modify `app/page.tsx` — summary pill renders as a bullet list.
- Create (temporarily) `convex/probeModel.ts` — gateway probe for the fallback slug; deleted again in Task 4.

No files are created permanently. No changes to `convex/schema.ts` (still one `summary: string` column; items are newline-joined).

---

### Task 1: List clamp (TDD)

**Files:**
- Modify: `convex/summaryLogic.test.ts` (clampSummary block only, lines 19–31)
- Modify: `convex/summaryLogic.ts` (line 1 and lines 15–18)

- [ ] **Step 1: Replace the clampSummary tests**

In `convex/summaryLogic.test.ts`, replace the whole existing `describe("clampSummary", ...)` block (the 3 tests "collapses whitespace runs and trims", "caps at 120 characters", "keeps text of exactly 120 characters intact") with:

```ts
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
```

The `monthRange` and `buildPrompt` describe blocks stay untouched.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test convex/summaryLogic.test.ts`
Expected: FAIL — e.g. "keeps one item per line and trims each" gets `fixed login bug added tests` (old clamp collapses the newline away). 5 or more of the new tests fail.

- [ ] **Step 3: Rewrite the helper**

In `convex/summaryLogic.ts`, replace line 1:

```ts
export const MAX_SUMMARY_CHARS = 120;
```

with:

```ts
export const MAX_SUMMARY_ITEMS = 5;
export const MAX_SUMMARY_ITEM_CHARS = 80;
```

and replace the old `clampSummary` (lines 15–18, including its comment):

```ts
// Model output is untrusted: one line, no stray whitespace, hard 120-char cap.
export function clampSummary(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY_CHARS);
}
```

with:

```ts
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
```

`monthRange` and `buildPrompt` are unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test convex/summaryLogic.test.ts`
Expected: 14 pass, 0 fail (3 monthRange + 8 clampSummary + 3 buildPrompt).

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: 27 pass, 0 fail (13 in `lib/commits.test.ts` + 14 in `convex/summaryLogic.test.ts`).

---

### Task 2: Prompt and token budget

**Files:**
- Modify: `convex/summaries.ts` (SYSTEM_PROMPT at lines 17–19, `max_tokens` at line 34)

- [ ] **Step 1: Rewrite the system prompt**

In `convex/summaries.ts`, replace the current `SYSTEM_PROMPT` constant:

```ts
const SYSTEM_PROMPT =
  "You summarize a developer's git work log. Reply with one factual line in English, " +
  "at most 120 characters. No quotes, no markdown, no explanation.";
```

with:

```ts
const SYSTEM_PROMPT =
  "You summarize a developer's git work log for a non-technical reader. " +
  "Reply with 1 to 5 short lines in English, one point per line, each at most 80 characters. " +
  "One line per feature, not per commit: merge related commits into the one feature they deliver. " +
  "Say what the app or page can now do — the result, not the engineering behind it " +
  "(no tokens, flags, tests, or function names). " +
  "Match the number of lines to the distinct features: 1 for a small change, up to 5 for a busy day. " +
  "Use simple everyday words: no jargon, no commit prefixes like 'feat:' or 'fix:', " +
  "no bullet symbols, no markdown, no quotes.";
```

- [ ] **Step 2: Raise max_tokens**

In the same file's `callGateway` body, change:

```ts
      max_tokens: 200,
```

to:

```ts
      max_tokens: 300,
```

(Five 80-char lines need roughly 120 completion tokens; 300 leaves comfortable headroom. Billing is per actual token, so the higher cap costs nothing.)

Do not touch the `MODELS` array — the `~deepseek/deepseek-v4-flash-latest` fallback edit is intentional.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

---

### Task 3: Bullet-list UI

**Files:**
- Modify: `app/page.tsx` (summary pill, currently lines 296–300)

- [ ] **Step 1: Render summary items as a list**

In `app/page.tsx`, replace the summary block:

```tsx
                                    {summary && (
                                      <p className="mt-1 rounded-md bg-violet-500/10 px-2 py-1 text-xs text-violet-300">
                                        {summary}
                                      </p>
                                    )}
```

with:

```tsx
                                    {summary && (
                                      <ul className="mt-1 list-disc rounded-md bg-violet-500/10 py-1 pl-6 pr-2 text-xs text-violet-300 marker:text-violet-400">
                                        {summary.split("\n").map((item, index) => (
                                          <li key={index}>{item}</li>
                                        ))}
                                      </ul>
                                    )}
```

`key={index}` is fine here: the list is static text, never reordered. Old single-line rows simply render as one bullet; no other UI change.

- [ ] **Step 2: Typecheck, lint, and tests**

Run: `bunx tsc --noEmit`
Expected: no errors.

Run: `bun run lint`
Expected: no errors (4 pre-existing warnings in `convex/_generated/` are OK).

Run: `bun test`
Expected: 27 pass, 0 fail.

---

### Task 4: Deploy, probe the fallback slug, end-to-end check

**Files:**
- Create (temporarily): `convex/probeModel.ts` — delete again in Step 4.

- [ ] **Step 1: Push to the dev deployment**

Announce first: this syncs local functions to **`dev:your-deployment`** (dev only, not production).

Run: `bunx convex dev --once`
Expected: exit code 0, functions deployed, `_generated` refreshed.

If the CLI asks for login or an interactive choice, STOP and ask the user to run the command themselves.

- [ ] **Step 2: End-to-end run of the real action**

Run:

```bash
bunx convex run summaries:summarizeBranch '{"day":"2026-09-27","repo":"timesheet","branch":"probe-list","titles":["feat: add list clamp for AI summaries","fix: strip bullet prefixes from model output","chore: raise max_tokens to 300","test: cover the item cap"]}'
```

Expected: the returned string has 1–5 lines, every line ≤ 80 characters, plain everyday words, no `feat:`/`fix:` prefixes, no bullet symbols. Example shape:

```
Made daily work summaries show as a short list
Fixed the text cutting off mid-sentence
Added a new limit for longer summaries
```

If the output still looks like one long line or contains prefixes, do NOT hand off — re-read Step 1 of Task 2 and the clamp in Task 1, fix, re-sync, retry.

This writes one dev row (`2026-09-27`, `timesheet`, `probe-list`); harmless, tell the user it exists.

- [ ] **Step 3: Probe the fallback slug**

Create `convex/probeModel.ts`:

```ts
// Temporary probe; delete after checking the gateway slug.
import { getServiceToken } from "convex/server";
import { action } from "./_generated/server";

export const probeFallback = action({
  args: {},
  handler: async () => {
    const token = await getServiceToken("ai-gateway");
    const response = await fetch("https://ai-gateway.convex.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "~deepseek/deepseek-v4-flash-latest",
        messages: [{ role: "user", content: "Say ok" }],
        max_tokens: 20,
      }),
    });
    return { status: response.status, body: (await response.text()).slice(0, 300) };
  },
});
```

Run: `bunx convex run probeModel:probeFallback`
Expected: `status: 200` with a short body. A 429 means the slug exists but the quota window is busy — wait a minute and rerun once. A 404 or "unavailable" means the slug is wrong: STOP, report it to the user; the 429 fallback would be dead code.

- [ ] **Step 4: Remove the probe**

Delete `convex/probeModel.ts`, then:

Run: `bunx convex dev --once`
Expected: exit code 0; `grep -rn probeModel convex/_generated/api.d.ts` finds nothing afterwards.

- [ ] **Step 5: Hand off the browser check to the user**

Ask the user to open `http://localhost:3000`, pick a month, click `สรุปใหม่` on any branch, and confirm: bullet list appears, 1–5 bullets, each one short and readable at a glance. (Old rows show one bullet until regenerated.) Do not dispatch a browser agent for this.

- [ ] **Step 6: Leave the working tree for review (no commit)**

Changed files for the user: `convex/summaryLogic.ts`, `convex/summaryLogic.test.ts`, `convex/summaries.ts`, `app/page.tsx`, plus the two new docs (`docs/superpowers/specs/2026-09-27-ai-summary-list-format-design.md`, `docs/superpowers/plans/2026-09-27-ai-summary-list-format.md`). Do not commit.

---

## Acceptance checklist

- [ ] `bun test` → 27 pass, 0 fail.
- [ ] `bunx tsc --noEmit` → clean.
- [ ] `bun run lint` → no errors.
- [ ] Deploy to `dev:your-deployment` succeeds.
- [ ] `summaries:summarizeBranch` E2E → 1–5 lines, each ≤ 80 chars, plain English.
- [ ] `~deepseek/deepseek-v4-flash-latest` probe → 200.
- [ ] User confirms bullets render on :3000.
