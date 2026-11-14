import type { Draw, Entry, PickerState } from "../types/picker";

export const MAX_ENTRIES = 1000;
export const MAX_NAME_LENGTH = 120;
export const MAX_HISTORY = 100;
export const MAX_PASTE_LENGTH = 125_000;

export function emptyState(): PickerState {
  return {
    version: 1,
    entries: [],
    history: [],
    removeCaught: false,
    theme: "system",
  };
}

export function normalizeName(value: string): string {
  return value.trim();
}

export function validateName(name: string): void {
  if (!name || [...name].length > MAX_NAME_LENGTH) {
    throw new Error(`Each name must contain 1–${MAX_NAME_LENGTH} characters.`);
  }
}

export function parseNames(text: string): string[] {
  if (text.length > MAX_PASTE_LENGTH)
    throw new Error("This paste is too large. Add names in smaller batches.");
  const names = text
    .split(/\r\n|\n|\r/)
    .map(normalizeName)
    .filter(Boolean);
  if (names.length > MAX_ENTRIES)
    throw new Error(`The pool can contain up to ${MAX_ENTRIES} entries.`);
  names.forEach(validateName);
  return names;
}

export function addNames(
  state: PickerState,
  text: string,
  makeId: () => string,
): PickerState {
  return appendEntries(state, parseNames(text), makeId);
}

export function addNumberRange(state: PickerState, text: string, makeId: () => string): PickerState {
  const match = /^(\d+)[ \t]*-[ \t]*(\d+)$/.exec(text.trim());
  if (!match) throw new Error("Enter a number range such as 200-300.");

  const [, first = "", last = ""] = match;
  const start = Number(first);
  const end = Number(last);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    throw new Error("Use whole numbers from 0 to 9,007,199,254,740,991.");
  }
  if (end < start) throw new Error("The range end must be at least the start.");

  const count = end - start + 1;
  validatePoolCapacity(state, count);
  const padded = first.length > String(start).length || last.length > String(end).length;
  const width = padded ? Math.max(first.length, last.length) : 0;
  if (Math.max(width, last.length) > MAX_NAME_LENGTH) {
    throw new Error(`Ticket labels can be up to ${MAX_NAME_LENGTH} characters.`);
  }

  const labels = Array.from({ length: count }, (_, index) => String(start + index).padStart(width, "0"));
  return appendEntries(state, labels, makeId);
}

function validatePoolCapacity(state: PickerState, count: number) {
  if (count > MAX_ENTRIES - state.entries.length) {
    throw new Error(
      `The pool can contain up to ${MAX_ENTRIES.toLocaleString("en-US")} entries. No entries were added.`,
    );
  }
}

function appendEntries(state: PickerState, names: string[], makeId: () => string): PickerState {
  validatePoolCapacity(state, names.length);
  const ids = new Set(state.entries.map((entry) => entry.id));
  const entries = names.map((name) => {
    const id = makeId();
    if (!id || ids.has(id))
      throw new Error("Could not create a unique entry. Please try again.");
    ids.add(id);
    return { id, name, removed: false };
  });
  return { ...state, entries: [...state.entries, ...entries] };
}

export function editEntry(
  state: PickerState,
  id: string,
  value: string,
): PickerState {
  const name = normalizeName(value);
  validateName(name);
  return {
    ...state,
    entries: state.entries.map((entry) =>
      entry.id === id ? { ...entry, name } : entry,
    ),
  };
}

export function eligibleEntries(state: PickerState): Entry[] {
  return state.entries.filter((entry) => !entry.removed);
}

/** Accept only a preselected, eligible winner. Repeated finalization is a no-op. */
export function completeDraw(
  state: PickerState,
  winner: Entry,
  id: string,
  timestamp: string,
): PickerState {
  if (state.history.some((draw) => draw.id === id)) return state;
  const current = state.entries.find(
    (entry) => entry.id === winner.id && !entry.removed,
  );
  if (!current || current.name !== winner.name)
    throw new Error("This entry is no longer eligible. Please cast again.");
  if (!id || !Number.isFinite(Date.parse(timestamp)))
    throw new Error("Could not record this catch.");
  const draw: Draw = { id, entryId: winner.id, name: winner.name, timestamp };
  return {
    ...state,
    entries: state.entries.map((entry) =>
      entry.id === winner.id && state.removeCaught
        ? { ...entry, removed: true }
        : entry,
    ),
    history: [draw, ...state.history].slice(0, MAX_HISTORY),
  };
}

export function restorePool(state: PickerState): PickerState {
  return {
    ...state,
    entries: state.entries.map((entry) => ({ ...entry, removed: false })),
  };
}
