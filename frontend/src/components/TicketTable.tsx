import { Link } from "react-router-dom";
import type { TicketListItem } from "../types/tickets";
import { formatDate } from "../utils/format";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";

interface TicketTableProps {
  tickets: TicketListItem[];
  dimmed?: boolean;
}

const AVATAR_STYLES = [
  "bg-blue-100 text-blue-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-cyan-100 text-cyan-700",
  "bg-sky-100 text-sky-700",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarStyle(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
}

export default function TicketTable({ tickets, dimmed }: TicketTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table
        className="min-w-full divide-y divide-slate-200 text-left text-sm"
        aria-busy={dimmed || undefined}
      >
        <thead className="bg-slate-50/80">
          <tr>
            <th
              scope="col"
              className="px-5 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase"
            >
              Ticket ID
            </th>
            <th
              scope="col"
              className="px-5 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase"
            >
              Customer
            </th>
            <th
              scope="col"
              className="px-5 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase"
            >
              Subject
            </th>
            <th
              scope="col"
              className="px-5 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-5 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase"
            >
              Priority
            </th>
            <th
              scope="col"
              className="px-5 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase"
            >
              Created
            </th>
          </tr>
        </thead>
        <tbody
          className={`divide-y divide-slate-100 ${dimmed ? "opacity-50" : ""}`}
        >
          {tickets.map((ticket) => {
            const href = `/tickets/${encodeURIComponent(ticket.ticket_id)}`;
            return (
              <tr
                key={ticket.ticket_id}
                className="transition-colors hover:bg-blue-50/40"
              >
                <td className="px-5 py-3.5 font-mono text-[13px] whitespace-nowrap">
                  <Link
                    to={href}
                    className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                  >
                    {ticket.ticket_id}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarStyle(ticket.customer_name)}`}
                    >
                      {initials(ticket.customer_name)}
                    </span>
                    <span>
                      <span className="block font-semibold text-slate-900">
                        {ticket.customer_name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {ticket.customer_email}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="max-w-xs px-5 py-3.5">
                  <Link
                    to={href}
                    className="block truncate font-medium text-slate-700 hover:text-blue-700 hover:underline"
                  >
                    {ticket.subject}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="px-5 py-3.5">
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                  {formatDate(ticket.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TicketTableSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading tickets"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-slate-100 p-4 last:border-0"
        >
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-200" />
          <div className="flex-1">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="hidden h-6 w-20 animate-pulse rounded-full bg-slate-100 sm:block" />
        </div>
      ))}
      <span className="sr-only">Loading tickets…</span>
    </div>
  );
}
