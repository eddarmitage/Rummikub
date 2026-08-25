import { describe, expect, it } from "vitest";
import { computeRoundScores, rackValue, tileValue } from "../../../src/worker/lib/scoring";

describe("tileValue", () => {
  it("returns the numeric face value for a numbered tile", () => {
    expect(tileValue("7")).toBe(7);
    expect(tileValue("13")).toBe(13);
  });

  it("returns 30 for a joker", () => {
    expect(tileValue("J")).toBe(30);
  });
});

describe("rackValue", () => {
  it("sums face values, counting jokers as 30", () => {
    expect(rackValue(["3", "9", "J"])).toBe(3 + 9 + 30);
  });

  it("is 0 for an empty rack", () => {
    expect(rackValue([])).toBe(0);
  });
});

describe("computeRoundScores", () => {
  it("credits the sole player with the fewest tiles the sum of everyone else's rack value", () => {
    // Mirrors the Wikipedia example: A goes out, B/C/D hold racks worth 5/10/3.
    const scores = computeRoundScores([
      { playerId: "a", tiles: [] },
      { playerId: "b", tiles: ["5"] },
      { playerId: "c", tiles: ["10"] },
      { playerId: "d", tiles: ["3"] },
    ]);

    expect(scores).toEqual({ a: 18, b: -5, c: -10, d: -3 });
  });

  it("counts a joker as 30 points in both the loser's debit and the winner's credit", () => {
    const scores = computeRoundScores([
      { playerId: "a", tiles: [] },
      { playerId: "b", tiles: ["J"] },
    ]);

    expect(scores).toEqual({ a: 30, b: -30 });
  });

  it("uses fewest tiles remaining, not lowest rack value, to determine the winner", () => {
    // b has fewer tiles (1) but a higher rack value than a's two tiles.
    const scores = computeRoundScores([
      { playerId: "a", tiles: ["1", "1"] },
      { playerId: "b", tiles: ["13"] },
    ]);

    expect(scores).toEqual({ a: -2, b: 2 });
  });

  it("awards no bonus when multiple players tie for fewest tiles", () => {
    const scores = computeRoundScores([
      { playerId: "a", tiles: ["5"] },
      { playerId: "b", tiles: ["5"] },
      { playerId: "c", tiles: ["1", "2", "3"] },
    ]);

    expect(scores).toEqual({ a: -5, b: -5, c: -6 });
  });

  it("scores a single-entry round as 0 (nothing to gain or lose)", () => {
    const scores = computeRoundScores([{ playerId: "a", tiles: ["5"] }]);
    expect(scores).toEqual({ a: 0 });
  });
});
