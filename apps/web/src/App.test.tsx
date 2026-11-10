import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { App } from "./App.tsx";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

test("preview has accessible navigation and no premature inquiry or payment collection", () => {
  render(<App />);
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeDefined();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Technology that earns its place in your business.");
  expect(screen.getAllByText("Rethink. Create. Transform.").length).toBeGreaterThan(0);
  expect(screen.getByText(/We help growing businesses and engineering teams decide what to build/)).toBeDefined();
  expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main");
  expect(document.querySelector("form")).toBeNull();
  expect(screen.getAllByText(/Inquiries are not open yet/).length).toBeGreaterThan(0);
});

test("admin route exposes no inbox or sign-in when required settings are absent", () => {
  window.history.replaceState(null, "", "/?admin");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Lead inbox" })).toBeDefined();
  expect(screen.getByText(/sign-in is not configured in this build/)).toBeDefined();
  expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
});
