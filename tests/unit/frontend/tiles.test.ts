import { describe, expect, it } from "vitest";
import { parseTileInput, rackValue, sortTiles } from "../../../src/frontend/lib/tiles";

describe("parseTileInput", () => {
  it("splits space-separated tiles", () => {
    const result = parseTileInput("3 5 8 12");
    expect(result).toEqual({ ok: true, tiles: ["3", "5", "8", "12"] });
  });

  it("splits comma-separated tiles", () => {
    const result = parseTileInput("3, 5,8");
    expect(result).toEqual({ ok: true, tiles: ["3", "5", "8"] });
  });

  it("normalizes j and * to a canonical J joker token", () => {
    const result = parseTileInput("j * J");
    expect(result).toEqual({ ok: true, tiles: ["J", "J", "J"] });
  });

  it("treats blank input as an empty rack (went out)", () => {
    expect(parseTileInput("")).toEqual({ ok: true, tiles: [] });
    expect(parseTileInput("   ")).toEqual({ ok: true, tiles: [] });
  });

  it("rejects an out-of-range tile value", () => {
    const result = parseTileInput("14");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-tile token", () => {
    const result = parseTileInput("3 banana 5");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("banana");
  });
});

describe("rackValue", () => {
  it("sums face values, counting jokers as 30", () => {
    expect(rackValue(["3", "9", "J"])).toBe(3 + 9 + 30);
  });
});

describe("sortTiles", () => {
  it("sorts tiles numerically ascending", () => {
    expect(sortTiles(["9", "3", "12", "1"])).toEqual(["1", "3", "9", "12"]);
  });

  it("sorts jokers after all numeric tiles", () => {
    expect(sortTiles(["3", "J", "8", "9"])).toEqual(["3", "8", "9", "J"]);
  });

  it("keeps multiple jokers together at the end", () => {
    expect(sortTiles(["J", "5", "J", "2"])).toEqual(["2", "5", "J", "J"]);
  });

  it("handles an all-joker rack", () => {
    expect(sortTiles(["J", "J"])).toEqual(["J", "J"]);
  });

  it("handles an empty rack", () => {
    expect(sortTiles([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = ["9", "3"];
    sortTiles(input);
    expect(input).toEqual(["9", "3"]);
  });
});
