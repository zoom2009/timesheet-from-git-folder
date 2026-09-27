# AI Branch Summary — Design

Date: 2026-09-27

## Goal

Each branch group in the timesheet dashboard gets a button that asks an AI to
summarize that day's commits on that branch in ≤120 characters. Summaries are
stored in Convex (keyed by day + repo + branch) so they survive reloads and
appear live in every open tab.

## Decisions (from brainstorming Q&A)

1. Summary language: **English** (user choice).
2. Model: `qwen/qwen3.8-27b:free` via the **Convex AI Gateway**, falling back
   to `poolside/laguna-s-2.1:free` on HTTP 429, with one 10 s retry round
   before giving up (user decision 2026-09-27 after the originally chosen
   `z-ai/glm-5.2:free` was rejected by the gateway — see Model findings).
3. Zero new dependencies: the gateway is called with the docs' manual-fetch
   pattern (`getServiceToken("ai-gateway")` + `fetch`), not the OpenAI SDK or
   the Vercel AI SDK. Convex 1.46.0 is installed and exports `getServiceToken`.
4. The button always regenerates on click (manual refresh of stale summaries);
   summaries do not auto-invalidate when new commits land on the same day.
5. One row per (day, repo, branch); the summary is hard-capped at 120 chars on
   write (prompt asks for ≤120, server truncates as a fallback).
6. No auth on the Convex functions. Acceptable for this personal local
   dashboard; the upgrade path (if it ever matters) is Convex auth or a shared
   token.

## Data model (`convex/schema.ts`)

Table `summaries`:

- `day: string` — Bangkok day `"YYYY-MM-DD"`, the same string the UI already
  groups by (`group.day`), so no timezone math is needed server-side.
- `repo: string` — repo folder name (`repo.name`).
- `branch: string` — branch label (`branchGroup.branch`); may be `""` when a
  commit has no ref name.
- `summary: string` — the generated text, ≤120 chars.

Index: `by_day_and_repo_and_branch` on `["day", "repo", "branch"]`. One
composite index serves both uses: the month listing (range scan on `day`, the
index's first field) and the exact-triple upsert lookup (equality on all three
fields).

First click inserts a row; later clicks patch the same row (no duplicates).

## Backend

### `convex/summaries.ts`

- `listByMonth({ year: number, month: number })` — public query. Computes the
  month range with `monthRange`, scans the index with
  `gte("day", start).lt("day", end)`, bounded with `.take(1000)`.
- `summarizeBranch({ day, repo, branch, titles: string[] })` — public action:
  1. Guard: throw if `titles` is empty; cap at 100 titles, 200 chars each,
     before building the prompt.
  2. `await getServiceToken("ai-gateway")`.
  3. `POST https://ai-gateway.convex.dev/v1/chat/completions` with
     `Authorization: Bearer <token>`, body `{ model, messages, max_tokens:
     200 }`.
     System prompt: summarize a developer's git work log in English, one
     factual line, max 120 characters, no markdown/quotes/explanation. User
     message: repo, branch, day, then the commit titles as a bullet list.
  4. Non-2xx → throw with status + truncated body; missing/empty content →
     throw. The client shows the message verbatim (gateway errors like
     `AiGatewayDisabled` included).
  5. `clampSummary(text)` → `ctx.runMutation(internal.summaries.upsert, ...)`
     → return the stored summary.
- `upsert` — internal mutation: `.unique()` lookup on the triple via the
  index; patch if found, insert otherwise.

### `convex/summaryLogic.ts` (pure helpers)

- `monthRange(year, month)` → `{ start, end }` day strings;
  `end` wraps to January of the next year for December.
- `clampSummary(text)` → collapse whitespace runs to single spaces, trim,
  `slice(0, 120)`.
- `buildPrompt({ day, repo, branch, titles })` → the user-message string.

Helpers must live under `convex/` because Convex functions cannot import from
`lib/`. Unit test: `convex/summaryLogic.test.ts` with `bun:test`, matching the
existing `lib/commits.test.ts` pattern (Convex CLI ignores `*.test.ts`).

