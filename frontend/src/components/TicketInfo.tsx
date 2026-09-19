import type { ReactNode } from "react";
import type { Ticket } from "../types/tickets";
import StatusBadge from "./StatusBadge";
import { formatDate } from "../utils/format";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default function TicketInfo({ ticket }: { ticket: Ticket }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-xl font-semibold text-slate-900">
          {ticket.ticket_id}
        </h1>
        <StatusBadge status={ticket.status} />
      </div>
      <dl className="mt-4 flex flex-col gap-3">
        <Row label="Customer">{ticket.customer_name}</Row>
        <Row label="Email">
          <a
            href={`mailto:${ticket.customer_email}`}
            className="text-blue-700 hover:underline"
          >
            {ticket.customer_email}
          </a>
        </Row>
        <Row label="Subject">{ticket.subject}</Row>
        <Row label="Description">
          <span className="block whitespace-pre-wrap">{ticket.description}</span>
        </Row>
        <Row label="Created">{formatDate(ticket.created_at)}</Row>
        <Row label="Last updated">{formatDate(ticket.updated_at)}</Row>
      </dl>
    </div>
  );
}
