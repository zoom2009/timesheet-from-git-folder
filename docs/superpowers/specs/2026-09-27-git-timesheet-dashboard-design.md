# Git Timesheet Dashboard — Design

Date: 2026-09-27

## Goal

A local Next.js dashboard that reads the git history of every repo under
`/Users/you/projects`, keeps only commits authored by the
user, and shows a day-by-day summary for a user-selected year + month (both required).

## Verified environment facts

- 19 git repos in `~/projects`; 2 non-git folders (`robot-framework`, `videos`) skipped.
- User's author identities (3, kept as an editable constant in `lib/git-scan.ts`):
  - `you@example.com` (name: me)
  - `you@work.example` (name: me at work)
  - `you@ext.example` (name: me at client)
- 1,505 non-merge commits authored by the user; 16 repos have at least one.
- Merge commits are excluded from the summary.
- UI language: Thai. Month/year example from user: "ปี 2026 เดือน 9" → Gregorian year.

## Decisions (from brainstorming Q&A)

1. Filter scope: one year+month filter applies to all repos (no per-repo drill-down).
2. Each day shows: per repo — repo name, commit count, commit titles.
3. Data freshness: live git scan per page load (Approach A); month switching filters
   in the browser, no re-scan. A Refresh button re-runs the scan.
4. Merges excluded. All branches included (`--all`).
5. UI in Thai; Thai month names with Gregorian year (e.g. "กันยายน 2026").
6. Both year and month must be selected before results appear.

## Architecture

Small: 5 new/edited source files plus one test file.

| File | Role |
|---|---|
| `app/page.tsx` | `"use client"` dashboard UI (replaces scaffold) |
| `app/layout.tsx` | metadata title "Timesheet", `lang="th"` (small edit) |
| `app/api/commits/route.ts` | `GET /api/commits` — scans repos, returns JSON |
| `lib/commits.ts` | types + pure helpers (parseLog, bangkokDay, groupByDay, availableYears); client-safe |
| `lib/git-scan.ts` | server-only: folder/author constants, git exec, scanRepos |
| `lib/commits.test.ts` | bun test for parse/group/timezone logic |

Before coding, read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
and `.../03-api-reference/03-file-conventions/route.md` for Next 16 conventions.
Route handler needs the Node runtime (child_process) and must not be cached.

## Data flow

1. Page load → client `fetch("/api/commits")`.
2. Route handler lists `~/projects`, finds dirs containing `.git`, scans all in
   parallel with a per-repo timeout (30s):

   ```
   git -C <repoDir> log --all --no-merges -i \
     --author=<email1> --author=<email2> --author=<email3> \
     --pretty=format:%S%x1f%H%x1f%aI%x1f%s%x1e
   ```

   - Multiple `--author` flags OR together; `-i` makes matching case-insensitive.
   - `%S` = the ref each commit was reached from (the branch), `%aI` = strict ISO 8601
     author date with offset; `%s` = subject line.
   - Parse: split output on `\x1e`, drop empties, split each record on `\x1f`; first
     field ref (cleaned of `refs/heads/`, `refs/remotes/<remote>/`, `refs/tags/`),
     second hash, third ISO date, remaining fields joined = title (robust even if a
     title somehow contains `\x1f`).
3. Response JSON:

   ```ts
   type ApiResponse = {
     scannedAt: string; // ISO timestamp of the scan
     repoCount: number; // repos successfully scanned
     commits: { repo: string; hash: string; iso: string; title: string; branch: string }[];
     errors: { repo: string; message: string }[]; // failed repos
   };
   ```

4. Client stores all commits. On year+month selection it filters and groups in memory:
   - Day key = author date converted to Asia/Bangkok → `YYYY-MM-DD`
     (`Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", ... })`).
   - Group shape: `DayGroup = { day: string; repos: { name: string; commits: Commit[] }[] }`.
   - Days sorted newest first; within a day, repos sorted by count desc, then name;
     commits in git log order. Only days with commits appear.
5. Refresh button re-fetches `/api/commits`.

## UI (Thai)

- Header: "Timesheet" + scan info ("อ่านข้อมูล 16 repos · 1,505 commits") + "รีเฟรช" button.
- Filter bar: "ปี" select (years present in data, desc) + "เดือน" select (มกราคม–ธันวาคม).
  Both required.
- States:
  - Loading: "กำลังอ่าน git history..." (scan takes a few seconds).
  - API failure: Thai error message.
  - Partial repo failures: small note listing failed repos, rest of the page renders.
  - No selection yet: "เลือกปีและเดือนเพื่อดูข้อมูล".
  - Month selected but empty: "ไม่มี commits ในเดือนนี้".
  - Results: summary line ("27 commits · 8 repos · 12 วัน") then day cards newest first.
    Day header: "27 กันยายน 2026" (Gregorian year) + count badge; under it each repo's
    name + count + the commit titles grouped under a muted branch subheader (one per branch, shown once per group).
- Styling: Tailwind only, no new dependencies, dark-mode aware (existing scaffold style).

## Config

- `TRUE_PROJECTS_DIR` = `process.env.TRUE_PROJECTS_DIR ?? "/Users/you/projects"`.
- `AUTHOR_EMAILS` = the 3 emails above.
- Both constants live at the top of `lib/git-scan.ts`.

## Error handling

- Missing `~/projects` dir → API returns 500 with a clear message; UI shows it.
- Non-git folders skipped silently.
- A repo failing or exceeding the timeout → collected in `errors[]`, shown as a note;
  the rest of the results still render.
- Repos with no commits by the user contribute nothing and simply don't appear.

## Verification

1. `bun test` — parser and grouping unit tests (bun's built-in runner, no new deps):
   - parse: multiple records, Thai/unicode titles, empty output, trailing separators.
   - Bangkok day key: `23:30Z` must land on the next Bangkok day; `00:30+07:00` on the same day.
   - month filter + day/repo grouping order.
2. Manual: `bun run dev`, pick a month, cross-check one day's counts against
   `git -C <repo> log --all --no-merges -i --author=... --since/--until ... | wc -l`.

## Out of scope (possible later)

- Calendar view showing empty days.
- Per-repo drill-down or repo selection.
- CSV/export for timesheet submission.
- Static JSON snapshot mode.
- Auth or deployment (local tool only).
