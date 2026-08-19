CREATE TABLE games (
  id TEXT PRIMARY KEY,           -- 8-char nanoid
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'complete'
  created_at INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id)    -- nullable until auth exists
);

CREATE TABLE players (
  id TEXT PRIMARY KEY,           -- nanoid
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT REFERENCES users(id),  -- nullable; links a player-in-a-game to a persistent user for league tables
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rounds (
  id TEXT PRIMARY KEY,           -- nanoid
  game_id TEXT NOT NULL REFERENCES games(id),
  round_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  submitted_by TEXT REFERENCES users(id)  -- nullable
);

CREATE TABLE scores (
  round_id TEXT NOT NULL REFERENCES rounds(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  tiles_left_value INTEGER NOT NULL,
  PRIMARY KEY (round_id, player_id)
);

-- Populated lazily: upserted on a user's first authenticated write via Access identity (email).
-- Can also be pre-created by an admin (e.g. to link a player before that person has ever logged in).
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL
);

-- Deferred — add when per-game roles/membership are needed (not v1)
-- CREATE TABLE game_members (
--   game_id TEXT NOT NULL REFERENCES games(id),
--   user_id TEXT NOT NULL REFERENCES users(id),
--   role TEXT NOT NULL DEFAULT 'editor',  -- 'owner' | 'editor'
--   PRIMARY KEY (game_id, user_id)
-- );

CREATE INDEX idx_players_game ON players(game_id);
CREATE INDEX idx_rounds_game ON rounds(game_id);
CREATE INDEX idx_scores_round ON scores(round_id);
