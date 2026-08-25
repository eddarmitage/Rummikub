// Mirrors src/worker/db/schema.ts and src/worker/db/queries.ts#GameDetail — the frontend's
// view of what the API returns as JSON (timestamps serialize to ISO strings over the wire).

export interface Game {
  id: string;
  name: string | null;
  status: "active" | "complete";
  createdAt: string;
  createdBy: string | null;
}

export interface Player {
  id: string;
  gameId: string;
  userId: string | null;
  name: string;
  sortOrder: number;
}

export interface Score {
  roundId: string;
  playerId: string;
  tiles: string[];
  roundScore: number;
}

export interface Round {
  id: string;
  gameId: string;
  roundNumber: number;
  createdAt: string;
  scores: Score[];
}

export interface PlayerTotal {
  playerId: string;
  total: number;
}

export interface GameDetail {
  game: Game;
  players: Player[];
  rounds: Round[];
  totals: PlayerTotal[];
}
