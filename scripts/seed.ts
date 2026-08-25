/**
 * Populates the local D1 database with a fake game, a few players, and a
 * couple of rounds of scores — for use during `wrangler dev` and Playwright
 * e2e runs (docs/spec.md project structure).
 *
 * Uses `wrangler`'s `getPlatformProxy()` to get the same bindings `wrangler
 * dev` would give the Worker, persisted to the same local state directory
 * (`.wrangler/state/v3` by default) — so seeded data shows up immediately
 * under local dev. Reads config the same way `wrangler dev` does: by default
 * the gitignored `wrangler.toml` (see `./scripts/bootstrap.sh`), or whichever
 * config `--config` points at.
 *
 * Idempotent: re-running clears out the fixed demo IDs below before
 * re-inserting, so it's safe to run repeatedly.
 *
 * Usage: npm run seed [-- --config wrangler.e2e.toml]
 */
import { eq } from "drizzle-orm";
import { getPlatformProxy } from "wrangler";
import { createDb } from "../src/worker/db/queries";
import { games, players, rounds, scores, users } from "../src/worker/db/schema";

const DEMO_GAME_ID = "demoseed";
const DEMO_USER_ID = "demoseeduser";
const DEMO_USER_EMAIL = "seed@example.com";
const DEMO_PLAYER_NAMES = ["Alice", "Bob", "Carol"];
// One row per round, one tile list per player (matching DEMO_PLAYER_NAMES order). An empty
// array means that player went out (round winner).
const DEMO_ROUND_SCORES: string[][][] = [
  [["3", "9", "J"], [], ["4", "13", "12", "5"]],
  [[], ["8"], ["7", "8"]],
];

function parseConfigPathArg(): string | undefined {
  const flagIndex = process.argv.indexOf("--config");
  return flagIndex !== -1 ? process.argv[flagIndex + 1] : undefined;
}

async function main() {
  const configPath = parseConfigPathArg();
  const { env, dispose } = await getPlatformProxy<Env>({ configPath });

  try {
    const db = createDb(env.DB);

    // Idempotent: wipe any previously-seeded rows for the fixed demo IDs first.
    const existingRounds = await db.query.rounds.findMany({ where: eq(rounds.gameId, DEMO_GAME_ID) });
    for (const round of existingRounds) {
      await db.delete(scores).where(eq(scores.roundId, round.id));
    }
    await db.delete(rounds).where(eq(rounds.gameId, DEMO_GAME_ID));
    await db.delete(players).where(eq(players.gameId, DEMO_GAME_ID));
    await db.delete(games).where(eq(games.id, DEMO_GAME_ID));
    await db.delete(users).where(eq(users.id, DEMO_USER_ID));

    await db.insert(users).values({
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: "Seed User",
      createdAt: new Date(),
    });

    await db.insert(games).values({
      id: DEMO_GAME_ID,
      name: "Friday night Rummikub",
      status: "active",
      createdAt: new Date(),
      createdBy: DEMO_USER_ID,
    });

    const seededPlayers = [];
    for (let i = 0; i < DEMO_PLAYER_NAMES.length; i++) {
      const [player] = await db
        .insert(players)
        .values({ id: `demoplayer${i}`, gameId: DEMO_GAME_ID, name: DEMO_PLAYER_NAMES[i], sortOrder: i })
        .returning();
      seededPlayers.push(player);
    }

    for (let r = 0; r < DEMO_ROUND_SCORES.length; r++) {
      const [round] = await db
        .insert(rounds)
        .values({ id: `demoround${r}`, gameId: DEMO_GAME_ID, roundNumber: r + 1, createdAt: new Date() })
        .returning();
      await db.insert(scores).values(
        seededPlayers.map((player, i) => ({
          roundId: round.id,
          playerId: player.id,
          tiles: JSON.stringify(DEMO_ROUND_SCORES[r][i]),
        })),
      );
    }

    console.log(`Seeded game "${DEMO_GAME_ID}" with ${seededPlayers.length} players and ${DEMO_ROUND_SCORES.length} rounds.`);
    console.log(`View it at: http://localhost:8787/g/${DEMO_GAME_ID}`);
  } finally {
    await dispose();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
