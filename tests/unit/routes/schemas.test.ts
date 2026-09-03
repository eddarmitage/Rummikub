import { describe, expect, it } from "vitest";
import { addPlayerSchema, createGameSchema, roundScoresSchema } from "../../../src/worker/routes/schemas";

describe("createGameSchema", () => {
  it("accepts a body with a trimmed name", () => {
    const result = createGameSchema.safeParse({ name: "  Friday night  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Friday night");
  });

  it("accepts a body with no name (name is optional)", () => {
    const result = createGameSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects an empty-string name", () => {
    const result = createGameSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a name over 200 characters", () => {
    const result = createGameSchema.safeParse({ name: "a".repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe("addPlayerSchema", () => {
  it("accepts a valid player name", () => {
    const result = addPlayerSchema.safeParse({ name: "Alice" });
    expect(result.success).toBe(true);
  });

  it("accepts an optional integer sortOrder", () => {
    const result = addPlayerSchema.safeParse({ name: "Alice", sortOrder: 2 });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = addPlayerSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = addPlayerSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer sortOrder", () => {
    const result = addPlayerSchema.safeParse({ name: "Alice", sortOrder: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe("roundScoresSchema", () => {
  it("accepts a body with one or more scores", () => {
    const result = roundScoresSchema.safeParse({
      scores: [
        { playerId: "p1", tiles: [] },
        { playerId: "p2", tiles: ["3", "12"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("normalizes j and * to a canonical J joker token", () => {
    const result = roundScoresSchema.safeParse({
      scores: [{ playerId: "p1", tiles: ["j", "*", "J"] }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.scores[0].tiles).toEqual(["J", "J", "J"]);
  });

  it("accepts an empty tiles array (player went out)", () => {
    const result = roundScoresSchema.safeParse({ scores: [{ playerId: "p1", tiles: [] }] });
    expect(result.success).toBe(true);
  });

  it("accepts tile values 1 through 13", () => {
    const tiles = Array.from({ length: 13 }, (_, i) => String(i + 1));
    const result = roundScoresSchema.safeParse({ scores: [{ playerId: "p1", tiles }] });
    expect(result.success).toBe(true);
  });

  it("rejects a tile value of 0", () => {
    const result = roundScoresSchema.safeParse({ scores: [{ playerId: "p1", tiles: ["0"] }] });
    expect(result.success).toBe(false);
  });

  it("rejects a tile value of 14", () => {
    const result = roundScoresSchema.safeParse({ scores: [{ playerId: "p1", tiles: ["14"] }] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-tile token", () => {
    const result = roundScoresSchema.safeParse({ scores: [{ playerId: "p1", tiles: ["banana"] }] });
    expect(result.success).toBe(false);
  });

  it("rejects an empty scores array", () => {
    const result = roundScoresSchema.safeParse({ scores: [] });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate playerIds", () => {
    const result = roundScoresSchema.safeParse({
      scores: [
        { playerId: "p1", tiles: [] },
        { playerId: "p1", tiles: ["5"] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a round where nobody's rack is empty", () => {
    const result = roundScoresSchema.safeParse({
      scores: [
        { playerId: "p1", tiles: ["5"] },
        { playerId: "p2", tiles: ["1", "2", "3"] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a round where more than one rack is empty", () => {
    const result = roundScoresSchema.safeParse({
      scores: [
        { playerId: "p1", tiles: [] },
        { playerId: "p2", tiles: [] },
        { playerId: "p3", tiles: ["4"] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a round with two or more players where exactly one rack is empty", () => {
    const result = roundScoresSchema.safeParse({
      scores: [
        { playerId: "p1", tiles: [] },
        { playerId: "p2", tiles: ["5"] },
        { playerId: "p3", tiles: ["1", "2"] },
      ],
    });
    expect(result.success).toBe(true);
  });
});
