import { useState } from "react";
import { PoolEditor } from "./components/PoolEditor";
import { History } from "./components/History";
import { PondView } from "./components/PondView";
import { Result } from "./components/Result";
import { usePicker } from "./hooks/usePicker";
import { useTheme } from "./hooks/useTheme";
import type { ThemePreference } from "./types/picker";

export default function App() {
  const picker = usePicker();
  const [historyOpen, setHistoryOpen] = useState(false);
  const theme = useTheme(picker.state.theme);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            WF<span>↝</span>
          </span>
          <div>
            <h1>WishFishing</h1>
            <p>Cast a Wish. Catch a Winner.</p>
          </div>
        </div>
        <div className="toolbar">
          <label className="theme-control">
            <span className="sr-only">Appearance</span>
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
            className="secondary-button"
            aria-controls="history"
            aria-expanded={historyOpen}
            onClick={() => {
              setHistoryOpen(!historyOpen);
              document
                .getElementById("history")
                ?.scrollIntoView({ block: "nearest" });
            }}
          >
            Catch Log
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="pond" aria-labelledby="pond-title">
          <div className="pond-heading">
            <span className="location-mark" aria-hidden="true">
              ⌁
            </span>
            <div>
              <h2 id="pond-title">The wishing pond</h2>
              <p>A quiet spot for a little chance.</p>
            </div>
            <span className="scene-label">{theme === "dark" ? "Moonlit pond" : "Daylight pond"}</span>
          </div>
          <PondView theme={theme} suspended={!!picker.result} />
          <div className="cast-dock">
            <p className="eligible-count" role="status">
              <span className="count-dot" aria-hidden="true" />
              {picker.eligibleCount} eligible{" "}
              {picker.eligibleCount === 1 ? "name" : "names"}
            </p>
            <button
              id="cast-line"
              className="primary-button cast-button"
              type="button"
              disabled={!picker.eligibleCount || !!picker.result}
              onClick={() => picker.cast()}
            >
              <span aria-hidden="true">↗</span> Cast the Line
            </button>
            <p className="cast-hint">
              {!picker.state.entries.length
                ? "Open Fishing Pool and add names to cast."
                : !picker.eligibleCount
                  ? "All names caught. Restore the pool or add more names."
                  : "One cast. One randomly chosen name."}
            </p>
          </div>
        </section>

        <aside className="side-dock" aria-label="Fishing controls">
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
            <h2 id="settings-title" className="eyebrow">
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
              Caught entries stay in your list, but leave the eligible pool.
              Duplicate names are separate catches.
            </p>
          </section>
          <History
            draws={picker.state.history}
            onClear={picker.clearHistory}
            open={historyOpen}
            onToggle={setHistoryOpen}
          />
          <p className="privacy-note">
            Just you and the pond.
            <br />
            Names and catches stay in this browser.
          </p>
        </aside>
      </main>

      <div className="feedback" aria-live="polite">
        {picker.notice && <p role="status">{picker.notice}</p>}
        {picker.error && <p role="alert">{picker.error}</p>}
      </div>
      <footer className="app-footer">
        <span>
          WF <span aria-hidden="true">/</span> A little luck goes a long way.
        </span>
        <span>Local to this browser</span>
      </footer>
      {picker.result && (
        <Result
          draw={picker.result}
          error={picker.error}
          eligibleCount={picker.eligibleCount}
          onAgain={() => picker.cast(true)}
          onClose={picker.closeResult}
        />
      )}
    </div>
  );
}
