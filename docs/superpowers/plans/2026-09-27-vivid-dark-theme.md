# Vivid Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colorize the dashboard with the approved "vivid roles" dark theme — every element family owns one hue (violet actions, cyan day, emerald commits, sky repos, pink branches) while zinc stays the structural skeleton.

**Architecture:** Styling-only change across two files. `app/globals.css` is pinned to dark (drops `prefers-color-scheme`, adds `color-scheme: dark`); `app/page.tsx` loses every `dark:` prefix and gains role colors using the stock Tailwind palette. No logic, markup structure, or data changes. Implements the approved spec `docs/superpowers/specs/2026-09-27-vivid-dark-theme-design.md`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4. Tests: `bun test` (bun runner).

**Commits:** Do NOT run `git commit` at any point (project rule). All changes stay in the working tree; the user reviews and commits manually.

**No new unit tests:** this plan changes only CSS utility classes — there is no logic to test. Verification is `grep` completeness, the existing test suite, lint, tsc, and a visual checklist on the live preview (spec decision).

---

## Task 1: Pin the dark theme in app/globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Pin `:root` to the dark values and declare `color-scheme`**

Current:
```css
:root {
  --background: #ffffff;
  --foreground: #171717;
}
```
Replace with:
```css
:root {
  --background: #0a0a0a;
  --foreground: #ededed;
  color-scheme: dark;
}
```

- [ ] **Step 2: Delete the `prefers-color-scheme` block**

Current:
```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
```
Replace with:
```css
body {
```

---

## Task 2: page.tsx — shared class constants and page-level elements

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Rewrite `selectClass`**

Current:
```tsx
const selectClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
```
Replace with:
```tsx
const selectClass =
  "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40 focus:outline-none";
```

- [ ] **Step 2: Rewrite `buttonClass`**

Current:
```tsx
const buttonClass =
  "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";
```
Replace with:
```tsx
const buttonClass =
  "rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none disabled:opacity-50";
```

- [ ] **Step 3: Rewrite `smallButtonClass`**

Current:
```tsx
const smallButtonClass =
  "rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";
```
Replace with:
```tsx
const smallButtonClass =
  "rounded-md bg-violet-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none disabled:opacity-50";
```

- [ ] **Step 4: Header scan-info line**

Current:
```tsx
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
```
Replace with:
```tsx
            <p className="mt-1 text-sm text-zinc-400">
```

- [ ] **Step 5: Amber scan-warning banner**

Current:
```tsx
        <p
          title={scan.errors.map((e) => `${e.repo}: ${e.message}`).join("\n")}
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
```
Replace with:
```tsx
        <p
          title={scan.errors.map((e) => `${e.repo}: ${e.message}`).join("\n")}
          className="mt-4 rounded-lg border border-amber-800 bg-amber-950 px-4 py-2 text-sm text-amber-200"
        >
```

- [ ] **Step 6: Loading message**

Current:
```tsx
          <p className="text-zinc-500 dark:text-zinc-400">กำลังอ่าน git history...</p>
```
Replace with:
```tsx
          <p className="text-zinc-400">กำลังอ่าน git history...</p>
```

- [ ] **Step 7: Red scan-error paragraph**

Current:
```tsx
          <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
```
Replace with:
```tsx
          <p className="rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-300">
```

- [ ] **Step 8: Select-a-month prompt**

Current:
```tsx
          <p className="text-zinc-500 dark:text-zinc-400">เลือกปีและเดือนเพื่อดูข้อมูล</p>
```
Replace with:
```tsx
          <p className="text-zinc-400">เลือกปีและเดือนเพื่อดูข้อมูล</p>
```

- [ ] **Step 9: Empty-month message**

Current:
```tsx
            <p className="text-zinc-500 dark:text-zinc-400">ไม่มี commits ในเดือนนี้</p>
```
Replace with:
```tsx
            <p className="text-zinc-400">ไม่มี commits ในเดือนนี้</p>
```

- [ ] **Step 10: Colored totals line**

Current:
```tsx
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {totals.commits} commits · {totals.repos} repos · {totals.days} วัน
              </p>
```
Replace with:
```tsx
              <p className="text-sm text-zinc-400">
                <span className="text-emerald-300">{totals.commits}</span> commits ·{" "}
                <span className="text-sky-300">{totals.repos}</span> repos ·{" "}
                <span className="text-cyan-300">{totals.days}</span> วัน
              </p>
```

---

## Task 3: page.tsx — day card internals

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Cyan left stripe on the day card**

Current:
```tsx
                    <li
                      key={group.day}
                      className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
                    >
```
Replace with:
```tsx
                    <li
                      key={group.day}
                      className="overflow-hidden rounded-xl border border-zinc-800 border-l-4 border-l-cyan-400"
                    >
```

- [ ] **Step 2: Day header row background**

Current:
```tsx
                      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
```
Replace with:
```tsx
                      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
```

- [ ] **Step 3: Cyan date heading**

