// @vitest-environment happy-dom
//
// Self-sufficient: seeds uniquely-tagged rows in beforeAll, so assertions are
// exact regardless of other rows in the database or parallel test files.
// After every filter change, tests wait for the URL value AND the rows,
// because the table stays rendered (stale) while the new fetch is in flight.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RouterProvider,
  createMemoryRouter,
  useParams,
} from "react-router-dom";
import { createTicket, updateTicket } from "../api/client";
import Layout from "../components/Layout";
import DashboardPage from "./DashboardPage";

afterEach(cleanup);

const TAG = `p2dash-${Date.now()}`;
const NAME_A = `P2 Alpha ${TAG}`;
const NAME_B = `P2 Bravo ${TAG}`;
const NAME_C = `P2 Charlie ${TAG}`;
const EMAIL_B = `p2b-${TAG}@example.com`;
let idA = "";
let idB = "";
let idC = "";

beforeAll(async () => {
  const a = await createTicket({
    customer_name: NAME_A,
    customer_email: `p2a-${TAG}@example.com`,
    subject: `Alpha subject ${TAG}`,
    description: `seeded ${TAG} row alpha`,
  });
  const b = await createTicket({
    customer_name: NAME_B,
    customer_email: EMAIL_B,
    subject: `Bravo subject ${TAG}`,
    description: `seeded ${TAG} row bravo`,
  });
  const c = await createTicket({
    customer_name: NAME_C,
    customer_email: `p2c-${TAG}@example.com`,
    subject: `Charlie subject ${TAG}`,
    description: `seeded ${TAG} row charlie`,
  });
  idA = a.ticket_id;
  idB = b.ticket_id;
  idC = c.ticket_id;
  await updateTicket(idA, { status: "In Progress" });
  await updateTicket(idC, { status: "Closed", note: "Seed note." });
  await updateTicket(idA, { priority: "High" });
  await updateTicket(idC, { priority: "Urgent" });
}, 30000);

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

function urlParam(router: ReturnType<typeof renderAt>, key: string) {
  return new URLSearchParams(router.state.location.search).get(key);
}

test("loading skeleton, then sorted listing with links", async () => {
  renderAt("/");
  expect(screen.queryByLabelText("Loading tickets")).not.toBeNull();

  const ids = await rowTicketIds();
  // Tagged rows present, newest-first (C created last).
  expect(ids.indexOf(idC)).toBeLessThan(ids.indexOf(idB));
  expect(ids.indexOf(idB)).toBeLessThan(ids.indexOf(idA));
  // Row content + links, scoped to the tagged row (names repeat across runs).
  expect(screen.getByText(NAME_B)).not.toBeNull();
  const link = screen.getByRole("link", { name: idB });
  expect(link.getAttribute("href")).toBe(`/tickets/${idB}`);
  const table = await screen.findByRole("table");
  const rows = within(table).getAllByRole("row").slice(1);
  const rowText = (id: string) =>
    rows.find((r) => r.textContent?.includes(id))?.textContent ?? "";
  expect(rowText(idA)).toContain("In Progress");
  expect(rowText(idC)).toContain("Closed");
});

test("search filters server-side and lands in the URL", async () => {
  const router = renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.change(screen.getByLabelText("Search tickets"), {
    target: { value: EMAIL_B },
  });
  await waitFor(() => expect(urlParam(router, "search")).toBe(EMAIL_B), {
    timeout: 5000,
  });
  await waitFor(
    async () => expect(await rowTicketIds()).toEqual([idB]),
    { timeout: 5000 },
  );
});

test("status filter isolates tagged rows", async () => {
  const router = renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "Closed" },
  });
  await waitFor(() => expect(urlParam(router, "status")).toBe("Closed"), {
    timeout: 5000,
  });
  // Tagged partition: C shows; A/B cannot (wrong status). Untagged leftovers
  // may add rows, so assert membership, not exact equality.
  await waitFor(
    async () => {
      const ids = await rowTicketIds();
      expect(ids).toContain(idC);
      expect(ids).not.toContain(idA);
      expect(ids).not.toContain(idB);
    },
    { timeout: 5000 },
  );
});

test("combined search+filter composes (AND)", async () => {
  const router = renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "Closed" },
  });
  fireEvent.change(screen.getByLabelText("Search tickets"), {
    target: { value: TAG },
  });
  // TAG matches all three tagged rows, but only Charlie is Closed.
  await waitFor(() => expect(urlParam(router, "search")).toBe(TAG), {
    timeout: 5000,
  });
  await waitFor(
    async () => expect(await rowTicketIds()).toEqual([idC]),
    { timeout: 5000 },
  );
});

