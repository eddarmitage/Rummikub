import { z } from "zod";

export const createGameSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
});

export const addPlayerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().optional(),
});

// A tile token is "1".."13" for a numbered tile, or "J"/"j"/"*" for a joker — normalized to a
// canonical "J" so stored/compared values are consistent regardless of which the player typed.
const TILE_TOKEN_PATTERN = /^(1[0-3]|[1-9]|[Jj*])$/;
// 106 = the full Rummikub tile set (2x 1-13 in 4 colors + 2 jokers) — a generous upper bound to
// reject abusive payloads, not a gameplay-accurate per-player limit.
const MAX_TILES_PER_PLAYER = 106;

const tileTokenSchema = z
  .string()
  .trim()
  .regex(TILE_TOKEN_PATTERN, "Tiles must be 1-13, or J (or *) for a joker.")
  .transform((token) => (token === "j" || token === "J" || token === "*" ? "J" : token));

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
  });
