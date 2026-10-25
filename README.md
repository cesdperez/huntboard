# Huntboard

A live scoreboard for team scavenger hunts. Teams check off challenges from their phones, organisers judge and award points, and everyone watches one shared leaderboard.

No accounts. Each team joins through its own secret link, so teams see only their own progress and the totals of everyone else. Creating a game needs a creation code.

- [Design](DESIGN.md): visual and interaction rules for every screen
- [Challenge format](docs/challenge-format.md): how organisers paste in their challenge list

## How a game works

| Role | How they get in | What they can do |
|---|---|---|
| Creator | `/new` plus the creation code | Create a game. They land on its admin page |
| Admin | The admin link | Edit the game, challenges and teams, judge claims, add adjustments, record arrivals, rotate links |
| Player | Their team's link | See all challenges, mark them done with an optional note, undo a pending claim, rename the team |
| Spectator | The scoreboard link | See team names, members and totals |

Players and admins type a nickname on first visit. It is kept in the browser and only shows who marked or judged something. It is not an account.

- **Links are the access model.** Each link holds a 128-bit random token. Anyone with a team link is on that team, and several judges share one admin link. A leaked link is rotated from Setup, and the old one stops working at once.
- **Claims take two steps.** A team marks a challenge done, and an admin scores it within its point range or rejects it with an optional reason. A team can undo a claim only while it is pending. An admin can also score a cell in the grid directly, for proof that arrives in person.
- **A challenge scores at most once per team.** Rejected claims stay as history and the team can claim again. When two judges act on the same pending claim, the first wins and the second sees who judged it.
- **Points are whole numbers inside the challenge's range.** Anything exceptional is an adjustment with a reason. A team's total is its scored claims plus adjustments, minus the late penalty.
- **The game window is enforced on the server.** Teams claim and undo only between the start and end time. Judging, adjustments and arrivals stay open after the end.
- **Late penalty.** Whole minutes late, rounded down, times the penalty per minute, with no cap. A team that never arrives gets no automatic penalty; the admin adds an adjustment.
- **Times are stored in UTC** and shown in each viewer's own time zone.
- **Teams see every challenge but not each other's claims.** The scoreboard shows totals only.
- **Proof stays outside the app**, in the group chat or in person. The app stores only one image per game (an invitation, poster or map) and one picture per team, in R2.
- **Themes live in code.** A game picks a registered theme in Setup; see [Themes](DESIGN.md#themes).

## Stack

SvelteKit and TypeScript on Cloudflare Workers, D1 (SQLite) for data, R2 for images, pnpm. Tailwind and shadcn-svelte for components. Raw SQL through thin query modules. Everything fits the Cloudflare free tier.

## Code layout

Dependencies point one way: route, then action adapter or page builder, then HTTP guard, then use case, then database or storage, then domain. A module imports only from its own layer or the layers below it, and it may skip layers. Routes stay thin and hold no rules.

Use cases, queries and the image store take the database or bucket as an argument. They never import SvelteKit or `cloudflare:workers`. Use cases read `FormData` themselves, because it is a web standard type and not a request.

`src/lib`:

- `domain/`: pure game rules and shared limits, such as the challenge parser, scoring and points.
- `format/`: display formatting, such as times, ordinals and plurals.
- `client/`: code for the page in the browser, such as live updates, the game clock and image resizing. Pages that render on the server use some of it too.
- `themes/`: the theme registry and each theme's tokens.
- `components/`: Svelte components, and the form action state they share.
- `action-results.ts`: the form action result types, by key. It imports only types, from use cases.

`src/lib/server`:

- `actions/`: thin form action adapters. They read the request, call a use case, and turn its outcome into a response, a failure or a redirect.
- `pages/`: page load builders.
- `http/`: request guards, security headers, the D1 usage meter for the load test, and the admin and team link guards that answer 404.
- `use-cases/`: what each form action does, tested without HTTP, and the form field readers they share.
- `db/`: D1 queries, including the team link lookup.
- `storage/`: the R2 image store. It also builds the response for an image request.
- `testing/`: an in-memory R2 bucket for tests.

The bottom layer is `domain/`, `format/` and the theme registry in `themes/index.ts`. These import nothing from `src/lib/server`. Browser code imports only types from `src/lib/server`.

A use case returns an `ActionOutcome<R>`: an HTTP status and a result. The adapter calls `respond(key, outcome)` from `server/actions/respond.ts`, which puts the result under `page.form[key]`. When success is a redirect, the use case returns what the adapter needs to build it instead, such as the new admin token. `/new` puts its result at the top of `page.form`, so its adapter calls `fail` directly. The client reads it back by the same key, through `AdminAction<K>` or `resultUnder(page.form, key)`. `ActionResults` in `src/lib/action-results.ts` maps each key to its result type on both sides, so a renamed key or a changed result fails `pnpm check`.

The schema lives in `migrations/`, applied in order by Wrangler.

## Local development

Needs Node 24 and pnpm.

```sh
pnpm install
cp .env.example .env.dev
pnpm db:migrate
pnpm dev
```

`.env.dev` is gitignored. `CREATE_GAME_CODE` is the code `/new` asks for before it creates a game. After adding or renaming a variable, run `pnpm gen` to update `worker-configuration.d.ts`.

`/dev/design` shows every component in every theme: `/dev/design?theme=<id>&mode=dark`. It answers 404 outside `pnpm dev`.

## Testing

```sh
pnpm test    # Vitest: domain, use cases, page builders and D1 queries
pnpm check   # svelte-check and the load test's type check
pnpm lint    # Prettier and ESLint
```

All three pass before a commit. Query tests run on in-memory SQLite with every migration applied. UI is checked with Playwright rather than component tests.

### Rehearsal

`pnpm rehearsal` plays a short game end to end in a browser: 4 teams, 10 challenges, judging from the queue and the grid, adjustments, a late arrival and a tie. It also fails on any CSP violation. It runs against the local dev server, and starts one if none is running.

```sh
pnpm exec playwright install chromium   # once
pnpm rehearsal
```

To rehearse against a deployment, set `HUNTBOARD_URL` and that deployment's `CREATE_GAME_CODE`:

```sh
HUNTBOARD_URL=https://huntboard.example.com CREATE_GAME_CODE=... pnpm rehearsal
```

Each run creates a new game named `Rehearsal ...`. Delete them before a real event:

```sh
pnpm exec wrangler d1 execute huntboard --remote --command "DELETE FROM game WHERE name LIKE 'Rehearsal %'"
```

Their images stay in R2 under `<game id>/`. Reset a rehearsal game from its Setup tab before deleting it to remove them too.

### Load test

`pnpm loadtest` plays one full game over HTTP against a local production build: 7 teams of 6 players, 3 judges and a big screen over 5 hours, with an opening rush and a finale where 40 phones load the scoreboard. It reports Worker requests and D1 rows read per request and per game, compares them with the free plan's daily limits, and checks that the final scoreboard matches the points the judges gave.

```sh
pnpm loadtest              # 5 game hours at 30x: about 12 minutes
pnpm loadtest --speed 300  # a quick smoke run
```

It serves the build with `wrangler dev` on port 4174 and keeps its own D1 state in `.wrangler/loadtest`, wiped on every run. `LOADTEST_METRICS` makes the Worker add each request's D1 usage in a `Server-Timing` header. Leave it unset in production. Local latency says nothing about Cloudflare, so the latency check only catches gross regressions.

## Free-tier budget

Pages poll: clients reload their data every 60 seconds, pause while the tab is hidden, and refresh at once on focus and after their own actions. `POLL_INTERVAL_MS` in `src/lib/client/live-updates.ts` holds the interval. Before each poll the client fetches `/reachable.txt`, a static file that never runs the Worker. When it fails, the poll is skipped and the page shows an offline notice instead of an error page.

D1 rows read decide the interval, not Worker requests. The free plan allows 5 million rows read and 100,000 Worker requests per day, reset at 00:00 UTC. Past either limit every request fails until the reset, which ends a running game, so the budget keeps about half the rows limit spare.

The model game: 40 players in 7 teams, 3 admins, one big screen, 5 hours. Phones lock and players switch apps, so a team page is visible about one minute in five. About 180 claims and 180 judgements.

| Interval | Worker requests | D1 rows read | Share of D1 limit |
|---|---|---|---|
| 30 s | 10,300 | 4.1 million | 83% |
| 60 s | 6,700 | 2.7 million | 54% |

Claim queries start from the game's teams and use the `claim_team_id` index, so other games in the database add no rows to a poll. The scoreboard caches its standings per game for 15 seconds, so extra scoreboard viewers cost almost no rows. If polling ever gets too close to the limit, the next step is a cheap check that loads the page only when the game changed, and past that a Durable Object per game pushing changes over WebSockets.

## Deploy

Every push to `main` deploys through Cloudflare Workers Builds. It builds the app, applies pending D1 migrations with `pnpm db:migrate:remote`, then runs `wrangler deploy`. Its settings live in the Cloudflare dashboard (Worker `huntboard`, Settings, Builds), not in this repo. Preview builds for other branches are off. The build uses a Cloudflare API token with D1 Write permission, so rotating that token breaks deploys.

`pnpm run deploy` builds and deploys by hand. Use `pnpm run deploy`: plain `pnpm deploy` is a pnpm command, not this script.

### First deploy on a new Cloudflare account

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create huntboard
pnpm exec wrangler r2 bucket create huntboard-images
```

Put the `database_id` that `d1 create` prints into `wrangler.jsonc`, and change the custom domain in `routes` to one on a zone you own. `wrangler deploy` fails while the R2 bucket does not exist. Then:

```sh
pnpm db:migrate:remote
pnpm exec wrangler secret put CREATE_GAME_CODE
pnpm run deploy
```

The creation code is the only guard on game creation, so make it random: at least 24 characters from a password generator.

## Security

- **Access.** Admin, team and scoreboard links each carry a 128-bit random token, looked up separately per role. Every server action checks its own token and scopes its queries to that game or team. Team and scoreboard pages never receive another team's claims or any privileged token. Unknown links answer 404.
- **Game creation.** `/new` needs the `CREATE_GAME_CODE` secret, compared in constant time. An unset secret matches nothing.
- **Headers.** SvelteKit sets an enforced CSP with per-request script nonces. `src/hooks.server.ts` adds `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS and `X-Robots-Tag: noindex` to every Worker response, and `Cache-Control: no-store` to secret-link pages. `_headers` applies the static ones to assets. `robots.txt` disallows everything.
- **Requests.** Plain HTTP redirects to HTTPS. Bodies without `Content-Length` get 411 and bodies over 2 MiB get 413, before any parsing. Uploaded images are checked for size, declared type and magic bytes.
- **Abuse limits.** The Worker is served only on its custom domain; `workers_dev` and `preview_urls` are off in `wrangler.jsonc`, so every request passes the zone's WAF. A zone rate-limiting rule, configured in Cloudflare and not in this repo, blocks an IP for 10 seconds after 300 requests in 10 seconds, skipping static paths. The cap is high because a whole party often shares one Wi-Fi IP. A distributed attack can still spend the daily free-tier allowance; stopping that needs Cloudflare's paid bot and DDoS features.
- **Accepted trade-offs.** A link is a bearer credential with no expiry until it is rotated. Nicknames are labels, not identities. Team names and members lines are visible to anyone with the scoreboard link.
