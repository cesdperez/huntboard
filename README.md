# Huntboard

A live scoreboard for team scavenger hunts. Teams check off challenges from their phones, organisers judge and award points, and everyone watches one shared leaderboard.

No accounts. Each team joins through its own secret link, so teams see only their own progress and the totals of everyone else. Creating a game needs a creation code.

## Docs

- [Product requirements](docs/prd.md)
- [Decisions](docs/decisions.md): what we chose and why
- [Challenge format](docs/challenge-format.md): how organisers paste in their challenge list
- [Open questions](docs/open-questions.md)
- [Security assessment](docs/security-assessment.md): findings and their remediation
- [Design](DESIGN.md): visual and interaction rules for every screen

## Stack

SvelteKit + TypeScript on Cloudflare Workers, D1 for storage, pnpm. Everything fits the Cloudflare free tier.

## Code layout

Dependencies point one way: route, then action adapter or page builder, then use case, then database or storage, then domain. Routes stay thin and hold no rules.

`src/lib`:

- `domain/`: pure game rules and shared limits, such as the challenge parser, scoring and points.
- `format/`: display formatting, such as times, ordinals and plurals.
- `client/`: code for the page in the browser, such as live updates, the game clock and image resizing. Pages that render on the server use some of it too.
- `themes/`: the theme registry and each theme's tokens.
- `components/`: Svelte components, and the form action state they share.
- `action-results.ts`: the form action result types, by key.

`src/lib/server`:

- `use-cases/`: what each form action does, tested without HTTP.
- `pages/`: page load builders.
- `http/`: request guards, security headers, form parsing and link lookups.
- `db/`: D1 queries.
- `storage/`: the R2 image store.
- `actions/`: thin form action adapters.
- `testing/`: an in-memory R2 bucket for tests.

A use case returns an `ActionOutcome<R>`: an HTTP status and a result. The adapter calls `respond(key, outcome)` from `server/actions/respond.ts`, which puts the result under `page.form[key]`. The client reads it back by the same key, through `AdminAction<K>` or `resultUnder(page.form, key)`. `ActionResults` in `src/lib/action-results.ts` maps each key to its result type on both sides, so a renamed key or a changed result fails `pnpm check`.

Domain rules are written test first. Vitest covers the domain, use cases, page builders and D1 queries. Query tests run on in-memory SQLite. UI is checked with Playwright rather than component tests. Before a commit, `pnpm test`, `pnpm check` and `pnpm lint` pass.

## Local development

```sh
pnpm install
pnpm db:migrate
pnpm dev
```

Secrets for `pnpm dev` live in `.env.dev`, which git ignores. Copy the example:

```
cp .env.example .env.dev
```

`CREATE_GAME_CODE` is the code `/new` asks for before it creates a game. After adding or renaming a variable, run `pnpm gen` to update `worker-configuration.d.ts`.

In production the code is the only guard on game creation, so it must be random: at least 24 characters from a password generator. The zone's WAF rule caps guesses per IP, but many IPs can still find a short or guessable code.

## Rehearsal

`pnpm rehearsal` plays a short game end to end in a browser: 4 teams, 10 challenges, judging from the queue and the grid, adjustments, a late arrival and a tie. It runs against the local dev server, and starts one if none is running.

```sh
pnpm exec playwright install chromium   # once
pnpm rehearsal
```

To rehearse against another deployment, set `HUNTBOARD_URL` and that deployment's `CREATE_GAME_CODE`:

```sh
HUNTBOARD_URL=https://huntboard.example.com CREATE_GAME_CODE=... pnpm rehearsal
```

Each run creates a new game.

## Load test

`pnpm loadtest` plays one full game over HTTP against a local production build: 7 teams of 6 players, 3 judges and a big screen over 5 hours, with an opening rush and a finale where 40 phones load the scoreboard. The players and judges follow the model in [Free-tier budget](docs/decisions.md#free-tier-budget). It reports Worker requests and D1 rows per request and per game, and compares them with the free plan's daily limits. It also checks that the final scoreboard matches the points the judges gave.

```sh
pnpm loadtest              # 5 game hours at 30x: about 12 minutes
pnpm loadtest --speed 300  # a quick smoke run
```

It serves the build with `wrangler dev` on port 4174 and keeps its own D1 state in `.wrangler/loadtest`, wiped on every run. `LOADTEST_METRICS` makes the Worker add each request's D1 usage in a `Server-Timing` header. Leave it unset in production. Local latency says nothing about Cloudflare, so the latency check only catches gross regressions.

## Deploy

The app runs on the Cloudflare free tier. A human runs these commands once, from the repo root:

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create huntboard
pnpm exec wrangler r2 bucket create huntboard-images
```

The bucket holds the game images and team pictures. `wrangler deploy` fails while the bucket named in `wrangler.jsonc` does not exist, so create it before the first deploy.

`wrangler.jsonc` holds this project's `database_id`. On another Cloudflare account, replace it with the id that `d1 create` prints and commit it. Then:

```sh
pnpm db:migrate:remote
pnpm exec wrangler secret put CREATE_GAME_CODE
pnpm run deploy
```

Use `pnpm run deploy`: plain `pnpm deploy` is a pnpm command, not this script. `pnpm db:migrate:remote` applies new migrations on later deploys too.

After that first setup, every push to `main` deploys through Cloudflare Workers Builds. It builds the app, applies pending D1 migrations, then runs `wrangler deploy`. Its settings live in Cloudflare, not in this repo: Worker `huntboard` → Settings → Builds, or `cf builds workers get <worker-tag>`. Preview builds for other branches are off. The build uses a Cloudflare API token with D1 Write permission, so rotating that token breaks deploys. `pnpm run deploy` stays as the manual fallback.

Rehearse against the production URL, with the code you just set:

```sh
HUNTBOARD_URL=https://huntboard.checho.xyz CREATE_GAME_CODE=... pnpm rehearsal
```

The app is served only on `huntboard.checho.xyz`, a custom domain on the `checho.xyz` zone. The zone's rate-limiting rule lives in Cloudflare (Security, WAF, Rate limiting rules), not in this repo; see [decisions](docs/decisions.md#abuse-limits).

Rehearsal games stay in the database. Delete them before the event:

```sh
pnpm exec wrangler d1 execute huntboard --remote --command "DELETE FROM game WHERE name LIKE 'Rehearsal %'"
```

Their images stay in R2 under `<game id>/`. Reset a rehearsal game from its Setup tab before deleting it to remove them too.
