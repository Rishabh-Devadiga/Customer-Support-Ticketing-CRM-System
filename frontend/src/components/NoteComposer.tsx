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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <label
        htmlFor="note-text"
        className="mb-1.5 block text-sm font-semibold text-slate-700"
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
          "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:ring-2 focus:outline-none " +
          (error
            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
            : "border-slate-300 focus:border-blue-500 focus:ring-blue-100")
        }
      />
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleAdd}
          disabled={isBlank || adding}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {adding ? "Adding…" : "Add Note"}
        </button>
      </div>
    </div>
  );
}
