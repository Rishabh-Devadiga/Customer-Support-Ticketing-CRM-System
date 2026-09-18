// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import DashboardPage from "./DashboardPage";

afterEach(cleanup);

test("empty database offers a create-ticket action", async () => {
  // Runs against an emptied tickets table.
  const router = createMemoryRouter(
    [
      { path: "/", element: <DashboardPage /> },
      { path: "/tickets/new", element: <div>new ticket page</div> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);

  await screen.findByText("No tickets yet.", {}, { timeout: 5000 });
  const link = screen.getByRole("link", { name: "Create ticket" });
  expect(link.getAttribute("href")).toBe("/tickets/new");
});
