import { Given, Then, When, type DataTable } from "@cucumber/cucumber";
import { expect, type Page } from "@playwright/test";
import assert from "node:assert/strict";
import { BASE_URL } from "./hooks";
import type { E2EWorld } from "./world";

Given("a game with players:", async function (this: E2EWorld, table: DataTable) {
  const names = table.rows().flat();
  await this.page.goto("/");
  await this.page.getByLabel("Game name").fill("Cucumber e2e game");

  // The form starts with 2 blank player rows (CreateGame.tsx) — add a row for anyone beyond
  // that, same as a real user clicking "+ Add player".
  for (let i = 2; i < names.length; i++) {
    await this.page.getByRole("button", { name: "+ Add player" }).click();
  }
  for (const [index, name] of names.entries()) {
    await this.page.getByPlaceholder(`Player ${index + 1}`).fill(name);
  }

  await this.page.getByRole("button", { name: "+ Start new game" }).click();
  await this.page.waitForURL(/\/g\/[^/]+\/?$/);
  this.gameUrl = this.page.url();
});

async function fillRound(page: Page, table: DataTable): Promise<void> {
  await page.getByRole("button", { name: "+ Add round" }).click();
  for (const row of table.hashes()) {
    await page.getByLabel(row.player).fill(row.tiles);
  }
}

async function fillAndSaveRound(page: Page, table: DataTable): Promise<void> {
  await fillRound(page, table);
  await page.getByRole("button", { name: "Save round" }).click();
}

When("round {int} is played:", async function (this: E2EWorld, _roundNumber: number, table: DataTable) {
  const roundsBefore = await this.page.locator("tbody tr").count();
  await fillAndSaveRound(this.page, table);
  // Game.tsx's onSaved closes the Add Round modal before awaiting the refresh GET that
  // repopulates the scorecard, so wait for the round row itself rather than just the modal
  // disappearing (same race the component layer's steps.ts hits too).
  await this.page.locator("tbody tr").nth(roundsBefore).waitFor();
});

When("round {int} is attempted:", async function (this: E2EWorld, _roundNumber: number, table: DataTable) {
  await fillRound(this.page, table);
});

Then("the round should be rejected", async function (this: E2EWorld) {
  await expect(this.page.getByRole("button", { name: "Save round" })).toBeDisabled();
});

Then("the Add Round modal should show the hint {string}", async function (this: E2EWorld, hint: string) {
  await expect(this.page.getByText(hint)).toBeVisible();
});

When(
  "an anonymous visitor tries to play round {int}:",
  async function (this: E2EWorld, _roundNumber: number, table: DataTable) {
    this.anonymousContext = await this.browser.newContext({ baseURL: BASE_URL }); // no auth header
    this.anonymousPage = await this.anonymousContext.newPage();
    await this.anonymousPage.goto(this.gameUrl);
    await fillAndSaveRound(this.anonymousPage, table);
  },
);

Then("the score should show:", async function (this: E2EWorld, table: DataTable) {
  const headers = await this.page.locator("thead th").allTextContents();
  const cells = await this.page.locator("tr.totals-row td").allTextContents();
  for (const row of table.hashes()) {
    const index = headers.indexOf(row.player);
    assert.equal(Number(cells[index]), Number(row.total), `expected ${row.player} total ${row.total}`);
  }
});

Then(
  "the rack for {string} in round {int} should show {string}",
  async function (this: E2EWorld, playerName: string, roundNumber: number, expected: string) {
    const headers = await this.page.locator("thead th").allTextContents();
    const index = headers.indexOf(playerName);
    const row = this.page.locator("tbody tr").nth(roundNumber - 1);
    const tilesText = await row.locator("td").nth(index).locator(".round-score-tiles").textContent();
    assert.equal(tilesText, expected, `expected ${playerName}'s round ${roundNumber} rack to show "${expected}"`);
  },
);

Then("they should be redirected to sign in", async function (this: E2EWorld) {
  await this.anonymousPage!.waitForURL(/\/api\/auth\/login/);
});

When("I try to create a game with players:", async function (this: E2EWorld, table: DataTable) {
  const names = table.rows().flat();
  await this.page.goto("/");
  await this.page.getByLabel("Game name").fill("Cucumber e2e duplicate-name game");
  for (let i = 2; i < names.length; i++) {
    await this.page.getByRole("button", { name: "+ Add player" }).click();
  }
  for (const [index, name] of names.entries()) {
    await this.page.getByPlaceholder(`Player ${index + 1}`).fill(name);
  }
  await this.page.getByRole("button", { name: "+ Start new game" }).click();
});

Then("I should see the error {string}", async function (this: E2EWorld, message: string) {
  const errorLocator = this.page.locator(".error");
  await errorLocator.waitFor();
  assert.equal(await errorLocator.textContent(), message);
});

Then("I should still be on the create-game form", async function (this: E2EWorld) {
  assert.equal(new URL(this.page.url()).pathname, "/");
});
