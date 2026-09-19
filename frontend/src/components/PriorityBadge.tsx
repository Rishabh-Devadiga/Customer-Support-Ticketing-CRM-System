import type { TicketPriority } from "../types/tickets";

const STYLES: Record<TicketPriority, string> = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-blue-100 text-blue-800",
  High: "bg-amber-100 text-amber-800",
  Urgent: "bg-red-100 text-red-800",
};

export default function PriorityBadge({
  priority,
}: {
  priority: TicketPriority;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STYLES[priority]}`}
    >
      {priority}
    </span>
  );
}
