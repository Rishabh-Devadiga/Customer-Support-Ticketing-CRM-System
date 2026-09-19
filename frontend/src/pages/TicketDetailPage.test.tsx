// @vitest-environment happy-dom
//
// Detail flows against the real backend. Seeds uniquely-tagged tickets in
// beforeAll; tests run sequentially within this file.
//
// happy-dom exposes live textarea values as text, so note assertions are
// scoped to the timeline <ol> and status assertions use the select value +
// API state (option texts would otherwise false-match).
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { createTicket, getTicket, updateTicket } from "../api/client";
import TicketDetailPage from "./TicketDetailPage";

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

const TAG = `p4detail-${Date.now()}`;
const NOTE_1 = `First note ${TAG}`;
const NOTE_2 = `Second note ${TAG}`;
let idD1 = "";
let idD2 = "";
let idD3 = "";

beforeAll(async () => {
  const d1 = await createTicket({
    customer_name: `P4 Detail ${TAG}`,
    customer_email: `p4d1-${TAG}@example.com`,
    subject: `Detail subject ${TAG}`,
    description: `Detail description ${TAG} with full text.`,
  });
  idD1 = d1.ticket_id;
  await updateTicket(idD1, { note: NOTE_1 });
  await updateTicket(idD1, { note: NOTE_2 });
  const d2 = await createTicket({
    customer_name: `P4 Empty ${TAG}`,
    customer_email: `p4d2-${TAG}@example.com`,
    subject: `Empty notes ${TAG}`,
    description: `No notes here ${TAG}.`,
  });
  idD2 = d2.ticket_id;
  const d3 = await createTicket({
    customer_name: `P4 Combo ${TAG}`,
    customer_email: `p4d3-${TAG}@example.com`,
    subject: `Combo ${TAG}`,
    description: `Combo row ${TAG}.`,
  });
  idD3 = d3.ticket_id;
}, 30000);

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ path: "/tickets/:ticketId", element: <TicketDetailPage /> }],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

/** Notes timeline only: bare text queries false-match the composer textarea. */
async function timeline() {
  return within(await screen.findByRole("list", {}, { timeout: 8000 }));
}

function statusSelect() {
  return screen.getByLabelText("Status") as HTMLSelectElement;
}

test("loads and displays all ticket information", async () => {
  renderAt(`/tickets/${idD1}`);
  expect(screen.queryByLabelText("Loading ticket")).not.toBeNull();

  await screen.findByText(`P4 Detail ${TAG}`, {}, { timeout: 8000 });
  expect(screen.getByText(idD1)).not.toBeNull();
  expect(screen.getByText(`p4d1-${TAG}@example.com`)).not.toBeNull();
  expect(screen.getByText(`Detail subject ${TAG}`)).not.toBeNull();
  expect(
    screen.getByText(`Detail description ${TAG} with full text.`),
  ).not.toBeNull();
  expect(statusSelect().value).toBe("Open");
  const back = screen.getByRole("link", { name: /Back to all tickets/ });
  expect(back.getAttribute("href")).toBe("/");
});

test("notes display oldest-first", async () => {
  renderAt(`/tickets/${idD1}`);
  const heading = await screen.findByText("Notes (2)", {}, { timeout: 8000 });
  expect(heading).not.toBeNull();
  const items = within(heading.parentElement as HTMLElement).getAllByRole(
    "listitem",
  );
  const contents = items.map((li) => li.textContent ?? "");
  expect(contents[0]).toContain(NOTE_1);
  expect(contents[1]).toContain(NOTE_2);
});

test("empty notes state on a fresh ticket", async () => {
  renderAt(`/tickets/${idD2}`);
  await screen.findByText("No notes yet.", {}, { timeout: 8000 });
});

