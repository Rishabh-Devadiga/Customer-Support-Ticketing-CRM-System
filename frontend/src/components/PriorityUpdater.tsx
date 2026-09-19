import { useEffect, useState } from "react";
import { TICKET_PRIORITIES, type TicketPriority } from "../types/tickets";

interface PriorityUpdaterProps {
  current: TicketPriority;
  updating: boolean;
  error: string | null;
  /** Sends the priority; resolves true on success. */
  onUpdate: (priority: TicketPriority) => Promise<boolean>;
}

export default function PriorityUpdater({
  current,
  updating,
  error,
  onUpdate,
}: PriorityUpdaterProps) {
  const [selected, setSelected] = useState<TicketPriority>(current);

  // Follow the server state after each refetch; a failed choice is kept
  // because `current` only changes on fresh server values.
  useEffect(() => {
    setSelected(current);
  }, [current]);

  const unchanged = selected === current;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <label
        htmlFor="priority-select"
        className="mb-1.5 block text-sm font-semibold text-slate-700"
      >
        Priority
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          id="priority-select"
          value={selected}
          onChange={(event) =>
            setSelected(event.target.value as TicketPriority)
          }
          disabled={updating}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:bg-slate-100"
        >
          {TICKET_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (unchanged || updating) return;
            void onUpdate(selected);
          }}
          disabled={unchanged || updating}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {updating ? "Updating…" : "Update Priority"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      {unchanged && !error && (
        <p className="mt-1.5 text-xs text-slate-500">
          Select a different priority to enable the update.
        </p>
      )}
    </div>
  );
}
