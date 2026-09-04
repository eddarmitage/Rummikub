import { z } from "zod";
import { normalizeTileToken, TILE_TOKEN_PATTERN } from "../../shared/lib/tiles";

export const createGameSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
});

export const addPlayerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().optional(),
});

// 106 = the full Rummikub tile set (2x 1-13 in 4 colors + 2 jokers) — a generous upper bound to
// reject abusive payloads, not a gameplay-accurate per-player limit.
const MAX_TILES_PER_PLAYER = 106;

const tileTokenSchema = z
  .string()
  .trim()
  .regex(TILE_TOKEN_PATTERN, "Tiles must be 1-13, or J (or *) for a joker.")
  .transform(normalizeTileToken);

const roundScoreSchema = z.object({
  playerId: z.string().min(1),
  tiles: z.array(tileTokenSchema).max(MAX_TILES_PER_PLAYER),
});

export const roundScoresSchema = z
  .object({
    scores: z.array(roundScoreSchema).min(1),
  })
  .refine((body) => new Set(body.scores.map((s) => s.playerId)).size === body.scores.length, {
    message: "Duplicate playerId in scores.",
    path: ["scores"],
  })
  // A real round has exactly one player who goes out (empty rack); with fewer than two score
  // rows there's no one else to compare against, so that degenerate case is left unchecked.
  .refine((body) => body.scores.length <= 1 || body.scores.filter((s) => s.tiles.length === 0).length === 1, {
    message: "Exactly one player must have an empty rack — the player who went out.",
    path: ["scores"],
  });
