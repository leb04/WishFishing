import { useRef, useState } from "react";
import {
  addNames,
  addNumberRange,
  completeDraw,
  editEntry,
  eligibleEntries,
  restorePool,
} from "../lib/picker";
import { selectWinner } from "../lib/random";
import { loadState, saveState } from "../lib/storage";
import type { Draw, PickerState, ThemePreference } from "../types/picker";

export function usePicker() {
  const [loaded] = useState(loadState);
  const [state, setState] = useState(loaded.state);
  const [notice, setNotice] = useState(loaded.notice);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Draw | null>(null);
  const stateRef = useRef(state);
  const resultRef = useRef<Draw | null>(null);

  function commit(next: PickerState) {
    stateRef.current = next;
    setState(next);
    setNotice(saveState(next));
  }

  function update(transform: (previous: PickerState) => PickerState, onError: (message: string) => void = setError): boolean {
    try {
      if (resultRef.current) return false;
      commit(transform(stateRef.current));
      setError("");
      return true;
    } catch (cause) {
      onError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Please try again.",
      );
      return false;
    }
  }

  function cast(again = false) {
    if (resultRef.current && !again) return;
    try {
      // Selection happens outside React updaters and before any result presentation.
      const current = stateRef.current;
      const candidates = eligibleEntries(current);
      const winner = selectWinner(candidates);
      if (!winner) {
        setError("No eligible names. Add names or restore the fishing pool.");
        return;
      }
      const next = completeDraw(
        current,
        winner,
        crypto.randomUUID(),
        new Date().toISOString(),
      );
      const draw = next.history[0]!;
      resultRef.current = draw;
      setResult(draw);
      commit(next);
      setError("");
      return { draw, candidates };
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The catch could not be completed. Please try again.",
      );
    }
  }

  return {
    state,
    result,
    error,
    notice,
    eligibleCount: eligibleEntries(state).length,
    add: (text: string, onError: (message: string) => void) =>
      update((previous) => addNames(previous, text, () => crypto.randomUUID()), onError),
    addRange: (text: string): { added: number } | { error: string } => {
      const count = stateRef.current.entries.length;
      let message = "Finish the current catch before adding entries.";
      const added = update(
        (previous) => addNumberRange(previous, text, () => crypto.randomUUID()),
        (error) => { message = error; },
      );
      return added ? { added: stateRef.current.entries.length - count } : { error: message };
    },
    edit: (id: string, name: string, onError: (message: string) => void) =>
      update((previous) => editEntry(previous, id, name), onError),
    remove: (id: string) =>
      update((previous) => ({
        ...previous,
        entries: previous.entries.filter((entry) => entry.id !== id),
      })),
    restore: () => update(restorePool),
    setRemoveCaught: (removeCaught: boolean) =>
      update((previous) => ({ ...previous, removeCaught })),
    setTheme: (theme: ThemePreference) =>
      commit({ ...stateRef.current, theme }),
    clearHistory: () => update((previous) => ({ ...previous, history: [] })),
    cast,
    closeResult: () => {
      resultRef.current = null;
      setResult(null);
      setError("");
    },
  };
}
