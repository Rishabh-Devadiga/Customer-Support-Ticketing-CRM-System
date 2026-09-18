import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError, isAbortError, listTickets } from "../api/client";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import type { TicketListItem, TicketStatus } from "../types/tickets";
import { isTicketStatus } from "../types/tickets";
import ErrorBanner from "../components/ErrorBanner";
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
    listTickets(
      {
        search: urlSearch === "" ? undefined : urlSearch,
        status: activeStatus ?? undefined,
      },
      controller.signal,
    )
      .then((rows) => setTickets(rows))
      .catch((err: unknown) => {
        if (isAbortError(err)) return; // stale request: silent (DEC-019)
        setError(
          err instanceof ApiError ? err.message : "Something went wrong.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [urlSearch, activeStatus, retryCount]);

  const handleStatusChange = (value: StatusFilterValue) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (value === "All") params.delete("status");
      else params.set("status", value);
      return params;
    });
  };

  const clearFilters = () => {
    setInput("");
    setSearchParams({});
  };

  const isFiltered = urlSearch !== "" || activeStatus !== null;
  const count = tickets === null ? 0 : tickets.length;

  return (
    <section aria-labelledby="tickets-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          id="tickets-heading"
          className="text-2xl font-semibold text-slate-900"
        >
          All tickets
        </h1>
        <Link
          to="/tickets/new"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          New ticket
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchBar ref={inputRef} value={input} onChange={setInput} />
        <StatusFilter
          value={activeStatus ?? "All"}
          onChange={handleStatusChange}
        />
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
            <div className="rounded border border-slate-200 bg-white p-8 text-center">
              <p className="font-medium text-slate-900">
                No tickets match your search.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try a different search term or status.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear search &amp; filters
              </button>
            </div>
          ) : (
            <div className="rounded border border-slate-200 bg-white p-8 text-center">
              <p className="font-medium text-slate-900">No tickets yet.</p>
              <p className="mt-1 text-sm text-slate-500">
                Create the first support ticket to get started.
              </p>
              <Link
                to="/tickets/new"
                className="mt-4 inline-block rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create ticket
              </Link>
            </div>
          )
        ) : (
          <>
            <p className="mb-2 text-sm text-slate-500">
              {count} {count === 1 ? "ticket" : "tickets"}
            </p>
            <TicketTable tickets={tickets ?? []} dimmed={loading} />
          </>
        )}
      </div>
    </section>
  );
}
