import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError, isAbortError, listTickets } from "../api/client";
import { withTransientRetry } from "../api/retry";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import type { TicketListItem, TicketStatus } from "../types/tickets";
import { isTicketPriority, isTicketStatus } from "../types/tickets";
import type { TicketPriority } from "../types/tickets";
import ErrorBanner from "../components/ErrorBanner";
import PriorityFilter, {
  type PriorityFilterValue,
} from "../components/PriorityFilter";
import SearchBar from "../components/SearchBar";
import StatusFilter, {
  type StatusFilterValue,
} from "../components/StatusFilter";
import TicketTable, { TicketTableSkeleton } from "../components/TicketTable";

export default function DashboardPage() {
  // Filter state lives in the URL so refresh/back/forward preserve it (DEC-019).
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const statusParam = searchParams.get("status") ?? "";
  const activeStatus: TicketStatus | null = isTicketStatus(statusParam)
    ? statusParam
    : null;
  const priorityParam = searchParams.get("priority") ?? "";
  const activePriority: TicketPriority | null = isTicketPriority(priorityParam)
    ? priorityParam
    : null;

  // Search box echoes keystrokes instantly; the debounced value commits to the URL.
  const [input, setInput] = useState(urlSearch);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedInput = useDebouncedValue(input);

  // Back/forward changes the URL elsewhere: mirror it unless the user is typing.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setInput(urlSearch);
  }, [urlSearch]);

  // Commit the debounced input to the URL; empty input removes the parameter.
  useEffect(() => {
    const next = debouncedInput.trim();
    if (next === urlSearch) return;
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next) params.set("search", next);
      else params.delete("search");
      return params;
    });
  }, [debouncedInput, urlSearch, setSearchParams]);

  const [tickets, setTickets] = useState<TicketListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    // Transient network failures retry automatically with backoff; real API
    // responses surface immediately. Aborts stay silent (DEC-019).
    withTransientRetry(
      (signal) =>
        listTickets(
          {
            search: urlSearch === "" ? undefined : urlSearch,
            status: activeStatus ?? undefined,
            priority: activePriority ?? undefined,
          },
          signal,
        ),
      controller.signal,
    )
      .then((rows) => {
        if (controller.signal.aborted) return;
        setTickets(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setError(
          err instanceof ApiError ? err.message : "Something went wrong.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [urlSearch, activeStatus, activePriority, retryCount]);

  const handleStatusChange = (value: StatusFilterValue) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (value === "All") params.delete("status");
      else params.set("status", value);
      return params;
    });
  };

  const handlePriorityChange = (value: PriorityFilterValue) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (value === "All") params.delete("priority");
      else params.set("priority", value);
      return params;
    });
  };

  // Clear via state, not by wiping the URL directly: the debounced input still
  // holds the old query for ~300ms and would re-commit it, resurrecting the
  // search. Letting the debounce commit the empty input converges cleanly.
  const clearFilters = () => {
    setInput("");
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("status");
      params.delete("priority");
      return params;
    });
  };

  const isFiltered =
    urlSearch !== "" || activeStatus !== null || activePriority !== null;
  const count = tickets === null ? 0 : tickets.length;

  return (
    <section aria-labelledby="tickets-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            id="tickets-heading"
            className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]"
          >
            All tickets
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track, search, and manage customer support tickets.
          </p>
        </div>
        {tickets !== null && tickets.length > 0 && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-600/20 ring-inset">
            {count} {count === 1 ? "ticket" : "tickets"}
          </span>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <SearchBar ref={inputRef} value={input} onChange={setInput} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <StatusFilter
              value={activeStatus ?? "All"}
              onChange={handleStatusChange}
            />
            <PriorityFilter
              value={activePriority ?? "All"}
              onChange={handlePriorityChange}
            />
          </div>
        </div>
      </div>

      <div className="mt-4" aria-live="polite">
        {loading && tickets === null ? (
          <TicketTableSkeleton />
        ) : error !== null ? (
          <ErrorBanner
            message={error}
            onRetry={() => setRetryCount((c) => c + 1)}
          />
        ) : tickets !== null && tickets.length === 0 ? (
          isFiltered ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
              <div
                aria-hidden="true"
                className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-5 w-5 text-slate-400"
                >
                  <path
                    d="M9 3.5a5.5 5.5 0 1 0 3.24 9.97l3.14 3.14a.75.75 0 0 0 1.06-1.06l-3.14-3.14A5.5 5.5 0 0 0 9 3.5Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              </div>
              <p className="mt-3 font-semibold text-slate-900">
                No tickets match your search.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try a different search term or status.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
              >
                Clear search &amp; filters
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
              <div
                aria-hidden="true"
                className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-50"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-5 w-5 text-blue-500"
                >
                  <path
                    d="M10 4v8m0 0 3-3m-3 3-3-3M4 16.5h12"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="mt-3 font-semibold text-slate-900">No tickets yet.</p>
              <p className="mt-1 text-sm text-slate-500">
                Create the first support ticket to get started.
              </p>
              <Link
                to="/tickets/new"
                className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                Create ticket
              </Link>
            </div>
          )
        ) : (
          <TicketTable tickets={tickets ?? []} dimmed={loading} />
        )}
      </div>
    </section>
  );
}
