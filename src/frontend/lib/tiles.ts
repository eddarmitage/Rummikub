// Parsing/preview for the free-text tile input in AddRound.tsx. Mirrors the token rules enforced
// server-side by roundScoreSchema/computeRoundScores (src/worker/routes/schemas.ts,
// src/worker/lib/scoring.ts) — kept in sync by hand since frontend/worker are separate builds.
// The server is the source of truth for the stored score; this is just input validation + a
// live "here's what that's worth" preview.

const TILE_TOKEN_PATTERN = /^(1[0-3]|[1-9]|[Jj*])$/;
const JOKER_VALUE = 30;

export type ParsedTileInput = { ok: true; tiles: string[] } | { ok: false; error: string };

function normalizeTileToken(token: string): string | null {
  if (!TILE_TOKEN_PATTERN.test(token)) return null;
  return token === "j" || token === "J" || token === "*" ? "J" : token;
}

/** Splits free text on whitespace/commas into normalized tile tokens ("1".."13" or "J"). An
 *  empty/blank input is valid — it means that player went out (empty rack). */
export function parseTileInput(input: string): ParsedTileInput {
  const raw = input.trim();
  if (raw === "") return { ok: true, tiles: [] };

  const tokens = raw.split(/[\s,]+/).filter(Boolean);
  const tiles: string[] = [];
  for (const token of tokens) {
    const normalized = normalizeTileToken(token);
    if (normalized === null) {
      return { ok: false, error: `"${token}" isn't a valid tile — use 1-13, or J (or *) for a joker.` };
    }
    tiles.push(normalized);
  }
  return { ok: true, tiles };
}

export function tileValue(tile: string): number {
  return tile === "J" ? JOKER_VALUE : Number(tile);
}

export function rackValue(tiles: string[]): number {
  return tiles.reduce((sum, tile) => sum + tileValue(tile), 0);
}
