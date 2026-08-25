// Player names must be unique within a game, case-insensitive and post-trim (#31). Exported so
// the cucumber component layer's stubbed fetch (tests/cucumber/component/hooks.ts) can call the
// real check instead of hand-copying it — same reasoning as scoring.ts's computeRoundScores().

export function isDuplicatePlayerName(existingPlayers: { name: string }[], name: string): boolean {
  return existingPlayers.some((p) => p.name.toLowerCase() === name.toLowerCase());
}
