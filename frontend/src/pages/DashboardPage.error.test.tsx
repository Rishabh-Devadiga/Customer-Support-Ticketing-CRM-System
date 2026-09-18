// @vitest-environment happy-dom
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

afterEach(cleanup);

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ path: "/", element: <DashboardPage /> }],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

test("connection failure shows error banner and retry re-attempts", async () => {
  // Runs with VITE_API_BASE_URL pointed at a dead port.
  renderAt("/");
  const alert = await screen.findByRole("alert", {}, { timeout: 8000 });
  expect(alert.textContent).toMatch(/Cannot reach the API/);

  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(
    () => expect(screen.queryByRole("alert")).not.toBeNull(),
    { timeout: 8000 },
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
