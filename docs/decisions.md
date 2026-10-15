# Decisions

## Build our own instead of using an existing tool

Hosted hunt apps (GooseChase, Scavify, Thrillify, Questovery) do submissions and leaderboards, but the free tiers are too small (GooseChase free: about 3 teams of 5) and every player has to install an app. Plain scoreboards (KeepTheScore, ScoreLeader) only track totals, with no challenge list, so double counting and undo are on the organiser.

On GitHub nothing fits. The closest project, csesoc/scavhunt, is a Python server with player accounts built for one university event. The rest are toy projects or archived scoreboards. Building a small app is less work than adapting any of them.

## Secret links instead of accounts

Each team gets one unguessable link. Anyone who has it is on that team. The admin link and the public scoreboard link work the same way.

We considered joining with a game code plus a nickname, but then anyone can join any team. Email OTP would stop that but adds friction for 40 people at a party. Secret links stop team-hopping as long as each team keeps its link inside its own WhatsApp group, which matches how the event already runs.

A nickname is still asked once and kept in the browser, only to show who marked or judged something.

## Several admins share one admin link

Admins are not fixed in advance: the organiser may add co-judges late. Sharing the admin link is enough. The nickname shows which admin judged what.

## Two-step claims: team marks done, admin judges

Teams mark a challenge done, with an optional note. It goes to a pending queue. An admin then scores it within its range, or rejects it.

This keeps the organiser from mapping WhatsApp photos to teams and challenges in their head. It also lets judges hold subjective claims and score them later, for example to compare two teams' entries.

A team can undo a claim only while it is pending. Once judged, only an admin changes it.

## Claims keep their history

A rejected claim stays in the table. When the team claims again, a new row is created. A partial unique index allows only one pending or scored claim per team and challenge, so a challenge still scores at most once. The history shows the judge what was rejected before.

## Admins can score without a team claim

Some proof arrives in person and the team never marks it. The judge scores the open cell in the grid, which creates a scored claim directly.

## Strict game window

Teams mark and undo claims only between the start and end time, enforced on the server. Judging, adjustments and arrivals stay open after the end, because judging subjective claims often happens at the meeting point.

## Times in UTC, shown in the viewer's time zone

The server stores UTC only. The admin enters times in their browser, which converts from the browser's time zone. Each viewer sees times in their own browser's time zone. Times are formatted on the client, because the server runs in UTC.

## Late penalty

Minutes late are rounded down, so arriving 30 seconds late costs nothing. The penalty is linear with no cap. A team that never arrives gets no automatic penalty: the admin decides and adds an adjustment. Arrival times can be corrected or cleared, because the admin may tap late or tap the wrong team.

## Team names: admin sets, team can override

The admin names teams during setup so links are easy to hand out. A team can rename itself from its page. The admin can rename it back.

Each team also has an optional members line, such as "César, Kos, Martin", shown under the name. A team name alone does not say who is on the team. The admin or the team sets it, and it shows on the public scoreboard, so it is visible to anyone with that link.

## Rejections carry an optional reason

The judge can add a short reason when rejecting. The team sees it next to the rejected challenge.

## Whole-number points

Ranges and awarded points are integers. Fractions add input friction on a phone and no challenge needs them.

## Game creation needs a code

Creating a game asks for a creation code, set as a server secret. Without it, anyone who finds the site can fill the free-tier database. There is no list of games: each game is reachable only through its links.

Game creation also requires Turnstile and a rate limit of five attempts per minute per client IP. The rate limit runs before reading the form. Turnstile is verified server-side, including hostname and action, before checking the creation code. Failed protection checks never create a game. Teams, judges and scoreboard polling do not run these checks. IP limits suit infrequent organiser requests, but organisers on one shared connection share the allowance. Cloudflare's limiter is local to each location and eventually consistent, not a global lockout.

## Links can be rotated

If a team or admin link leaks, the admin rotates it. The old link stops working at once, and the admin shares the new one.

## Concurrent judging: first judge wins on pending claims

Judging a pending claim only succeeds if it is still pending. A second judge gets a message naming who judged it and how. Undoing a claim follows the same rule, so a team cannot undo a claim a judge just scored. Fixing an already judged claim from the grid is last write wins.

## Re-import matches by title

