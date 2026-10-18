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
        <span>
          <span className="eyebrow">Previous catches</span>
          <strong>Catch Log</strong>
        </span>
        <span className="count-badge">{draws.length}</span>
      </summary>
      <div className="panel-content">
        <p className="help">The latest 100 catches, saved on this browser.</p>
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
            No catches yet. Your next cast starts the story.
          </p>
        )}
        <button
          type="button"
          className="text-button"
          onClick={onClear}
          disabled={!draws.length}
        >
          Clear history
        </button>
      </div>
    </details>
  );
}
