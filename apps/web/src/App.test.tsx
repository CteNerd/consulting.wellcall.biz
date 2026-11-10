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
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("game plan");
  expect(screen.getAllByText("Rethink. Create. Transform.").length).toBeGreaterThan(0);
  expect(screen.getByText(/Practical technology consulting for small businesses and established teams/)).toBeDefined();
  expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main");
  expect(document.querySelector("form")).toBeNull();
  expect(screen.getByText(/Intake is closed in this preview/)).toBeDefined();
});

test("admin route exposes no inbox or sign-in when required settings are absent", () => {
  window.history.replaceState(null, "", "/?admin");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Lead inbox" })).toBeDefined();
  expect(screen.getByText(/sign-in is not configured in this build/)).toBeDefined();
  expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
});
