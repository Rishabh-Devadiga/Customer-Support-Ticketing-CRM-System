import { TICKET_PRIORITIES, type TicketPriority } from "../types/tickets";

export type PriorityFilterValue = TicketPriority | "All";

interface PriorityFilterProps {
  value: PriorityFilterValue;
  onChange: (value: PriorityFilterValue) => void;
}

export default function PriorityFilter({
  value,
  onChange,
}: PriorityFilterProps) {
  return (
    <div>
      <label
        htmlFor="priority-filter"
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        Priority
      </label>
      <select
        id="priority-filter"
        value={value}
        onChange={(event) => onChange(event.target.value as PriorityFilterValue)}
        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      >
        <option value="All">All</option>
        {TICKET_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </select>
    </div>
  );
}
