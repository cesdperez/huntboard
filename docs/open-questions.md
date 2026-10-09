# Open questions

Resolved questions move to [decisions](decisions.md).

## Product

- **Repeatable challenges.** Not in the prototype. If wanted later, a challenge needs a max count, and the active-claim index has to go.
- **Scoreboard freeze.** Should the scoreboard hide changes for the last part of the game so the final result is a reveal?
- **Team name moderation.** Teams can rename themselves and the name shows on the public scoreboard. The admin can rename it back. Is that enough?
- **Language.** The prototype is English only. Do Dutch-speaking players need a Dutch UI?

## Technical

- **Free-tier limits.** Confirm the current Workers and D1 free-tier limits before the event. They set the polling interval.
- **Re-import after the game starts.** Re-importing deletes claims on challenges that disappear from the list. The preview warns, but a careless confirm mid-game loses scores. If this bites, block destructive re-imports once the game has started.
