import type { TicketStatus } from "../types/tickets";

const STYLES: Record<TicketStatus, { pill: string; dot: string }> = {
  Open: { pill: "bg-blue-50 text-blue-700 ring-blue-600/20", dot: "bg-blue-500" },
  "In Progress": {
    pill: "bg-amber-50 text-amber-700 ring-amber-600/25",
    dot: "bg-amber-500",
  },
  Closed: {
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
};

export default function StatusBadge({ status }: { status: TicketStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${style.pill}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}
