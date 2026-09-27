# AI Summary List Format — Design

Date: 2026-09-27

## Goal

The AI branch summary becomes a short plain-language list instead of one line:
1 to 5 items scaled to how much work there is, each ≤ 80 characters, written
so a reader with no technical background still understands it.

## Decisions (from brainstorming Q&A)

1. **1–5 items** per summary, counted per distinct feature — related commits
   merge into one line, and lines describe the result, not the engineering
   (user choice 2026-09-27; replaces an earlier flat max-5, briefly a fixed
   max-3).
2. Language: **English** (kept from the original design).
3. Storage stays a single string field with items joined by `"\n"` — no schema
   change, no migration. Existing single-line rows render as a one-item list.
4. Enforcement is prompt + server clamp (same pattern as the old 120-char cap).
5. Independent change landed the same day: the 429 fallback slug is now
   `~deepseek/deepseek-v4-flash-latest` (the gateway's floating alias — the
   tilde is required; primary unchanged:
   `qwen/qwen3.7-flash` with `reasoning: {enabled: false}`).

## Backend

### `convex/summaryLogic.ts`

- `MAX_SUMMARY_CHARS = 120` is replaced by `MAX_SUMMARY_ITEMS = 5` and
  `MAX_SUMMARY_ITEM_CHARS = 80` (nothing else imports the old constant).
- `clampSummary(text)` becomes a list clamp:
  1. split on newlines (`/\r?\n/`);
  2. per line: collapse whitespace runs, trim, strip a leading bullet or
     number prefix (`- `, `* `, `• `, `1. ` — models add these despite
     instructions);
  3. drop empty lines;
  4. cap each item at 80 chars;
  5. keep the first 5 items; join with `"\n"`.
- `monthRange` and `buildPrompt` are untouched.

### `convex/summaries.ts`

- `SYSTEM_PROMPT` rewritten to:

  > You summarize a developer's git work log for a non-technical reader.
  > Reply with 1 to 5 short lines in English, one point per line, each at
  > most 80 characters. One line per feature, not per commit: merge related
  > commits into the one feature they deliver. Say what the app or page can
  > now do — the result, not the engineering behind it (no tokens, flags,
  > tests, or function names). Match the number of lines to the distinct
  > features: 1 for a small change, up to 5 for a busy day. Use simple
  > everyday words: no jargon, no commit prefixes like "feat:" or "fix:",
  > no bullet symbols, no markdown, no quotes.

- `max_tokens` 200 → 300: five 80-char lines (~120 tokens) fit without
  truncation. Billing is per actual token, so the raised cap costs nothing.
- Everything else in the action (retry chain, error messages, upsert) is
  unchanged.

## Frontend (`app/page.tsx`)

- The summary pill keeps its violet styling but renders
  `summary.split("\n")` as a `list-disc` `<ul>` with one `<li>` per item,
  instead of the single `<p>`.
- Button, busy, and error behavior are unchanged.

## Edge cases

- Model emits bullet markers or numbers → stripped by `clampSummary`.
- Model returns 1 line → single-item list; old stored rows → one bullet, and
  "สรุปใหม่" regenerates them in the new format.
- Model returns > 5 items or a > 80-char item → clamped server-side.

## Verification

1. `bun test` — rewritten `clampSummary` tests: prefix strip, per-item cap,
   5-item cap, empty-line drop, single-line pass-through.
2. `bunx tsc --noEmit` and `bun run lint` clean.
3. `bunx convex dev --once` to the dev deployment (`dev:your-deployment`),
   then a real `summaries:summarizeBranch` run through the gateway: output is
   ≤ 5 plain-English lines, each ≤ 80 chars.
4. Probe the new fallback slug `~deepseek/deepseek-v4-flash-latest` on the
   gateway (slugs can 404; the fallback is only hit on 429).
5. User browser check: click "สรุปด้วย AI" → bullet list under the branch.

## Out of scope

- Schema change to an array field; migration of stored rows.
- A second "rewrite for non-technical readers" model pass.
- Auto-regenerating old summaries.
