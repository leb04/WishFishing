import { afterEach, describe, expect, it, vi } from "vitest";
import { randomIndex, selectWinner } from "./random";

afterEach(() => vi.unstubAllGlobals());

describe("unbiased selection", () => {
  it("does not consult the random source for an empty pool", () => {
    const source = vi.fn();
    expect(selectWinner([], source)).toBeNull();
    expect(source).not.toHaveBeenCalled();
  });

  it("handles one entry and the bottom and top uint32 boundaries", () => {
    expect(selectWinner(["only"], () => 0xffffffff)).toBe("only");
    expect(randomIndex(4, () => 0)).toBe(0);
    expect(randomIndex(4, () => 0xffffffff)).toBe(3);
    expect(randomIndex(2 ** 32, () => 0xffffffff)).toBe(0xffffffff);
  });

  it("rejects the incomplete top interval rather than introducing modulo bias", () => {
    const source = vi
      .fn()
      .mockReturnValueOnce(0xffffffff)
      .mockReturnValueOnce(0xfffffffe);
    expect(randomIndex(3, source)).toBe(2);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it("maps every accepted group to each eligible entry once, including duplicates", () => {
    const pool = [
      { id: "a", name: "Sam" },
      { id: "b", name: "Sam" },
      { id: "c", name: "李" },
    ];
    for (let value = 0; value < 12; value++) {
      expect(selectWinner(pool, () => value)).toBe(pool[value % 3]);
    }
  });

  it.each([0, -1, 1.5, NaN, Infinity, 2 ** 32 + 1])(
    "rejects invalid pool size %s",
    (count) => {
      expect(() => randomIndex(count)).toThrow();
    },
  );

  it.each([-1, 0.5, NaN, Infinity, 2 ** 32])(
    "rejects invalid source value %s",
    (value) => {
      expect(() => randomIndex(3, () => value)).toThrow();
    },
  );

  it("uses Web Crypto by default", () => {
    const getRandomValues = vi.fn((array: Uint32Array) => {
      array[0] = 7;
      return array;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    expect(randomIndex(4)).toBe(3);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("fails explicitly when secure randomness is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => selectWinner(["a"])).toThrow(
      "Secure randomness is unavailable",
    );
  });
});
