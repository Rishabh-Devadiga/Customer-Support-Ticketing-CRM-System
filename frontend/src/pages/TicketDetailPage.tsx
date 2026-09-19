import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  getTicket,
  isAbortError,
  updateTicket,
} from "../api/client";
import { withTransientRetry } from "../api/retry";
import type { Ticket, TicketPriority, TicketStatus } from "../types/tickets";
import ErrorBanner from "../components/ErrorBanner";
import NoteComposer from "../components/NoteComposer";
import NoteTimeline from "../components/NoteTimeline";
import PriorityUpdater from "../components/PriorityUpdater";
import StatusUpdater from "../components/StatusUpdater";
import TicketInfo from "../components/TicketInfo";

function TicketDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading ticket"
      className="flex flex-col gap-4"
    >
      <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="mt-4 flex flex-col gap-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-4 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
      </div>
      <span className="sr-only">Loading ticket…</span>
    </div>
  );
}

export default function TicketDetailPage() {
  const { ticketId } = useParams();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(
    null,
  );
  const [refreshCount, setRefreshCount] = useState(0);

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [noteAdding, setNoteAdding] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  // Ref guards: rapid double-clicks must not send duplicate PUTs (state lags).
  const statusUpdatingRef = useRef(false);
  const priorityUpdatingRef = useRef(false);
  const noteAddingRef = useRef(false);

  useEffect(() => {
    if (!ticketId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    // Same transient retry as the dashboard: status-0 failures back off and
    // retry; 404/422/500 surface immediately. Aborts stay silent (DEC-019).
    withTransientRetry(
      (signal) => getTicket(ticketId, signal),
      controller.signal,
    )
      .then((t) => {
        if (controller.signal.aborted) return;
        setTicket(t);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setError({
          status: err instanceof ApiError ? err.status : 0,
          message:
            err instanceof ApiError ? err.message : "Something went wrong.",
        });
        setLoading(false);
      });
    return () => controller.abort();
  }, [ticketId, refreshCount]);

  const refetch = () => setRefreshCount((c) => c + 1);

  const messageFor = (err: unknown) =>
    err instanceof ApiError ? err.message : "Something went wrong.";

  const handleStatusUpdate = async (status: TicketStatus): Promise<boolean> => {
    if (!ticketId || statusUpdatingRef.current) return false;
    statusUpdatingRef.current = true;
    setStatusUpdating(true);
    setStatusError(null);
    try {
      await updateTicket(ticketId, { status });
      refetch(); // UI refreshes from the server response, never faked (FLOW §4F).
      return true;
    } catch (err: unknown) {
      setStatusError(messageFor(err)); // selection preserved (untouched).
      return false;
    } finally {
      statusUpdatingRef.current = false;
      setStatusUpdating(false);
    }
  };

  const handlePriorityUpdate = async (
    priority: TicketPriority,
  ): Promise<boolean> => {
    if (!ticketId || priorityUpdatingRef.current) return false;
    priorityUpdatingRef.current = true;
    setPriorityUpdating(true);
    setPriorityError(null);
    try {
      await updateTicket(ticketId, { priority });
      refetch(); // UI refreshes from the server response, never faked (FLOW §4F).
      return true;
    } catch (err: unknown) {
      setPriorityError(messageFor(err)); // selection preserved (untouched).
      return false;
    } finally {
      priorityUpdatingRef.current = false;
      setPriorityUpdating(false);
    }
  };

  const handleAddNote = async (note: string): Promise<boolean> => {    if (!ticketId || noteAddingRef.current) return false;
    noteAddingRef.current = true;
    setNoteAdding(true);
    setNoteError(null);
    try {
      await updateTicket(ticketId, { note });
      refetch();
      return true;
    } catch (err: unknown) {
      setNoteError(messageFor(err)); // composer keeps the text.
      return false;
    } finally {
      noteAddingRef.current = false;
      setNoteAdding(false);
    }
  };

  return (
    <section aria-labelledby="ticket-detail-heading" className="mx-auto max-w-4xl">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
      >
        &larr; Back to all tickets
      </Link>

      <div className="mt-4" aria-live="polite">
        {loading && ticket === null ? (
          <TicketDetailSkeleton />
        ) : error !== null ? (
          error.status === 404 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
              <h1
                id="ticket-detail-heading"
                className="text-xl font-bold tracking-tight text-slate-900"
              >
                Ticket not found
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {ticketId} does not exist or was removed.
              </p>
              <Link
                to="/"
                className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                Back to tickets
              </Link>
            </div>
          ) : (
            <ErrorBanner
              message={error.message}
              onRetry={() => setRefreshCount((c) => c + 1)}
            />
          )
        ) : ticket !== null ? (
          <div className="flex flex-col gap-4 sm:gap-5">
            <span id="ticket-detail-heading" className="sr-only">
              Ticket {ticket.ticket_id}
            </span>
            <TicketInfo ticket={ticket} />
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <StatusUpdater
                current={ticket.status}
                updating={statusUpdating}
                error={statusError}
                onUpdate={handleStatusUpdate}
              />
              <PriorityUpdater
                current={ticket.priority}
                updating={priorityUpdating}
                error={priorityError}
                onUpdate={handlePriorityUpdate}
              />
            </div>
            <div>
              <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">
                Notes ({ticket.notes.length})
              </h2>
              <div className="flex flex-col gap-4">
                <NoteTimeline notes={ticket.notes} />
                <NoteComposer
                  adding={noteAdding}
                  error={noteError}
                  onAdd={handleAddNote}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
