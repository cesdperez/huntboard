# Huntboard

A live scoreboard for team scavenger hunts. Teams check off challenges from their phones, organisers judge and award points, and everyone watches one shared leaderboard.

No accounts. Each team joins through its own secret link, so teams see only their own progress and the totals of everyone else. Creating a game needs a creation code.

## Docs

- [Product requirements](docs/prd.md)
- [Decisions](docs/decisions.md): what we chose and why
- [Challenge format](docs/challenge-format.md): how organisers paste in their challenge list
- [Open questions](docs/open-questions.md)
- [Plan](docs/plan.md): milestones and how each one is checked
- [Design](DESIGN.md): visual and interaction rules for every screen

## Stack

SvelteKit + TypeScript on Cloudflare Workers, D1 for storage, pnpm. Everything fits the Cloudflare free tier.

## Local development

```sh
pnpm install
pnpm db:migrate
pnpm dev
```

Secrets for `pnpm dev` live in `.dev.vars`, which git ignores. Create it with this content:

```
CREATE_GAME_CODE=letmein
```

`CREATE_GAME_CODE` is the code `/new` asks for before it creates a game. After adding or renaming a variable, run `pnpm gen` to update `worker-configuration.d.ts`.

## Rehearsal

`pnpm rehearsal` plays a short game end to end in a browser: 4 teams, 10 challenges, judging from the queue and the grid, adjustments, a late arrival and a tie. It runs against the local dev server, and starts one if none is running.

```sh
pnpm exec playwright install chromium   # once
pnpm rehearsal
```

To rehearse against another deployment, set `HUNTBOARD_URL` and that deployment's `CREATE_GAME_CODE`:

```sh
HUNTBOARD_URL=https://huntboard.example.workers.dev CREATE_GAME_CODE=... pnpm rehearsal
```

Each run creates a new game.

## Deploy

The app runs on the Cloudflare free tier. A human runs these commands once, from the repo root:

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create huntboard
```

Put the `database_id` that `d1 create` prints into `wrangler.jsonc`, in place of the zeros, and commit it. Then:

```sh
pnpm db:migrate:remote
pnpm exec wrangler secret put CREATE_GAME_CODE
pnpm run deploy
```

Use `pnpm run deploy`: plain `pnpm deploy` is a pnpm command, not this script. `pnpm db:migrate:remote` applies new migrations on later deploys too.

Rehearse against the URL that `deploy` prints, with the code you just set:

```sh
HUNTBOARD_URL=https://huntboard.<your-subdomain>.workers.dev CREATE_GAME_CODE=... pnpm rehearsal
```

Rehearsal games stay in the database and make every poll read more rows (see [decisions](docs/decisions.md#live-updates-by-polling)). Delete them before the event:

```sh
pnpm exec wrangler d1 execute huntboard --remote --command "DELETE FROM game WHERE name LIKE 'Rehearsal %'"
```
