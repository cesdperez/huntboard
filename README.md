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
