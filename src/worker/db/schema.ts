import { relations } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Mirrors migrations/0001_init.sql field-for-field. Keep in sync by hand — the SQL
// migration is the source of truth; this file is a typed reflection of it, not the
// other way around (see drizzle.config.ts for why drizzle-kit doesn't generate
// migrations in this project).

export const games = sqliteTable("games", {
  id: text("id").primaryKey(), // 8-char nanoid
  name: text("name"),
  status: text("status", { enum: ["active", "complete"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  createdBy: text("created_by").references(() => users.id), // nullable until auth exists
});

export const players = sqliteTable(
  "players",
  {
    id: text("id").primaryKey(), // nanoid
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    userId: text("user_id").references(() => users.id), // nullable; links to a persistent user
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("idx_players_game").on(table.gameId)],
);

export const rounds = sqliteTable(
  "rounds",
  {
    id: text("id").primaryKey(), // nanoid
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    roundNumber: integer("round_number").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_rounds_game").on(table.gameId)],
);

export const scores = sqliteTable(
  "scores",
  {
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    tilesLeftValue: integer("tiles_left_value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roundId, table.playerId] }),
    index("idx_scores_round").on(table.roundId),
  ],
);

// Populated lazily: upserted on a user's first authenticated write via Access
// identity (email). Can also be pre-created by an admin.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const gamesRelations = relations(games, ({ many, one }) => ({
  players: many(players),
  rounds: many(rounds),
  createdByUser: one(users, { fields: [games.createdBy], references: [users.id] }),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  game: one(games, { fields: [players.gameId], references: [games.id] }),
  user: one(users, { fields: [players.userId], references: [users.id] }),
  scores: many(scores),
}));

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  game: one(games, { fields: [rounds.gameId], references: [games.id] }),
  scores: many(scores),
}));

export const scoresRelations = relations(scores, ({ one }) => ({
  round: one(rounds, { fields: [scores.roundId], references: [rounds.id] }),
  player: one(players, { fields: [scores.playerId], references: [players.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  games: many(games),
  players: many(players),
}));

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type Round = typeof rounds.$inferSelect;
export type NewRound = typeof rounds.$inferInsert;
export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
