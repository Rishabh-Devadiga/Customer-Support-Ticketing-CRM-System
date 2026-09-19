import { useState } from "react";

interface NoteComposerProps {
  adding: boolean;
  error: string | null;
  /** Adds the note; resolves true on success (text clears only then). */
  onAdd: (note: string) => Promise<boolean>;
}

export default function NoteComposer({ adding, error, onAdd }: NoteComposerProps) {
  const [text, setText] = useState("");
  const isBlank = text.trim().length === 0;

  const handleAdd = () => {
    if (isBlank || adding) return;
    void onAdd(text.trim()).then((ok) => {
      if (ok) setText("");
    });
  };

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <label
        htmlFor="note-text"
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        Add a note
      </label>
      <textarea
        id="note-text"
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Write a note about this ticket…"
        aria-invalid={error ? true : undefined}
        className={
          "w-full rounded border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:outline-none " +
          (error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : "border-slate-300 focus:border-blue-500 focus:ring-blue-500")
        }
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleAdd}
        disabled={isBlank || adding}
        className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {adding ? "Adding…" : "Add Note"}
      </button>
    </div>
  );
}
