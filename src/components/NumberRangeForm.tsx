import { useState } from "react";

export function NumberRangeForm({ onAdd }: { onAdd: (text: string) => { added: number } | { error: string } }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  return (
    <form className="number-range-form" onSubmit={(event) => {
      event.preventDefault();
      const result = onAdd(text);
      if ("error" in result) {
        setError(result.error);
        setStatus("");
        return;
      }
      setText("");
      setError("");
      setStatus(`Added ${result.added.toLocaleString()} ${result.added === 1 ? "ticket" : "tickets"}.`);
    }}>
      <label htmlFor="number-range">Add number range</label>
      <input
        id="number-range"
        type="text"
        value={text}
        placeholder="200-300"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "range-help range-error" : "range-help"}
        onChange={(event) => {
          setText(event.target.value);
          setError("");
          setStatus("");
        }}
      />
      <p id="range-help" className="help">Both endpoints are included. Leading zeros are kept.</p>
      {error && <p id="range-error" className="help field-error" role="alert">{error}</p>}
      <button className="secondary-button full-width" type="submit" disabled={!text.trim()}>
        Add range
      </button>
      <p className="help range-status" role="status">{status}</p>
    </form>
  );
}
