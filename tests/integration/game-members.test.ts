import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "../../src/worker/db/queries";
import { gameMembers } from "../../src/worker/db/schema";
import type { GameResponse, PlayerResponse } from "./types";

const worker = exports.default;

const API = "https://example.com/api";
const OWNER_HEADERS = { "X-Dev-User-Email": "owner@example.com", "content-type": "application/json" };
const EDITOR_HEADERS = { "X-Dev-User-Email": "editor@example.com", "content-type": "application/json" };

async function createGame() {
  const res = await worker.fetch(`${API}/games`, {
    method: "POST",
    headers: OWNER_HEADERS,
    body: JSON.stringify({ name: "Membership test" }),
  });
  const { game } = (await res.json()) as GameResponse;
  return game;
}

async function membersFor(gameId: string) {
  const db = createDb(env.DB);
  return db.query.gameMembers.findMany({ where: eq(gameMembers.gameId, gameId) });
}

describe("game_members bookkeeping", () => {
  it("adds the creator as owner on POST /api/games", async () => {
    const game = await createGame();
    const members = await membersFor(game.id);

    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
  });

  it("adds a different authenticated writer as editor on POST /api/games/:id/players", async () => {
    const game = await createGame();

    await worker.fetch(`${API}/games/${game.id}/players`, {
      method: "POST",
      headers: EDITOR_HEADERS,
      body: JSON.stringify({ name: "Alice" }),
    });

    const members = await membersFor(game.id);
    const roles = members.map((m) => m.role).sort();
    expect(roles).toEqual(["editor", "owner"]);
  });

  it("does not downgrade the owner's role on a later write to their own game", async () => {
    const game = await createGame();

    await worker.fetch(`${API}/games/${game.id}/players`, {
      method: "POST",
      headers: OWNER_HEADERS,
      body: JSON.stringify({ name: "Bob" }),
    });

    const members = await membersFor(game.id);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
  });

  it("does not add a membership row when a write fails validation", async () => {
    const game = await createGame();

    const res = await worker.fetch(`${API}/games/${game.id}/players`, {
      method: "POST",
      headers: EDITOR_HEADERS,
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);

    const members = await membersFor(game.id);
    expect(members).toHaveLength(1); // just the owner from game creation
  });

  it("adds an editor on POST /api/games/:id/rounds and PATCH .../rounds/:roundId", async () => {
    const game = await createGame();
    const playerRes = await worker.fetch(`${API}/games/${game.id}/players`, {
      method: "POST",
      headers: OWNER_HEADERS,
      body: JSON.stringify({ name: "Carol" }),
    });
    const { player } = (await playerRes.json()) as PlayerResponse;

    await worker.fetch(`${API}/games/${game.id}/rounds`, {
      method: "POST",
      headers: EDITOR_HEADERS,
      body: JSON.stringify({ scores: [{ playerId: player.id, tilesLeftValue: 5 }] }),
    });

    const members = await membersFor(game.id);
    expect(members.find((m) => m.role === "editor")).toBeDefined();
  });
});
