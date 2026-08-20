# Rummikub scores

A web app to track Rummikub game scores, hosted entirely on Cloudflare's developer platform.

## What it does

- Each game gets a shareable link built from a short random ID (e.g. `/g/aB3xK9mQ`)
- Anyone with the link can view the scorecard — running totals per player, one row per round
- Players enter the number of points left on their rack at the end of each round; the app tallies totals
- Submitting/editing scores and creating games requires being logged in (Cloudflare Access)
- Per-game membership (`game_members`) is tracked automatically; role-based permissions aren't enforced yet. Later: league tables aggregating a player's results across games

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

Write routes are gated behind **Cloudflare Access**, scoped per-path rather than to the
whole Worker. See `docs/spec.md` "Auth" for the full model.

**Do not use the "Protect this Worker behind Access" one-click toggle** (Workers & Pages →
your Worker → Access tab) — it gates every route on the Worker, including the public
`GET /games/:id` scorecard view, which breaks "anyone with the link can view." Cloudflare
Access has no HTTP-method awareness and a bare path matches everything nested under it, so
there's no way to protect only `POST` while leaving the same-shaped `GET` public — this is
also why game creation lives at `POST /games/new` rather than `POST /games` (see
`src/worker/routes/games.ts`).

**One-time manual step (you own this, not this repo):** after deploying, in the Zero Trust
dashboard go to **Access controls → Applications → Create new application → Self-hosted and
private**, and add one **public hostname** destination per write route (up to 5 per
application, so one application covers all of these):

| Domain | Path |
| --- | --- |
| `<your-worker>.<account>.workers.dev` | `api/games/new` |
| `<your-worker>.<account>.workers.dev` | `api/games/*/players` |
| `<your-worker>.<account>.workers.dev` | `api/games/*/rounds*` |
| `<your-worker>.<account>.workers.dev` | `api/auth/login` |

Note the **`api/` prefix**: the Hono app itself is mounted at `/api` (`src/worker/index.ts`),
and `wrangler.toml`'s `run_worker_first = ["/api/*"]` means only `/api/*` even reaches the
Worker — an Access application scoped to the bare paths (no `api/` prefix) never gates these
routes at all, so `requireAuth()` falls through to a plain `401 UNAUTHENTICATED` JSON response
instead of Access ever stepping in — including for `auth/login`, where that means the browser
renders the raw error JSON instead of following Access's hosted-login redirect.

Note the **Subdomain** field (separate from Domain) needs your Worker's own subdomain
(`<your-worker>`) — leaving it blank scopes the app to the bare account domain, which won't
match your Worker's traffic at all. Don't add a leading `/` inside the Path field; the UI
already prefixes one.

Add an **Access policy** (Allow, Include → Emails → your own email, or whichever identities
you want allowed) and attach it to the application. This repo intentionally never commits
that allow-list — only you know which email(s) should be let in, and an Access policy is a
real account/security setting, not something that belongs in a public repo.

**Verifying identity in the Worker:** a *self-hosted* Access Application (the setup above)
doesn't populate the Workers-native `ctx.access` binding — that binding only exists when you
use the "Protect this Worker" toggle this README tells you not to use. Instead,
`src/worker/middleware/auth.ts` verifies the `Cf-Access-Jwt-Assertion` header Access signs
onto every request that passes through the application (Cloudflare's [documented approach for
this](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/)),
which needs two values on your own `wrangler.toml` (see `wrangler.toml.example` — not secrets,
but still account-specific config, so this repo only ever commits `${...}` placeholders for
them, never real values):

- `ACCESS_TEAM_DOMAIN` — your Zero Trust team domain, e.g.
  `https://your-team.cloudflareaccess.com` (Zero Trust dashboard → Settings).
- `ACCESS_AUD` — the self-hosted Access Application's **Application Audience (AUD) Tag**, shown
  on its Overview tab once you've created it above.

`./scripts/bootstrap.sh` will pass these through if you `export` them first; otherwise it
leaves blank placeholders on the generated `wrangler.toml` for you to fill in by hand. Writes
401 until both are set to real values.

**The real deploy (`.github/workflows/deploy.yml`) needs these set separately** — it
regenerates `wrangler.toml` from scratch on every push to `main` from GitHub Actions
Variables, the same way it sources `D1_DATABASE_ID` from a Secret. Add both under this repo's
**Settings → Secrets and variables → Actions → Variables** (not Secrets — see the workflow
comment for why): `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, same values as above. Editing your own
local `wrangler.toml` has no effect on the deployed site; only these repo Variables do. This is
a one-time step — once set, every future deploy picks them up automatically.

**Local development / testing bypass:** there's no live Access session (and therefore no
`Cf-Access-Jwt-Assertion` header) under `wrangler dev` or the test suites.
`src/worker/middleware/auth.ts` accepts an `X-Dev-User-Email` header as a stand-in identity,
but only when `DEV_AUTH_BYPASS_ENABLED=true` is set — which is never true in the real
deployment, since `wrangler.toml.example` doesn't define it. To use it locally, add a line to
your gitignored `.dev.vars` file (create it if it doesn't exist):

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
