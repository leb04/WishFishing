import { useLayoutEffect, useRef, useState } from "react";
import type { Entry } from "../types/picker";
import { MAX_ENTRIES, MAX_NAME_LENGTH, MAX_PASTE_LENGTH } from "../lib/picker";
import { NumberRangeForm } from "./NumberRangeForm";

interface Props {
  entries: Entry[];
  eligibleCount: number;
  onAdd: (text: string, onError: (message: string) => void) => boolean;
  onAddRange: (text: string) => { added: number } | { error: string };
  onEdit: (id: string, name: string, onError: (message: string) => void) => boolean;
  onRemove: (id: string) => void;
  onRemoveAll: () => boolean;
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
  const [error, setError] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const errorId = `entry-error-${entry.id}`;

  useLayoutEffect(() => {
    if (editing || !restoreFocus.current) return;
    restoreFocus.current = false;
    editButton.current?.focus();
  }, [editing]);

  function finishEditing() {
    restoreFocus.current = true;
    setError("");
    setEditing(false);
  }
  return (
    <li className="entry-row">
      {editing ? (
        <form
          className="entry-edit"
          onSubmit={(event) => {
            event.preventDefault();
            if (onEdit(entry.id, value, setError)) finishEditing();
          }}
        >
          <label className="sr-only" htmlFor={`entry-${entry.id}`}>
            Edit participant {index + 1}
          </label>
          <input
            id={`entry-${entry.id}`}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            maxLength={MAX_NAME_LENGTH * 2}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errorId : undefined}
            autoFocus
          />
          {error && <p id={errorId} className="help field-error" role="alert">{error}</p>}
          <div className="row-actions">
            <button type="submit" className="text-button">
              Save
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setValue(entry.name);
                finishEditing();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <span className="entry-name" data-caught={entry.removed}>
            {entry.name}
            <small>{entry.removed ? "Caught" : "Eligible"}</small>
          </span>
          <button
            ref={editButton}
            type="button"
            className="text-button"
            aria-label={`Edit participant ${index + 1}: ${entry.name}`}
            title="Edit name"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-button"
            aria-label={`Remove participant ${index + 1}: ${entry.name}`}
            title="Remove name"
            onClick={() => onRemove(entry.id)}
          >
            Remove
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
  onRemoveAll,
  onRestore,
}: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(entries.length === 0);
  const [inputMode, setInputMode] = useState<"names" | "range">("names");
  const removeDialog = useRef<HTMLDialogElement>(null);
  const poolSummary = useRef<HTMLElement>(null);

  return (
    <details id="fishing-pool" className="panel pool-panel" open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary ref={poolSummary}>
        <strong>Fishing Pool</strong>
        <span className="count-badge">
          <strong>{eligibleCount.toLocaleString()}</strong> eligible
        </span>
      </summary>
      <div className="panel-content">
        <div className="pool-modes" role="group" aria-label="How to add entries">
          <button type="button" aria-pressed={inputMode === "names"} onClick={() => setInputMode("names")}>Names</button>
          <button type="button" aria-pressed={inputMode === "range"} onClick={() => setInputMode("range")}>Number range</button>
        </div>
        <form data-pool-input hidden={inputMode !== "names"}
          onSubmit={(event) => {
            event.preventDefault();
            if (onAdd(text, setError)) {
              setText("");
              setError("");
            }
          }}
        >
          <label htmlFor="names">Add names, one per line</label>
          <textarea
            id="names"
            rows={5}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError("");
            }}
            placeholder={"Alex\nSam\nJordan"}
            maxLength={MAX_PASTE_LENGTH}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "pool-help pool-error" : "pool-help"}
          />
          <p id="pool-help" className="help">Up to {MAX_NAME_LENGTH} characters per name. Duplicates count separately.</p>
          {error && <p id="pool-error" className="help field-error" role="alert">{error}</p>}
          <button
            className="secondary-button full-width"
            type="submit"
            disabled={!text.trim()}
          >
            Add names
          </button>
        </form>
        <div data-pool-input hidden={inputMode !== "range"}>
          <NumberRangeForm onAdd={onAddRange} />
        </div>
        <div className="pool-count">
          <span>
            {entries.length.toLocaleString()} / {MAX_ENTRIES.toLocaleString()} entries
          </span>
          {eligibleCount < entries.length && <button
            className="text-button"
            type="button"
            onClick={(event) => {
              event.currentTarget.closest("details")?.querySelector("summary")?.focus();
              onRestore();
            }}
          >
            Restore pool
          </button>}
        </div>
        {eligibleCount < entries.length && (
          <p className="help">Restore makes every caught entry eligible again.</p>
        )}
        {entries.length > 0 && <>
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
          <div className="pool-bulk-actions">
            <button className="text-button destructive-button" type="button" onClick={() => removeDialog.current?.showModal()}>
              Remove all names
            </button>
          </div>
        </>}
      </div>
      <dialog className="pool-remove-dialog" ref={removeDialog} aria-labelledby="remove-pool-title" aria-describedby="remove-pool-description">
        <h2 id="remove-pool-title">Remove all names?</h2>
        <p id="remove-pool-description" className="help">This removes all names and ticket numbers from the pool. Your Catch Log is kept.</p>
        <form method="dialog" className="row-actions">
          <button className="secondary-button" type="submit" autoFocus>Cancel</button>
          <button className="primary-button" type="button" onClick={() => {
            if (!onRemoveAll()) return;
            removeDialog.current?.close();
            poolSummary.current?.focus();
          }}>Remove all names</button>
        </form>
      </dialog>
    </details>
  );
}