## Frontend

- `app/ConvexClientProvider.tsx` (new, client component): module-level
  `new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)`, wraps children
  in `ConvexProvider`. No auth, so plain `ConvexProvider` is correct.
- `app/layout.tsx`: wrap `{children}` with the provider.
- `app/page.tsx`:
  - `useQuery(api.summaries.listByMonth, year && month ? { year: Number(year),
    month: Number(month) } : "skip")`; build a `Map` keyed
    `` `${day}|${repo}|${branch}` ``.
  - Branch header row becomes a flex row: branch label left, button right.
    Button label: `สรุปด้วย AI`; `กำลังสรุป...` (disabled) while running;
    `สรุปใหม่` once a summary exists.
  - Click handler: per-key busy map + per-key error map
    (key = `` `${day}|${repo}|${branch}` ``); calls the action with the
    group's commit titles (`branchGroup.commits.map(c => c.title)`); errors
    render as small red text under the branch; cleared on retry.
  - Summary text renders under the branch label, small and muted.
  - Button styling: smaller variant of the existing button classes.
- Existing commit lists and scan flow are untouched.

## Deployment

- `bunx convex dev --once` pushes schema + functions to the linked dev
  deployment (`dev:your-deployment`) and regenerates `_generated`
  (required for the `api.summaries` types).
- For day-to-day development afterwards, keep `bunx convex dev` running in a
  second terminal so edits push automatically.

## Edge cases

- Year/month not selected → query is skipped; no summary UI state.
- Gateway errors (`AiGatewayDisabled`, bad model name, timeouts) → shown
  verbatim per branch; retry = click again.
- Model returns more than 120 chars → server truncates.
- Empty branch string (`""`) → the row still gets a button.
- Reload or second tab → summaries come from Convex reactively.

## Assumptions

- The team has AI Gateway access (paid plan); otherwise the first click shows
  `AiGatewayDisabled` and we would fall back to a provider key (out of scope).
- The dev deployment is linked and CLI login is valid (already true today).

## Model findings (2026-09-27)

Free-tier model availability on the gateway is volatile; probed live:

- `z-ai/glm-5.2:free` → 404 "unavailable for free" (gateway suggests the
  paid slug `z-ai/glm-5.2`). `inclusionai/ling-3.0-flash:free`,
  `nex-agi/nex-n2.5-mini:free`, `thinkingmachines/inkling-small:free` → 404 /
  harness-only.
- `qwen/qwen3.8-27b:free` and `google/gemma-4-*:free` → intermittent 429s
  ("Provider returned error"); free slots clear on ~minute-long windows, so
  bursts of rapid calls fail instantly while spaced attempts succeed.
- `nvidia/nemotron-3-super-120b-a12b:free` answers but leaks
  chain-of-thought into `content` and burns the token budget thinking
  (`finish_reason: length`) — unusable for a save-the-first-120-chars flow.
- `poolside/laguna-s-2.1:free` → clean one-line output in ~1.4 s; used as the
  fallback.

Consequence: a click can still fail under heavy free-tier load (the action
retries both models once after a 10 s pause) and then shows "model ฟรีไม่ว่าง
ชั่วคราว". Reliability upgrade path: set `MODEL` in `convex/summaries.ts` to
the paid `z-ai/glm-5.2` (one line, billed per click).

## Verification

1. `bun test` — new `summaryLogic` tests pass; existing 10 tests unchanged.
2. `bunx tsc --noEmit` and `bun run lint` clean.
3. `bunx convex dev --once` deploys without errors; types regenerate.
4. Browser check against real data: select a month, click a branch's
   `สรุปด้วย AI` → summary appears under the branch, ≤120 chars; reload keeps
   it; clicking `สรุปใหม่` replaces the text.

## Out of scope

- Auth on the Convex functions.
- Auto-invalidation/regeneration when commits change.
- Streaming responses; batch "summarize whole day" actions.
- Tests for the network action itself (mocked fetch); unit tests cover the
  pure helpers only.
