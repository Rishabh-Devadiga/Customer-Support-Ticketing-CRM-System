import type { Note } from "../types/tickets";
import { formatDate } from "../utils/format";

export default function NoteTimeline({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
        <p className="font-semibold text-slate-900">No notes yet.</p>
        <p className="mt-1 text-sm text-slate-500">
          Add the first note below to start the history.
        </p>
      </div>
    );
  }
  return (
    <ol className="relative ml-2 flex flex-col gap-4 border-l-2 border-slate-200 pl-6">
      {notes.map((note) => (
        <li key={note.id} className="relative">
          <span
            aria-hidden="true"
            className="absolute top-4 -left-6 ml-[-7px] h-3 w-3 rounded-full bg-teal-500 ring-4 ring-teal-50"
          />
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm whitespace-pre-wrap text-slate-900">
              {note.content}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {formatDate(note.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
