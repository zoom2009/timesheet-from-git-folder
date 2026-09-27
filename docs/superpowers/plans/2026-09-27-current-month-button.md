# Current Month Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-click "เดือนนี้" button that fills the ปี/เดือน selects with the current Bangkok month.

**Architecture:** Single-file client-side change in `app/page.tsx`. Reuses the already-tested `bangkokDay` helper from `lib/commits.ts`; no API, server, or data changes. Implements the approved spec `docs/superpowers/specs/2026-09-27-current-month-button-design.md`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4. Tests: `bun test` (bun runner).

**Commits:** Do NOT run `git commit` at any point (project rule). All changes stay in the working tree; the user reviews and commits manually.

---

## Task 1: Add the เดือนนี้ button to app/page.tsx

**Files:**
- Modify: `app/page.tsx` (the six edits below)

No new unit test: the added logic is a three-line derivation over `bangkokDay`, whose timezone edge is already covered in `lib/commits.test.ts` (spec decision).

- [ ] **Step 1: Import `bangkokDay`**

Current:
```tsx
import { availableYears, groupByBranch, groupByDay, type Commit, type ScanError } from "@/lib/commits";
```
Replace with:
```tsx
import {
  availableYears,
  bangkokDay,
  groupByBranch,
  groupByDay,
  type Commit,
  type ScanError,
} from "@/lib/commits";
```

- [ ] **Step 2: Add shared `buttonClass` next to `selectClass`**

Current:
```tsx
const selectClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
```
Replace with:
```tsx
const selectClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const buttonClass =
  "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";
```

- [ ] **Step 3: Include the current year in the year dropdown**

Current:
```tsx
  const years = useMemo(
    () => (scan.status === "ready" ? availableYears(scan.commits) : []),
    [scan]
  );
```
Replace with:
```tsx
  const years = useMemo(() => {
    if (scan.status !== "ready") return [];
    const list = availableYears(scan.commits);
    const currentYear = Number(bangkokDay(new Date().toISOString()).slice(0, 4));
    return list.includes(currentYear) ? list : [...list, currentYear].sort((a, b) => b - a);
  }, [scan]);
```

- [ ] **Step 4: Add the `selectCurrentMonth` handler**

Directly after the `refresh` callback, insert:
```tsx
  const selectCurrentMonth = useCallback(() => {
    // Bangkok month matches the timezone commits are grouped by.
    const today = bangkokDay(new Date().toISOString());
    setYear(today.slice(0, 4));
    setMonth(String(Number(today.slice(5, 7))));
  }, []);
```

- [ ] **Step 5: Use `buttonClass` on the รีเฟรช button**

Current:
```tsx
        <button
          onClick={refresh}
          disabled={scan.status === "loading"}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          รีเฟรช
        </button>
```
Replace with:
```tsx
        <button onClick={refresh} disabled={scan.status === "loading"} className={buttonClass}>
          รีเฟรช
        </button>
```

- [ ] **Step 6: Add the เดือนนี้ button to the filter bar**

Current (end of the filter section):
```tsx
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
```
Replace with:
```tsx
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
        <button onClick={selectCurrentMonth} className={buttonClass}>
          เดือนนี้
        </button>
      </section>
```

- [ ] **Step 7: Run the existing test suite**

Run: `bun test`
Expected: all tests pass, 0 fail (suite unchanged).

- [ ] **Step 8: Run lint and typecheck**

Run: `bun run lint` — expected: no errors.
Run: `bunx tsc --noEmit` — expected: no errors.

---

## Task 2: Browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `bun dev` in the background.
Expected: ready within ~30s, serving the app at http://localhost:3000.

- [ ] **Step 2: Open the app with the browser-use MCP**

First read the tool schemas (`navigate_page`, `wait_for`, `take_snapshot`, `click`, `take_screenshot`) under `~/.qoder/mcps/browser-use` (required before calling any MCP tool). Then:
1. `navigate_page` to `http://localhost:3000`.
2. `wait_for` the text "อ่านข้อมูล" (the page first shows "กำลังอ่าน git history..." during the scan).
3. `take_snapshot` and note the "เดือนนี้" button ref.

- [ ] **Step 3: Click and assert**

1. `click` the "เดือนนี้" button.
2. `take_snapshot` and assert all of:
   - The ปี combobox shows 2026.
   - The เดือน combobox shows กันยายน.
   - The results section shows a totals line like "194 commits · N repos · M วัน" (194 is the known-good, git-cross-checked count for กันยายน 2026; expect ≥194 if repos gained commits today).
   - Day cards show September 2026 dates (e.g. "27 กันยายน 2026").

- [ ] **Step 4: Capture evidence**

`take_screenshot` of the page after the click.

- [ ] **Step 5: Stop the dev server and report**

Stop the background dev server. Report the observed selects and totals to the user. Do not commit anything.

---

## Notes

- If the page is left open across New Year without a re-scan, the click sets the new year but the dropdown lacks that option until the next scan (cosmetic, once-a-year case; spec decision).
- The year-union edge (current year with zero commits) cannot be reproduced against real data; covered by code inspection only.
