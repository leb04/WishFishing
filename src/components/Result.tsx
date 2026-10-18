import { useEffect, useRef } from "react";
import type { Draw } from "../types/picker";

export function Result({
  draw,
  error,
  eligibleCount,
  onAgain,
  onClose,
}: {
  draw: Draw;
  error: string;
  eligibleCount: number;
  onAgain: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      const castButton = document.getElementById("cast-line");
      const target =
        castButton instanceof HTMLButtonElement && !castButton.disabled
          ? castButton
          : document.querySelector<HTMLElement>(".pool-panel > summary");
      if (target instanceof HTMLElement) target.focus();
    };
  }, []);
  return (
    <dialog
      className="result-dialog"
      ref={dialog}
      aria-labelledby="winner-name"
      aria-describedby="result-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="result-content">
        <span className="catch-mark" aria-hidden="true">
          ↝
        </span>
        <p className="eyebrow">You caught a winner!</p>
        <h2 id="winner-name" key={draw.id} aria-live="polite">
          {draw.name}
        </h2>
        <p id="result-description">A truly legendary specimen.</p>
        <p className="help">
          Catch recorded · {eligibleCount} eligible{" "}
          {eligibleCount === 1 ? "name" : "names"} in the pool
        </p>
        <div className="result-actions">
          <button
            type="button"
            className="primary-button"
            disabled={!eligibleCount}
            onClick={(event) => {
              if (event.detail < 2) onAgain();
            }}
          >
            Fish Again
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            Back to Pond
          </button>
        </div>
        {!eligibleCount && (
          <p className="help">
            Pool exhausted. Return to the pond to add names or restore the pool.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </dialog>
  );
}
