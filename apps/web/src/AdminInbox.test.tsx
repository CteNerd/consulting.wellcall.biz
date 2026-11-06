import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AdminInbox } from "./AdminInbox.tsx";

vi.mock("./admin-auth.ts", () => ({
  readAdminAuthConfiguration: () => ({ apiUrl: new URL("https://api.example.invalid") }),
  createAdminAuth: () => ({
    completeSignIn: async () => "access-token",
    beginSignIn: async () => undefined,
    signOut: () => undefined,
  }),
}));

const lead = {
  leadId: "b9de9897-5f48-4a63-a872-1d1b53bd64a5",
  name: "Riley Example", email: "person@example.com", company: "",
  message: "<script>not executable</script>",
  createdAt: "2026-11-05T16:00:00.000Z", consentedAt: "2026-11-05T16:00:00.000Z",
  consentPolicyVersion: "2026-01", status: "NEW", version: 0,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

test("inbox saves a status with the displayed version and updates the confirmed result", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(reply({ leads: [lead], nextToken: null }))
    .mockResolvedValueOnce(reply({ status: "CONTACTED", version: 1 }));
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/?code=callback&state=state");
  render(<AdminInbox />);
  const select = await screen.findByRole("combobox", { name: "Follow-up status for Riley Example" });
  expect(document.querySelector("script")).toBeNull();
  fireEvent.change(select, { target: { value: "CONTACTED" } });
  fireEvent.click(screen.getByRole("button", { name: "Save status" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Inquiry status saved."));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [url, options] = fetchMock.mock.calls[1]!;
  expect(String(url)).toBe(`https://api.example.invalid/admin/leads/${lead.leadId}`);
  expect(options.method).toBe("PATCH");
  expect(options.headers.authorization).toBe("Bearer access-token");
  expect(JSON.parse(options.body)).toEqual({ status: "CONTACTED", expectedVersion: 0 });
  expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("CONTACTED");
  expect((screen.getByRole("button", { name: "Save status" }) as HTMLButtonElement).disabled).toBe(true);
});

test("inbox surfaces concurrent edits without claiming success or automatically retrying", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(reply({ leads: [lead], nextToken: null }))
    .mockResolvedValueOnce(reply({}, 409));
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/?code=callback&state=state");
  render(<AdminInbox />);
  const select = await screen.findByRole("combobox");
  fireEvent.change(select, { target: { value: "CLOSED" } });
  fireEvent.click(screen.getByRole("button", { name: "Save status" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Refresh before trying again"));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByText("New", { selector: "p" })).toBeDefined();
});

test("inbox keeps pagination available when expiry filtering leaves an empty page", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(reply({ leads: [], nextToken: "page-token" }))
    .mockResolvedValueOnce(reply({ leads: [lead], nextToken: null }));
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/?code=callback&state=state");
  render(<AdminInbox />);
  await screen.findByText("No inquiries on this page.");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByRole("combobox");
  expect(String(fetchMock.mock.calls[1]![0])).toBe("https://api.example.invalid/admin/leads?nextToken=page-token");
  expect(screen.getByText("Page 2")).toBeDefined();
});

test("expired sessions clear the inbox and re-enable sign-in with a visible explanation", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(reply({}, 401));
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/?code=callback&state=state");
  render(<AdminInbox />);
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Your session expired"));
  expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByRole("combobox")).toBeNull();
});

function reply(body: unknown, status = 200) {
  return { ok: status === 200, status, json: async () => body };
}
