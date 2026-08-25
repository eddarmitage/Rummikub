import { asc, eq, sql } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";
import { computeRoundScores } from "../lib/scoring";
import * as schema from "./schema";
import { games, players, rounds, scores, users, gameMembers } from "./schema";
import type { Game, NewGame, Player, Round, Score, User, NewUser, GameMember, NewGameMember } from "./schema";

const GAME_ID_LENGTH = 8;

export type Db = DrizzleD1Database<typeof schema>;

/** Build a Drizzle handle around the `DB` D1 binding. Call once per request in a route handler:
 *  `const db = createDb(c.env.DB)`. */
export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export interface CreateGameInput {
  name?: string | null;
  createdBy?: string | null;
}

export async function createGame(db: Db, input: CreateGameInput): Promise<Game> {
  const [game] = await db
    .insert(games)
    .values({
      id: nanoid(GAME_ID_LENGTH),
      name: input.name ?? null,
      status: "active",
      createdAt: new Date(),
      createdBy: input.createdBy ?? null,
    } satisfies NewGame)
    .returning();
  return game;
}

export async function getGame(db: Db, gameId: string): Promise<Game | undefined> {
  return db.query.games.findFirst({ where: eq(games.id, gameId) });
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export interface AddPlayerInput {
  gameId: string;
  name: string;
  sortOrder?: number;
}

export async function addPlayer(db: Db, input: AddPlayerInput): Promise<Player> {
  const [player] = await db
    .insert(players)
    .values({
      id: nanoid(),
      gameId: input.gameId,
      name: input.name,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return player;
}

export async function listPlayers(db: Db, gameId: string): Promise<Player[]> {
  return db.query.players.findMany({
    where: eq(players.gameId, gameId),
    orderBy: asc(players.sortOrder),
  });
}

// ---------------------------------------------------------------------------
// Rounds & scores
// ---------------------------------------------------------------------------

export interface RoundScoreInput {
  playerId: string;
  tiles: string[];
}

/** A score row with `tiles` parsed back out of storage and `roundScore` computed against the
 *  rest of that round's entries (see src/worker/lib/scoring.ts) — what routes actually return. */
export interface ScoreDetail {
  roundId: string;
  playerId: string;
  tiles: string[];
  roundScore: number;
}

export type RoundWithScores = Round & { scores: ScoreDetail[] };

/** Parses each row's stored `tiles` JSON and computes round scores across the whole set —
 *  scoring is cross-player (the winner is credited everyone else's rack value), so it can't be
 *  done per-row in SQL. */
function toScoreDetails(rows: Score[]): ScoreDetail[] {
  const parsed = rows.map((r) => ({ ...r, tiles: JSON.parse(r.tiles) as string[] }));
  const roundScores = computeRoundScores(parsed);
  return parsed.map((r) => ({ ...r, roundScore: roundScores[r.playerId] ?? 0 }));
}

/** Adds a new round to a game, auto-numbered as (current max round_number) + 1, with one
 *  score row per entry in `roundScores`. */
export async function addRound(
  db: Db,
  gameId: string,
  roundScores: RoundScoreInput[],
): Promise<RoundWithScores> {
  const [{ maxRoundNumber }] = await db
    .select({ maxRoundNumber: sql<number>`coalesce(max(${rounds.roundNumber}), 0)` })
    .from(rounds)
    .where(eq(rounds.gameId, gameId));

  const roundId = nanoid();
  const [round] = await db
    .insert(rounds)
    .values({
      id: roundId,
      gameId,
      roundNumber: maxRoundNumber + 1,
      createdAt: new Date(),
    })
    .returning();

  if (roundScores.length > 0) {
    await db.insert(scores).values(
      roundScores.map((s) => ({
        roundId,
        playerId: s.playerId,
        tiles: JSON.stringify(s.tiles),
      })),
    );
  }

  return { ...round, scores: await listRoundScores(db, roundId) };
}

/** Upserts scores for an existing round (used by PATCH .../rounds/:roundId). Rows are
 *  applied sequentially rather than via db.batch() — see plan Decision D5: a round has a
 *  small, bounded number of players, so sequential awaits are simpler and fully type-safe;
 *  the tradeoff is no cross-row atomicity if a later write fails after an earlier one
 *  succeeds. */
export async function updateRoundScores(
  db: Db,
  roundId: string,
  roundScores: RoundScoreInput[],
): Promise<ScoreDetail[]> {
  for (const s of roundScores) {
    const tiles = JSON.stringify(s.tiles);
    await db
      .insert(scores)
      .values({ roundId, playerId: s.playerId, tiles })
      .onConflictDoUpdate({
        target: [scores.roundId, scores.playerId],
        set: { tiles },
      });
  }
  return listRoundScores(db, roundId);
}

export async function listRoundScores(db: Db, roundId: string): Promise<ScoreDetail[]> {
  const rows = await db.query.scores.findMany({ where: eq(scores.roundId, roundId) });
  return toScoreDetails(rows);
}

export async function getRound(db: Db, roundId: string): Promise<Round | undefined> {
  return db.query.rounds.findFirst({ where: eq(rounds.id, roundId) });
}

export async function listRounds(db: Db, gameId: string): Promise<RoundWithScores[]> {
  const rows = await db.query.rounds.findMany({
    where: eq(rounds.gameId, gameId),
    orderBy: asc(rounds.roundNumber),
    with: { scores: true },
  });
  return rows.map((round) => ({ ...round, scores: toScoreDetails(round.scores) }));
}

// ---------------------------------------------------------------------------
// Running totals — a player's running total is the sum of their computed
// round scores across a game, computed on read (docs/spec.md).
// ---------------------------------------------------------------------------

export interface PlayerTotal {
  playerId: string;
  total: number;
}

function sumRoundScores(gamePlayers: Player[], gameRounds: RoundWithScores[]): PlayerTotal[] {
  const totals = new Map(gamePlayers.map((p) => [p.id, 0]));
  for (const round of gameRounds) {
    for (const s of round.scores) {
      totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.roundScore);
    }
  }
  return gamePlayers.map((p) => ({ playerId: p.id, total: totals.get(p.id) ?? 0 }));
}

export async function getPlayerTotals(db: Db, gameId: string): Promise<PlayerTotal[]> {
  const [gamePlayers, gameRounds] = await Promise.all([listPlayers(db, gameId), listRounds(db, gameId)]);
  return sumRoundScores(gamePlayers, gameRounds);
}

// ---------------------------------------------------------------------------
// Composed read for GET /games/:id — everything the scorecard screen needs
// in one call: game info, ordered players, ordered rounds-with-scores, and
// each player's running total.
// ---------------------------------------------------------------------------

export interface GameDetail {
  game: Game;
  players: Player[];
  rounds: RoundWithScores[];
  totals: PlayerTotal[];
}

export async function getGameDetail(db: Db, gameId: string): Promise<GameDetail | undefined> {
  const game = await getGame(db, gameId);
  if (!game) return undefined;

  const [gamePlayers, gameRounds] = await Promise.all([listPlayers(db, gameId), listRounds(db, gameId)]);

  return { game, players: gamePlayers, rounds: gameRounds, totals: sumRoundScores(gamePlayers, gameRounds) };
}

// ---------------------------------------------------------------------------
// Users — populated lazily from Cloudflare Access identity (see docs/spec.md
// "Auth" and src/worker/middleware/auth.ts). Added here as a small, additive
// exception to #3's original scope (issue #5 needs it for the auth
// middleware's upsert-on-first-write) — not a revision of anything #3
// shipped (see plan Decision D4).
// ---------------------------------------------------------------------------

export interface UpsertUserInput {
  email: string;
  name?: string | null;
}

/** Finds a user by email, creating one on first authenticated write. If the user already
 *  exists, a non-null `name` here refreshes the stored name (e.g. Access now supplies a
 *  display name where an admin pre-created the row with none); passing `name: null` never
 *  clobbers an existing stored name. */
export async function getOrCreateUserByEmail(db: Db, input: UpsertUserInput): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      id: nanoid(),
      email: input.email,
      name: input.name ?? null,
      createdAt: new Date(),
    } satisfies NewUser)
    .onConflictDoUpdate({
      target: users.email,
      set: { name: sql`coalesce(${input.name ?? null}, ${users.name})` },
    })
    .returning();
  return user;
}

// ---------------------------------------------------------------------------
// Game members — per-game roles (docs/spec.md "Auth", issue #12). This is
// bookkeeping only: it records who's a member of a game and what role they
// have, but nothing in the route layer checks `role` yet — v1 write-route
// behavior is unchanged (any Access-allowed user may still write to any
// game). Wiring this into actual authorization is a follow-on ticket once
// the owner/editor permission split is decided (AGENTS.md "Open design
// questions").
// ---------------------------------------------------------------------------

export interface EnsureGameMemberInput {
  gameId: string;
  userId: string;
  role: "owner" | "editor";
}

/** Idempotently records a user's membership/role in a game. Insert-if-absent — an existing
 *  membership row (e.g. the owner) is never changed by a later call with a different role. */
export async function ensureGameMember(db: Db, input: EnsureGameMemberInput): Promise<void> {
  await db
    .insert(gameMembers)
    .values({
      gameId: input.gameId,
      userId: input.userId,
      role: input.role,
    } satisfies NewGameMember)
    .onConflictDoNothing();
}

export async function listGameMembers(db: Db, gameId: string): Promise<GameMember[]> {
  return db.query.gameMembers.findMany({ where: eq(gameMembers.gameId, gameId) });
}
