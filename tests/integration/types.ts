// Minimal response-shape types for casting `await res.json()` in integration
// tests — mirrors what the route handlers actually return (src/worker/routes/
// games.ts, rounds.ts), reusing the real Drizzle row types so these stay in
// sync with the schema.
import type { ApiErrorBody } from "../../src/worker/lib/http";
import type { Game, Player, Round, Score } from "../../src/worker/db/schema";

export type { ApiErrorBody };

export interface GameResponse {
  game: Game;
}

export interface PlayerResponse {
  player: Player;
}

export interface RoundResponse {
  round: Round & { scores: Score[] };
}

export interface ScoresResponse {
  scores: Score[];
}

export interface GameDetailResponse {
  game: Game;
  players: Player[];
  rounds: (Round & { scores: Score[] })[];
  totals: { playerId: string; total: number }[];
}
