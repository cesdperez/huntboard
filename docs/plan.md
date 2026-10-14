# Plan

The prototype is built in milestones. M0 to M5 run locally against a local D1 database. M6 deploys to Cloudflare. Each milestone ends with a working app, not a half-built layer.

## Definition of done for every milestone

1. Unit tests pass (`pnpm test`), type check passes (`pnpm check`), lint passes.
2. Run `/locallensedreview --autofix` on the milestone's changes and resolve what it reports.
3. QA with the Playwright CLI against `pnpm dev`, using the milestone's checklist below. Phone viewport (390 × 844) first, then 1280 × 800. Check light and dark themes. Screenshots go to `qa/` (git ignored).
4. The screens match [DESIGN.md](../DESIGN.md). Update DESIGN.md if a milestone made a better choice.
5. Commit.

Domain logic is written test first. UI is checked through Playwright QA rather than component tests.

## M0: Foundation

- Scaffold SvelteKit with TypeScript, `@sveltejs/adapter-cloudflare`, pnpm.
- `wrangler.toml` with a D1 binding. Local D1 through the platform proxy in `vite dev`.
- Migration `0001` with the schema from the [PRD](prd.md#data-model), including the partial unique index on active claims.
- Tailwind and shadcn-svelte, wired to the DESIGN.md tokens. Archivo loaded with its width axis.
- Base components: Button, Sheet, Marker (all four states), Points (tabular number).
- A dev-only `/dev/design` page that shows tokens, type scale, markers and buttons.
- Vitest, svelte-check, ESLint and Prettier set up.

QA: the app starts with `pnpm dev`. `/dev/design` renders in light and dark at 390px with no horizontal scroll. Markers are distinguishable in grayscale.

## M1: Domain logic (test first, no UI)

- Challenge parser: every accepted form in [challenge format](challenge-format.md), sections, descriptions, errors with line numbers, duplicate titles.
- Re-import diff: matched, new, deleted, deleted with claims, and clamped scores.
- Scoring: totals, ranks with ties, late penalty (rounded down minutes, no arrival means no penalty).
- Points clamping and quick values (min, middle rounded down, max).
- Game window check: before, during, after.
- Token generation: 128 random bits, base64url.

QA: none in the browser. The review checks test coverage of the edge cases above.

## M2: Create and set up a game

- `/new`: creation code plus game name. The code is the `CREATE_GAME_CODE` secret (`.env.dev` locally). Success redirects to the admin link.
- Nickname prompt on first visit, stored in `localStorage`.
- Admin Setup tab: game name, start and end (browser time zone to UTC), penalty per minute.
- Teams: add, rename, reorder, delete (only without claims).
- Challenges: paste, preview table with errors and re-import warnings, confirm. Edit a single challenge in place.
- Links: copy each link, rotate any link.

QA: create a game with a wrong code (rejected) and the right one. Paste the example from the challenge format doc and a broken list, check the preview. Re-import with a changed range. Rotate a team link and confirm the old one returns 404. Times entered in the browser show the same wall clock after reload.

## M3: Team play

- Team page at `/t/[token]`: sticky rank strip, countdown, challenge list by section, markers.
- Bottom sheet: description, note, "Mark done". Undo while pending. Claim again after rejection, showing the reason.
- Rename team.
- Server enforces the game window and that a token only ever sees its own team's claims.
- Live updates: invalidate on a fixed interval, pause when hidden, refresh on focus and after actions.

QA: two browser contexts on two team links. Mark, undo, and re-mark. Confirm team A's page data never contains team B's claims (inspect the `__data.json` response). Set the game window to the past and the future and confirm marking is refused with a clear message. Check the strip and sheet are usable with a thumb at 390px.

## M4: Judging

- Admin tabs: Queue, Grid, Teams, Setup, with a pending count on Queue.
- Queue: oldest first, points picker, reject with optional reason.
- Grid: sticky challenge column, markers per cell, score open cells directly, fix or reject scored claims.
- Teams tab: adjustments with reason, arrivals (record, correct, clear), totals breakdown per team.
- Conflict handling: judging or undoing a claim that is no longer pending returns a message naming who judged it.

QA: two admin contexts judging the same claim at once. A team undoing while an admin scores. Score from the grid without a team claim. Record a late arrival and check the penalty and total. Clamp: type a value outside the range.

## M5: Scoreboard and polish

- Public scoreboard at `/s/[token]`, ranked with ties, big-screen layout above 1024px.
- Score change motion (FLIP reorder, count-up), reduced motion respected.
- Game states across all views: not started, running, ended.
- Empty, error and offline states with copy from DESIGN.md.
- Accessibility pass: focus order, labels, live region on the team strip.
- Rehearsal: a Playwright script runs a short game with 4 teams and 10 challenges end to end.

QA: the rehearsal script passes. The scoreboard reorders live while a second context scores claims. Full-screen at 1920 × 1080 reads from across a room. Keyboard-only walk through the admin queue.

## M6: Deploy to Cloudflare

- Create the remote D1 database and apply migrations.
- Set `CREATE_GAME_CODE` as a Worker secret.
- `wrangler deploy`, and a deploy script in `package.json`.
- Check the current Workers and D1 free-tier limits and set the polling interval from them (see [decisions](decisions.md#live-updates-by-polling)).
- Smoke test on a real phone over mobile data.

QA: run the rehearsal script against the deployed URL. Check the request count in the Cloudflare dashboard matches the polling estimate.

## Later

Ideas kept out of the prototype. See [open questions](open-questions.md).

- Scoreboard freeze for the final reveal.
- Blocking destructive re-imports once the game has started.
- Dutch UI.
