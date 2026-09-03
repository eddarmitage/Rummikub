// Rummikub round scoring per the official rules (https://en.wikipedia.org/wiki/Rummikub#Scoring):
// the player(s) with the fewest tiles left "win" the round and are credited the sum of every
// other player's rack value; everyone else is debited their own rack value. Tile tokens are
// "1".."13" for numbered tiles or "J" for a joker (worth 30, src/shared/lib/tiles.ts) — already
// validated/normalized by roundScoreSchema (src/worker/routes/schemas.ts) by the time they reach
// here.

import { rackValue, tileValue } from "../../shared/lib/tiles";

export { rackValue, tileValue };

export interface RoundEntry {
  playerId: string;
  tiles: string[];
}

/** Maps each entry's playerId to their round score. A real round has exactly one player who
 *  goes out (empty rack) — roundScoreSchema (src/worker/routes/schemas.ts) rejects any request
 *  with zero or multiple empty racks before it reaches here, so "fewest tiles" and "empty rack"
 *  always pick the same winner. The no-winner/tied-winner branch below is unreachable through
 *  the API; it stays as a defensive fallback (debit everyone their own rack value, no bonus) for
 *  direct callers, such as this file's own unit tests, that skip that validation. */
export function computeRoundScores(entries: RoundEntry[]): Record<string, number> {
  const values = entries.map((e) => ({ playerId: e.playerId, value: rackValue(e.tiles), count: e.tiles.length }));
  const minCount = Math.min(...values.map((v) => v.count));
  const winners = values.filter((v) => v.count === minCount);

  const scores: Record<string, number> = {};
  if (winners.length === 1) {
    const winnerId = winners[0].playerId;
    const othersTotal = values.filter((v) => v.playerId !== winnerId).reduce((sum, v) => sum + v.value, 0);
    for (const v of values) scores[v.playerId] = v.playerId === winnerId ? othersTotal : -v.value;
  } else {
    for (const v of values) scores[v.playerId] = -v.value;
  }
  return scores;
}
