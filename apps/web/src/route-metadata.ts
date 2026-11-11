import { brand } from "./branding.ts";
import { services } from "./site-content.ts";

export type PublicPageMetadata = {
  path: string;
  title: string;
  description: string;
};

export const publicPageMetadata: PublicPageMetadata[] = [
  {
    path: "/",
    title: brand.philosophy,
    description: "Technology consulting for growing businesses and engineering teams. Decide what to buy, connect, improve or build.",
  },
  {
    path: "/small-business",
    title: "Small Business Solutions",
    description: "Digital foundations, customer journeys and practical workflow improvements for small businesses.",
  },
  {
    path: "/enterprise",
    title: "Enterprise Engineering",
    description: "Architecture, engineering leadership and delivery support for teams improving complex systems.",
  },
  {
    path: "/work",
    title: "Selected Work",
    description: "Owner-approved client projects, in-progress work and a separate founder experiment, with status and scope made clear.",
  },
  {
    path: "/services",
    title: "Services",
    description: "Five practical consulting capabilities with examples of fit and likely deliverables.",
  },
  {
    path: "/approach",
    title: "Our Approach",
    description: "A clear Rethink, Create, Transform process with discovery, fixed-scope and ongoing engagement models.",
  },
  {
    path: "/about",
    title: "About",
    description: "Founder Roderick Tomlin II's engineering, architecture and delivery background, and a practical consulting philosophy.",
  },
  {
    path: "/faq",
    title: "Frequently Asked Questions",
    description: "Answers about technology choices, project scope, data boundaries and working together.",
  },
  {
    path: "/contact",
    title: "Contact",
    description: "Public inquiries and discovery booking are closed. Prepare a private, concise project brief.",
  },
  ...services.map((service) => ({
    path: `/services/${service.slug}`,
    title: service.name,
    description: service.summary,
  })),
];

export const notFoundPageMetadata: PublicPageMetadata = {
  path: "",
  title: "Page Not Found",
  description: "This page is not available.",
};

export function getPublicPageMetadata(path: string): PublicPageMetadata {
  return publicPageMetadata.find((page) => page.path === path) ?? notFoundPageMetadata;
}
