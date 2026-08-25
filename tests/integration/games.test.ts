import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ApiErrorBody, GameDetailResponse, GameResponse, PlayerResponse } from "./types";

// `exports.default` is the Hono app's default export, running inside the
// real workerd runtime with a real (isolated-per-test) D1 instance behind it
// — see AGENTS.md "Testing conventions" (no mocking the database).
const worker = exports.default;

const GAMES_URL = "https://example.com/api/games";
// Deliberately distinct from GAMES_URL — POST /api/games/new isn't a prefix of GET
// /api/games/:id, which is what lets Cloudflare Access path-scope the write route without
// also catching the public read route. See src/worker/routes/games.ts.
const CREATE_GAME_URL = "https://example.com/api/games/new";
const AUTH_HEADERS = { "X-Dev-User-Email": "tester@example.com", "content-type": "application/json" };
const JSON_HEADERS = { "content-type": "application/json" };

async function createGame(name = "Friday night") {
  const res = await worker.fetch(CREATE_GAME_URL, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ name }),
  });
  const { game } = (await res.json()) as GameResponse;
  return game;
}

describe("GET /api/games/:id", () => {
  it("is public (no auth header needed)", async () => {
    const game = await createGame();
    const res = await worker.fetch(`${GAMES_URL}/${game.id}`);
    expect(res.status).toBe(200);
  });

  it("returns everything the scorecard needs for a known game", async () => {
    const game = await createGame();
    const res = await worker.fetch(`${GAMES_URL}/${game.id}`);
    const detail = (await res.json()) as GameDetailResponse;

    expect(detail.game.id).toBe(game.id);
    expect(detail.players).toEqual([]);
    expect(detail.rounds).toEqual([]);
    expect(detail.totals).toEqual([]);
  });

  it("404s with GAME_NOT_FOUND for an unknown game", async () => {
    const res = await worker.fetch(`${GAMES_URL}/does-not-exist`);
    expect(res.status).toBe(404);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("GAME_NOT_FOUND");
  });
});

describe("POST /api/games/new", () => {
  it("401s with UNAUTHENTICATED when no auth is supplied", async () => {
    const res = await worker.fetch(CREATE_GAME_URL, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: "No auth" }),
    });

    expect(res.status).toBe(401);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates a game with status active when authenticated", async () => {
    const res = await worker.fetch(CREATE_GAME_URL, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: "Friday night" }),
    });

    expect(res.status).toBe(201);
    const { game } = (await res.json()) as GameResponse;
    expect(game.name).toBe("Friday night");
    expect(game.status).toBe("active");
    expect(game.id).toHaveLength(8);
  });

  it("creates a game with a null name when none is given", async () => {
    const res = await worker.fetch(CREATE_GAME_URL, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const { game } = (await res.json()) as GameResponse;
    expect(game.name).toBeNull();
  });

  it("400s with VALIDATION_ERROR for an invalid body", async () => {
    const res = await worker.fetch(CREATE_GAME_URL, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: "" }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/games/:id/players", () => {
  it("401s with UNAUTHENTICATED when no auth is supplied", async () => {
    const game = await createGame();
    const res = await worker.fetch(`${GAMES_URL}/${game.id}/players`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: "Alice" }),
    });

    expect(res.status).toBe(401);
  });

  it("404s with GAME_NOT_FOUND for an unknown game", async () => {
    const res = await worker.fetch(`${GAMES_URL}/does-not-exist/players`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: "Alice" }),
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("GAME_NOT_FOUND");
  });

  it("adds a player to the game", async () => {
    const game = await createGame();
    const res = await worker.fetch(`${GAMES_URL}/${game.id}/players`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: "Alice", sortOrder: 1 }),
    });

    expect(res.status).toBe(201);
    const { player } = (await res.json()) as PlayerResponse;
    expect(player.name).toBe("Alice");
    expect(player.gameId).toBe(game.id);
    expect(player.sortOrder).toBe(1);
  });

  it("400s with VALIDATION_ERROR for an invalid body", async () => {
    const game = await createGame();
    const res = await worker.fetch(`${GAMES_URL}/${game.id}/players`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: "" }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  // The rejection itself (case-insensitive, post-trim) is covered by
  // tests/cucumber/features/duplicate-player-names.feature's integration-layer step, which hits
  // this same real route — no need to duplicate that here. This case is the one genuine
  // no-UI-angle edge of the check (scoping to a single game), so it stays a direct test.
  it("allows the same name in a different game", async () => {
    const gameOne = await createGame();
    const gameTwo = await createGame();
    await worker.fetch(`${GAMES_URL}/${gameOne.id}/players`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: "Alice" }),
    });

    const res = await worker.fetch(`${GAMES_URL}/${gameTwo.id}/players`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: "Alice" }),
    });

    expect(res.status).toBe(201);
  });
});
