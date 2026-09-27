# Current Month Button — Design

Date: 2026-09-27

## Goal

Add one button to the dashboard that fills the ปี (year) and เดือน (month) selects
with the current Bangkok calendar month, so the common case (checking this month's
commits) takes one click instead of two dropdown picks.

## Decisions (from brainstorming Q&A)

1. A single button ("เดือนนี้") fills both selects. No auto-select on page load,
   no separate year/month buttons.
2. "Current" means the Asia/Bangkok calendar month, matching how commits are
   grouped, and is computed at click time (stays correct if the page is left open).
3. If the current year has no commits in the scan, the year dropdown still lists it,
   so the select never renders visually blank after a click (results then show
   "ไม่มี commits ในเดือนนี้").

## Design

Single file change: `app/page.tsx`. No API, lib, or git-scan changes; no new
dependencies.

- Filter bar section: a button labeled "เดือนนี้" after the เดือน select, aligned
  by the existing `items-end` row, styled like the รีเฟรช button (border, rounded-lg,
  hover, dark-mode aware).
- Click handler:
  - `const today = bangkokDay(new Date().toISOString());` (existing tested helper)
  - `setYear(today.slice(0, 4));`
  - `setMonth(String(Number(today.slice(5, 7))));`
- `years` memo: when the scan is ready, union `availableYears(commits)` with the
  current Bangkok year (kept in descending order, no duplicate).
- The button is never disabled: clicking while the scan is still loading just
  presets the selects; results render once data arrives.

## Edge cases

- Click before data loads → selects preset, options resolve when ready.
- Current year absent from data → year still listed, month shows the empty state.
- Month boundary while the page is open → click recomputes; no stale value.

## Verification

1. `bun test` — unchanged; `bangkokDay` already pins the UTC→Bangkok day boundary
   that defines the current month.
2. `bun run lint` and `bunx tsc --noEmit` clean.
3. Browser check with the dev server: click เดือนนี้ → ปี = 2026, เดือน = กันยายน,
   and the summary line + day cards match manually selecting กันยายน 2026.

## Out of scope

- Previous/next month navigation buttons.
- Auto-selecting the current month on load.
- Persisting the last viewed month.
