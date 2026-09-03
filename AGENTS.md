# Agent guide

A Rummikub scorecard webapp, deployed as a single Cloudflare Worker. **`docs/spec.md`** is the
source of truth for architecture, data model, API routes, and UI reference (mockups in
`docs/mockups/`) — read it before making non-trivial changes.

## Tech stack

TypeScript full stack · Hono (API) · Drizzle ORM over D1 · Zod (validation) · React + Vite
(frontend) · plain CSS (no Tailwind, no component library) · Vitest + `vitest-pool-workers` +
React Testing Library + Playwright + cucumber-js (tests).

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
│   ├── frontend/
│   │   ├── main.tsx
│   │   ├── pages/
│   │   └── styles/
│   └── shared/               # Pure, dependency-free logic used by both worker and frontend
│       └── lib/                 # (e.g. isDuplicatePlayerName) -- neither side imports the other's code
├── migrations/                 # D1 SQL migrations
├── scripts/
│   └── seed.ts                 # populates local D1 with a fake game for dev/e2e
├── tests/
│   ├── unit/
│   ├── integration/             # Vitest + vitest-pool-workers, hits real Worker + D1
│   ├── component/               # Vitest + React Testing Library, src/frontend/pages/
│   ├── e2e/                     # Playwright, runs against wrangler dev
│   └── cucumber/                # Shared Gherkin scenario catalog — see "Testing conventions"
│       ├── features/            # .feature files: one behaviour catalog, no layer-specific code
│       ├── component/           # step defs: jsdom + RTL, fetch stubbed against an in-memory game
│       ├── integration/         # step defs: fetch against a standalone `wrangler dev`
│       └── e2e/                 # step defs: Playwright against a standalone `wrangler dev`
├── docs/
│   ├── spec.md
│   └── mockups/
└── wrangler.toml
```

## Commands

| Command                 | Does                                                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Builds the frontend, then runs `wrangler dev` (local Miniflare-backed dev server on `http://localhost:8787`) alongside a Vite watcher that rebuilds `dist/client` on frontend changes                                                  |
| `npm run build`         | Builds the React frontend into `dist/client` via Vite                                                                                                                                                                                  |
| `npm run deploy`        | Builds the frontend, then `wrangler deploy`                                                                                                                                                                                            |
| `npm run typecheck`     | Type-checks the frontend, worker, and each test suite as separate `tsc` invocations (`tsconfig.json`, `tsconfig.worker.json`, `tsconfig.test.*.json`) — they have different global types (DOM vs Workers vs test-only ambient modules) |
| `npm run lint`          | Lints the repo with oxlint (`.oxlintrc.json`)                                                                                                                                                                                          |
| `npm run cf-typegen`    | Regenerates `worker-configuration.d.ts` from `wrangler.toml`; rerun after changing bindings                                                                                                                                            |
| `npm run test`          | Runs unit, integration (real `workerd` + local D1 via `@cloudflare/vitest-pool-workers`), and component tests (Vitest) — fully local, no setup needed                                                                                  |
| `npm run test:watch`    | Same as `npm run test`, in watch mode                                                                                                                                                                                                  |
| `npm run test:e2e`      | Runs the Playwright suite against a throwaway `wrangler dev` (`wrangler.e2e.toml`) — fully local, no setup needed                                                                                                                      |
| `npm run test:cucumber` | Runs the shared Gherkin scenario catalog (`tests/cucumber/`) at all three layers — component (jsdom), integration, and e2e, each against its own throwaway `wrangler dev`; `npm run test:cucumber:<layer>` runs just one layer         |
| `npm run seed`          | Populates local D1 with a fake game (`scripts/seed.ts`); pass `-- --config <file>` to target a config other than the default `wrangler.toml`                                                                                           |

Routing note: v1 has effectively one real route (`/g/:id`, the scorecard), so `src/frontend/App.tsx`
does hand-rolled path matching rather than pulling in React Router. Revisit if the route count
grows.

## Documentation conventions

- **Keep markdown tables column-aligned.** Pad every cell so the `|` separators line up per
  column — tables should read cleanly in a plain-text diff, not just rendered HTML. When you
  edit any row in a table, re-pad the whole table, not just that row.

## Testing conventions

- **Integration tests** run against the real `workerd` runtime via `vitest-pool-workers` and hit a
  real D1 instance — don't mock the database.
- **Component tests** use Vitest + React Testing Library.
- **E2E tests** use Playwright against `wrangler dev`.
- **Cross-layer behaviour scenarios** (game setup, round scoring, auth prompts — anything worth
  checking at more than one layer) live once as Gherkin `.feature` files in
  `tests/cucumber/features/`, run by cucumber-js against three independent step-definition
  suites (`tests/cucumber/{component,integration,e2e}/`). This exists specifically to avoid
  hand-duplicating the same scenario as three near-identical Vitest/Playwright tests, and to
  make coverage gaps visible rather than silent:
  - A scenario is **default-inclusive** — untagged, it's expected to pass at all three layers.
  - Add `@no-component`, `@no-integration`, or `@no-e2e` only when a scenario genuinely doesn't
    apply at that layer (e.g. "the button isn't shown" has no backend equivalent) — never as a
    way to skip a layer that's merely inconvenient to implement. "This is API validation, not a
    UI concern" is *not* by itself a reason for `@no-integration` — the integration layer isn't
    UI-only, its steps just talk raw HTTP instead of the DOM (see `round-scoring.feature`'s
    integration steps, which POST directly and assert on the JSON response). Reach for
    `@no-integration` only when the behaviour has no HTTP-level equivalent at all — e.g.
    `sign-in-prompt.feature`'s browser redirect, or `duplicate-player-names.feature`'s "the form
    doesn't navigate away," both of which are frontend-only by nature, not just inconvenient to
    hit over HTTP.
  - An untagged scenario with a step missing from one layer's suite fails there as
    "undefined," not silently — that's the coverage signal working as intended; fix by adding
    the step, not by reaching for an exclusion tag.
  - The component layer stubs `fetch` against an in-memory game (see
    `tests/cucumber/component/hooks.ts`) rather than hitting a real server. Where the behaviour
    being faked already has a real, exported implementation (`computeRoundScores()` for scoring,
    `isDuplicatePlayerName()` for the players route), the stub must call that function rather
    than hand-copying the logic — a hand-copy can silently drift from the real behaviour it's
    meant to be standing in for, which defeats the point of a shared scenario. If no such
    function exists yet, extract one instead of inlining the check in both places.
  - New scenario-worthy behaviour (a new route, a new UI flow) belongs here, not as a fresh
    Vitest/Playwright test file — including pure API-contract checks, via the integration
    layer's raw-HTTP steps, per above. Reach for a direct `tests/integration/` test only when a
    case is single-layer in a stronger sense than "no UI": nothing to render and no distinct
    request/response to assert on beyond what the shared scenario already covers (e.g. confirming
    a uniqueness check is correctly scoped per-game rather than global — same check, just a data
    boundary with nothing further for a Gherkin scenario to usefully narrate).

## Open design questions

- **League table grouping** (implicit — any games a user played in — vs an explicit "league"
  entity grouping users/games) is unresolved. It's out of scope for v1; don't invent an answer if
  asked to build league tables — check with the user first.
- **`game_members` owner/editor permission split** (#12 added the table and automatic membership
  bookkeeping; nothing reads `role` yet). What an `editor` can't do that an `owner` can — e.g.
  remove players, mark a game complete, remove other members — is undecided. Don't invent
  enforcement logic if asked to gate a route by role; check with the user first.
