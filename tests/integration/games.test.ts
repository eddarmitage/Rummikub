import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ApiErrorBody, GameDetailResponse, GameResponse, PlayerResponse } from "./types";

// `exports.default` is the Hono app's default export, running inside the
// real workerd runtime with a real (isolated-per-test) D1 instance behind it
// — see AGENTS.md "Testing conventions" (no mocking the database).
const worker = exports.default;

const GAMES_URL = "https://example.com/api/games";
const AUTH_HEADERS = { "X-Dev-User-Email": "tester@example.com", "content-type": "application/json" };
const JSON_HEADERS = { "content-type": "application/json" };

async function createGame(name = "Friday night") {
  const res = await worker.fetch(GAMES_URL, {
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

describe("POST /api/games", () => {
  it("401s with UNAUTHENTICATED when no auth is supplied", async () => {
    const res = await worker.fetch(GAMES_URL, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: "No auth" }),
    });

    expect(res.status).toBe(401);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates a game with status active when authenticated", async () => {
    const res = await worker.fetch(GAMES_URL, {
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
    const res = await worker.fetch(GAMES_URL, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const { game } = (await res.json()) as GameResponse;
    expect(game.name).toBeNull();
  });

  it("400s with VALIDATION_ERROR for an invalid body", async () => {
    const res = await worker.fetch(GAMES_URL, {
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
});
