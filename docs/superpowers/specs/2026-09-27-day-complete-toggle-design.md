# Day Completion Toggle — Design

Date: 2026-09-27

## Goal

Each day card gains a "เสร็จ" (complete) checkbox. Completed days show a green
check and dimmed text — nothing is hidden. Clearing the mark requires a
confirm dialog. State persists in Convex.

## Decisions (from brainstorming Q&A)

1. Scope: one checkbox per **day** card (not per branch, commit, or summary
   item).
2. Persistence: **Convex** — survives reload, syncs across tabs (user choice,
   not client-only state).
3. Completed look: **green check + dimmed text** — no strikethrough, no
   hiding.
4. Un-tick → styled in-app confirm dialog. Rejected: native `window.confirm`
   (functional but jarring against the dark theme).

## Data model (`convex/schema.ts`)

New table `completedDays`:

- `day: v.string()` — Bangkok `"YYYY-MM-DD"`, the same string the UI groups
  by; one row per completed day, presence = complete.
- Index `by_day` on `["day"]` — equality for `setDone`, range for the month
  listing.

Rejected: a `done: v.boolean()` row kept on un-tick (extra state, no
benefit); localStorage (single browser, no cross-tab sync — user chose
Convex).

## Backend (`convex/completedDays.ts`, new)

- `listByMonth({ year, month })` — public query; reuses `monthRange` from
  `summaryLogic`; range scan on `by_day` with `.take(1000)`; returns the day
  strings.
- `setDone({ day, done })` — public mutation; `.unique()` lookup; insert when
  `done && !existing`, delete when `!done && existing`. Idempotent — safe to
  double-call.
- No auth, consistent with the rest of this personal dashboard.

## Frontend (`app/page.tsx`)

- New `useQuery(api.completedDays.listByMonth, …)`, skipped until year+month
  are chosen (same pattern as summaries); memoized into a `Set<string>` of
  done days.
- Day header row (the `flex items-center justify-between … px-4 py-3` div at
  lines 260–265): the right side becomes a cluster — commits badge plus a
  checkbox label:
  - native `<input type="checkbox">`, `h-4 w-4 accent-emerald-400`, violet
    focus ring, visible "เสร็จ" text; the whole label is clickable. Checked =
    emerald check, which is the completed mark.
- Un-ticked → `setDone({ day, done: true })` immediately. Ticked → opens the
  confirm dialog (state `confirmDay: string | null`) instead of mutating.
- Completed styling: date `h2` switches `text-cyan-300` → `text-cyan-300/40`;
  the card body (`flex flex-col gap-4 px-4 py-4`) gets `opacity-60`. Commits
  badge and card borders unchanged.
- Confirm dialog: conditional overlay (`fixed inset-0 z-50`, `bg-black/60`,
  click-outside closes) + centered card (`rounded-xl border-zinc-800
  bg-zinc-900`), text `เปลี่ยนกลับเป็น "ยังไม่เสร็จ"?`, buttons `ปิด` (ghost)
  and `ยืนยัน` (violet `smallButtonClass`). `role="dialog"` +
  `aria-modal="true"`. Deliberate simplification: no focus trap, no Escape
  handling (marked with a `ponytail:` comment in code) — revisit if it grows
  into a real dialog need.
- Errors: no optimistic state — the reactive query is the source of truth; a
  failed mutation leaves the checkbox as-is and logs with `console.error`.

## Edge cases

- Two tabs: the reactive query keeps both in sync.
- Cancel/close in the confirm dialog keeps the day complete.
- Changing year/month re-runs the query ("skip" otherwise).
- Historic rows for days without commits are never rendered — harmless.

## Verification

1. `bunx tsc --noEmit`, `bun run lint`, `bun test` — the existing 27 tests
   stay green; no new pure logic to unit-test (the mutation is covered by the
   CLI E2E below).
2. `bunx convex dev --once` to the dev deployment
   (`dev:your-deployment`).
3. CLI E2E: `bunx convex run completedDays:setDone '{"day":"2026-09-27","done":true}'`
   → `listByMonth` includes the day → same call with `done:false` → gone.
4. User click-through on :3000: tick → check + dim; untick → dialog → ยืนยัน
   reverts; reload keeps the tick.

## Out of scope

- Auth; per-branch/commit granularity; hiding completed days; auto-complete
  rules.
