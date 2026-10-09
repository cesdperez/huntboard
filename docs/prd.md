# Product requirements

## Problem

An organiser runs a city-wide scavenger hunt that lasts several hours. Teams complete challenges and send proof (photos, videos, sometimes the physical object). The organiser has to keep track of which team did what, judge how well they did it, and keep a live score that everyone can follow.

Doing this from a WhatsApp chat and memory does not work at this scale: several teams, about 50 challenges, subjective scoring, and several hours of messages.

## Reference event

The first event shapes the requirements, but the app stays generic.

- About 30 to 40 players in 4 to 7 teams of 6 or 7.
- About 50 challenges. There are more than any team can finish, so choosing which ones to do is part of the strategy.
- A fixed time window (for example 16:00 to 21:00). At the end time every team has to be at a meeting point. Each minute late costs points.
- Proof is sent to the organiser over WhatsApp, or arrives in person.
- Some challenges are clear-cut, others are judged on quality ("a napkin card gets 5, a detailed drawing gets 20").

## Roles

| Role | How they get in | What they can do |
|---|---|---|
| Admin | The admin link, created with the game | Edit challenges and teams, judge claims, add adjustments, record arrivals. A game can have several admins: anyone with the admin link |
| Player | Their team's secret link | See all challenges, mark them done with an optional note, follow their own team's status |
| Spectator | The public scoreboard link | See team names and total points |

Players and admins type a nickname on first visit. It is stored in the browser and used only to show who did what ("marked done by Sam"). It is not an account.

## Views

### Scoreboard (public)

- Team names and total points, ranked.
- Updates live during the game.
- Never shows which challenges a team has done.

### Team page (secret link per team)

- The scoreboard at the top.
- All challenges with their point ranges.
- Each challenge shows one state for this team:
  - **Open**: not claimed yet.
  - **Pending**: the team marked it done and is waiting for a judge.
  - **Scored**: a judge awarded points, shown next to it.
  - **Rejected**: a judge did not accept the claim. The team can mark it done again.
- Marking done takes an optional short note (a reference to a WhatsApp message, or an explanation).
- A team can undo its own claim while it is still pending.
- The team page shows only this team's data. The server must enforce this: it never sends another team's claims to the browser.

### Admin

- **Queue**: pending claims, oldest first. Each shows team, challenge, note, who marked it and when. The judge picks points within the challenge's range, or rejects.
- **Grid**: teams × challenges, showing every claim and its state. Lets a judge score a claim directly, fix a score, or see at a glance what is still pending.
- **Points picker**: quick buttons for min, middle and max, plus a number field. Values are clamped to the challenge's range.
- **Adjustments**: free-form bonus or penalty per team, with a reason.
- **Arrivals**: one tap per team when it reaches the meeting point. The app computes minutes late against the end time and applies the penalty.
- **Setup**: game name, start and end time, penalty per minute late, teams, and the challenge list (pasted as text, see [challenge format](challenge-format.md)).
- **Links**: copy the scoreboard link, each team's link and the admin link.

## Scoring rules

- A team scores each challenge at most once.
- Points for a challenge are always within its range.
- A team's total is the sum of its scored claims plus its adjustments, minus its late penalty.
- Pending claims count as zero until judged.
- Judges may score as they go, or leave subjective claims pending and judge them later, for example to compare entries.

## Data model

```
game        id, name, admin_token, scoreboard_token, starts_at, ends_at, late_penalty_per_minute
team        id, game_id, name, token, arrived_at
challenge   id, game_id, title, description, section, min_points, max_points, position
claim       id, team_id, challenge_id, status (pending|scored|rejected), note,
            marked_by, marked_at, points, judged_by, judged_at
            unique (team_id, challenge_id)
adjustment  id, team_id, points (signed), reason, created_by, created_at
```

## Non-goals for the prototype

- Accounts, passwords, email or OTP verification.
- Uploading photos or videos. Proof stays on WhatsApp.
- Repeatable challenges.
- Points outside a challenge's range.
- Push notifications.
- Maps or location tracking.

## Constraints

- Works on a phone browser, one-handed. Most of the judging happens on the organiser's phone while scrolling WhatsApp.
- Runs on the Cloudflare free tier for one event of about 40 people over 5 hours.
