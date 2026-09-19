import type { Note } from "../types/tickets";
import { formatDate } from "../utils/format";

export default function NoteTimeline({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-white p-6 text-center">
        <p className="font-medium text-slate-900">No notes yet.</p>
        <p className="mt-1 text-sm text-slate-500">
          Add the first note below to start the history.
        </p>
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {notes.map((note) => (
        <li
          key={note.id}
          className="rounded border border-slate-200 bg-white p-4"
        >
          <p className="text-sm whitespace-pre-wrap text-slate-900">
            {note.content}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {formatDate(note.created_at)}
          </p>
        </li>
      ))}
    </ol>
  );
}