test("prefilled URL restores state; All + clear empties params", async () => {
  const router = renderAt(`/?search=${TAG}&status=Closed`);
  await waitFor(
    () =>
      expect(
        (screen.getByLabelText("Search tickets") as HTMLInputElement).value,
      ).toBe(TAG),
    { timeout: 5000 },
  );
  expect(
    (screen.getByLabelText("Status") as HTMLSelectElement).value,
  ).toBe("Closed");
  expect(await rowTicketIds()).toEqual([idC]);

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
    async () => {
      const ids = await rowTicketIds();
      expect(ids).toContain(idA);
      expect(ids).toContain(idB);
      expect(ids).toContain(idC);
    },
    { timeout: 5000 },
  );
});

test("no-results state with working clear action", async () => {
  renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.change(screen.getByLabelText("Search tickets"), {
    target: { value: `${TAG}-zzz-no-match` },
  });
  // Generous timeout: shared backend is slow under full-suite parallel load.
  await screen.findByText("No tickets match your search.", {}, { timeout: 10000 });

  fireEvent.click(
    screen.getByRole("button", { name: "Clear search & filters" }),
  );
  await waitFor(
    async () => {
      const ids = await rowTicketIds();
      expect(ids).toContain(idA);
      expect(ids).toContain(idB);
      expect(ids).toContain(idC);
    },
    { timeout: 5000 },
  );
});

test("ticket link navigates to the detail route", async () => {
  renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.click(screen.getByRole("link", { name: idB }));
  await screen.findByText(`detail:${idB}`, {}, { timeout: 5000 });
});

test("transient first failure is retried silently, then rows load", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => {
    calls += 1;
    if (calls === 1) return Promise.reject(new TypeError("flaky network"));
    return realFetch(...args);
  });
  try {
    renderAt("/");
    expect(await rowTicketIds()).toContain(idA);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(calls).toBeGreaterThanOrEqual(2);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("HTTP error responses are not retried", async () => {
  let calls = 0;
  vi.stubGlobal("fetch", () => {
    calls += 1;
    return Promise.resolve(
      new Response(JSON.stringify({ detail: "DB down" }), { status: 500 }),
    );
  });
  try {
    renderAt("/");
    await screen.findByRole("alert", {}, { timeout: 5000 });
    // Past the only attempt: no automatic retries for real responses.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(calls).toBe(1);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("exactly one New ticket button (header) on the dashboard", async () => {
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: "/",
            element: <Layout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: "tickets/new", element: <div>new ticket page</div> },
            ],
          },
        ],
        { initialEntries: ["/"] },
      )}
    />,
  );
  await screen.findByRole("table", {}, { timeout: 5000 });
  const links = screen.getAllByRole("link", { name: "New ticket" });
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute("href")).toBe("/tickets/new");
});

test("priority filter isolates tagged rows and lands in the URL", async () => {
  const router = renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.change(screen.getByLabelText("Priority"), {
    target: { value: "High" },
  });
  await waitFor(() => expect(urlParam(router, "priority")).toBe("High"), {
    timeout: 5000,
  });
  // Tagged partition: A is High; B/C cannot be. Untagged leftovers may add
  // rows, so assert membership, not exact equality.
  await waitFor(
    async () => {
      const ids = await rowTicketIds();
      expect(ids).toContain(idA);
      expect(ids).not.toContain(idB);
      expect(ids).not.toContain(idC);
    },
    { timeout: 5000 },
  );
});

test("priority composes with search and status (AND)", async () => {
  const router = renderAt("/");
  await screen.findByRole("table", {}, { timeout: 5000 });

  fireEvent.change(screen.getByLabelText("Priority"), {
    target: { value: "Urgent" },
  });
  fireEvent.change(screen.getByLabelText("Search tickets"), {
    target: { value: TAG },
  });
  // TAG matches all three tagged rows, but only Charlie is Urgent.
  await waitFor(() => expect(urlParam(router, "priority")).toBe("Urgent"), {
    timeout: 5000,
  });
  await waitFor(() => expect(urlParam(router, "search")).toBe(TAG), {
    timeout: 5000,
  });
  // waitFor: the table still shows pre-search rows while the new fetch flies.
  await waitFor(
    async () => expect(await rowTicketIds()).toEqual([idC]),
    { timeout: 8000 },
  );

  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "Open" },
  });
  // None of the tagged rows is Open+Urgent: proves the third clause applied.
  await waitFor(() => expect(urlParam(router, "status")).toBe("Open"), {
    timeout: 5000,
  });
  await screen.findByText("No tickets match your search.", {}, { timeout: 8000 });
});

test("priority column renders badges in the table", async () => {
  renderAt("/");
  const table = await screen.findByRole("table", {}, { timeout: 5000 });
  const rows = within(table).getAllByRole("row").slice(1);
  const rowText = (id: string) =>
    rows.find((r) => r.textContent?.includes(id))?.textContent ?? "";
  expect(rowText(idA)).toContain("High");
  expect(rowText(idC)).toContain("Urgent");
});
