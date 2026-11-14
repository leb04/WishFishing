import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import type { FishingPose } from "../lib/cinematic";
import type { Draw } from "../types/picker";

export function Result({
  draw,
  revealPose,
  error,
  eligibleCount,
  onAgain,
  onClose,
  onSkip,
}: {
  draw: Draw;
  revealPose?: FishingPose;
  error: string;
  eligibleCount: number;
  onAgain: () => void;
  onClose: () => void;
  onSkip: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const winner = useRef<HTMLHeadingElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const revealing = revealPose !== undefined;
  const ticket = /^\d{1,3}$/.test(draw.name) ? "short"
    : /^\d{4,6}$/.test(draw.name) ? "wide"
    : /^\d{7,16}$/.test(draw.name) ? "long" : undefined;

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      queueMicrotask(() => {
        if (element?.isConnected || !document.querySelector('.pond[data-fishing-phase="IDLE"]')) return;
        const castButton = document.querySelector<HTMLButtonElement>("#cast-line:enabled");
        const poolTarget = document.fullscreenElement
          ? document.querySelector<HTMLElement>(".pool-cta")
          : document.querySelector<HTMLElement>(".pool-panel > summary");
        (castButton ?? poolTarget)?.focus();
      });
    };
  }, []);

  useLayoutEffect(() => {
    if (!revealPose) {
      winner.current?.focus({ preventScroll: true });
      return;
    }
    skip.current?.focus({ preventScroll: true });
    const element = dialog.current;
    const update = () => {
      element?.style.setProperty("--trophy-progress", String(revealPose.reveal));
    };
    update();
    gsap.ticker.add(update);
    return () => {
      gsap.ticker.remove(update);
      element?.style.removeProperty("--trophy-progress");
    };
  }, [revealPose]);

  return (
    <dialog
      className="result-dialog"
      ref={dialog}
      data-revealing={revealing || undefined}
      aria-label={revealing ? "Revealing the catch" : undefined}
      aria-labelledby={revealing ? undefined : "winner-name"}
      aria-describedby={revealing ? undefined : "result-description"}
      onCancel={(event) => {
        event.preventDefault();
        if (revealing) onSkip();
        else onClose();
      }}
    >
      <div className="result-content">
        {revealing && <div className="victory-rays" aria-hidden="true" />}
        <svg className="catch-mark" aria-hidden="true" viewBox="0 0 96 64" fill="none">
          <ellipse cx="48" cy="55" rx="32" ry="7" stroke="currentColor" opacity=".38" />
          <path d="M18 26C29 9 49 7 68 22L83 12L80 27L83 42L68 32C49 47 29 43 18 26Z" fill="currentColor" />
          <path d="M39 12L49 4L58 15M41 40L50 49L60 37" fill="currentColor" opacity=".7" />
          <circle cx="34" cy="24" r="2.4" fill="var(--card)" />
          <path d="M27 30C34 34 44 34 51 29M41 54H55" stroke="var(--card)" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
          <path d="M32 56H64M38 52H58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="result-label" aria-hidden={revealing || undefined}>
          <p className="result-caption">You caught a winner!</p>
          <h2
            id="winner-name"
            key={draw.id}
            ref={winner}
            tabIndex={-1}
            data-ticket={ticket}
            className={[...draw.name].length > 40 ? "long-winner-name" : undefined}
          >
            {draw.name}
          </h2>
          <p id="result-description">A truly legendary specimen.</p>
          <p className="help">
            Catch recorded · {eligibleCount} eligible{" "}
            {eligibleCount === 1 ? "entry" : "entries"} in the pool
          </p>
        </div>
        <div className="result-actions">
          {revealing ? (
            <button className="secondary-button" ref={skip} type="button" onClick={onSkip}>Skip</button>
          ) : (
            <>
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
            </>
          )}
        </div>
        {!revealing && !eligibleCount && (
          <p className="help">
            Pool exhausted. Return to the pond to add entries or restore the pool.
          </p>
        )}
        {!revealing && error && <p role="alert">{error}</p>}
      </div>
    </dialog>
  );
}
