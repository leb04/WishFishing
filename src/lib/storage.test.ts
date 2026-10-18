import { describe, expect, it, vi } from "vitest";
import { addNames, completeDraw, emptyState, MAX_ENTRIES } from "./picker";
import { loadState, saveState, STORAGE_KEY, validateState } from "./storage";

function store(raw: string | null = null) {
  let value = raw;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => {
      value = next;
    }),
  };
}

describe("versioned local persistence", () => {
  it("starts empty with the System preference on first use", () => {
    expect(loadState(store())).toEqual({ state: emptyState(), notice: "" });
  });

  it("roundtrips entries, preference, eligibility, and historical name snapshots", () => {
    let number = 0;
    const initial = {
      ...addNames(emptyState(), "Alex\nAlex\n李", () => `entry-${++number}`),
      removeCaught: true,
      theme: "dark" as const,
    };
    const state = completeDraw(
      initial,
      initial.entries[1]!,
      "draw-1",
      "2026-10-17T12:00:00.000Z",
    );
    const storage = store();
    expect(saveState(state, storage)).toBe("");
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(state),
    );
    expect(loadState(storage)).toEqual({ state, notice: "" });
    expect(
      loadState(store(JSON.stringify({ ...state, entries: [] }))).state.history,
    ).toEqual(state.history);
  });

  it.each([
    "{broken",
    "null",
    "[]",
    '{"version":0}',
    '{"version":2}',
    JSON.stringify({ ...emptyState(), theme: "purple" }),
  ])("recovers from malformed or incompatible data: %s", (raw) => {
    const loaded = loadState(store(raw));
    expect(loaded.state).toEqual(emptyState());
    expect(loaded.notice).not.toBe("");
  });

  it("rejects invalid names, IDs, flags, timestamps, and excessive entries", () => {
    const entry = { id: "one", name: "Alex", removed: false };
    for (const entries of [
      [entry, entry],
      [{ ...entry, name: " " }],
      [{ ...entry, name: "A".repeat(121) }],
      [{ ...entry, id: "" }],
      [{ ...entry, removed: "false" }],
      Array.from({ length: MAX_ENTRIES + 1 }, () => entry),
    ])
      expect(validateState({ ...emptyState(), entries })).toBeNull();
    const draw = {
      id: "draw",
      entryId: "one",
      name: "Alex",
      timestamp: "invalid",
    };
    expect(validateState({ ...emptyState(), history: [draw] })).toBeNull();
    const validDraw = { ...draw, timestamp: "2026-10-17T12:00:00.000Z" };
    expect(
      validateState({ ...emptyState(), history: [validDraw, validDraw] }),
    ).toBeNull();
  });

  it("discards unknown fields instead of retaining extra personal data", () => {
    expect(validateState({ ...emptyState(), extra: "discard me" })).toEqual(
      emptyState(),
    );
  });

  it("keeps the app usable when storage reads or writes throw", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(loadState(storage).state).toEqual(emptyState());
    expect(loadState(storage).notice).not.toBe("");
    expect(saveState(emptyState(), storage)).toContain("session only");
  });

  it("rejects oversized payloads and invalid boolean settings", () => {
    expect(loadState(store(" ".repeat(2_000_001))).state).toEqual(emptyState());
    expect(validateState({ ...emptyState(), removeCaught: "yes" })).toBeNull();
  });
});
