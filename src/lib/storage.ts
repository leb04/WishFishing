import type { PickerState } from "../types/picker";
import {
  emptyState,
  MAX_ENTRIES,
  MAX_HISTORY,
  MAX_NAME_LENGTH,
} from "./picker";

export const STORAGE_KEY = "wishfishing:picker";
const MAX_STORAGE_LENGTH = 2_000_000;

type Store = Pick<Storage, "getItem" | "setItem">;
type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function id(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function name(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length > 0 &&
    [...value].length <= MAX_NAME_LENGTH
  );
}

/** Reconstruct only known fields; invalid or incompatible payloads are discarded as a whole. */
export function validateState(value: unknown): PickerState | null {
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.removeCaught !== "boolean" ||
    (value.theme !== "light" &&
      value.theme !== "dark" &&
      value.theme !== "system") ||
    !Array.isArray(value.entries) ||
    value.entries.length > MAX_ENTRIES ||
    !Array.isArray(value.history) ||
    value.history.length > MAX_HISTORY
  )
    return null;

  const entries: PickerState["entries"] = [];
  const history: PickerState["history"] = [];
  const entryIds = new Set<string>();
  const drawIds = new Set<string>();
  for (const entry of value.entries) {
    if (
      !record(entry) ||
      !id(entry.id) ||
      !name(entry.name) ||
      typeof entry.removed !== "boolean" ||
      entryIds.has(entry.id)
    )
      return null;
    entryIds.add(entry.id);
    entries.push({ id: entry.id, name: entry.name, removed: entry.removed });
  }
  for (const draw of value.history) {
    if (
      !record(draw) ||
      !id(draw.id) ||
      !id(draw.entryId) ||
      !name(draw.name) ||
      typeof draw.timestamp !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(draw.timestamp) ||
      !Number.isFinite(Date.parse(draw.timestamp)) ||
      drawIds.has(draw.id)
    )
      return null;
    drawIds.add(draw.id);
    history.push({
      id: draw.id,
      entryId: draw.entryId,
      name: draw.name,
      timestamp: draw.timestamp,
    });
  }
  return {
    version: 1,
    entries,
    history,
    removeCaught: value.removeCaught,
    theme: value.theme,
  };
}

export function loadState(storage?: Store): {
  state: PickerState;
  notice: string;
} {
  try {
    const raw = (storage ?? window.localStorage).getItem(STORAGE_KEY);
    if (raw === null) return { state: emptyState(), notice: "" };
    const valid =
      raw.length <= MAX_STORAGE_LENGTH
        ? validateState(JSON.parse(raw) as unknown)
        : null;
    if (valid) return { state: valid, notice: "" };
    return {
      state: emptyState(),
      notice: "Saved data was incompatible or invalid. A fresh pool is ready.",
    };
  } catch {
    return {
      state: emptyState(),
      notice:
        "Saved data could not be loaded. You can still fish in this session.",
    };
  }
}

export function saveState(state: PickerState, storage?: Store): string {
  try {
    (storage ?? window.localStorage).setItem(
      STORAGE_KEY,
      JSON.stringify(state),
    );
    return "";
  } catch {
    return "Changes are kept in this session only; browser storage is unavailable or full.";
  }
}
