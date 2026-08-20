import { Hono } from "hono";
import { addRound, createDb, ensureGameMember, getGame, getRound, listPlayers, updateRoundScores, type Db } from "../db/queries";
import { errorResponse, parseBody } from "../lib/http";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { roundScoresSchema } from "./schemas";

// Mounted at /api/games/:id/rounds — `id` comes from the parent games router's mount path.
export const rounds = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/** Returns the first playerId in `scores` that isn't a player in `gameId`, if any. */
async function findInvalidPlayerId(
  db: Db,
  gameId: string,
  scores: { playerId: string }[],
): Promise<string | undefined> {
  const validIds = new Set((await listPlayers(db, gameId)).map((p) => p.id));
  return scores.map((s) => s.playerId).find((id) => !validIds.has(id));
}

// POST /api/games/:id/rounds — adds a new round, auto-numbered, one score per player.
rounds.post("/", requireAuth(), async (c) => {
  // `id` is guaranteed by the /:id/rounds mount path in games.ts — Hono's param() typing
  // doesn't see across route() boundaries, so it comes back as `string | undefined`.
  const gameId = c.req.param("id") as string;
  const db = createDb(c.env.DB);

  const game = await getGame(db, gameId);
  if (!game) {
    return errorResponse(c, 404, "GAME_NOT_FOUND", "That game doesn't exist.");
  }

  const body = await parseBody(c, roundScoresSchema);
  if (!body.ok) return body.response;

  const invalidPlayerId = await findInvalidPlayerId(db, gameId, body.data.scores);
  if (invalidPlayerId) {
    return errorResponse(c, 400, "INVALID_PLAYER", `Player ${invalidPlayerId} is not part of this game.`);
  }

  const round = await addRound(db, gameId, body.data.scores);
  await ensureGameMember(db, { gameId, userId: c.get("user").id, role: "editor" });
  return c.json({ round }, 201);
});

// PATCH /api/games/:id/rounds/:roundId — upserts scores for an existing round.
rounds.patch("/:roundId", requireAuth(), async (c) => {
  // See the POST handler above re: why `id` needs a cast here.
  const gameId = c.req.param("id") as string;
  const roundId = c.req.param("roundId");
  const db = createDb(c.env.DB);

  const game = await getGame(db, gameId);
  if (!game) {
    return errorResponse(c, 404, "GAME_NOT_FOUND", "That game doesn't exist.");
  }

  const round = await getRound(db, roundId);
  if (!round || round.gameId !== gameId) {
    return errorResponse(c, 404, "ROUND_NOT_FOUND", "That round doesn't exist.");
  }

  const body = await parseBody(c, roundScoresSchema);
  if (!body.ok) return body.response;

  const invalidPlayerId = await findInvalidPlayerId(db, gameId, body.data.scores);
  if (invalidPlayerId) {
    return errorResponse(c, 400, "INVALID_PLAYER", `Player ${invalidPlayerId} is not part of this game.`);
  }

  const scores = await updateRoundScores(db, roundId, body.data.scores);
  await ensureGameMember(db, { gameId, userId: c.get("user").id, role: "editor" });
  return c.json({ scores });
});
