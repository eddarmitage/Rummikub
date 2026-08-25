import { After, Before } from "@cucumber/cucumber";
import { cleanup } from "@testing-library/react";
import { isDuplicatePlayerName } from "../../../src/worker/lib/players";
import { computeRoundScores } from "../../../src/worker/lib/scoring";
import { fakeLocation } from "./dom-setup";
import type { ComponentWorld } from "./world";

Before(function (this: ComponentWorld) {
  fakeLocation.href = "/";
  fakeLocation.pathname = "/";
  fakeLocation.search = "";

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost/");
    const method = init?.method ?? "GET";
    return handleFakeRequest(this, url.pathname, method, init?.body);
  }) as typeof fetch;
});

After(function () {
  cleanup();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function handleFakeRequest(world: ComponentWorld, path: string, method: string, rawBody?: BodyInit | null) {
  const gameDetailMatch = path.match(/^\/api\/games\/([^/]+)$/);
  if (gameDetailMatch && method === "GET") {
    const totalsByPlayer = new Map<string, number>();
    for (const round of world.rounds) {
      for (const score of round.scores) {
        totalsByPlayer.set(score.playerId, (totalsByPlayer.get(score.playerId) ?? 0) + score.roundScore);
      }
    }
    return jsonResponse({
      game: { id: world.gameId, name: "Cucumber component game", status: "active", createdAt: new Date().toISOString(), createdBy: null },
      players: world.players,
      rounds: world.rounds,
      totals: world.players.map((p) => ({ playerId: p.id, total: totalsByPlayer.get(p.id) ?? 0 })),
    });
  }

  if (path === "/api/games/new" && method === "POST") {
    return jsonResponse(
      { game: { id: world.gameId, name: "Cucumber component game", status: "active", createdAt: new Date().toISOString(), createdBy: null } },
      201,
    );
  }

  const addPlayerMatch = path.match(/^\/api\/games\/([^/]+)\/players$/);
  if (addPlayerMatch && method === "POST") {
    const { name } = JSON.parse(String(rawBody)) as { name: string };
    const trimmedName = name.trim();
    if (isDuplicatePlayerName(world.players, trimmedName)) {
      return jsonResponse({ error: { code: "VALIDATION_ERROR", message: "A player with that name already exists in this game." } }, 400);
    }
    const player = { id: `p${world.players.length + 1}`, gameId: world.gameId, name: trimmedName, sortOrder: world.players.length };
    world.players.push(player);
    return jsonResponse({ player }, 201);
  }

  const roundsMatch = path.match(/^\/api\/games\/([^/]+)\/rounds$/);
  if (roundsMatch && method === "POST") {
    if (world.simulateUnauthenticated) {
      return jsonResponse({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, 401);
    }
    const { scores } = JSON.parse(String(rawBody)) as { scores: { playerId: string; tiles: string[] }[] };
    const scoresByPlayer = computeRoundScores(scores);
    const round = {
      id: `round-${world.rounds.length + 1}`,
      gameId: world.gameId,
      roundNumber: world.rounds.length + 1,
      createdAt: new Date().toISOString(),
      scores: scores.map((s) => ({
        roundId: `round-${world.rounds.length + 1}`,
        playerId: s.playerId,
        tiles: s.tiles,
        roundScore: scoresByPlayer[s.playerId],
      })),
    };
    world.rounds.push(round);
    return jsonResponse({ round }, 201);
  }

  throw new Error(`Unhandled fake request: ${method} ${path}`);
}
