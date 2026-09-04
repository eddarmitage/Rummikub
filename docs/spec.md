# Rummikub scores — project spec

A web app to track Rummikub game scores, hosted entirely on Cloudflare's developer platform. This doc captures the architecture and decisions made so far, for scaffolding the initial project structure.

## What it does

- Each game gets a UUID-free shareable link using an 8-char nanoid (e.g. `/g/aB3xK9mQ`)
- Anyone with the link can view the scorecard — running totals per player, one row per round
- Players enter the tiles left on their rack at the end of each round (e.g. "3 5 8 J 12"; blank
  if they went out); the app computes each round's score per official Rummikub rules — the
  player with the fewest tiles is credited the sum of everyone else's rack value (face value,
  jokers = 30), everyone else is debited their own — and tallies running totals
- Once auth exists, submitting/editing scores and creating games requires being logged in
- Per-game membership (`game_members`) is tracked automatically; role-based permissions aren't enforced yet. Later: league tables aggregating a player's results across games

## Architecture

Single Cloudflare Worker deployment — no separate Pages project. One `wrangler.toml`, one deploy.

```
Browser
  └─> Worker (single deployment)
        ├─ Static assets (built React SPA)
        └─ API routes (Hono)
              ├─ reads: public, no auth
              └─ writes: require Cloudflare Access
        └─> D1 (games, players, rounds, scores, users)
```

- **Compute**: Cloudflare Workers, serving both the built React frontend (as static assets) and the API (Hono routes) from one Worker
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Storage (R2)**: not used in v1 — no file/blob needs yet
- **Auth**: Cloudflare Access (see Auth section)
- **Environments**: production only for now; no staging. Safety nets live in the CI pipeline (type checks, tests) rather than a parallel environment.

## Tech stack

| Layer                  | Choice                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Language               | TypeScript, full stack                                                                                          |
| API framework          | Hono                                                                                                            |
| DB access              | Drizzle ORM (D1-aware batch support, typed queries) or raw SQL for simple queries                               |
| Validation             | Zod                                                                                                             |
| Frontend               | React + Vite (Cloudflare Vite plugin for native Workers integration)                                            |
| Styling                | Plain CSS (no Tailwind — small app, not worth the abstraction layer while learning frontend)                    |
| Routing (frontend)     | React Router, or hand-rolled given the small number of routes                                                   |
| Unit/integration tests | Vitest + `@cloudflare/vitest-pool-workers` (runs against real workerd runtime, tests D1-backed routes directly) |
| Component tests        | Vitest + React Testing Library                                                                                  |
| E2E tests              | Playwright                                                                                                      |
| Local dev              | `wrangler dev` (Miniflare-backed, no live Cloudflare account needed)                                            |
| CI/CD                  | GitHub Actions + `wrangler-action`, deploy on push to `main`                                                    |

Scaffold from Cloudflare's own template as a starting point rather than hand-assembling: `npm create hono@latest` or the `create-cloudflare` CLI with the Hono + React option (see `cloudflare/react-router-hono-fullstack-template` on GitHub for a close reference).

## Data model (D1 / SQLite)

```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,           -- 8-char nanoid
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'complete'
  created_at INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id)    -- nullable until auth exists
);

CREATE TABLE players (
  id TEXT PRIMARY KEY,           -- nanoid
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT REFERENCES users(id),  -- nullable; links a player-in-a-game to a persistent user for league tables
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rounds (
  id TEXT PRIMARY KEY,           -- nanoid
  game_id TEXT NOT NULL REFERENCES games(id),
  round_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE scores (
  round_id TEXT NOT NULL REFERENCES rounds(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  tiles TEXT NOT NULL,   -- JSON array of remaining-tile tokens, e.g. '["3","5","J"]'; "J" = joker
  PRIMARY KEY (round_id, player_id)
);

-- Populated lazily: upserted on a user's first authenticated write via Access identity (email).
-- Can also be pre-created by an admin (e.g. to link a player before that person has ever logged in).
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE game_members (
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'editor',  -- 'owner' | 'editor'
  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX idx_players_game ON players(game_id);
CREATE INDEX idx_rounds_game ON rounds(game_id);
CREATE INDEX idx_scores_round ON scores(round_id);
CREATE INDEX idx_game_members_user ON game_members(user_id);
```

