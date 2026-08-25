// Minimal response-shape types for casting `await res.json()` in integration
// tests — mirrors what the route handlers actually return (src/worker/routes/
// games.ts, rounds.ts), reusing the real Drizzle/query row types so these stay
// in sync with the schema.
import type { ApiErrorBody } from "../../src/worker/lib/http";
import type { Game, Player, Round } from "../../src/worker/db/schema";
import type { ScoreDetail } from "../../src/worker/db/queries";

export type { ApiErrorBody };

export interface GameResponse {
  game: Game;
}

export interface PlayerResponse {
  player: Player;
}

export interface RoundResponse {
  round: Round & { scores: ScoreDetail[] };
}

export interface ScoresResponse {
  scores: ScoreDetail[];
}

export interface GameDetailResponse {
  game: Game;
  players: Player[];
  rounds: (Round & { scores: ScoreDetail[] })[];
  totals: { playerId: string; total: number }[];
}
