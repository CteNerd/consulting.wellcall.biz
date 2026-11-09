import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App.tsx";
import { brand } from "./branding.ts";
import { publicRoutes } from "./PublicSite.tsx";
import { services } from "./site-content.ts";
import { presentation, presentationHtml } from "./presentation.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.querySelector('link[rel="canonical"]')?.remove();
  window.history.replaceState(null, "", "/");
});

test.each(publicRoutes)("explicit production presentation at %s publishes the brand, not intake", (path) => {
  vi.stubEnv("VITE_PUBLIC_PRESENTATION", "production");
  vi.stubEnv("VITE_PUBLIC_ORIGIN", "https://thirddowntech.com");
  window.history.replaceState(null, "", path);
  render(<App />);
  expect(document.title).toContain(brand.name);
  expect(document.title).not.toMatch(/preview|provisional/i);
  expect(document.body.textContent).not.toMatch(/preview|provisional|launch remains subject/i);
  expect(document.body.textContent).toMatch(/intake.*closed/i);
  expect(document.querySelector("form, input, textarea")).toBeNull();
  expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href)
    .toBe(`https://thirddowntech.com${path}`);
  expect(screen.queryByRole("link", { name: "Admin inbox" })).toBeNull();
});

test("public SEO requires explicit presentation, never just a production build, and a safe origin", () => {
  const html = '<head>\n    <meta name="robots" content="noindex, nofollow" />\n<title>Third Down Technologies | Development preview</title></head>';
  expect(presentation({ PROD: true }).publicBrand).toBe(false);
  expect(presentationHtml(html, { PROD: true })).toBe(html);
  const env = { VITE_PUBLIC_PRESENTATION: "production", VITE_PUBLIC_ORIGIN: "https://thirddowntech.com" };
  expect(presentationHtml(html, env)).not.toMatch(/noindex|preview/i);
  expect(presentationHtml(html, env)).toContain('href="https://thirddowntech.com/"');
  for (const origin of ["https://dev.thirddowntech.com", "https://evil.example", 'https://thirddowntech.com/"']) {
    expect(() => presentation({ ...env, VITE_PUBLIC_ORIGIN: origin })).toThrow(/SEO origin/);
  }
  expect(() => presentation({ VITE_PUBLIC_ORIGIN: env.VITE_PUBLIC_ORIGIN })).toThrow(/SEO origin/);
});

test.each(["workspace", "admin"])("production %s entry remains closed without preview wording", (query) => {
  vi.stubEnv("VITE_PUBLIC_PRESENTATION", "production");
  window.history.replaceState(null, "", `/?${query}`);
  render(<App />);
  expect(document.body.textContent).not.toMatch(/preview|provisional/i);
  expect(document.body.textContent).toMatch(/not configured/i);
  expect(document.querySelector("form, input, textarea")).toBeNull();
  expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
});

test.each(publicRoutes)("public route %s has a coherent, connected and closed preview", (path) => {
  window.history.replaceState(null, "", path);
  render(<App />);
  const main = screen.getByRole("main");
  expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeDefined();
  expect(screen.getByRole("navigation", { name: "Footer navigation" })).toBeDefined();
  expect(document.title).toContain(brand.name);
  expect(document.title).toContain("Development preview");
  expect(document.querySelector("form")).toBeNull();
  expect(document.querySelector("input, textarea")).toBeNull();
  expect(document.body.textContent).not.toMatch(/WellCall|We'll Call|admin@|certified|guaranteed savings/i);
  const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const link of screen.getAllByRole("link")) {
    const href = link.getAttribute("href")!;
    if (href.startsWith("#")) {
      expect(document.getElementById(href.slice(1)), `broken fragment ${href} on ${path}`).not.toBeNull();
    } else {
      const url = new URL(href, window.location.origin);
      expect(publicRoutes, `unrecognized public destination ${href} on ${path}`).toContain(url.pathname);
      expect(url.origin).toBe(window.location.origin);
    }
  }
});

test.each(services)("service $name explains fit, deliverables and evaluation", (service) => {
  window.history.replaceState(null, "", `/services/${service.slug}`);
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(service.headline);
  for (const deliverable of service.deliverables) expect(screen.getByText(deliverable)).toBeDefined();
  expect(screen.getByText(service.decisions)).toBeDefined();
  expect(screen.getByText(service.measure)).toBeDefined();
  expect(screen.getByRole("link", { name: "Services", current: "page" })).toBeDefined();
  expect(screen.getByRole("navigation", { name: "On this service page" })).toBeDefined();
});

