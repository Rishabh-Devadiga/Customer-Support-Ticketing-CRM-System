import type { TicketPriority } from "../types/tickets";

const STYLES: Record<TicketPriority, { pill: string; dot: string }> = {
  Low: { pill: "bg-slate-100 text-slate-600 ring-slate-500/20", dot: "bg-slate-400" },
  Medium: { pill: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
  High: {
    pill: "bg-orange-50 text-orange-700 ring-orange-600/25",
    dot: "bg-orange-500",
  },
  Urgent: { pill: "bg-rose-50 text-rose-700 ring-rose-600/25", dot: "bg-rose-500" },
};

export default function PriorityBadge({
  priority,
}: {
  priority: TicketPriority;
}) {
  const style = STYLES[priority];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${style.pill}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {priority}
    </span>
  );
}
