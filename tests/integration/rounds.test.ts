import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ApiErrorBody, GameResponse, PlayerResponse, RoundResponse, ScoresResponse } from "./types";

const worker = exports.default;

const API = "https://example.com/api";
const AUTH_HEADERS = { "X-Dev-User-Email": "tester@example.com", "content-type": "application/json" };
const JSON_HEADERS = { "content-type": "application/json" };

async function createGameWithPlayers(playerNames: string[]) {
  const gameRes = await worker.fetch(`${API}/games`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ name: "Rounds test" }),
  });
  const { game } = (await gameRes.json()) as GameResponse;

  const players: PlayerResponse["player"][] = [];
  for (const name of playerNames) {
    const res = await worker.fetch(`${API}/games/${game.id}/players`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name }),
    });
    const { player } = (await res.json()) as PlayerResponse;
    players.push(player);
  }
  return { game, players };
}

async function addRound(gameId: string, scores: { playerId: string; tilesLeftValue: number }[]) {
  const res = await worker.fetch(`${API}/games/${gameId}/rounds`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ scores }),
  });
  const { round } = (await res.json()) as RoundResponse;
  return round;
}

describe("POST /api/games/:id/rounds", () => {
  it("401s with UNAUTHENTICATED when no auth is supplied", async () => {
    const { game, players } = await createGameWithPlayers(["Alice"]);
    const res = await worker.fetch(`${API}/games/${game.id}/rounds`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ scores: [{ playerId: players[0].id, tilesLeftValue: 5 }] }),
    });

    expect(res.status).toBe(401);
  });

  it("404s with GAME_NOT_FOUND for an unknown game", async () => {
    const res = await worker.fetch(`${API}/games/does-not-exist/rounds`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ scores: [{ playerId: "p1", tilesLeftValue: 5 }] }),
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("GAME_NOT_FOUND");
  });

  it("400s with VALIDATION_ERROR for an empty scores array", async () => {
    const { game } = await createGameWithPlayers(["Alice"]);
    const res = await worker.fetch(`${API}/games/${game.id}/rounds`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ scores: [] }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("400s with INVALID_PLAYER for a playerId not in the game", async () => {
    const { game } = await createGameWithPlayers(["Alice"]);
    const res = await worker.fetch(`${API}/games/${game.id}/rounds`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ scores: [{ playerId: "not-a-real-player", tilesLeftValue: 5 }] }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("INVALID_PLAYER");
  });

  it("adds a round auto-numbered from 1, with one score per player", async () => {
    const { game, players } = await createGameWithPlayers(["Alice", "Bob"]);

    const round = await addRound(game.id, [
      { playerId: players[0].id, tilesLeftValue: 12 },
      { playerId: players[1].id, tilesLeftValue: 0 },
    ]);

    expect(round.roundNumber).toBe(1);
    expect(round.scores).toHaveLength(2);
  });

  it("auto-numbers a second round as 2", async () => {
    const { game, players } = await createGameWithPlayers(["Alice"]);
    await addRound(game.id, [{ playerId: players[0].id, tilesLeftValue: 3 }]);

    const round2 = await addRound(game.id, [{ playerId: players[0].id, tilesLeftValue: 7 }]);

    expect(round2.roundNumber).toBe(2);
  });
});

describe("PATCH /api/games/:id/rounds/:roundId", () => {
  it("401s with UNAUTHENTICATED when no auth is supplied", async () => {
    const { game, players } = await createGameWithPlayers(["Alice"]);
    const round = await addRound(game.id, [{ playerId: players[0].id, tilesLeftValue: 10 }]);

    const res = await worker.fetch(`${API}/games/${game.id}/rounds/${round.id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ scores: [{ playerId: players[0].id, tilesLeftValue: 3 }] }),
    });

    expect(res.status).toBe(401);
  });

  it("404s with GAME_NOT_FOUND for an unknown game", async () => {
    const res = await worker.fetch(`${API}/games/does-not-exist/rounds/does-not-exist`, {
      method: "PATCH",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ scores: [{ playerId: "p1", tilesLeftValue: 3 }] }),
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("GAME_NOT_FOUND");
  });

  it("404s with ROUND_NOT_FOUND for an unknown round in a real game", async () => {
    const { game } = await createGameWithPlayers(["Alice"]);
    const res = await worker.fetch(`${API}/games/${game.id}/rounds/does-not-exist`, {
      method: "PATCH",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ scores: [{ playerId: "p1", tilesLeftValue: 3 }] }),
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("ROUND_NOT_FOUND");
  });

  it("400s with INVALID_PLAYER for a playerId not in the game", async () => {
    const { game, players } = await createGameWithPlayers(["Alice"]);
    const round = await addRound(game.id, [{ playerId: players[0].id, tilesLeftValue: 10 }]);

    const res = await worker.fetch(`${API}/games/${game.id}/rounds/${round.id}`, {
      method: "PATCH",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ scores: [{ playerId: "not-a-real-player", tilesLeftValue: 3 }] }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("INVALID_PLAYER");
  });

  it("upserts (overwrites) scores for the round", async () => {
    const { game, players } = await createGameWithPlayers(["Alice"]);
    const round = await addRound(game.id, [{ playerId: players[0].id, tilesLeftValue: 10 }]);

    const res = await worker.fetch(`${API}/games/${game.id}/rounds/${round.id}`, {
      method: "PATCH",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ scores: [{ playerId: players[0].id, tilesLeftValue: 3 }] }),
    });

    expect(res.status).toBe(200);
    const { scores } = (await res.json()) as ScoresResponse;
    expect(scores).toHaveLength(1);
    expect(scores[0].tilesLeftValue).toBe(3);
  });
});
