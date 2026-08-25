import { Given, Then, When, type DataTable } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { BASE_URL } from "./hooks";
import type { IntegrationWorld } from "./world";

const AUTH_HEADERS = { "X-Dev-User-Email": "cucumber-integration@example.com", "content-type": "application/json" };

Given("a game with players:", async function (this: IntegrationWorld, table: DataTable) {
  const gameRes = await fetch(`${BASE_URL}/games/new`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ name: "Cucumber integration game" }),
  });
  const { game } = (await gameRes.json()) as { game: { id: string } };
  this.gameId = game.id;

  for (const name of table.rows().flat()) {
    const res = await fetch(`${BASE_URL}/games/${this.gameId}/players`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name }),
    });
    const { player } = (await res.json()) as { player: { id: string } };
    this.playerIdByName.set(name, player.id);
  }
});

When("round {int} is played:", async function (this: IntegrationWorld, _roundNumber: number, table: DataTable) {
  const scores = table.hashes().map((row) => ({
    playerId: this.playerIdByName.get(row.player),
    tiles: row.tiles.trim() === "" ? [] : row.tiles.trim().split(/\s+/),
  }));

  const res = await fetch(`${BASE_URL}/games/${this.gameId}/rounds`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ scores }),
  });
  assert.equal(res.status, 201, `round save failed: ${await res.text()}`);
});

Then("the score should show:", async function (this: IntegrationWorld, table: DataTable) {
  const res = await fetch(`${BASE_URL}/games/${this.gameId}`);
  const detail = (await res.json()) as { totals: { playerId: string; total: number }[] };
  const totalsByPlayerId = new Map(detail.totals.map((t) => [t.playerId, t.total]));

  for (const row of table.hashes()) {
    const playerId = this.playerIdByName.get(row.player);
    assert.ok(playerId, `no such player "${row.player}" — was it added in the Given step?`);
    assert.equal(totalsByPlayerId.get(playerId), Number(row.total), `expected ${row.player} total ${row.total}`);
  }
});
