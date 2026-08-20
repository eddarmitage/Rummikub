import { z } from "zod";

export const createGameSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
});

export const addPlayerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().optional(),
});

const roundScoreSchema = z.object({
  playerId: z.string().min(1),
  tilesLeftValue: z.number().int().min(0),
});

export const roundScoresSchema = z
  .object({
    scores: z.array(roundScoreSchema).min(1),
  })
  .refine((body) => new Set(body.scores.map((s) => s.playerId)).size === body.scores.length, {
    message: "Duplicate playerId in scores.",
    path: ["scores"],
  });
