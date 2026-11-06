import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LeadForm } from "./LeadForm.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("inquiry collection remains unavailable without explicit policy and API configuration", () => {
  vi.stubEnv("VITE_LEAD_INTAKE_ENABLED", "true");
  vi.stubEnv("VITE_LEAD_CONSENT_POLICY_VERSION", "");
  vi.stubEnv("VITE_LEAD_CONSENT_COPY", "");
  vi.stubEnv("VITE_API_URL", "");
  render(<LeadForm />);
  expect(document.querySelector("form")).toBeNull();
  expect(screen.getByText(/inquiries are not open/)).toBeDefined();
});

test("configured form posts consent and bounded fields with an idempotency key", async () => {
  configureForm();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", { randomUUID: () => "b9de9897-5f48-4a63-a872-1d1b53bd64a5" });
  render(<LeadForm />);

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Riley Example" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.change(screen.getByLabelText("How can we help?"), { target: { value: "I would like to discuss a project." } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.submit(screen.getByRole("button", { name: "Send inquiry" }).closest("form")!);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  const [url, options] = fetchMock.mock.calls[0]!;
  expect(String(url)).toBe("https://api.example.invalid/leads");
  expect(options.headers["idempotency-key"]).toBe("b9de9897-5f48-4a63-a872-1d1b53bd64a5");
  expect(JSON.parse(options.body)).toMatchObject({
    name: "Riley Example",
    email: "person@example.com",
    consent: true,
    consentPolicyVersion: "2026-01",
  });
  expect(screen.getByRole("status").textContent).toContain("Your inquiry was received");
});

test("network retries reuse a key for the unchanged submission", async () => {
  configureForm();
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error("network unavailable"))
    .mockResolvedValueOnce({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", { randomUUID: () => "b9de9897-5f48-4a63-a872-1d1b53bd64a5" });
  render(<LeadForm />);

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Riley Example" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.change(screen.getByLabelText("How can we help?"), { target: { value: "I would like to discuss a project." } });
  fireEvent.click(screen.getByRole("checkbox"));
  const form = screen.getByRole("button", { name: "Send inquiry" }).closest("form")!;
  fireEvent.submit(form);
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("could not reach"));
  fireEvent.submit(form);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[0]![1].headers["idempotency-key"])
    .toBe(fetchMock.mock.calls[1]![1].headers["idempotency-key"]);
});

function configureForm() {
  vi.stubEnv("VITE_LEAD_INTAKE_ENABLED", "true");
  vi.stubEnv("VITE_LEAD_CONSENT_POLICY_VERSION", "2026-01");
  vi.stubEnv("VITE_LEAD_CONSENT_COPY", "Approved inquiry consent text.");
  vi.stubEnv("VITE_API_URL", "https://api.example.invalid");
}