See [challenge format](challenge-format.md#re-importing). Exact title matching is easy to explain and to preview. Typo fixes on claimed challenges go through the in-place edit.

## Point ranges, always clamped

Each challenge has a min and max. Judges cannot go outside it. A single value is a range where min equals max. Anything exceptional goes in as an adjustment with a reason.

## Challenges pasted as text

The organiser keeps the challenge list secret and writes it in their own tools. The admin pastes it as markdown-ish text and the app parses it. The format has one way to write each part ([10] or [5-20] for points, `- ` for a challenge, `# ` for a section). A lenient parser that accepted many forms made the hint and example harder to follow than the few keystrokes it saved. See [challenge format](challenge-format.md).

## Proof stays outside the app

Photos and videos keep going to WhatsApp, and some proof arrives in person (furniture). Storing media for 40 people is a separate project. The claim note is enough to link a claim to the proof.

## Teams see all challenges, but not each other's progress

Challenge choice is the strategy, so every team sees the full list with point ranges. Other teams' claims are private. The scoreboard shows totals only. A big jump in points still hints at what a team did, which we accept.

## Stack

- **SvelteKit + TypeScript**, deployed to Cloudflare Workers with `@sveltejs/adapter-cloudflare`.
- **D1** (SQLite) for storage.
- **pnpm**.
- **Tailwind + shadcn-svelte** for components, only where they save time (buttons, dialogs, tables).
- **Vitest** for the challenge parser and scoring rules. These are pure functions and the easiest place to get things wrong.
- **Raw SQL on D1** through a thin query module. Five tables do not need an ORM.
- **Playwright CLI** for QA at the end of each milestone, on a phone viewport first.

## Live updates by polling

Each page's load function depends on a shared key. Clients invalidate it every 60 seconds, pause while the tab is hidden, and refresh at once on focus and after their own actions. `POLL_INTERVAL_MS` in `src/lib/live-updates.ts` holds the interval.

Before each poll the client fetches a small static file. Static assets never run the Worker, so the check costs nothing from the request budget. When it fails, the poll is skipped and the page shows an offline notice. Without the check, a load that fails offline replaces the whole page with the error page.

### Free-tier budget

Free-tier limits, checked October 2026:

| Limit | Free plan | Source |
|---|---|---|
| Worker requests | 100,000 per day, reset at 00:00 UTC | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Static asset requests | Free and unlimited | [Static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) |
| D1 rows read | 5,000,000 per day, reset at 00:00 UTC | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| D1 rows written | 100,000 per day | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |

D1 rows read decide the interval, not Worker requests. Rows read count every row a query scans, index rows included. Past the daily limit every D1 query fails, so every page load fails until 00:00 UTC. That ends the game, so the estimate keeps about half the limit spare.

Rows read per poll, measured on local D1 (which reports `rows_read` the same way) with 7 teams, 50 challenges, 182 claims and 14 adjustments, and no other game in the database:

| Page | Start of game | End of game | Average |
|---|---|---|---|
| Team | 119 | 773 | 446 |
| Scoreboard | 17 | 490 | 254 |
| Admin (Queue, Grid or Teams) | 1 to 109 | 444 to 574 | about 300 |

A realistic game: 40 players in 7 teams, 3 admins, one big screen, 5 hours. Phones lock and players switch to WhatsApp, so a team page is visible about one minute in five: about 8 team pages poll at any moment, plus the big screen and 3 admin pages. Each player opens the page about 12 times an hour, and each open loads it once. About 180 claims and 180 judgements each cost a request plus a refresh.

| Interval | Worker requests | D1 rows read | Share of D1 limit |
|---|---|---|---|
| 15 s | 17,500 | 7.0 million | 139% |
| 30 s | 10,300 | 4.1 million | 83% |
| 45 s | 7,900 | 3.2 million | 64% |
| 60 s | 6,700 | 2.7 million | 54% |

Opening pages and acting cost about 1.3 million rows at any interval. Polling costs about 4,700 rows per round of 12 clients.

If all 44 clients stayed visible for the whole game, 60 seconds would read about 5.7 million rows (114%) from about 14,000 requests. Requests stay far from their limit even then: at 15 seconds that case is about 54,000.

Rows read also grow with other games in the database. Two queries scan claims of every game: the scored claims behind each scoreboard, and a team's own claims. One more finished game of the same size added about 60% to a team page poll. Delete old games, rehearsal games included, before the event.

If polling ever gets too close to the limit, the cheaper fix is indexes that keep those two queries inside one game, then a cheap check that loads the page only when the game changed. The upgrade path past that is a Durable Object per game that pushes changes over WebSockets.

## Nothing event-specific in the app

The app never mentions specific people or a specific event. Names, themes and inside jokes live only in the challenge text the organiser writes.
