import { ApiError, isAbortError } from "./client";

/**
 * Shared transient-retry for initial page loads (Dashboard + Detail).
 *
 * Runs `task`, automatically retrying transient network failures —
 * `ApiError` with `status === 0`, i.e. no response reached us (cold backend,
 * brief hiccup) — up to `maxRetries` times with 400ms → 800ms backoff.
 * Real API responses (404/422/500/…) are never retried and propagate
 * immediately. Aborting `signal` cancels pending backoff; the abort surfaces
 * as an AbortError for the caller to swallow silently (DEC-019).
 */
const RETRY_BACKOFF_MS = [400, 800];

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withTransientRetry<T>(
  task: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  maxRetries = 2,
): Promise<T> {
  const delays = RETRY_BACKOFF_MS.slice(0, Math.max(0, maxRetries));
  for (let attempt = 0; ; attempt++) {
    try {
      return await task(signal);
    } catch (err: unknown) {
      if (isAbortError(err) || signal.aborted) throw err;
      const transient = err instanceof ApiError && err.status === 0;
      if (!transient || attempt >= delays.length) throw err;
      await sleep(delays[attempt], signal);
    }
  }
}
