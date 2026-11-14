# AGENTS.md

## Commands

- `pnpm test` runs `vitest run` and exits after the tests.
- `pnpm exec vitest run src/path/to/file.test.ts` runs one test file.
- `pnpm exec vitest run -t "test name"` runs tests matching a name.
- `pnpm ports` prints this checkout's preview, load-test and dev URLs.
- `bash scripts/stop-servers.sh` stops this checkout's servers.
- See [Several worktrees](README.md#several-worktrees) for port, `HUNTBOARD_PORT` and Orca setup details.
- `pnpm dev` uses a strict port and fails if the port is busy. It does not choose another port.
- `pnpm rehearsal` reuses a dev server already listening on this checkout's dev port.
- `stop-servers.sh` finds servers by port, so pass the same `HUNTBOARD_PORT` they started with.

## Deployment

- Every push to `main` deploys to production through Cloudflare Workers Builds. Push to `main` only when asked.
- For a manual deploy, use `pnpm run deploy`, not `pnpm deploy`. See [Deploy](README.md#deploy).

## Checks

- Pre-commit runs `pnpm exec lint-staged && pnpm scan:staged` (Prettier and ESLint on staged files, gitleaks on staged changes).
- Pre-push runs `pnpm check && pnpm test && pnpm scan && pnpm knip`.
- trivy scans only production `dependencies`, so a package whose code ships to the browser or the Worker belongs there, not in `devDependencies`.
- gitleaks and trivy come from Homebrew.
- After changes, run `pnpm test`, `pnpm check` and `pnpm lint`.

## Context

- Read [Code layout](README.md#code-layout) before adding modules.
- Read [DESIGN.md](DESIGN.md) before UI changes.
- Read [Challenge format](docs/challenge-format.md) before changing challenge import.

## Git

- Rebase on origin/main right before merging or pushing to main; never force-push main.
