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

| Command              | Does                                                                                |
| -------------------- | ---------------------------------------------------------------------------------- |
| `npm run build`      | Builds the frontend into `dist/client`                                             |
| `npm run deploy`     | Builds and deploys the Worker via `wrangler deploy`                                |
| `npm run typecheck`  | Type-checks the frontend, worker, and all test suites                              |
| `npm run test`       | Runs unit, integration (real `workerd` + local D1), and component tests (Vitest)   |
| `npm run test:watch` | Same as `npm run test`, in watch mode                                              |
| `npm run test:e2e`   | Runs the Playwright suite against a throwaway `wrangler dev` (`wrangler.e2e.toml`) |
| `npm run seed`       | Populates local D1 with a fake game, for `wrangler dev` / manual e2e poking        |

`npm run test` needs no setup — the integration project runs against a fully local D1
instance via `@cloudflare/vitest-pool-workers` (see `wrangler.test.toml`), and `npm run
test:e2e` spins up its own throwaway `wrangler dev` via `wrangler.e2e.toml` — neither needs
`./scripts/bootstrap.sh` or a live Cloudflare account. `npm run seed` is the exception: it
writes to whichever local D1 `wrangler dev` would use (`wrangler.toml` by default, or pass
`-- --config <file>` to target a different one, e.g. `wrangler.e2e.toml`), so it needs that
config (and its migrations) to already exist locally.

## Auth setup

Write routes are gated behind **Cloudflare Access for Workers** (native integration — the
Access policy is attached directly to the deployed Worker; Cloudflare enforces
authentication at the edge before the Worker's code runs). See `docs/spec.md` "Auth" for
the full model.

**One-time manual step (you own this, not this repo):** after deploying, attach an Access
policy to the Worker in the Cloudflare dashboard, and add your own email (or whichever
identities you want allowed) to its allowed list. This repo intentionally never commits
that allow-list — only you know which email(s) should be let in, and an Access policy is a
real account/security setting, not something that belongs in a public repo.
`wrangler.toml.example` has no placeholder for it because, per Cloudflare's native Workers
Access integration, attaching the policy doesn't require a `wrangler.toml` entry — this is
a new feature, so double-check that's still true when you do this step. If it turns out a
binding is required, add a parameterized placeholder to `wrangler.toml.example` the same
way `D1_DATABASE_ID` is handled (see `scripts/bootstrap.sh`), rather than committing the
real value.

**Local development / testing bypass:** there's no live Access session under `wrangler dev`
or the test suites, so `ctx.access` is always unset locally. `src/worker/middleware/auth.ts`
accepts an `X-Dev-User-Email` header as a stand-in identity, but only when
`DEV_AUTH_BYPASS_ENABLED=true` is set — which is never true in the real deployment, since
`wrangler.toml.example` doesn't define it. To use it locally, add a line to your gitignored
`.dev.vars` file (create it if it doesn't exist):

```
DEV_AUTH_BYPASS_ENABLED=true
```

then send `X-Dev-User-Email: <any-email>` on write requests instead of authenticating via a
real Access session.

## Deployment

GitHub Actions builds, tests, applies D1 migrations, and deploys the Worker on every push to `main`.
There's no staging environment — the CI pipeline (type checks, tests, branch protection) is the
safety net instead of a parallel deploy target.

## License

MIT — see [LICENSE](LICENSE).
