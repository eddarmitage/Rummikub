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
        { playerId: "p1", tilesLeftValue: 0 },
        { playerId: "p2", tilesLeftValue: 12 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty scores array", () => {
    const result = roundScoresSchema.safeParse({ scores: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a negative tilesLeftValue", () => {
    const result = roundScoresSchema.safeParse({ scores: [{ playerId: "p1", tilesLeftValue: -1 }] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer tilesLeftValue", () => {
    const result = roundScoresSchema.safeParse({ scores: [{ playerId: "p1", tilesLeftValue: 1.5 }] });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate playerIds", () => {
    const result = roundScoresSchema.safeParse({
      scores: [
        { playerId: "p1", tilesLeftValue: 0 },
        { playerId: "p1", tilesLeftValue: 5 },
      ],
    });
    expect(result.success).toBe(false);
  });
});
