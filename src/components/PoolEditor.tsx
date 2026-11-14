import { useState } from "react";
import type { Entry } from "../types/picker";
import { MAX_ENTRIES, MAX_NAME_LENGTH, MAX_PASTE_LENGTH } from "../lib/picker";

import { NumberRangeForm } from "./NumberRangeForm";

interface Props {
  entries: Entry[];
  eligibleCount: number;
  onAdd: (text: string) => boolean;
  onAddRange: (text: string) => { added: number } | { error: string };
  onEdit: (id: string, name: string) => boolean;
  onRemove: (id: string) => void;
  onRestore: () => void;
}

function EntryRow({
  entry,
  index,
  onEdit,
  onRemove,
}: {
  entry: Entry;
  index: number;
  onEdit: Props["onEdit"];
  onRemove: Props["onRemove"];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.name);
  return (
    <li className="entry-row">
      {editing ? (
        <form
          className="entry-edit"
          onSubmit={(event) => {
            event.preventDefault();
            if (onEdit(entry.id, value)) setEditing(false);
          }}
        >
          <label className="sr-only" htmlFor={`entry-${entry.id}`}>
            Edit participant {index + 1}
          </label>
          <input
            id={`entry-${entry.id}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={MAX_NAME_LENGTH * 2}
            autoFocus
          />
          <div className="row-actions">
            <button type="submit" className="text-button">
              Save
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setValue(entry.name);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <span className="entry-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="entry-name">
            {entry.name}
            <small>{entry.removed ? "Caught" : "Eligible"}</small>
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label={`Edit participant ${index + 1}: ${entry.name}`}
            title="Edit name"
            onClick={() => setEditing(true)}
          >
            ✎
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Remove participant ${index + 1}: ${entry.name}`}
            title="Remove name"
            onClick={() => onRemove(entry.id)}
          >
            ×
          </button>
        </>
      )}
    </li>
  );
}

export function PoolEditor({
  entries,
  eligibleCount,
  onAdd,
  onAddRange,
  onEdit,
  onRemove,
  onRestore,
}: Props) {
  const [text, setText] = useState("");
  return (
    <details className="panel pool-panel">
      <summary>
        <span>
          <span className="eyebrow">Your participants</span>
          <strong>Fishing Pool</strong>
        </span>
        <span className="count-badge">
          {eligibleCount}
          <span className="sr-only"> eligible names</span>
        </span>
      </summary>
      <div className="panel-content">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (onAdd(text)) setText("");
          }}
        >
          <label htmlFor="names">Add names, one per line</label>
          <textarea
            id="names"
            rows={5}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"Alex\nSam\nAlex"}
            maxLength={MAX_PASTE_LENGTH}
            aria-describedby="pool-help"
          />
          <p id="pool-help" className="help">
            Up to {MAX_ENTRIES.toLocaleString()} names · {MAX_NAME_LENGTH}{" "}
            characters each. Blank lines are ignored; duplicates count
            separately.
          </p>
          <button
            className="secondary-button full-width"
            type="submit"
            disabled={!text.trim()}
          >
            Add to Pool
          </button>
        </form>
        <NumberRangeForm onAdd={onAddRange} />
        <div className="pool-count">
          <span>
            {eligibleCount} eligible / {entries.length} total
          </span>
          <button
            className="text-button"
            type="button"
            disabled={!entries.some((entry) => entry.removed)}
            onClick={onRestore}
          >
            Restore pool
          </button>
        </div>
        <p className="help">Restore makes every caught name eligible again.</p>
        {entries.length ? (
          <ol className="entry-list" aria-label="Participants">
            {entries.map((entry, index) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                index={index}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}
          </ol>
        ) : (
          <p className="empty-copy">
            An empty pool, full of possibilities. Add a few names to begin.
          </p>
        )}
      </div>
    </details>
  );
}
