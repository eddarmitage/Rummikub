CREATE TABLE game_members (
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'editor',  -- 'owner' | 'editor'
  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX idx_game_members_user ON game_members(user_id);