test("small-business and enterprise paths provide different practical starting points", () => {
  window.history.replaceState(null, "", "/small-business");
  const view = render(<App />);
  expect(screen.getByRole("heading", { name: "Digital Foundations", level: 3 })).toBeDefined();
  expect(screen.queryByRole("heading", { name: "Engineering Solutions", level: 3 })).toBeNull();
  view.unmount();
  window.history.replaceState(null, "", "/enterprise");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Engineering Solutions", level: 3 })).toBeDefined();
  expect(screen.queryByRole("heading", { name: "Digital Foundations", level: 3 })).toBeNull();
});

test("mobile menu is a disclosure with a real controlled navigation element", () => {
  render(<App />);
  const toggle = screen.getByRole("button", { name: "Menu" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  const menu = document.getElementById(toggle.getAttribute("aria-controls")!);
  expect(menu?.tagName).toBe("NAV");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(menu?.classList.contains("is-open")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

test("discovery preparation is useful without opening collection or inventing contact details", () => {
  window.history.replaceState(null, "", "/contact");
  render(<App />);
  expect(screen.getByText("Discovery booking and inquiries are not open in this preview.")).toBeDefined();
  expect(screen.getByRole("heading", { name: "The constraints" })).toBeDefined();
  expect(document.querySelector('a[href^="mailto:"], a[href^="tel:"], form')).toBeNull();
});

test("FAQ uses native, keyboard-operable disclosures and explains meaningful boundaries", () => {
  window.history.replaceState(null, "", "/faq");
  render(<App />);
  const questions = document.querySelectorAll("details");
  expect(questions.length).toBeGreaterThan(5);
  expect(screen.getByText("Can cloud savings be guaranteed?").tagName).toBe("SUMMARY");
  expect(screen.getByText(/No automatic warranty, service level/)).toBeDefined();
});

test("engagement options describe scope and ownership without payment terms", () => {
  window.history.replaceState(null, "", "/approach");
  render(<App />);
  for (const name of ["Focused discovery", "Fixed-scope project", "Ongoing retainer"]) {
    expect(screen.getByRole("heading", { name })).toBeDefined();
  }
  expect(screen.getByText(/A retainer is not unlimited work/)).toBeDefined();
  expect(screen.getByText(/No payment terms, response-time guarantees or service levels/)).toBeDefined();
});

test("owner-directed software explains the reviewed path from a request to integration scope", () => {
  window.history.replaceState(null, "", "/approach");
  render(<App />);
  expect(screen.getByRole("navigation", { name: "Main navigation" })
    .querySelector('a[href="/approach#owner-directed"]')).not.toBeNull();
  expect(screen.getByText("Owner-directed software / selfware")).toBeDefined();
  expect(screen.getByRole("heading", { name: "Start with the change you want to make." })).toBeDefined();
  expect(screen.getByText(/When a task is marked ready, include its due date/)).toBeDefined();
  expect(screen.getByRole("heading", { name: "Buy, configure or build?" })).toBeDefined();
  expect(screen.getByText(/For regulated needs, establish applicable requirements, authorized access, audit evidence, vendor agreements and independent review/)).toBeDefined();
  expect(screen.getByText(/AI is not compliance/)).toBeDefined();
  expect(document.querySelector("form")).toBeNull();
});

test("unknown and retired payment routes do not show commercial terms or a checkout", () => {
  window.history.replaceState(null, "", "/payment");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("find the next move");
  expect(screen.getByRole("link", { name: "Return home" }).getAttribute("href")).toBe("/");
  expect(document.querySelector("form")).toBeNull();
});

test("trailing-slash service URLs still render their detail page", () => {
  window.history.replaceState(null, "", "/services/ai-automation/");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("useful workflow");
});

test.each(["code=callback", "state=callback", "error=access_denied"])("auth callback %s still reaches the admin flow", (query) => {
  window.history.replaceState(null, "", `/?${query}`);
  render(<App />);
  expect(screen.getByRole("heading", { name: "Lead inbox" })).toBeDefined();
  expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
});