test("status flows Open to In Progress to Closed with refetch", async () => {
  const before = (await getTicket(idD2)).updated_at;
  renderAt(`/tickets/${idD2}`);
  await screen.findByText("No notes yet.", {}, { timeout: 8000 });

  const update = screen.getByRole("button", { name: "Update Status" });
  expect((update as HTMLButtonElement).disabled).toBe(true);

  fireEvent.change(statusSelect(), { target: { value: "In Progress" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
  // Server-authoritative: API confirms, then the UI settles (button back).
  await waitFor(
    async () => expect((await getTicket(idD2)).status).toBe("In Progress"),
    { timeout: 8000 },
  );
  await waitFor(
    async () =>
      expect(
        (screen.getByRole("button", { name: "Update Status" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true),
    { timeout: 8000 },
  );

  fireEvent.change(statusSelect(), { target: { value: "Closed" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
  await waitFor(
    async () => expect((await getTicket(idD2)).status).toBe("Closed"),
    { timeout: 8000 },
  );

  const after = await getTicket(idD2);
  expect(after.status).toBe("Closed");
  expect(after.updated_at).not.toBe(before);

  // Fresh mount reads server state: UI is server-driven, never faked.
  cleanup();
  renderAt(`/tickets/${idD2}`);
  await screen.findByText("Notes (0)", {}, { timeout: 8000 });
  expect(statusSelect().value).toBe("Closed");
}, 30000);

test("note-only PUT appends, clears composer, persists on refresh", async () => {
  const content = `Composer note ${TAG}`;
  renderAt(`/tickets/${idD2}`);
  await screen.findByLabelText("Add a note", {}, { timeout: 8000 });

  // Blank rejected client-side.
  fireEvent.change(screen.getByLabelText("Add a note"), {
    target: { value: "   " },
  });
  expect(
    (screen.getByRole("button", { name: "Add Note" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);

  fireEvent.change(screen.getByLabelText("Add a note"), {
    target: { value: content },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add Note" }));
  // Timeline-scoped: the composer textarea itself would false-match.
  await (await timeline()).findByText(content, {}, { timeout: 8000 });
  // Composer cleared on success.
  expect(
    (screen.getByLabelText("Add a note") as HTMLTextAreaElement).value,
  ).toBe("");

  // Fresh mount (headless refresh): note persisted via server refetch.
  cleanup();
  renderAt(`/tickets/${idD2}`);
  await (await timeline()).findByText(content, {}, { timeout: 8000 });
  const persisted = await getTicket(idD2);
  expect(persisted.notes.some((n) => n.content === content)).toBe(true);
  expect(persisted.status).toBe("Closed"); // note-only PUT kept status.
}, 30000);

test("oversized note fails with text preserved", async () => {
  const big = `oversized-${TAG}-` + "x".repeat(10001);
  renderAt(`/tickets/${idD2}`);
  await screen.findByLabelText("Add a note", {}, { timeout: 8000 });

  fireEvent.change(screen.getByLabelText("Add a note"), {
    target: { value: big },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add Note" }));
  await waitFor(
    () =>
      expect(
        (screen.getByLabelText("Add a note") as HTMLTextAreaElement).value,
      ).toBe(big),
    { timeout: 8000 },
  );
  // 422 from the backend surfaces without losing the draft.
  await screen.findByText(/10000/, {}, { timeout: 8000 });
}, 20000);

test("double-click Add Note creates exactly one note", async () => {
  const content = `Double note ${TAG}`;
  renderAt(`/tickets/${idD2}`);
  await screen.findByLabelText("Add a note", {}, { timeout: 8000 });

  fireEvent.change(screen.getByLabelText("Add a note"), {
    target: { value: content },
  });
  const add = screen.getByRole("button", { name: "Add Note" });
  fireEvent.click(add);
  fireEvent.click(add);
  await (await timeline()).findByText(content, {}, { timeout: 8000 });

  const persisted = await getTicket(idD2);
  expect(persisted.notes.filter((n) => n.content === content)).toHaveLength(1);
}, 20000);

test("client supports combined status+note PUT", async () => {
  // UI intentionally sends them separately (approved); the client covers both.
  const res = await updateTicket(idD3, {
    status: "In Progress",
    note: `Combo note ${TAG}`,
  });
  expect(res.success).toBe(true);
  const after = await getTicket(idD3);
  expect(after.status).toBe("In Progress");
  expect(after.notes.map((n) => n.content)).toContain(`Combo note ${TAG}`);
});

test("unknown ticket shows not-found UI", async () => {
  renderAt("/tickets/TKT-NOPE01");
  await screen.findByText("Ticket not found", {}, { timeout: 8000 });
  const back = screen.getByRole("link", { name: "Back to tickets" });
  expect(back.getAttribute("href")).toBe("/");
});

test("load failure shows banner; retry recovers", async () => {
  vi.stubGlobal("fetch", () => Promise.reject(new TypeError("network down")));
  renderAt(`/tickets/${idD1}`);
  const alert = await screen.findByRole("alert", {}, { timeout: 8000 });
  expect(alert.textContent).toMatch(/Cannot reach the API/);

  vi.unstubAllGlobals();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText(`P4 Detail ${TAG}`, {}, { timeout: 8000 });
});

test("transient first failure is retried silently, then detail loads", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => {
    calls += 1;
    if (calls === 1) return Promise.reject(new TypeError("flaky network"));
    return realFetch(...args);
  });
  try {
    renderAt(`/tickets/${idD1}`);
    await screen.findByText(`P4 Detail ${TAG}`, {}, { timeout: 8000 });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(calls).toBeGreaterThanOrEqual(2);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("404 is shown immediately without automatic retries", async () => {
  let calls = 0;
  vi.stubGlobal("fetch", () => {
    calls += 1;
    return Promise.resolve(
      new Response(JSON.stringify({ detail: "Ticket not found" }), {
        status: 404,
      }),
    );
  });
  try {
    renderAt("/tickets/TKT-NOPE01");
    await screen.findByText("Ticket not found", {}, { timeout: 8000 });
    // Past the only attempt: real responses are never retried.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(calls).toBe(1);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("unmount during backoff stops retries", async () => {
  let calls = 0;
  vi.stubGlobal("fetch", () => {
    calls += 1;
    return Promise.reject(new TypeError("down"));
  });
  try {
    const router = createMemoryRouter(
      [{ path: "/tickets/:ticketId", element: <TicketDetailPage /> }],
      { initialEntries: [`/tickets/${idD1}`] },
    );
    const { unmount } = render(<RouterProvider router={router} />);
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(1), {
      timeout: 5000,
    });
    unmount();
    // A broken cleanup would fire retries at +400ms/+800ms; assert silence.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(calls).toBe(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
