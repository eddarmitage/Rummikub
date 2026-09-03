// Tile token format shared by the frontend's free-text input parser (src/frontend/lib/tiles.ts)
// and the server-side request schema (src/worker/routes/schemas.ts): "1".."13" for a numbered
// tile, or "J"/"j"/"*" for a joker, normalized to a canonical "J". Also used by
// src/worker/lib/scoring.ts to price a rack. Lives here rather than in either side (like
// isDuplicatePlayerName, #64) because frontend/worker are separate builds and can't import each
// other's code (#65).

export const TILE_TOKEN_PATTERN = /^(1[0-3]|[1-9]|[Jj*])$/;
export const JOKER_VALUE = 30;

export function normalizeTileToken(token: string): string {
  return token === "j" || token === "J" || token === "*" ? "J" : token;
}

export function tileValue(tile: string): number {
  return tile === "J" ? JOKER_VALUE : Number(tile);
}

export function rackValue(tiles: string[]): number {
  return tiles.reduce((sum, tile) => sum + tileValue(tile), 0);
}
