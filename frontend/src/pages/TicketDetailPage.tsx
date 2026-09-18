import { Link, useParams } from "react-router-dom";

export default function TicketDetailPage() {
  const { ticketId } = useParams();

  return (
    <section>
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        &larr; Back to all tickets
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{ticketId}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Ticket details, notes, and updates arrive in Phase 4.
      </p>
    </section>
  );
}
