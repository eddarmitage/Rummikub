# Agent guide

A Rummikub scorecard webapp, deployed as a single Cloudflare Worker. **`docs/spec.md`** is the
source of truth for architecture, data model, API routes, and UI reference (mockups in
`docs/mockups/`) — read it before making non-trivial changes.

## Tech stack

TypeScript full stack · Hono (API) · Drizzle ORM over D1 · Zod (validation) · React + Vite
(frontend) · plain CSS (no Tailwind, no component library) · Vitest + `vitest-pool-workers` +
React Testing Library + Playwright (tests).

## Hard constraints

- **One Worker, one deploy.** Static assets (built React SPA) and API routes are served from the
  same Cloudflare Worker — no separate Pages project, no second `wrangler.toml`.
- **No Tailwind, no UI component library.** Plain CSS only — deliberate choice for a small app.
- **Reads are public, writes require auth.** `GET` routes must never be gated behind Cloudflare
  Access; all mutating routes must be.
- **Consistent API error shape** across every route:
  ```json
  { "error": { "code": "GAME_NOT_FOUND", "message": "That game doesn't exist." } }
  ```
- **No staging environment.** Production only — CI (typecheck, lint, tests, branch protection) is
  the safety net, not a parallel deploy target. Don't propose adding a staging env.

## Project structure

```
/
├── src/
│   ├── worker/
│   │   ├── index.ts          # Hono app entrypoint
│   │   ├── routes/
│   │   ├── middleware/
│   │   │   └── auth.ts       # Cloudflare Access identity check
│   │   └── db/
│   │       ├── schema.ts     # Drizzle schema
│   │       └── queries.ts
│   └── frontend/
│       ├── main.tsx
│       ├── pages/
│       └── styles/
├── migrations/                 # D1 SQL migrations
├── scripts/
│   └── seed.ts                 # populates local D1 with a fake game for dev/e2e
├── tests/
│   ├── unit/
│   ├── integration/             # Vitest + vitest-pool-workers, hits real Worker + D1
│   └── e2e/                     # Playwright, runs against wrangler dev
├── docs/
│   ├── spec.md
│   └── mockups/
└── wrangler.toml
```

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Builds the frontend, then runs `wrangler dev` (local Miniflare-backed dev server on `http://localhost:8787`) alongside a Vite watcher that rebuilds `dist/client` on frontend changes |
| `npm run build` | Builds the React frontend into `dist/client` via Vite |
| `npm run deploy` | Builds the frontend, then `wrangler deploy` |
| `npm run typecheck` | Type-checks the frontend (`tsconfig.json`) and worker (`tsconfig.worker.json`) separately — they have different global types (DOM vs Workers) |
| `npm run cf-typegen` | Regenerates `worker-configuration.d.ts` from `wrangler.toml`; rerun after changing bindings |

Test commands (`test`, `test:e2e`) aren't wired up yet — see issue "Set up test suites and seed
script".

Routing note: v1 has effectively one real route (`/g/:id`, the scorecard), so `src/frontend/App.tsx`
does hand-rolled path matching rather than pulling in React Router. Revisit if the route count
grows.

## Testing conventions

- **Integration tests** run against the real `workerd` runtime via `vitest-pool-workers` and hit a
  real D1 instance — don't mock the database.
- **Component tests** use Vitest + React Testing Library.
- **E2E tests** use Playwright against `wrangler dev`.

## Open design questions

- **League table grouping** (implicit — any games a user played in — vs an explicit "league"
  entity grouping users/games) is unresolved. It's out of scope for v1; don't invent an answer if
  asked to build league tables — check with the user first.
