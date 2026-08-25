-- Replaces the old "tiles_left_value" raw integer with the actual tiles left on each player's
-- rack, so round/running scores can be computed per official Rummikub rules (face value sum,
-- jokers = 30, winner credited the sum of everyone else's rack) instead of just showing a
-- manually-counted tile count. Old rounds/scores can't be converted (no way to recover which
-- tiles they represented), so round history resets; games and players are untouched.
DELETE FROM scores;
DELETE FROM rounds;

DROP TABLE scores;

CREATE TABLE scores (
  round_id TEXT NOT NULL REFERENCES rounds(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  tiles TEXT NOT NULL,   -- JSON array of remaining-tile tokens, e.g. ["3","5","J"]; "J" = joker. [] = went out (round winner).
  PRIMARY KEY (round_id, player_id)
);

CREATE INDEX idx_scores_round ON scores(round_id);
