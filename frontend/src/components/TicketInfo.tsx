import type { ReactNode } from "react";
import type { Ticket } from "../types/tickets";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";
import { formatDate } from "../utils/format";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default function TicketInfo({ ticket }: { ticket: Ticket }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Ticket
          </p>
          <h1 className="mt-0.5 font-mono text-xl font-bold tracking-tight text-slate-900">
            {ticket.ticket_id}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>
      <dl className="mt-2 divide-y divide-slate-100">
        <Row label="Customer">
          <span className="font-semibold">{ticket.customer_name}</span>
        </Row>
        <Row label="Email">
          <a
            href={`mailto:${ticket.customer_email}`}
            className="font-medium text-blue-700 hover:text-blue-800 hover:underline"
          >
            {ticket.customer_email}
          </a>
        </Row>
        <Row label="Subject">
          <span className="font-semibold">{ticket.subject}</span>
        </Row>
        <Row label="Description">
          <span className="block rounded-lg bg-slate-50 px-3.5 py-3 whitespace-pre-wrap">
            {ticket.description}
          </span>
        </Row>
        <Row label="Created">{formatDate(ticket.created_at)}</Row>
        <Row label="Last updated">{formatDate(ticket.updated_at)}</Row>
      </dl>
    </div>
  );
}
