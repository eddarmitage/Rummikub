# Rummikub scores

A web app to track Rummikub game scores, hosted entirely on Cloudflare's developer platform.

## What it does

- Each game gets a shareable link built from a short random ID (e.g. `/g/aB3xK9mQ`)
- Anyone with the link can view the scorecard — running totals per player, one row per round
- Players enter the number of points left on their rack at the end of each round; the app tallies totals
- Submitting/editing scores and creating games requires being logged in (Cloudflare Access)
- Later: per-game membership and roles, league tables aggregating a player's results across games

See [`docs/spec.md`](docs/spec.md) for the full architecture, data model, and API design, and
[`docs/mockups/`](docs/mockups/) for UI reference screenshots.

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript, full stack |
| Compute | Cloudflare Workers (serves both the built React frontend and the API from one Worker) |
| API framework | Hono |
| Database | Cloudflare D1 (SQLite at the edge), via Drizzle ORM |
| Validation | Zod |
| Frontend | React + Vite |
| Styling | Plain CSS |
| Auth | Cloudflare Access for Workers |
| Tests | Vitest (+ `@cloudflare/vitest-pool-workers`, React Testing Library), Playwright for e2e |
| CI/CD | GitHub Actions + `wrangler-action`, deploy on push to `main` |

## Local development

```
npm install
npm run dev
```

This builds the React frontend and starts `wrangler dev` (Miniflare-backed, no live Cloudflare
account needed) on `http://localhost:8787`, alongside a Vite watcher that rebuilds the frontend on
change. Other commands:

| Command | Does |
|---|---|
| `npm run build` | Builds the frontend into `dist/client` |
| `npm run deploy` | Builds and deploys the Worker via `wrangler deploy` |
| `npm run typecheck` | Type-checks the frontend and worker |

## Deployment

GitHub Actions builds, tests, applies D1 migrations, and deploys the Worker on every push to `main`.
There's no staging environment — the CI pipeline (type checks, tests, branch protection) is the
safety net instead of a parallel deploy target.

## License

MIT — see [LICENSE](LICENSE).
