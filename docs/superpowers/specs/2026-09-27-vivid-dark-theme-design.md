# Vivid Dark Theme — Design

Date: 2026-09-27

## Goal

The dashboard is currently pure zinc gray (only amber/red status colors exist).
Add color to the existing dark UI using a "vivid roles" system: every element
family owns one hue so the month view is readable by color, while zinc stays the
structural skeleton (backgrounds, borders, card frames).

## Decisions (from brainstorming Q&A)

1. Direction C "vivid roles" chosen over A (single violet accent) and B
   (GitHub-style entity colors). Reference mockup: day card with cyan date,
   violet AI button, pink branch chip, emerald badge/bullets, sky repo.
2. **Dark only.** The app stops following `prefers-color-scheme`; the dark look
   becomes the one and only theme. Light mode is dropped, not redesigned.
3. Colors use the stock Tailwind palette (violet/cyan/sky/pink/emerald + existing
   amber/red). No custom theme tokens, no new dependencies.

## Color roles

| Element | Hue | Treatment |
|---|---|---|
| Primary buttons (รีเฟรช, เดือนนี้) | violet | `bg-violet-600 text-white`, hover `violet-500` |
| AI "สรุปด้วย AI" button | violet | same family, small size — all actions read violet |
| AI summary text | violet | `bg-violet-500/10` rounded box, `text-violet-300` |
| Day card left edge | cyan | `border-l-4 border-l-cyan-400` stripe |
| Day date heading | cyan | `text-cyan-300` |
| Day badge "N commits" | emerald | `bg-emerald-500/15`, `text-emerald-300` |
| Stats line numbers | emerald / sky / cyan | commits / repos / วัน; words stay `zinc-400` |
| Repo row | sky | `sky-400` dot + `text-sky-300` name; count muted |
| Branch name | pink | chip: `bg-pink-500/15`, `text-pink-300`, rounded-full |
| Commit bullets | emerald | `marker:text-emerald-400` per `<li>`; text stays `zinc-300` |
| Warnings / errors | amber / red | unchanged from today |

Focus states: selects get `focus:border-violet-500` + `focus:ring-2
focus:ring-violet-500/40`; buttons get the `focus-visible:` equivalents. The
native outline is replaced by this visible ring, never silently removed.

## Dark-only switch

- `app/globals.css`: keep the existing variable structure, pin `:root` to the
  dark values (`--background: #0a0a0a`, `--foreground: #ededed`), delete the
  `@media (prefers-color-scheme: dark)` block, and add `color-scheme: dark` so
  native UI (select dropdowns, scrollbars) renders dark.
- `app/page.tsx`: remove every `dark:` prefix; the former dark variant becomes
  the single styling. Example: `dark:border-zinc-700 dark:bg-zinc-900` on the
  selects becomes plain `border-zinc-700 bg-zinc-900`. The file shrinks.

## Verification

1. `bun run lint` and `bunx tsc --noEmit` clean.
2. `bun test` — existing 13 tests untouched and still green (no logic changes).
3. Visual check on the live dev preview: compare day card against the approved
   mockup (panel C); confirm the native select dropdown renders dark
   (`color-scheme`), buttons show white-on-violet, and keyboard focus rings are
   visible on selects and buttons.

## Out of scope

- Light theme (removed by decision) and any theme toggle / persisted preference.
- Layout, structure, copy, or data changes — styling only.
- Gradients, glow, animation.
- Colored repo names beyond the sky treatment (no per-repo generated hues).
