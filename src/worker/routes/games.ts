import { Hono } from "hono";
import { addPlayer, createDb, createGame, ensureGameMember, getGame, getGameDetail } from "../db/queries";
import { errorResponse, parseBody } from "../lib/http";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { rounds } from "./rounds";
import { addPlayerSchema, createGameSchema } from "./schemas";

export const games = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/games/:id — public; everything the scorecard screen needs in one call.
games.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const detail = await getGameDetail(db, c.req.param("id"));
  if (!detail) {
    return errorResponse(c, 404, "GAME_NOT_FOUND", "That game doesn't exist.");
  }
  return c.json(detail);
});

// POST /api/games/new — creates a game; the authenticated caller becomes createdBy.
// Deliberately not POST /api/games: that path would be a structural prefix of the public
// GET /api/games/:id route, and Cloudflare Access path-scoping matches prefixes (no
// HTTP-method awareness) — see README "Auth setup" for the Access application config this
// path needs to line up with.
games.post("/new", requireAuth(), async (c) => {
  const body = await parseBody(c, createGameSchema);
  if (!body.ok) return body.response;

  const db = createDb(c.env.DB);
  const game = await createGame(db, { name: body.data.name, createdBy: c.get("user").id });
  await ensureGameMember(db, { gameId: game.id, userId: c.get("user").id, role: "owner" });
  return c.json({ game }, 201);
});

// POST /api/games/:id/players — adds a player to an existing game.
games.post("/:id/players", requireAuth(), async (c) => {
  const gameId = c.req.param("id");
  const db = createDb(c.env.DB);

  const game = await getGame(db, gameId);
  if (!game) {
    return errorResponse(c, 404, "GAME_NOT_FOUND", "That game doesn't exist.");
  }

  const body = await parseBody(c, addPlayerSchema);
  if (!body.ok) return body.response;

  const player = await addPlayer(db, { gameId, name: body.data.name, sortOrder: body.data.sortOrder });
  await ensureGameMember(db, { gameId, userId: c.get("user").id, role: "editor" });
  return c.json({ player }, 201);
});

games.route("/:id/rounds", rounds);
