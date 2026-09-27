# Day Completion Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each day card gets a "เสร็จ" checkbox. Completed days show an emerald check and dimmed text (nothing hidden); un-ticking opens a styled confirm dialog; state persists in Convex.

**Architecture:** New `completedDays` table (presence = complete, one row per day, index `by_day`). A public `listByMonth` query (reuses `monthRange` from `summaryLogic`) feeds a `Set` in the page; a public `setDone` mutation inserts/deletes idempotently. The day header gains a native checkbox; completed styling is pure Tailwind classes; the confirm dialog is a conditional overlay (no new deps, no effects).

**Tech Stack:** Convex 1.46, Next.js 16 client component, React 19, Tailwind 4, bun:test.

**PROJECT RULE — no commits:** Do NOT run `git commit`. Leave everything in the working tree; the user reviews and commits manually.

**Spec:** `docs/superpowers/specs/2026-09-27-day-complete-toggle-design.md`

---

## File Structure

- Modify `convex/schema.ts` — add the `completedDays` table.
- Create `convex/completedDays.ts` — `listByMonth` query + `setDone` mutation.
- Modify `app/page.tsx` — query/Set state, checkbox in the day header, dim classes, confirm dialog.

No new unit tests: there is no new pure logic (the mutation is exercised by the CLI E2E in Task 3); the existing 27 tests must stay green.

---

### Task 1: Schema + backend module

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/completedDays.ts`

- [ ] **Step 1: Add the table**

In `convex/schema.ts`, add after the `summaries` table definition (inside `defineSchema`):

```ts
  // One row per completed day; presence of the row means "done".
  completedDays: defineTable({
    day: v.string(),
  }).index("by_day", ["day"]),
```

The file ends up with two tables — `summaries` unchanged, `completedDays` added.

- [ ] **Step 2: Create the backend module**

Create `convex/completedDays.ts`:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { monthRange } from "./summaryLogic";

export const listByMonth = query({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    const { start, end } = monthRange(args.year, args.month);
    const rows = await ctx.db
      .query("completedDays")
      .withIndex("by_day", (q) => q.gte("day", start).lt("day", end))
      .take(1000);
    return rows.map((row) => row.day);
  },
});

export const setDone = mutation({
  args: { day: v.string(), done: v.boolean() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("completedDays")
      .withIndex("by_day", (q) => q.eq("day", args.day))
      .unique();
    if (args.done && !existing) await ctx.db.insert("completedDays", { day: args.day });
    if (!args.done && existing) await ctx.db.delete(existing._id);
  },
});
```

- [ ] **Step 3: Push to the dev deployment and check types**

Announce: syncs to **`dev:your-deployment`** (dev only, not production).

Run: `bunx convex dev --once`
Expected: exit code 0, "Convex functions ready!".

Run: `grep -n completedDays convex/_generated/api.d.ts`
Expected: a line like `export const completedDays: typeof ...` (module registered).

Run: `bunx tsc --noEmit`
Expected: no errors.

---

### Task 2: UI — checkbox, dim styling, confirm dialog

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Import and state**

Change the import:
`import { useAction, useQuery } from "convex/react";`
→ `import { useAction, useMutation, useQuery } from "convex/react";`

Inside `Home`, next to the existing summary state, add:

```tsx
  const setDayDone = useMutation(api.completedDays.setDone);
  const [confirmDay, setConfirmDay] = useState<string | null>(null);
```

- [ ] **Step 2: Query + helpers**

After the `summaryByKey` memo, add:

```tsx
  const doneDays = useQuery(
    api.completedDays.listByMonth,
    year && month ? { year: Number(year), month: Number(month) } : "skip"
  );

  const doneSet = useMemo(() => new Set(doneDays ?? []), [doneDays]);

  const markDone = (day: string, done: boolean) => {
    setDayDone({ day, done }).catch((err: unknown) => console.error("setDone failed", err));
  };
```

- [ ] **Step 3: Day header — checkbox + dim classes**

In the `groups.map((group) => {` block, after `const dayCount = ...;` add:

```tsx
  const done = doneSet.has(group.day);
```

Replace the day header block (currently `h2` + commits badge) with:

```tsx
                      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
                        <h2 className={`font-medium ${done ? "text-cyan-300/40" : "text-cyan-300"}`}>
                          {formatDay(group.day)}
                        </h2>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                            {dayCount} commits
                          </span>
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => (done ? setConfirmDay(group.day) : markDone(group.day, true))}
                              className="h-4 w-4 accent-emerald-400 focus-visible:ring-2 focus-visible:ring-violet-500/60"
                            />
                            เสร็จ
                          </label>
                        </div>
                      </div>
```

And dim the card body — change:

```tsx
                      <div className="flex flex-col gap-4 px-4 py-4">
```

to:

```tsx
                      <div className={`flex flex-col gap-4 px-4 py-4 ${done ? "opacity-60" : ""}`}>
```

- [ ] **Step 4: Confirm dialog**

Insert immediately before `</main>` (after the closing `</section>`):

```tsx
      {confirmDay && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmDay(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
        >
          {/* ponytail: no focus trap or Esc handling; click-outside closes. Upgrade if it becomes a real dialog need. */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl"
          >
            <p className="text-sm text-zinc-200">เปลี่ยนกลับเป็น "ยังไม่เสร็จ"?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDay(null)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none"
              >
                ปิด
              </button>
              <button
                onClick={() => {
                  markDone(confirmDay, false);
                  setConfirmDay(null);
                }}
                className={smallButtonClass}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Typecheck, lint, tests**

Run: `bunx tsc --noEmit` → no errors.
Run: `bun run lint` → no errors (4 pre-existing `convex/_generated/` warnings are OK).
Run: `bun test` → 27 pass, 0 fail.

---

### Task 3: CLI end-to-end + hand off

**Files:** none (verification only).

- [ ] **Step 1: Round-trip the mutation**

Run: `bunx convex run completedDays:setDone '{"day":"2026-09-27","done":true}'`
Expected: `null` (mutation completed).

Run: `bunx convex run completedDays:listByMonth '{"year":2026,"month":9}'`
Expected: an array including `"2026-09-27"`.

Run: `bunx convex run completedDays:setDone '{"day":"2026-09-27","done":false}'`
Then `listByMonth` again → `"2026-09-27"` gone (DB left clean).

- [ ] **Step 2: Confirm the dev server serves the page**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000`
Expected: `200`. If the server is down, tell the user to start it with `bun dev`.

- [ ] **Step 3: Hand off the click-through**

Ask the user to, on :3000: tick a day's "เสร็จ" → badge row shows the emerald check and the day text dims; untick → confirm dialog appears; "ยืนยัน" reverts, "ปิด" keeps it complete; reload → tick persists. Do not dispatch a browser agent.

- [ ] **Step 4: Leave the working tree for review (no commit)**

Changed files: `convex/schema.ts`, `convex/completedDays.ts` (new), `app/page.tsx`, plus the two new docs (`docs/superpowers/specs/2026-09-27-day-complete-toggle-design.md`, `docs/superpowers/plans/2026-09-27-day-complete-toggle.md`). Do not commit.

---

## Acceptance checklist

- [ ] `bunx tsc --noEmit` → clean; `bun run lint` → no errors.
- [ ] `bun test` → 27 pass, 0 fail.
- [ ] Deploy to `dev:your-deployment` succeeds; `completedDays` in `api.d.ts`.
- [ ] CLI round-trip: `setDone true` → `listByMonth` includes the day → `setDone false` → gone.
- [ ] User confirms: tick → check + dim; untick → dialog; reload persists.