Each round's per-player score is computed on read from `tiles` (src/worker/lib/scoring.ts): the
player with the fewest tiles left is credited the sum of every other player's rack value (face
value of each tile, jokers = 30); everyone else is debited their own rack value. A tie for fewest
tiles (nobody went out) has no bonus that round — every player is just debited their own rack
value. A player's running total = sum of their computed round scores across a game, also computed
on read.

**Open design question, not yet settled**: how league tables should group games — automatically (any games a user played in) vs an explicit "league" entity (a named group of users/games set up deliberately). Decide before building that feature; doesn't block v1.

**Open design question, not yet settled**: whether `rounds` needs a `submitted_by` (attribution for who recorded the round) depends on the scoring flow — a single person entering everyone's tile counts vs. each player submitting their own. Decide when designing that flow (#4); add the column back via migration then if needed.

## API routes (v1)

| Route                              | Auth                                         |
| ---------------------------------- | -------------------------------------------- |
| `GET /games/:id`                   | Public                                       |
| `POST /games/new`                  | Requires Access (write-gated from the start) |
| `POST /games/:id/players`          | Requires Access                              |
| `POST /games/:id/rounds`           | Requires Access                              |
| `PATCH /games/:id/rounds/:roundId` | Requires Access                              |

Error response shape, consistent across all routes:
```json
{ "error": { "code": "GAME_NOT_FOUND", "message": "That game doesn't exist." } }
```

## Auth

