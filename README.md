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

| Layer         | Choice                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Language      | TypeScript, full stack                                                                  |
| Compute       | Cloudflare Workers (serves both the built React frontend and the API from one Worker)   |
| API framework | Hono                                                                                    |
| Database      | Cloudflare D1 (SQLite at the edge), via Drizzle ORM — env binding: `DB`                 |
| Validation    | Zod                                                                                     |
| Frontend      | React + Vite                                                                            |
| Styling       | Plain CSS                                                                               |
| Auth          | Cloudflare Access for Workers                                                           |
| Tests         | Vitest (+ `@cloudflare/vitest-pool-workers`, React Testing Library), Playwright for e2e |
| CI/CD         | GitHub Actions + `wrangler-action`, deploy on push to `main`                            |

## Local development

```
npm install
./scripts/bootstrap.sh
npm run dev
```

`bootstrap.sh` provisions (or reuses) the `rummikub-scores-db` D1 database on your Cloudflare
account, generates a local `wrangler.toml` from `wrangler.toml.example` (gitignored — never
committed, since it embeds a real D1 database ID), applies migrations to both the local and remote
databases, and regenerates `worker-configuration.d.ts`. It needs `wrangler login` to already be
authenticated, plus `jq` and `envsubst` (`brew install jq gettext` on macOS) on your PATH.

`npm run dev` then builds the React frontend and starts `wrangler dev` (Miniflare-backed, no live
Cloudflare account needed for day-to-day dev) on `http://localhost:8787`, alongside a Vite watcher
that rebuilds the frontend on change.

**Starting over**: if you want to blow away the D1 database and rebuild from nothing, run
`wrangler d1 delete rummikub-scores-db` then re-run `./scripts/bootstrap.sh` — it's idempotent and
will recreate the database and regenerate config from scratch.

Other commands:

| Command             | Does                                                |
| ------------------- | --------------------------------------------------- |
| `npm run build`     | Builds the frontend into `dist/client`              |
| `npm run deploy`    | Builds and deploys the Worker via `wrangler deploy` |
| `npm run typecheck` | Type-checks the frontend and worker                 |

## Deployment

GitHub Actions builds, tests, applies D1 migrations, and deploys the Worker on every push to `main`.
There's no staging environment — the CI pipeline (type checks, tests, branch protection) is the
safety net instead of a parallel deploy target.

## License

MIT — see [LICENSE](LICENSE).
