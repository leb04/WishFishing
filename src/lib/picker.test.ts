import { describe, expect, it } from "vitest";
import {
  addNames,
  completeDraw,
  editEntry,
  eligibleEntries,
  emptyState,
  MAX_ENTRIES,
  MAX_HISTORY,
  MAX_PASTE_LENGTH,
  parseNames,
  restorePool,
} from "./picker";
import { selectWinner } from "./random";

function pool() {
  let id = 0;
  return addNames(emptyState(), "Alex\nAlex\n李 🐟", () => `entry-${++id}`);
}
const timestamp = "2026-10-17T12:00:00.000Z";

describe("name management", () => {
  it("trims surrounding whitespace, ignores blank lines, accepts line endings and Unicode", () => {
    expect(parseNames("  Alex \r\n\n \t\r李 🐟\nSam  Lee\r")).toEqual([
      "Alex",
      "李 🐟",
      "Sam  Lee",
    ]);
    expect(parseNames(" \n\t")).toEqual([]);
  });

  it("preserves duplicate entries, original order, and identities through edits", () => {
    const state = pool();
    expect(state.entries.map((entry) => entry.name)).toEqual([
      "Alex",
      "Alex",
      "李 🐟",
    ]);
    expect(new Set(state.entries.map((entry) => entry.id)).size).toBe(3);
    const edited = editEntry(state, "entry-2", "  Renamed  ");
    expect(edited.entries.map((entry) => entry.id)).toEqual(
      state.entries.map((entry) => entry.id),
    );
    expect(edited.entries[1]?.name).toBe("Renamed");
    expect(state.entries[1]?.name).toBe("Alex");
  });

  it("rejects blank edits, oversized names/pastes, and excessive entries without partially adding", () => {
    expect(() => editEntry(pool(), "entry-1", "  ")).toThrow();
    expect(parseNames("🐟".repeat(120))).toEqual(["🐟".repeat(120)]);
    expect(() => parseNames("a".repeat(121))).toThrow();
    expect(() => parseNames("a".repeat(MAX_PASTE_LENGTH + 1))).toThrow();
    expect(() =>
      parseNames(Array.from({ length: MAX_ENTRIES + 1 }, () => "a").join("\n")),
    ).toThrow();
    let id = 0;
    const full = addNames(
      emptyState(),
      Array.from({ length: MAX_ENTRIES }, () => "A").join("\n"),
      () => String(++id),
    );
    expect(() => addNames(full, "B", () => "new")).toThrow();
    expect(full.entries).toHaveLength(MAX_ENTRIES);
  });

  it("rejects duplicate generated IDs", () => {
    expect(() => addNames(emptyState(), "A\nA", () => "same")).toThrow(
      "unique",
    );
  });
});

describe("completed draws", () => {
  it("records a snapshot with IDs and timestamp and removes only one duplicate by ID", () => {
    const initial = { ...pool(), removeCaught: true };
    const selected = selectWinner(eligibleEntries(initial), () => 1)!;
    const next = completeDraw(initial, selected, "draw-1", timestamp);
    expect(next.history).toEqual([
      { id: "draw-1", entryId: "entry-2", name: "Alex", timestamp },
    ]);
    expect(next.entries).toHaveLength(3);
    expect(eligibleEntries(next).map((entry) => entry.id)).toEqual([
      "entry-1",
      "entry-3",
    ]);
    expect(initial.entries.every((entry) => !entry.removed)).toBe(true);
    expect(completeDraw(next, selected, "draw-1", timestamp)).toBe(next);
  });

  it("keeps all entries eligible when elimination is disabled", () => {
    const initial = pool();
    const next = completeDraw(
      initial,
      initial.entries[0]!,
      "draw-1",
      timestamp,
    );
    expect(eligibleEntries(next)).toHaveLength(3);
    expect(
      completeDraw(next, initial.entries[0]!, "draw-2", timestamp).history,
    ).toHaveLength(2);
  });

  it("exhausts safely and restores original order and IDs", () => {
    const initial = { ...pool(), removeCaught: true };
    let state = initial;
    initial.entries.forEach((entry, index) => {
      state = completeDraw(state, entry, `draw-${index}`, timestamp);
    });
    expect(selectWinner(eligibleEntries(state))).toBeNull();
    expect(() =>
      completeDraw(state, initial.entries[0]!, "new", timestamp),
    ).toThrow("eligible");
    expect(restorePool(state).entries).toEqual(initial.entries);
    expect(restorePool(state).history).toEqual(state.history);
  });

  it("preserves history snapshots after names are edited or deleted", () => {
    const state = pool();
    const caught = completeDraw(state, state.entries[0]!, "draw-1", timestamp);
    const edited = editEntry(caught, "entry-1", "Changed");
    expect(edited.history[0]?.name).toBe("Alex");
    expect({ ...edited, entries: [] }.history[0]?.entryId).toBe("entry-1");
  });

  it("keeps newest-first history within the documented limit", () => {
    let state = pool();
    for (let index = 0; index <= MAX_HISTORY; index++) {
      state = completeDraw(
        state,
        state.entries[0]!,
        `draw-${index}`,
        timestamp,
      );
    }
    expect(state.history).toHaveLength(MAX_HISTORY);
    expect(state.history[0]?.id).toBe(`draw-${MAX_HISTORY}`);
    expect(state.history.at(-1)?.id).toBe("draw-1");
    expect(() =>
      completeDraw(state, state.entries[0]!, "new", "invalid"),
    ).toThrow();
  });
});
