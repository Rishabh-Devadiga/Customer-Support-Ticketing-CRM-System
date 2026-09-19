// @vitest-environment happy-dom
//
// Failure path with fetch stubbed down: deterministic under plain `npm test`.
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import NewTicketPage from "./NewTicketPage";

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

test("network failure keeps values and retry re-attempts", async () => {
  vi.stubGlobal(
    "fetch",
    () => Promise.reject(new TypeError("network down")),
  );
  const router = createMemoryRouter(
    [{ path: "/tickets/new", element: <NewTicketPage /> }],
    { initialEntries: ["/tickets/new"] },
  );
  render(<RouterProvider router={router} />);

  fireEvent.change(screen.getByLabelText("Customer Name"), {
    target: { value: "Offline User" },
  });
  fireEvent.change(screen.getByLabelText("Customer Email"), {
    target: { value: "off@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Subject"), {
    target: { value: "No network" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Testing the failure path." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

  const alert = await screen.findByRole("alert", {}, { timeout: 5000 });
  expect(alert.textContent).toMatch(/Cannot reach the API/);

  // Values preserved, still on the form (no navigation).
  expect(
    (screen.getByLabelText("Customer Name") as HTMLInputElement).value,
  ).toBe("Offline User");

  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("alert", {}, { timeout: 5000 });
});
