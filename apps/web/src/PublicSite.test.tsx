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

test.each(publicRoutes)("explicit production presentation at %s publishes the brand without opening intake", (path) => {
  vi.stubEnv("VITE_PUBLIC_PRESENTATION", "production");
  vi.stubEnv("VITE_PUBLIC_ORIGIN", "https://thirddowntech.com");
  window.history.replaceState(null, "", path);
  render(<App />);
  expect(document.title).toContain(brand.name);
  expect(document.title).not.toMatch(/preview|provisional/i);
  expect(document.body.textContent).not.toMatch(/preview|provisional|launch remains subject/i);
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;
  expect(description).toBeTruthy();
  expect(description).not.toContain("Development preview");
  expect(document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content).toBe(document.title);
  expect(document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content).toBe(description);
  expect(document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe(`https://thirddowntech.com${path}`);
  expect(document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.content).toBe(description);
  expect(document.querySelector("form, input, textarea")).toBeNull();
  if (path === "/contact") {
    expect(document.body.textContent).toContain("Public inquiries and discovery booking are closed.");
  }
  expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href)
    .toBe(`https://thirddowntech.com${path}`);
  expect(screen.queryByRole("link", { name: "Admin inbox" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Team workspace" })).toBeNull();
  expect(document.querySelector('a[href^="tel:"]')).toBeNull();
});

test("each public route exposes a distinct page description", () => {
  vi.stubEnv("VITE_PUBLIC_PRESENTATION", "production");
  vi.stubEnv("VITE_PUBLIC_ORIGIN", "https://thirddowntech.com");
  const descriptions = publicRoutes.map((path) => {
    window.history.replaceState(null, "", path);
    const view = render(<App />);
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;
    view.unmount();
    return description;
  });
  expect(descriptions.every(Boolean)).toBe(true);
  expect(new Set(descriptions).size).toBe(publicRoutes.length);
});

test("public SEO requires explicit presentation, never just a production build, and a safe origin", () => {
  const html = '<head>\n    <meta name="robots" content="noindex, nofollow" />\n    <meta name="description" content="Development preview: technology consulting for growing businesses and engineering teams. Decide what to buy, connect, improve or build." />\n<title>Third Down Technologies | Development preview</title></head>';
  expect(presentation({ PROD: true }).publicBrand).toBe(false);
  expect(presentationHtml(html, { PROD: true })).toBe(html);
  const env = { VITE_PUBLIC_PRESENTATION: "production", VITE_PUBLIC_ORIGIN: "https://thirddowntech.com" };
  expect(presentationHtml(html, env)).not.toMatch(/noindex|preview/i);
  expect(presentationHtml(html, env)).toContain('href="https://thirddowntech.com/"');
  const metadata = new DOMParser().parseFromString(presentationHtml(html, env), "text/html");
  expect(metadata.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe("Technology consulting for growing businesses and engineering teams. Decide what to buy, connect, improve or build.");
  expect(metadata.querySelector('meta[property="og:image"]')?.getAttribute("content"))
    .toBe("https://thirddowntech.com/assets/third-down-social-8e2cf34fa2ac.jpg");
  expect(metadata.querySelector('meta[name="twitter:image"]')?.getAttribute("content"))
    .toBe("https://thirddowntech.com/assets/third-down-social-8e2cf34fa2ac.jpg");
  expect(metadata.querySelector('meta[name="twitter:card"]')?.getAttribute("content"))
    .toBe("summary_large_image");
  expect(presentationHtml(html, { VITE_PUBLIC_PRESENTATION: "production" })).not.toContain("og:image");
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
      if (url.origin === window.location.origin) {
        expect(publicRoutes, `unrecognized public destination ${href} on ${path}`).toContain(url.pathname);
        if (url.pathname === path && url.hash) {
          expect(document.getElementById(url.hash.slice(1)), `broken fragment ${href} on ${path}`).not.toBeNull();
        }
      } else {
        if (url.origin === "https://github.com") {
          expect(url.pathname).toMatch(/^\/CteNerd\/(r3counseling|sugarsocietysc|the-lab|candy-map)$/);
        } else {
          expect(["https://r3counseling.com", "https://sugarsocietysc.com"]).toContain(url.origin);
          expect(url.pathname).toBe("/");
        }
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      }
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

test("small-business and enterprise pages speak to distinct audiences without repeating the service directory", () => {
  window.history.replaceState(null, "", "/small-business");
  const view = render(<App />);
  expect(screen.getByRole("heading", { name: "A website should help customers—and make the business easier to run." })).toBeDefined();
  expect(screen.getByRole("heading", { name: "People cannot quickly find you or take the next step.", level: 3 })).toBeDefined();
  expect(screen.queryByText(/fragile or difficult to roll back/i)).toBeNull();
  view.unmount();
  window.history.replaceState(null, "", "/enterprise");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Help your team deliver with a clearer direction." })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Releases are fragile or difficult to roll back.", level: 3 })).toBeDefined();
  expect(screen.queryByText(/People cannot quickly find you/i)).toBeNull();
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

test("homepage leads with concrete problem paths and approved proof without repeated CTAs", () => {
  render(<App />);

  expect(screen.getByRole("heading", { level: 1, name: "Technology that earns its place in your business." })).toBeDefined();
  expect(screen.getAllByText(brand.philosophy).length).toBeGreaterThan(0);
  expect(screen.getByRole("link", { name: "See our work" }).getAttribute("href")).toBe("/work");
  expect(screen.getByRole("link", { name: "See how we work" }).getAttribute("href")).toBe("/approach");
  expect(screen.getByRole("heading", { name: "Recognize the problem. Find the right move." })).toBeDefined();
  expect(screen.getByRole("heading", { name: "My business is growing; my tools are slowing me down." })).toBeDefined();
  expect(screen.getByRole("heading", { name: "I have an idea. Do I buy it, connect tools, or build?" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "My systems are expensive or difficult to change." })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Not everything needs to be custom-built." })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Real systems, with status and scope made clear." })).toBeDefined();
  expect(screen.getAllByText("In use").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByRole("link", { name: "See all work and experiments" }).getAttribute("href")).toBe("/work");
  for (const option of ["Buy", "Connect", "Improve", "Build"]) {
    expect(screen.getByRole("heading", { name: option, level: 3 })).toBeDefined();
  }
  expect(screen.queryByText(/Illustrative scenarios|not client case studies/)).toBeNull();
  expect(screen.getByText(/total cost, maintenance ownership, data portability/)).toBeDefined();
  expect(screen.queryByText(/Start with the problem, not the platform/)).toBeNull();
  expect(screen.queryByRole("link", { name: /Prepare for discovery|Inquiries are not open yet/ })).toBeNull();
  expect(screen.queryByRole("link", { name: /Digital Foundations/ })).toBeNull();
});

test("work page separates client projects, in-progress work and founder experiments", () => {
  window.history.replaceState(null, "", "/work");
  render(<App />);
  const clientWork = screen.getByRole("region", { name: "Client work" });
  const experiments = screen.getByRole("region", { name: "Founder experiments and products" });
  expect(within(clientWork).getByRole("heading", { name: "R3 Counseling" })).toBeDefined();
  expect(within(clientWork).getByRole("heading", { name: "Sugar Society SC" })).toBeDefined();
  expect(within(clientWork).getByRole("heading", { name: "The Lab Performance & Strength" })).toBeDefined();
  expect(within(clientWork).queryByRole("heading", { name: "Candy Map / Neighborhood Celebrations" })).toBeNull();
  expect(within(experiments).getByRole("heading", { name: "Candy Map / Neighborhood Celebrations" })).toBeDefined();
  expect(within(experiments).getByText(/residency and ownership are not verified/)).toBeDefined();
  expect(within(clientWork).getByText("In progress")).toBeDefined();
  expect(within(experiments).getByText("Experiment")).toBeDefined();
  expect(within(clientWork).getAllByRole("link", { name: "Business website" }).map((link) => link.getAttribute("href")).sort())
    .toEqual(["https://r3counseling.com", "https://sugarsocietysc.com"]);
  expect(screen.getAllByRole("link", { name: "Public source repository" })).toHaveLength(4);
});

test("contact status is clear without opening collection or inventing a contact channel", () => {
  window.history.replaceState(null, "", "/contact");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Public inquiries and discovery booking are closed." })).toBeDefined();
  expect(screen.getByText(/This page is preparation guidance only; it does not send an inquiry/)).toBeDefined();
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
  expect(screen.getByText(/Each stage has an output, an owner and a decision checkpoint/)).toBeDefined();
  expect(screen.queryByText(/Start with the problem, not the platform/)).toBeNull();
});

test("owner-directed software keeps changes reviewed, scoped and accountable", () => {
  window.history.replaceState(null, "", "/approach");
  render(<App />);
  expect(screen.getByRole("navigation", { name: "Main navigation" })
    .querySelector('a[href="/approach#owner-directed"]')).toBeNull();
  expect(screen.getAllByText("Owner-directed software").length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Describe the outcome. Engineering makes the change safe to own." })).toBeDefined();
  expect(screen.getByText(/Integrations need a process map, approved data and access/)).toBeDefined();
  expect(screen.getByRole("heading", { name: "Buy, configure or build?" })).toBeDefined();
  expect(screen.getByText(/Confirm applicable requirements, authorized access, vendor terms and independent review/)).toBeDefined();
  expect(screen.getByText(/AI is not compliance: use approved data, human review and testing/)).toBeDefined();
  expect(document.querySelector("form")).toBeNull();
});

test("services index is a compact directory while details retain their decision support", () => {
  window.history.replaceState(null, "", "/services");
  render(<App />);
  expect(screen.getAllByText("Example output:").length).toBe(services.length);
  expect(screen.getAllByRole("link", { name: "View details" })).toHaveLength(services.length);
  expect(screen.queryByText(/A starting point:/)).toBeNull();
});

test("about page gives approved founder context without employer or client outcome claims", () => {
  window.history.replaceState(null, "", "/about");
  render(<App />);
  expect(screen.getByText(/I’m Roderick C\. Tomlin II, founder of Third Down Tech/)).toBeDefined();
  expect(screen.getByText(/engineering leadership, enterprise architecture and delivery management/)).toBeDefined();
  expect(document.body.textContent).not.toMatch(/NFL|SAIC|Greyhound|revenue growth|increased conversion/i);
});

test("unknown and retired payment routes do not show commercial terms or a checkout", () => {
  window.history.replaceState(null, "", "/payment");
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("This page is not available.");
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
