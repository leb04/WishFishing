import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ControlIcon } from "./components/ControlIcon";
import { PoolEditor } from "./components/PoolEditor";
import { History } from "./components/History";
import { PondView } from "./components/PondView";
import { Result } from "./components/Result";
import { usePicker } from "./hooks/usePicker";
import { useFishingCinematic } from "./hooks/useFishingCinematic";
import { useTheme } from "./hooks/useTheme";
import type { ThemePreference } from "./types/picker";

export default function App() {
  const picker = usePicker();
  const [historyOpen, setHistoryOpen] = useState(false);
  const theme = useTheme(picker.state.theme);
  const { lifecycle, phase, busy, soundEnabled, unlockSound, toggleSound } = useFishingCinematic();
  const revealing = phase === "REVEALING";
  const showTension = busy && !revealing;
  const tensionOverlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const overlay = tensionOverlay.current;
    if (!showTension || !overlay) return;
    let previousTension = -1;
    const update = () => {
      const { tension } = lifecycle.pose;
      if (tension === previousTension) return;
      previousTension = tension;
      overlay.style.setProperty("--tension", String(tension));
    };
    update();
    gsap.ticker.add(update);
    return () => gsap.ticker.remove(update);
  }, [lifecycle, showTension]);
  const escaped = phase === "DECOY_ESCAPE";
  const poolEmpty = picker.eligibleCount === 0 && phase === "IDLE";
  const biteLabel = phase === "BITING" ? lifecycle.draw?.name
    : phase === "DECOY_BITE" || escaped ? lifecycle.decoy?.label : undefined;
  const cast = (again = false) => {
    if (lifecycle.start(() => picker.cast(again), again)) unlockSound();
  };
  const close = () => { if (lifecycle.close()) picker.closeResult(); };

  function openPool() {
    const panel = document.getElementById("fishing-pool");
    if (panel instanceof HTMLDetailsElement) {
      panel.open = true;
      const target = picker.state.entries.length ? ".pool-count button" : "[data-pool-input]:not([hidden]) :is(textarea, input)";
      panel.querySelector<HTMLElement>(target)?.focus();
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            WF
          </span>
          <div>
            <h1>WishFishing</h1>
            <p>Cast a Wish. Catch a Winner.</p>
          </div>
        </div>
        <div className="toolbar">
          <label className="theme-control">
            <span>Appearance</span>
            <select
              aria-label="Appearance"
              value={picker.state.theme}
              onChange={(event) =>
                picker.setTheme(event.target.value as ThemePreference)
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <button
            type="button"
            className="secondary-button toolbar-log"
            title="Catch Log"
            aria-label="Catch Log"
            disabled={busy}
            aria-controls="history"
            onClick={() => {
              setHistoryOpen(true);
              document.querySelector<HTMLElement>("#history > summary")?.focus();
            }}
          >
            <ControlIcon name="log" />
            <span>Catch Log</span>
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="pond" aria-labelledby="pond-title" data-fishing-phase={phase}>
          <PondView theme={theme} suspended={phase === "RESULT"}
            lifecycle={lifecycle} phase={phase} soundEnabled={soundEnabled} onToggleSound={toggleSound}>
            {showTension && <div ref={tensionOverlay} className="cinematic-tension" aria-hidden="true" />}
            {biteLabel && (
              <div key={`${phase}-${lifecycle.attempt}`} className="bite-card" data-escaped={escaped}
                data-ticket={/^\d{1,3}$/.test(biteLabel) ? "short" : /^\d{4,6}$/.test(biteLabel) ? "wide" : undefined}
                data-long-label={[...biteLabel].length > 18}
                data-waterline={escaped && ["rod", "surface", "breach"].includes(lifecycle.escapePoint)}
                role="status" aria-atomic="true">
                <strong>{biteLabel}</strong>
                <span>{escaped ? "Got away" : "Takes the bait"}</span>
              </div>
            )}
            {biteLabel && (
              <div key={phase} className="cinematic-impact"
                data-splash={escaped && lifecycle.escapePoint === "breach"} aria-hidden="true" />
            )}
            {busy && !revealing && <div className="cinematic-hud" data-theme="dark">
              <p role="status">{({ CASTING: "Make a little wish…", WAITING_FOR_BITE: "Something’s listening…",
                UNDERWATER: "The hook sinks…", DECOY_BITE: "", DECOY_PULL: "Reeling it in…", DECOY_ESCAPE: "", FINAL_APPROACH: "The line goes still…",
                BITING: "", REELING: "Reeling it in…", SPLASH: "Reeling it in…", REVEALING: "", IDLE: "", RESULT: "" })[phase]}</p>
              <div className="cinematic-controls">
                <button type="button" className="secondary-button" aria-label="Sound effects" aria-pressed={soundEnabled} onClick={toggleSound}>
                  {soundEnabled ? "Sound on" : "Sound off"}
                </button>
                <button autoFocus type="button" className="secondary-button" onClick={lifecycle.skip}>Skip</button>
              </div>
            </div>}
          </PondView>
          <div className="cast-dock" data-empty={poolEmpty} inert={busy}>
            <div className="cast-status" role="status">
              <p className="eligible-count">
                <strong>{picker.eligibleCount.toLocaleString()}</strong>{" "}
                eligible {picker.eligibleCount === 1 ? "entry" : "entries"}
              </p>
              {poolEmpty && <p className="cast-hint">
                {picker.state.entries.length ? "Add or restore entries to cast." : "Add names or ticket numbers to cast."}
              </p>}
              {phase === "IDLE" && picker.error && <p className="cast-error" role="alert">{picker.error}</p>}
            </div>
            <div className="cast-actions">
              {poolEmpty && (
                <button type="button" className="primary-button pool-cta" onClick={openPool}>
                  {picker.state.entries.length ? "Manage pool" : "Add entries"}
                </button>
              )}
              <button
                id="cast-line"
                className="primary-button cast-button"
                type="button"
                disabled={!picker.eligibleCount || !!picker.result}
                onClick={() => cast()}
              >
                <ControlIcon name="cast" />
                Cast the Line
              </button>
            </div>
          </div>
          {picker.result && (revealing || phase === "RESULT") && (
            <Result
              draw={picker.result}
              revealPose={revealing ? lifecycle.pose : undefined}
              error={picker.error}
              eligibleCount={picker.eligibleCount}
              onAgain={() => cast(true)}
              onClose={close}
              onSkip={lifecycle.skip}
            />
          )}
        </section>

        <aside className="side-dock" aria-label="Fishing controls" inert={busy}>
          <PoolEditor
            entries={picker.state.entries}
            eligibleCount={picker.eligibleCount}
            onAdd={picker.add}
            onAddRange={picker.addRange}
            onEdit={picker.edit}
            onRemove={picker.remove}
            onRestore={picker.restore}
          />
          <section
            className="panel setting-panel"
            aria-labelledby="settings-title"
          >
            <h2 id="settings-title">
              Cast settings
            </h2>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={picker.state.removeCaught}
                onChange={(event) =>
                  picker.setRemoveCaught(event.target.checked)
                }
              />
              <span>Remove Caught Names</span>
            </label>
            <p className="help">
              Keep each winner in the list and exclude that entry from future casts.
            </p>
          </section>
          <History
            draws={picker.state.history}
            onClear={picker.clearHistory}
            open={historyOpen}
            onToggle={setHistoryOpen}
          />
        </aside>
      </main>

      <div className="feedback" aria-live="polite">
        {picker.notice && <p role="status">{picker.notice}</p>}
      </div>
      <footer className="app-footer">
        Names and catches stay in this browser.
      </footer>
    </div>
  );
}
