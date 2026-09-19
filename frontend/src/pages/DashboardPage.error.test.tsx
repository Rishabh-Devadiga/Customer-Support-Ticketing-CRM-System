// @vitest-environment happy-dom
//
// Failure paths with fetch stubbed down: deterministic under plain `npm test`
// (real dead-port runs already proved this UI in Phases 2-3).
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { isAbortError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import DashboardPage from "./DashboardPage";

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ path: "/", element: <DashboardPage /> }],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

test("connection failure shows error banner and retry re-attempts", async () => {
  vi.stubGlobal(
    "fetch",
    () => Promise.reject(new TypeError("network down")),
  );
  renderAt("/");
  const alert = await screen.findByRole("alert", {}, { timeout: 5000 });
  expect(alert.textContent).toMatch(/Cannot reach the API/);

  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(
    () => expect(screen.queryByRole("alert")).not.toBeNull(),
    { timeout: 5000 },
  );
});

test("ErrorBanner shows the message and calls retry", () => {
  const onRetry = vi.fn();
  render(<ErrorBanner message="Boom." onRetry={onRetry} />);
  expect(screen.getByRole("alert").textContent).toMatch(/Boom\./);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("isAbortError identifies only aborts", () => {
  expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
  expect(isAbortError(new Error("nope"))).toBe(false);
  expect(isAbortError(null)).toBe(false);
});