**Cloudflare Access**, scoped per-path rather than to the whole Worker — a self-hosted Access application with one destination per write route (`/api/games/new`, `/api/games/*/players`, `/api/games/*/rounds*`, `/api/auth/login` — see README "Auth setup" for why the `/api` prefix is required), sharing one Allow policy. Cloudflare enforces authentication at the edge before the Worker's code runs for those paths only; `GET /games/:id` is never covered, so it stays public. A self-hosted application doesn't populate the Workers-native `ctx.access` binding (that's exclusive to the "Protect this Worker" toggle — see below), so the Worker instead verifies the `Cf-Access-Jwt-Assertion` header Access signs onto the request, using `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` (README "Auth setup") — see `src/worker/middleware/auth.ts`.

  Whole-Worker Access (the "Protect this Worker behind Access" one-click toggle in the dashboard, or a self-hosted app's bare `/games` path with no wildcard) doesn't work here: Access path matching has no HTTP-method awareness and a bare path matches everything nested under it, so it can't distinguish `POST /games` from `GET /games/:id` — either one gates both, breaking public reads. This is why game creation lives at `POST /games/new` rather than `POST /games`: nothing about method-based scoping is possible, so the write route needs its own path shape instead.

- `game_members` (game_id, user_id, role) is populated automatically: the creator becomes `owner` on `POST /games/new`; any other Access-allowed user becomes `editor` on their first successful write to a game (mirroring how `users` itself is lazily upserted). **Not yet enforced** — v1 behavior is unchanged: any Access-allowed user can still write to any game, and `role` isn't read anywhere yet.
- Access controls *who can log in* (an allow-list of emails/domains, manageable via Cloudflare's API — can be wrapped in an "invite" admin flow in-app)
- Your own `users` table in D1 controls *app-level identity* — upserted from Access identity on first authenticated write, or pre-created by an admin to link a player before that person has logged in
- End state (not yet implemented): route handlers check `role` to gate specific actions per game — e.g. only an `owner` can remove members or mark a game complete. What exactly an `editor` can't do that an `owner` can is undecided (see AGENTS.md "Open design questions"). Access remains the front door throughout — it authenticates, your D1 schema will authorize once that ships.

## Suggested project structure

```
/
├── src/
│   ├── worker/
│   │   ├── index.ts          # Hono app entrypoint
│   │   ├── routes/
│   │   │   ├── games.ts
│   │   │   └── rounds.ts
│   │   ├── middleware/
│   │   │   └── auth.ts       # Access identity check
│   │   └── db/
│   │       ├── schema.ts     # Drizzle schema
│   │       └── queries.ts
│   └── frontend/
│       ├── main.tsx
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── Game.tsx      # scorecard screen
│       │   └── EnterRound.tsx
│       └── styles/
├── migrations/
│   └── 0001_init.sql
├── scripts/
│   └── seed.ts                # populates local D1 with a fake game for dev/e2e
├── tests/
│   ├── unit/
│   ├── integration/            # Vitest + vitest-pool-workers, hits real Worker + D1
│   └── e2e/                    # Playwright, runs against wrangler dev
├── .github/workflows/deploy.yml
└── wrangler.toml
```

## Deployment

GitHub Actions, deploy on push to `main`:
1. Type-check / lint (fail fast before touching D1)
2. Run tests
3. `wrangler d1 migrations apply <db-name> --remote`
4. `wrangler deploy` via `cloudflare/wrangler-action`

No staging environment — single production environment, protected by the CI pipeline itself (branch protection on `main`, tests/type-checks as required steps) rather than a parallel deploy target.

## UI reference

Core screens roughed out during design. Mockup screenshots live alongside this doc (see `docs/mockups/`). Flat, minimal styling, no component library — plain CSS per the tech stack above.

### Scorecard (`/g/:id`) — the primary screen
- Card layout: game name as header, with a status badge ("Active" / "Complete")
- Subheading: current round number and when the game started
- A table: one row per round, one column per player, each cell showing that round's computed
  score (signed) with the entered tiles underneath for reference; a totals row at the bottom,
  bold, separated by a divider
- Players are sorted left to right in a fixed order (decided when the game/players are created); rows are chronological by round
- Primary action button: "Add round" — full width, prominent, always visible when the game is active
- Two secondary actions below it, side by side: "Share link" (copies/shares the URL) and "Sign in" (only relevant once the person tries to add a round or edit — this button doesn't gate viewing, it's there so returning players can authenticate ahead of writing)
- Anyone with the link sees this exact screen — no visual difference between an authenticated and anonymous viewer

### Add round (modal/overlay)
- Triggered from the "Add round" button on the scorecard
- Small centered card over a dimmed background
- Header shows which round number is being entered, with a close (×) affordance
- One row per player: name on the left, a free-text input on the right for the tiles left on
  their rack (e.g. "3 5 8 12"; J or * for a joker; blank means they went out), with a live hint
  showing the parsed tile count and rack value, or a validation error for an unrecognized token
- Single "Save round" button at the bottom, full width; disabled while any row has an invalid
  tile, or while the racks don't show exactly one player having gone out (blank) — a round has
  exactly one winner, and blocking submission with a hint follows the same treatment as an
  invalid tile
- This is the write action that requires auth — if the person isn't signed in when they try to save, this is the natural point to prompt sign-in rather than gating it earlier

### Home (only meaningful once auth/users exist — not part of v1's link-only flow)
- Page-level layout (not a card): app name/tagline at top
- Primary action: "Start new game" button, prominent
- Below that, a "Your recent games" list — each row shows the game name, a short status line (round count + active/complete), and a chevron to open it
- This screen only makes sense once the app knows who "you" are — in v1 (no auth), there's no way to know which games are "yours," so this page is a v2+ addition once sign-in exists

### Design language across all screens
- Flat surfaces, no shadows or gradients, thin (0.5px) borders
- One primary action per screen, styled as a solid filled button; secondary actions are outlined/ghost style
- Numbers are right-aligned in tables; text is left-aligned
- Status conveyed via small colored badges (e.g. green "Active"), not icons alone
