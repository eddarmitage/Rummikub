import { Given, Then, When, type DataTable } from "@cucumber/cucumber";
import { render, waitFor, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import assert from "node:assert/strict";
import { createElement } from "react";
import { Game } from "../../../src/frontend/pages/Game";
import type { ComponentWorld } from "./world";

// Deliberately not using @testing-library/react's `screen` singleton: it resolves `document`
// once at module-import time (see node_modules/@testing-library/dom/dist/screen.js), before
// this file's hooks.ts has had a chance to install jsdom globals for the scenario. Using each
// render()'s own bound queries instead means they're always scoped to the right document.

Given("a game with players:", function (this: ComponentWorld, table: DataTable) {
  this.players = table.rows().flat().map((name, i) => ({ id: `p${i + 1}`, gameId: this.gameId, name, sortOrder: i }));
});

async function playRound(view: RenderResult, table: DataTable) {
  // Pass `document` explicitly rather than relying on userEvent's default options — those
  // capture `globalThis.document` once at this module's import time (see setup.js's
  // `defaultOptionsDirect`), before hooks.ts has installed this scenario's jsdom globals.
  const user = userEvent.setup({ document });
  await user.click(await view.findByRole("button", { name: "+ Add round" }));
  for (const row of table.hashes()) {
    if (row.tiles === "") continue; // input already starts blank ("winner") — nothing to type
    await user.type(await view.findByLabelText(row.player), row.tiles);
  }
  await user.click(view.getByRole("button", { name: "Save round" }));
}

When("round {int} is played:", async function (this: ComponentWorld, _roundNumber: number, table: DataTable) {
  // Render once per scenario and reuse across rounds — see world.ts's `view` field comment.
  if (!this.view) {
    this.view = render(createElement(Game, { gameId: this.gameId }));
    await this.view.findByRole("button", { name: "+ Add round" }); // wait for the initial GET
  }

  const roundsBefore = document.querySelectorAll("tbody tr").length;
  await playRound(this.view, table);

  // Same race as the e2e layer's AddRound.tsx onSaved (modal closes before the refresh GET
  // resolves) — wait for the round to actually land before the Then step reads totals.
  await waitFor(() => assert.equal(document.querySelectorAll("tbody tr").length, roundsBefore + 1));
});

When(
  "an anonymous visitor tries to play round {int}:",
  async function (this: ComponentWorld, _roundNumber: number, table: DataTable) {
    this.simulateUnauthenticated = true;
    const view = render(createElement(Game, { gameId: this.gameId }));
    await view.findByRole("button", { name: "+ Add round" });
    await playRound(view, table);
  },
);

Then("the score should show:", function (this: ComponentWorld, table: DataTable) {
  const cells = document.querySelectorAll("tr.totals-row td");
  const playerNames = this.players.map((p) => p.name);
  for (const row of table.hashes()) {
    const index = playerNames.indexOf(row.player); // cells[0] is the "Total" row label
    assert.equal(Number(cells[index + 1].textContent), Number(row.total), `expected ${row.player} total ${row.total}`);
  }
});

Then(
  "the rack for {string} in round {int} should show {string}",
  function (this: ComponentWorld, playerName: string, roundNumber: number, expected: string) {
    const headers = [...document.querySelectorAll("thead th")].map((th) => th.textContent);
    const index = headers.indexOf(playerName);
    const row = document.querySelectorAll("tbody tr")[roundNumber - 1];
    const cell = row.querySelectorAll("td")[index];
    const tilesText = cell.querySelector(".round-score-tiles")?.textContent;
    assert.equal(tilesText, expected, `expected ${playerName}'s round ${roundNumber} rack to show "${expected}"`);
  },
);

Then("they should be redirected to sign in", function () {
  assert.match(window.location.href, /^\/api\/auth\/login/);
});
