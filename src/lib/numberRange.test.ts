import { describe, expect, it } from "vitest";
import { addNames, addNumberRange, completeDraw, emptyState, MAX_ENTRIES } from "./picker";
import { loadState, saveState } from "./storage";

const makeIds = () => {
  let next = 0;
  return () => `entry-${++next}`;
};

describe("number ranges", () => {
  it("appends inclusive, ordered tickets beside literal names", () => {
    const id = makeIds();
    const start = addNames(emptyState(), "200-300\nAda", id);
    const state = addNumberRange(start, " 200 - 300 ", id);
    expect(state.entries).toHaveLength(103);
    expect(state.entries.slice(0, 4).map(({ name }) => name)).toEqual(["200-300", "Ada", "200", "201"]);
    expect(state.entries.at(-1)?.name).toBe("300");
    expect(new Set(state.entries.map(({ id }) => id)).size).toBe(103);
  });

  it.each([
    ["001-050", "001", "050", 50],
    ["01-100", "001", "100", 100],
    ["1-003", "001", "003", 3],
    ["42-42", "42", "42", 1],
    ["0-0", "0", "0", 1],
    ["9007199254740990-9007199254740991", "9007199254740990", "9007199254740991", 2],
    ["T100-T200", "T100", "T200", 101],
    [" VIP01 - VIP100 ", "VIP001", "VIP100", 100],
    ["ab007-ab007", "ab007", "ab007", 1],
    ["票009-票010", "票009", "票010", 2],
  ] as const)("expands %s with matching ticket labels", (input, first, last, count) => {
    const { entries } = addNumberRange(emptyState(), input, makeIds());
    expect(entries).toHaveLength(count);
    expect(entries[0]?.name).toBe(first);
    expect(entries.at(-1)?.name).toBe(last);
  });

  it.each(["", "-1-3", "2.5-3", "1e2-200", "2-1", "1-2-3", "0-9007199254740992", "1-2\n3-4"])(
    "rejects invalid input %j before creating entries", (input) => {
      expect(() => addNumberRange(emptyState(), input, () => {
        throw new Error("Unexpected ID allocation");
      })).toThrow(/range|whole numbers|start/i);
    },
  );

  it.each(["T1-U3", "T1-3", "1-T3", "T1-t3"])("rejects unmatched ticket prefixes in %s", (input) => {
    expect(() => addNumberRange(emptyState(), input, makeIds())).toThrow(/same prefix/i);
  });

  it("counts the prefix toward the ticket label limit", () => {
    const prefix = "T".repeat(119);
    const id = makeIds();
    const { entries } = addNumberRange(emptyState(), `${prefix}1-${prefix}2`, id);
    expect(entries.map(({ name }) => name)).toEqual([`${prefix}1`, `${prefix}2`]);
    expect(() => addNumberRange(emptyState(), `${prefix}09-${prefix}10`, id)).toThrow(/120 characters/);
    expect(id()).toBe("entry-3");
  });

  it("checks total capacity, including caught entries, before allocating IDs", () => {
    const id = makeIds();
    const full = addNumberRange(emptyState(), "1-1000", id);
    const state = completeDraw({ ...full, removeCaught: true }, full.entries[0]!, "draw", "2026-11-13T00:00:00Z");
    const previous = JSON.stringify(state);
    expect(state.entries).toHaveLength(MAX_ENTRIES);
    expect(() => addNumberRange(state, "1-1", id)).toThrow(/1,000/);
    expect(() => addNumberRange(state, "T1-T1", id)).toThrow(/1,000/);
    expect(() => addNumberRange(emptyState(), "0-9007199254740991", id)).toThrow(/1,000/);
    expect(JSON.stringify(state)).toBe(previous);
    expect(id()).toBe("entry-1001");
  });

  it.each([["007-008", "007"], ["T007-T008", "T007"]])("keeps a caught ticket's printed label for %s", (range, label) => {
    const state = addNumberRange({ ...emptyState(), removeCaught: true }, range, makeIds());
    const drawn = completeDraw(state, state.entries[0]!, "draw", "2026-11-13T00:00:00Z");
    let data: string | null = null;
    const storage = { getItem: () => data, setItem: (_key: string, value: string) => { data = value; } };
    saveState(drawn, storage);
    expect(loadState(storage).state).toEqual(drawn);
    expect(drawn.history[0]?.name).toBe(label);
    expect(drawn.entries.map(({ removed }) => removed)).toEqual([true, false]);
  });
});
