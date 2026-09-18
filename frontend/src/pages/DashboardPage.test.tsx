// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import {
  RouterProvider,
  createMemoryRouter,
  useParams,
} from "react-router-dom";
import { listTickets } from "../api/client";
import DashboardPage from "./DashboardPage";

afterEach(cleanup);

function DetailStub() {
  const { ticketId } = useParams();
  return <div>detail:{ticketId}</div>;
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <DashboardPage /> },
      { path: "/tickets/new", element: <div>new ticket page</div> },
      { path: "/tickets/:ticketId", element: <DetailStub /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

async function rowTicketIds(): Promise<string[]> {
  const table = await screen.findByRole("table", {}, { timeout: 5000 });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map(
      (row) => within(row).getAllByRole("cell")[0].textContent ?? "",
    );
}

test("loading skeleton, then all tickets newest-first with links", async () => {
  const seeded = await listTickets({});
  expect(seeded.length).toBe(3);

  renderAt("/");
  expect(screen.queryByLabelText("Loading tickets")).not.toBeNull();

  expect(await rowTicketIds()).toEqual(seeded.map((t) => t.ticket_id));
  // Row content: customer, subject, status badge, created date, links.
  expect(screen.getByText("Rahul Sharma")).not.toBeNull();
  expect(
    screen.getByRole("link", { name: seeded[0].ticket_id }),
  ).not.toBeNull();
  const href = screen
    .getByRole("link", { name: seeded[0].ticket_id })
    .getAttribute("href");
  expect(href).toBe(`/tickets/${seeded[0].ticket_id}`);
});

test("search filters server-side and lands in the URL", async () => {
  const router = renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.change(screen.getByLabelText("Search tickets"), {
    target: { value: "jane" },
  });
  await waitFor(
    () => expect(screen.queryByText("Rahul Sharma")).toBeNull(),
    { timeout: 5000 },
  );
  expect(screen.getByText("Jane Doe")).not.toBeNull();
  expect(router.state.location.search).toContain("search=jane");
});

test("status filter and combined search+filter", async () => {
  const router = renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "Closed" },
  });
  await waitFor(
    () => expect(screen.queryByText("Jane Doe")).toBeNull(),
    { timeout: 5000 },
  );
  expect(screen.getByText("Rahul Verma")).not.toBeNull();
  expect(router.state.location.search).toContain("status=Closed");

  fireEvent.change(screen.getByLabelText("Search tickets"), {
    target: { value: "jane" },
  });
  // Combined jane + Closed matches nothing: proves the AND-composed query ran.
  await waitFor(
    () => expect(router.state.location.search).toContain("search=jane"),
    { timeout: 5000 },
  );
  await screen.findByText("No tickets match your search.", {}, { timeout: 5000 });
});

test("All + cleared search remove URL params and restore rows", async () => {
  const router = renderAt("/?search=rahul&status=Closed");
  await waitFor(
    () =>
      expect(
        (screen.getByLabelText("Search tickets") as HTMLInputElement).value,
      ).toBe("rahul"),
    { timeout: 5000 },
  );
  expect(
    (screen.getByLabelText("Status") as HTMLSelectElement).value,
  ).toBe("Closed");
  expect(await rowTicketIds()).toHaveLength(1);

  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "All" },
  });
  fireEvent.change(screen.getByLabelText("Search tickets"), {
    target: { value: "" },
  });
  await waitFor(
    () => expect(router.state.location.search).toBe(""),
    { timeout: 5000 },
  );
  await waitFor(
    async () => expect(await rowTicketIds()).toHaveLength(3),
    { timeout: 5000 },
  );
});

test("no-results state with working clear action", async () => {
  renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.change(screen.getByLabelText("Search tickets"), {
    target: { value: "zzz-no-such-ticket" },
  });
  await screen.findByText("No tickets match your search.", {}, { timeout: 5000 });

  fireEvent.click(
    screen.getByRole("button", { name: "Clear search & filters" }),
  );
  expect(await rowTicketIds()).toHaveLength(3);
});

test("ticket link navigates to the detail route", async () => {
  const seeded = await listTickets({});
  renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.click(screen.getByRole("link", { name: seeded[1].ticket_id }));
  await screen.findByText(`detail:${seeded[1].ticket_id}`, {}, { timeout: 5000 });
});
