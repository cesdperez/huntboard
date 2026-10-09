# Open questions

## Product

- **Repeatable challenges.** Not in the prototype. If wanted later, a challenge needs a max count, and a claim is no longer unique per team and challenge.
- **Scoreboard freeze.** Should the scoreboard hide changes for the last part of the game so the final result is a reveal?
- **Big-screen view.** A full-screen scoreboard for the final reveal at the meeting point.
- **Team names.** Does the admin set them, or does each team pick its own on first visit?
- **Rejection reasons.** Should a rejection carry a short message back to the team?
- **Late penalty.** Is it linear with no cap? What happens to a team that never arrives?

## Technical

- **Team link leaks.** If a link gets out, anyone can act for that team. Rotating a team's link from the admin page would be a cheap fix.
- **Free-tier limits.** Confirm the current Workers and D1 free-tier limits before the event. They set the polling interval.
- **Concurrent judging.** Two admins can judge the same claim at once. Last write wins is probably fine, but the UI should show who judged it.
