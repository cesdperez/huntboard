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

Secrets for `pnpm dev` live in `.env.dev`, which git ignores. Copy the example:

```
cp .env.example .env.dev
```

`CREATE_GAME_CODE` is the code `/new` asks for before it creates a game. After adding or renaming a variable, run `pnpm gen` to update `worker-configuration.d.ts`.

`/new` POSTs use the `CREATE_GAME_RATE_LIMITER` binding: five attempts per IP per 60 seconds, including successful requests and rejected forms. The limit runs before form parsing or Turnstile verification. A rejection returns 429 with `Retry-After: 60`. IPs are shared at some venues, so organisers behind the same IP share that allowance. Cloudflare's counters are local to each location and eventually consistent, so this is a burst limit rather than a global lockout.

The form also requires Turnstile verification before checking the creation code. Tokens must match the request hostname and the `create-game` action. Missing configuration or an unavailable protection service closes game creation. These protections apply only to `/new` submissions.

`pnpm dev` uses Cloudflare's always-pass test keys, including real Siteverify calls. Production builds reject test keys. Automated rehearsals against a production widget may be challenged as bots; use the local dev server for automated rehearsals.

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

## Load test

`pnpm loadtest` plays one full game over HTTP against a local production build: 7 teams of 6 players, 3 judges and a big screen over 5 hours, with an opening rush and a finale where 40 phones load the scoreboard. The players and judges follow the model in [Free-tier budget](docs/decisions.md#free-tier-budget). It reports Worker requests and D1 rows per request and per game, and compares them with the free plan's daily limits. It also checks that the final scoreboard matches the points the judges gave.

```sh
pnpm loadtest              # 5 game hours at 30x: about 12 minutes
pnpm loadtest --speed 300  # a quick smoke run
```

It serves the build with `wrangler dev` on port 4174 and keeps its own D1 state in `.wrangler/loadtest`, wiped on every run. `LOADTEST_METRICS` makes the Worker add each request's D1 usage in a `Server-Timing` header and turns off the per-link rate limit, which the compressed game would trip. Leave it unset in production. Local latency says nothing about Cloudflare, so the latency check only catches gross regressions.

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
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm run deploy
```

Use `pnpm run deploy`: plain `pnpm deploy` is a pnpm command, not this script. `pnpm db:migrate:remote` applies new migrations on later deploys too.

After that first setup, every push to `main` deploys through Cloudflare Workers Builds. It builds the app, applies pending D1 migrations, then runs `wrangler deploy`. Its settings live in Cloudflare, not in this repo: Worker `huntboard` → Settings → Builds, or `cf builds workers get <worker-tag>`. Preview builds for other branches are off. The build uses a Cloudflare API token with D1 Write permission, so rotating that token breaks deploys. `pnpm run deploy` stays as the manual fallback.

`TURNSTILE_SITE_KEY` in `wrangler.jsonc` belongs to the managed **Huntboard game creation** widget, restricted to `huntboard.checho.xyz`. `TURNSTILE_SECRET_KEY` must be that widget's secret. When changing the app hostname, update the widget's allowed hostnames in Cloudflare. The public site key can be committed; the secret belongs in a Worker secret and ignored local env files.

To deploy a code change and its Turnstile secret together, put only `TURNSTILE_SECRET_KEY` in a private JSON or env file and run `pnpm exec wrangler deploy --secrets-file <path>` after `pnpm build`. Wrangler preserves other existing secrets. Never upload `.env.example` as production secrets.

Rehearse against the production URL, with the code you just set:

```sh
HUNTBOARD_URL=https://huntboard.checho.xyz CREATE_GAME_CODE=... pnpm rehearsal
```

The app is served only on `huntboard.checho.xyz`, a custom domain on the `checho.xyz` zone. The zone's rate-limiting rule lives in Cloudflare (Security, WAF, Rate limiting rules), not in this repo; see [decisions](docs/decisions.md#abuse-limits).

Rehearsal games stay in the database. Delete them before the event:

```sh
pnpm exec wrangler d1 execute huntboard --remote --command "DELETE FROM game WHERE name LIKE 'Rehearsal %'"
```
