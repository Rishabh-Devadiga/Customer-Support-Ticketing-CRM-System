import { Link } from "react-router-dom";
import type { TicketListItem } from "../types/tickets";
import { formatDate } from "../utils/format";
import StatusBadge from "./StatusBadge";

interface TicketTableProps {
  tickets: TicketListItem[];
  dimmed?: boolean;
}

export default function TicketTable({ tickets, dimmed }: TicketTableProps) {
  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table
        className="min-w-full divide-y divide-slate-200 text-left text-sm"
        aria-busy={dimmed || undefined}
      >
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium text-slate-600">
              Ticket ID
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-slate-600">
              Customer
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-slate-600">
              Subject
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-slate-600">
              Status
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-slate-600">
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
              <tr key={ticket.ticket_id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-[13px] whitespace-nowrap">
                  <Link to={href} className="text-blue-700 hover:underline">
                    {ticket.ticket_id}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900">
                    {ticket.customer_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {ticket.customer_email}
                  </div>
                </td>
                <td className="max-w-xs px-4 py-2">
                  <Link
                    to={href}
                    className="block truncate text-slate-900 hover:text-blue-700 hover:underline"
                  >
                    {ticket.subject}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-slate-600">
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
      className="overflow-hidden rounded border border-slate-200 bg-white"
    >
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="h-12 animate-pulse border-b border-slate-100 bg-slate-100 last:border-0"
        />
      ))}
      <span className="sr-only">Loading tickets…</span>
    </div>
  );
}
