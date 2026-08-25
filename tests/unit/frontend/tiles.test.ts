import { describe, expect, it } from "vitest";
import { parseTileInput, rackValue } from "../../../src/frontend/lib/tiles";

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
