import { useEffect, useState } from "react";
import { TICKET_STATUSES, type TicketStatus } from "../types/tickets";

interface StatusUpdaterProps {
  current: TicketStatus;
  updating: boolean;
  error: string | null;
  /** Sends the status; resolves true on success. */
  onUpdate: (status: TicketStatus) => Promise<boolean>;
}

export default function StatusUpdater({
  current,
  updating,
  error,
  onUpdate,
}: StatusUpdaterProps) {
  const [selected, setSelected] = useState<TicketStatus>(current);

  // Follow the server state after each refetch; never overwrite a failed choice
  // with anything but a fresh server value (failure keeps `current` unchanged).
  useEffect(() => {
    setSelected(current);
  }, [current]);

  const unchanged = selected === current;

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <label
        htmlFor="status-select"
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        Status
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="status-select"
          value={selected}
          onChange={(event) =>
            setSelected(event.target.value as TicketStatus)
          }
          disabled={updating}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
        >
          {TICKET_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
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
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {updating ? "Updating…" : "Update Status"}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {unchanged && !error && (
        <p className="mt-1 text-xs text-slate-500">
          Select a different status to enable the update.
        </p>
      )}
    </div>
  );
}
