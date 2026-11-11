export type PortfolioProject = {
  slug: string;
  name: string;
  relationship: "client" | "operated-business" | "founder-experiment";
  status: "in-use" | "in-progress" | "experimental";
  category: string;
  challenge: string;
  decision: string;
  work: string[];
  verifiedOutcome?: string;
  nextStep?: string;
  evidenceLinks: { label: string; url: string }[];
  image?: { src: string; alt: string };
  ownerApproval: "approved" | "pending";
};

export const portfolioProjects: PortfolioProject[] = [
  {
    slug: "r3-counseling",
    name: "R3 Counseling",
    relationship: "client",
    status: "in-use",
    category: "Client work · Digital foundations",
    challenge: "Maintain a useful business website while its owner continues to shape what the business needs.",
    decision: "Keep changes owner-directed and practical; assess larger workflows before committing to a build.",
    work: [
      "Built and maintain an actively used business website.",
      "Support owner-directed website changes through tracked GitHub issues.",
    ],
    verifiedOutcome: "The owner confirms the website is actively used. No patient, treatment, or compliance outcomes are claimed.",
    evidenceLinks: [
      { label: "Business website", url: "https://r3counseling.com" },
      { label: "Public source repository", url: "https://github.com/CteNerd/r3counseling" },
    ],
    ownerApproval: "approved",
  },
  {
    slug: "sugar-society-sc",
    name: "Sugar Society SC",
    relationship: "client",
    status: "in-use",
    category: "Client work · E-commerce",
    challenge: "Give a growing bakery a digital platform for its business and seasonal pre-sale operations.",
    decision: "Prioritize event-based pre-sales and admin order operations; keep custom-order workflows as future scope.",
    work: [
      "Implemented event-based catalogs, fixed-price pack variants, and a pre-sale order workflow.",
      "Built supporting order-management and payment code; production availability and payment outcomes are not asserted.",
    ],
    verifiedOutcome: "The owner confirms the business uses the platform. No order-volume, revenue, or cost-savings claims are made.",
    evidenceLinks: [
      { label: "Business website", url: "https://sugarsocietysc.com" },
      { label: "Public source repository", url: "https://github.com/CteNerd/sugarsocietysc" },
    ],
    ownerApproval: "approved",
  },
  {
    slug: "the-lab-performance-and-strength",
    name: "The Lab Performance & Strength",
    relationship: "client",
    status: "in-progress",
    category: "Client work · In progress",
    challenge: "Establish a clear public identity and website before investing in backend capabilities.",
    decision: "Stage the static marketing site and content first; defer booking, payment, and backend features.",
    work: [
      "Partnering with the business owner on the website, identity, and training content.",
      "Keeping backend features out of the current milestone.",
    ],
    nextStep: "Complete and review the static-site milestone before deciding whether backend work is needed.",
    evidenceLinks: [{ label: "Public source repository", url: "https://github.com/CteNerd/the-lab" }],
    ownerApproval: "approved",
  },
  {
    slug: "candy-map",
    name: "Candy Map / Neighborhood Celebrations",
    relationship: "founder-experiment",
    status: "experimental",
    category: "Founder experiment · Product",
    challenge: "Explore a mobile-first seasonal map for neighbors who choose to share holiday displays.",
    decision: "Build incremental seasonal editions with explicit participation choices and privacy boundaries.",
    work: [
      "Developed a proof of concept for opt-in Halloween and Christmas display maps.",
      "Kept property claims self-reported or organizer-reviewed; residency and ownership are not verified.",
    ],
    verifiedOutcome: "A founder experiment only. No adoption, residency-verification, or property-ownership outcomes are claimed.",
    evidenceLinks: [{ label: "Public source repository", url: "https://github.com/CteNerd/candy-map" }],
    ownerApproval: "approved",
  },
];
