import type { Draw } from "../types/picker";

export function History({
  draws,
  onClear,
  open,
  onToggle,
}: {
  draws: Draw[];
  onClear: () => void;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  return (
    <details
      id="history"
      className="panel history-panel"
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary>
        <strong>Catch Log</strong>
        <span className="count-badge"><strong>{draws.length}</strong> {draws.length === 1 ? "catch" : "catches"}</span>
      </summary>
      <div className="panel-content">
        {draws.length ? (
          <ol className="history-list" aria-label="Draw history">
            {draws.map((draw) => (
              <li key={draw.id}>
                <strong>{draw.name}</strong>
                <time dateTime={draw.timestamp}>
                  {new Date(draw.timestamp).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-copy">
            Your first catch will appear here.
          </p>
        )}
        {draws.length > 0 && <button
          type="button"
          className="text-button"
          onClick={onClear}
        >
          Clear history
        </button>}
      </div>
    </details>
  );
}
