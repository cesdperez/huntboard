# Product requirements

## Problem

An organiser runs a city-wide scavenger hunt that lasts several hours. Teams complete challenges and send proof (photos, videos, sometimes the physical object). The organiser has to keep track of which team did what, judge how well they did it, and keep a live score that everyone can follow.

Doing this from a WhatsApp chat and memory does not work at this scale: several teams, about 50 challenges, subjective scoring, and several hours of messages.

## Reference event

The first event shapes the requirements, but the app stays generic.

- About 30 to 40 players in 4 to 7 teams of 6 or 7, in Amsterdam.
- About 50 challenges. There are more than any team can finish, so choosing which ones to do is part of the strategy.
- A fixed time window (for example 16:00 to 21:00). At the end time every team has to be at a meeting point. Each minute late costs points.
- Proof is sent to the organiser over WhatsApp, or arrives in person.
- Some challenges are clear-cut, others are judged on quality ("a napkin card gets 5, a detailed drawing gets 20").

## Roles

| Role | How they get in | What they can do |
|---|---|---|
| Creator | The create page plus the creation code | Create a game. They land on its admin page |
| Admin | The admin link, created with the game | Edit the game, challenges and teams, judge claims, add adjustments, record arrivals, rotate links. Anyone with the admin link is an admin |
| Player | Their team's secret link | See all challenges, mark them done with an optional note, undo a pending claim, rename their team |
| Spectator | The public scoreboard link | See team names and total points |

Players and admins type a nickname on first visit. It is stored in the browser and used only to show who did what ("marked done by Sam"). It is not an account.

## Game window

- The admin sets a start and end time. The admin's browser converts them from its own time zone. Every viewer sees times in their own browser's time zone.
- Teams can mark challenges done and undo pending claims only between the start and end time. The server enforces this.
- Admins can judge, adjust and record arrivals at any time, including after the end.

## Views

### Scoreboard (public)

- Team names and total points, ranked. Tied teams share a rank.
- Updates live during the game.
- Never shows which challenges a team has done.
- Works on a phone and scales up to a big screen for the final reveal.

### Team page (secret link per team)

- The team's rank and total at the top. It expands to the full scoreboard.
- A countdown to the start, or to the end while the game runs.
- All challenges with their point ranges, grouped by section.
- Each challenge shows one state for this team:
  - **Open**: not claimed yet.
  - **Pending**: the team marked it done and is waiting for a judge.
  - **Scored**: a judge awarded points, shown next to it.
  - **Rejected**: a judge did not accept the claim. The judge's reason shows, if there is one. The team can mark it done again.
- Marking done takes an optional short note (a reference to a WhatsApp message, or an explanation).
- A team can undo its own claim only while it is pending.
- A team can rename itself. The admin sets the first name.
- The team page shows only this team's data. The server must enforce this: it never sends another team's claims to the browser.

### Admin

- **Queue**: pending claims, oldest first. Each shows team, challenge, note, who marked it and when. The judge picks points within the challenge's range, or rejects with an optional reason.
- **Grid**: teams × challenges, showing each team's current claim and its state. A judge can score an open cell directly (for proof that arrives in person), fix a score, or reject a scored claim.
- **Points picker**: quick buttons for min, middle and max, plus a number field. Values are whole numbers, clamped to the challenge's range.
- **Adjustments**: free-form bonus or penalty per team, with a reason.
- **Arrivals**: one tap per team when it reaches the meeting point. The time can be corrected or cleared. The app computes minutes late against the end time and applies the penalty.
- **Setup**: game name, start and end time, penalty per minute late, teams, and the challenge list (pasted as text, see [challenge format](challenge-format.md)). Single challenges can be edited in place.
- **Links**: copy the scoreboard link, each team's link and the admin link. Any link can be rotated, which makes the old one stop working.

## Scoring rules

- A team scores each challenge at most once. A team has at most one active claim (pending or scored) per challenge. Rejected claims stay as history, and the team can claim again.
- Points are whole numbers within the challenge's range.
- A team's total is the sum of its scored claims plus its adjustments, minus its late penalty.
- Pending claims count as zero until judged.
- Judges may score as they go, or leave subjective claims pending and judge them later, for example to compare entries.
- Late penalty: whole minutes late (rounded down) times the penalty per minute. No cap. A team with no arrival gets no automatic penalty. The admin adds an adjustment if it never shows up.

## Data model

All times are stored as UTC.

```
game        id, name, admin_token, scoreboard_token, starts_at, ends_at,
            late_penalty_per_minute, created_at
team        id, game_id, name, token, position, arrived_at
challenge   id, game_id, title, title_key, description, section, min_points, max_points, position
            unique (game_id, title_key)
claim       id, team_id, challenge_id, status (pending|scored|rejected), note,
            marked_by, marked_at, points, judged_by, judged_at, judge_note
            unique (team_id, challenge_id) where status in (pending, scored)
adjustment  id, team_id, points (signed), reason, created_by, created_at
```

A claim an admin creates from the grid has `marked_by` set to the admin's nickname and goes straight to scored.

## Non-goals for the prototype

- Accounts, passwords, email or OTP verification.
- Uploading photos or videos. Proof stays on WhatsApp.
- Repeatable challenges.
- Points outside a challenge's range, or fractional points.
- Push notifications.
- Maps or location tracking.
- Languages other than English.

## Constraints

- Mobile first. Works on a phone browser, one-handed. Most of the judging happens on the organiser's phone while scrolling WhatsApp.
- Runs on the Cloudflare free tier for one event of about 40 people over 5 hours.
- Visual and interaction rules live in [DESIGN.md](../DESIGN.md).
