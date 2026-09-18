import { TICKET_STATUSES, type TicketStatus } from "../types/tickets";

export type StatusFilterValue = TicketStatus | "All";

interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

export default function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div>
      <label
        htmlFor="status-filter"
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        Status
      </label>
      <select
        id="status-filter"
        value={value}
        onChange={(event) => onChange(event.target.value as StatusFilterValue)}
        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      >
        <option value="All">All</option>
        {TICKET_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>
  );
}
