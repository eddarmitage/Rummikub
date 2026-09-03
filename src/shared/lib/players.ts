// Player names must be unique within a game, case-insensitive and post-trim (#31). Lives under
// src/shared rather than src/worker so the frontend's CreateGame.tsx can enforce the same rule
// before submitting (#51) without importing worker code — the frontend and worker are separate
// builds, so anything imported by both needs to live somewhere neither owns. Also exported so
// the cucumber component layer's stubbed fetch (tests/cucumber/component/hooks.ts) can call the
// real check instead of hand-copying it — same reasoning as scoring.ts's computeRoundScores().

export function isDuplicatePlayerName(existingPlayers: { name: string }[], name: string): boolean {
  return existingPlayers.some((p) => p.name.toLowerCase() === name.toLowerCase());
}
