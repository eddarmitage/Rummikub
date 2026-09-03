// Parsing/preview for the free-text tile input in AddRound.tsx. Token format and rack pricing
// live in src/shared/lib/tiles.ts so this can't drift from the server-side roundScoreSchema
// (src/worker/routes/schemas.ts). The server is still the source of truth for the stored score;
// this is just input validation + a live "here's what that's worth" preview.

import { normalizeTileToken, rackValue, TILE_TOKEN_PATTERN } from "../../shared/lib/tiles";

export { rackValue };

export type ParsedTileInput = { ok: true; tiles: string[] } | { ok: false; error: string };

function parseToken(token: string): string | null {
  if (!TILE_TOKEN_PATTERN.test(token)) return null;
  return normalizeTileToken(token);
}

/** Splits free text on whitespace/commas into normalized tile tokens ("1".."13" or "J"). An
 *  empty/blank input is valid — it means that player went out (empty rack). */
export function parseTileInput(input: string): ParsedTileInput {
  const raw = input.trim();
  if (raw === "") return { ok: true, tiles: [] };

  const tokens = raw.split(/[\s,]+/).filter(Boolean);
  const tiles: string[] = [];
  for (const token of tokens) {
    const normalized = parseToken(token);
    if (normalized === null) {
      return { ok: false, error: `"${token}" isn't a valid tile — use 1-13, or J (or *) for a joker.` };
    }
    tiles.push(normalized);
  }
  return { ok: true, tiles };
}

function compareTiles(a: string, b: string): number {
  if (a === "J" || b === "J") return a === b ? 0 : a === "J" ? 1 : -1;
  return Number(a) - Number(b);
}

/** Returns a player's rack sorted for display: numeric tiles ascending, jokers last. Used by the
 *  scorecard table (Game.tsx) — doesn't mutate the input. */
export function sortTiles(tiles: string[]): string[] {
  return [...tiles].sort(compareTiles);
}
