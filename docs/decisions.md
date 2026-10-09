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

## Point ranges, always clamped

Each challenge has a min and max. Judges cannot go outside it. A single value is a range where min equals max. Anything exceptional goes in as an adjustment with a reason.

## Challenges pasted as text

The organiser keeps the challenge list secret and writes it in their own tools. The admin pastes it as markdown-ish text and the app parses it. See [challenge format](challenge-format.md).

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

## Live updates by polling

Clients poll a small JSON endpoint every 15 seconds and pause while the tab is hidden.

Free-tier budget: about 40 clients, polling every 15 seconds for 5 hours, is roughly 48,000 Worker requests. The Workers free tier allows 100,000 requests per day. Static assets do not count. Check the current limits before the event, because they decide the polling interval.

If polling ever gets too close to the limit, the upgrade path is a Durable Object per game that pushes changes over WebSockets.

## Nothing event-specific in the app

The app never mentions specific people or a specific event. Names, themes and inside jokes live only in the challenge text the organiser writes.