Current:
```tsx
                        <h2 className="font-medium">{formatDay(group.day)}</h2>
```
Replace with:
```tsx
                        <h2 className="font-medium text-cyan-300">{formatDay(group.day)}</h2>
```

- [ ] **Step 4: Emerald commit-count badge**

Current:
```tsx
                        <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium dark:bg-zinc-800">
```
Replace with:
```tsx
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
```

- [ ] **Step 5: Repo row — sky dot + sky name**

Current:
```tsx
                            <h3 className="text-sm font-semibold">
                              {repo.name}
                              <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                                {repo.commits.length} commits
                              </span>
                            </h3>
```
Replace with:
```tsx
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-300">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                              {repo.name}
                              <span className="font-normal text-zinc-400">
                                {repo.commits.length} commits
                              </span>
                            </h3>
```

- [ ] **Step 6: Pink branch chip**

Current:
```tsx
                                      <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                        {branchGroup.branch}
                                      </h4>
```
Replace with:
```tsx
                                      <h4 className="break-all rounded-full bg-pink-500/15 px-2 py-0.5 text-xs font-medium text-pink-300">
                                        {branchGroup.branch}
                                      </h4>
```

- [ ] **Step 7: Violet AI-summary box**

Current:
```tsx
                                    {summary && (
                                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                        {summary}
                                      </p>
                                    )}
```
Replace with:
```tsx
                                    {summary && (
                                      <p className="mt-1 rounded-md bg-violet-500/10 px-2 py-1 text-xs text-violet-300">
                                        {summary}
                                      </p>
                                    )}
```

- [ ] **Step 8: Summary-error red shade**

Current:
```tsx
                                    {error && (
                                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                        สรุปไม่สำเร็จ: {error}
                                      </p>
                                    )}
```
Replace with:
```tsx
                                    {error && (
                                      <p className="mt-1 text-xs text-red-400">
                                        สรุปไม่สำเร็จ: {error}
                                      </p>
                                    )}
```

- [ ] **Step 9: Commit list — zinc text, emerald markers**

Current:
```tsx
                                    <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                                      {branchGroup.commits.map((commit) => (
                                        <li key={commit.hash}>{commit.title}</li>
                                      ))}
                                    </ul>
```
Replace with:
```tsx
                                    <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-zinc-300">
                                      {branchGroup.commits.map((commit) => (
                                        <li key={commit.hash} className="marker:text-emerald-400">
                                          {commit.title}
                                        </li>
                                      ))}
                                    </ul>
```

---

## Task 4: Verification

**Files:** none (verification only)

- [ ] **Step 1: Prove no `dark:` prefixes remain**

Run: `grep -rn "dark:" app/`
Expected: no output (exit code 1). If anything matches, that spot was missed — fix it before continuing.

- [ ] **Step 2: Run the existing test suite**

Run: `bun test`
Expected: 13 pass, 0 fail (suite untouched by design).

- [ ] **Step 3: Run lint and typecheck**

Run: `bun run lint` — expected: no errors.
Run: `bunx tsc --noEmit` — expected: no errors.

- [ ] **Step 4: Visual checklist on the live preview**

With the dev server running (hot reload), check each item against the approved mockup (panel C of the widget):

- รีเฟรช / เดือนนี้ / สรุปด้วย AI buttons: white text on violet-600; hover lightens to violet-500; disabled state dims.
- Day card: 4px cyan stripe on the left edge; date heading cyan.
- "N commits" day badge: emerald tint with emerald text.
- Repo rows: sky dot + sky repo name; count stays muted.
- Branch names: pink rounded chips, not plain text.
- AI summary (after running a summary): violet text in a faint violet box.
- Commit bullets: emerald markers, commit text still zinc (readable).
- Open a select dropdown: the native option list renders dark.
- Tab through selects and buttons: violet focus rings are clearly visible.

- [ ] **Step 5: Report**

Summarize what changed and the checklist result for the user. Do not commit anything.

---

## Notes

- `marker:` is applied per `<li>`, not on the `<ul>` — the `::marker` pseudo-element belongs to the list item, so a `marker:` utility on the `<ul>` would style nothing.
- `border-l-4` + `border-l-cyan-400` intentionally override the 1px zinc border on the left side only; Tailwind emits side-specific utilities after the shorthand, so no `!important` is needed.
- `break-all` on the branch chip lets pathological branch names wrap inside the chip instead of pushing the สรุปด้วย AI button out of the row.
- Light mode is removed by decision; `app/layout.tsx` and `app/ConvexClientProvider.tsx` contain no color classes and need no edits.

## Completion (2026-09-27)

Executed inline. All 19 replacements applied exactly as specified. Results: `grep -rn "dark:" app/` clean; `bun test` 22 pass / 0 fail (13 lib + 9 summaryLogic — the suite grew after this plan header was written, which expected "13"); `bun run lint` 0 errors (4 pre-existing warnings in `convex/_generated/`); `bunx tsc --noEmit` clean. Visual checklist handed to the user for the live preview. Nothing committed (project rule).
