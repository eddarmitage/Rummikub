import { Given, Then, When, type DataTable } from "@cucumber/cucumber";
import { render, waitFor, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import assert from "node:assert/strict";
import { createElement } from "react";
import { CreateGame } from "../../../src/frontend/pages/CreateGame";
import { Game } from "../../../src/frontend/pages/Game";
import { fakeLocation } from "./dom-setup";
import type { ComponentWorld } from "./world";

// Deliberately not using @testing-library/react's `screen` singleton: it resolves `document`
// once at module-import time (see node_modules/@testing-library/dom/dist/screen.js), before
// this file's hooks.ts has had a chance to install jsdom globals for the scenario. Using each
// render()'s own bound queries instead means they're always scoped to the right document.

Given("a game with players:", function (this: ComponentWorld, table: DataTable) {
  this.players = table.rows().flat().map((name, i) => ({ id: `p${i + 1}`, gameId: this.gameId, name, sortOrder: i }));
});

async function fillRound(view: RenderResult, table: DataTable) {
  // Pass `document` explicitly rather than relying on userEvent's default options — those
  // capture `globalThis.document` once at this module's import time (see setup.js's
  // `defaultOptionsDirect`), before hooks.ts has installed this scenario's jsdom globals.
  const user = userEvent.setup({ document });
  await user.click(await view.findByRole("button", { name: "+ Add round" }));
  for (const row of table.hashes()) {
    if (row.tiles === "") continue; // input already starts blank ("winner") — nothing to type
    await user.type(await view.findByLabelText(row.player), row.tiles);
  }
}

async function playRound(view: RenderResult, table: DataTable) {
  await fillRound(view, table);
  await userEvent.setup({ document }).click(view.getByRole("button", { name: "Save round" }));
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

When("round {int} is attempted:", async function (this: ComponentWorld, _roundNumber: number, table: DataTable) {
  if (!this.view) {
    this.view = render(createElement(Game, { gameId: this.gameId }));
    await this.view.findByRole("button", { name: "+ Add round" }); // wait for the initial GET
  }
  await fillRound(this.view, table);
});

Then("the round should be rejected", async function (this: ComponentWorld) {
  const saveButton = await this.view!.findByRole("button", { name: "Save round" });
  assert.equal((saveButton as HTMLButtonElement).disabled, true, "expected the Save round button to be disabled");
});

Then(
  "the Add Round modal should show the hint {string}",
  async function (this: ComponentWorld, hint: string) {
    const hintEl = await this.view!.findByText(hint);
    assert.ok(hintEl, `expected the hint "${hint}" to be shown`);
  },
);

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

When("I try to create a game with players:", async function (this: ComponentWorld, table: DataTable) {
  const user = userEvent.setup({ document });
  this.view = render(createElement(CreateGame));
  const names = table.rows().flat();
  // The form starts with 2 blank player rows -- add a row for anyone beyond that, same as a
  // real user clicking "+ Add player" (mirrors the e2e layer's "Given a game with players:").
  for (let i = 2; i < names.length; i++) {
    await user.click(this.view.getByRole("button", { name: "+ Add player" }));
  }
  for (const [index, name] of names.entries()) {
    await user.type(this.view.getByPlaceholderText(`Player ${index + 1}`), name);
  }
  await user.click(this.view.getByRole("button", { name: "+ Start new game" }));
});

Then("I should see the error {string}", async function (this: ComponentWorld, message: string) {
  const errorEl = await waitFor(() => {
    const el = document.querySelector(".error");
    assert.ok(el, "expected an error message to be shown");
    return el!;
  });
  assert.equal(errorEl.textContent, message);
});

Then("I should still be on the create-game form", function () {
  assert.equal(fakeLocation.href, "/");
});
