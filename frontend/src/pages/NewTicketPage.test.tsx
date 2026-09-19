// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { RouterProvider, createMemoryRouter, useParams } from "react-router-dom";
import { getTicket, listTickets } from "../api/client";
import NewTicketPage, { mapDetailToFieldErrors } from "./NewTicketPage";

afterEach(cleanup);

function DetailStub() {
  const { ticketId } = useParams();
  return <div>detail:{ticketId}</div>;
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/tickets/new", element: <NewTicketPage /> },
      { path: "/tickets/:ticketId", element: <DetailStub /> },
      { path: "/", element: <div>dashboard</div> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function fillValid(email: string) {
  fireEvent.change(screen.getByLabelText("Customer Name"), {
    target: { value: "  Priya Nair  " },
  });
  fireEvent.change(screen.getByLabelText("Customer Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Subject"), {
    target: { value: "  App crashes on upload  " },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "  Uploading a 5MB file crashes the app.  " },
  });
}

test("submit disabled until valid; inline errors on blur", () => {
  renderAt("/tickets/new");
  const submit = screen.getByRole("button", { name: "Create ticket" });
  expect((submit as HTMLButtonElement).disabled).toBe(true);

  fireEvent.change(screen.getByLabelText("Customer Name"), {
    target: { value: "Priya" },
  });
  // Untouched empty email shows nothing yet, submit still disabled.
  expect((submit as HTMLButtonElement).disabled).toBe(true);

  fireEvent.blur(screen.getByLabelText("Customer Email"));
  expect(screen.getByText("Customer email is required.")).not.toBeNull();

  fireEvent.change(screen.getByLabelText("Customer Email"), {
    target: { value: "not-an-email" },
  });
  expect(screen.getByText("Enter a valid email address.")).not.toBeNull();
});

test("valid creation trims, starts Open, persists, navigates", async () => {
  const email = `phase3-${Date.now()}@example.com`;
  renderAt("/tickets/new");
  fillValid(email);

  const submit = screen.getByRole("button", { name: "Create ticket" });
  await waitFor(
    () => expect((submit as HTMLButtonElement).disabled).toBe(false),
    { timeout: 5000 },
  );
  fireEvent.click(submit);

  const detail = await screen.findByText(/^detail:TKT-/, {}, { timeout: 8000 });
  const createdId = (detail.textContent ?? "").replace("detail:", "");
  expect(createdId).toMatch(/^TKT-[A-Z2-9]{6}$/);

  const persisted = await getTicket(createdId);
  expect(persisted.status).toBe("Open");
  expect(persisted.customer_name).toBe("Priya Nair");
  expect(persisted.customer_email).toBe(email);
  expect(persisted.subject).toBe("App crashes on upload");
  expect(persisted.description).toBe("Uploading a 5MB file crashes the app.");
  expect(persisted.created_at).toBeTruthy();
  expect(persisted.notes).toEqual([]);
}, 20000);

test("double submit creates exactly one ticket", async () => {
  const email = `phase3-dup-${Date.now()}@example.com`;
  renderAt("/tickets/new");
  fillValid(email);

  const submit = screen.getByRole("button", { name: "Create ticket" });
  await waitFor(
    () => expect((submit as HTMLButtonElement).disabled).toBe(false),
    { timeout: 5000 },
  );
  fireEvent.click(submit);
  fireEvent.click(submit);

  await screen.findByText(/^detail:TKT-/, {}, { timeout: 8000 });
  const matches = await listTickets({ search: email });
  expect(matches).toHaveLength(1);
}, 20000);

test("cancel/back actions return to the dashboard", () => {
  renderAt("/tickets/new");
  const cancel = screen.getByRole("link", { name: "Cancel" });
  expect(cancel.getAttribute("href")).toBe("/");
  const back = screen.getByRole("link", { name: /Back to all tickets/ });
  expect(back.getAttribute("href")).toBe("/");
});

test("backend 422 detail maps to fields", () => {
  const { fieldErrors, formError } = mapDetailToFieldErrors([
    { loc: ["body", "customer_email"], msg: "value is not a valid email" },
    { loc: ["body", "mystery"], msg: "weird" },
    "garbage",
  ]);
  expect(fieldErrors.customer_email).toBe("value is not a valid email");
  expect(formError).toBe("weird");
  const empty = mapDetailToFieldErrors("nope");
  expect(empty).toEqual({ fieldErrors: {}, formError: null });
});
