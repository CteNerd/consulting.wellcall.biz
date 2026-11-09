export type Service = {
  slug: string;
  name: string;
  category: string;
  headline: string;
  summary: string;
  fit: string;
  signals: string[];
  deliverables: string[];
  decisions: string;
  measure: string;
  startingPoint: string;
};

export const services: Service[] = [
  {
    slug: "digital-foundations",
    name: "Digital Foundations",
    category: "Get the essentials working together",
    headline: "A stronger business starts with the basics.",
    summary: "Make it easier for customers to find you and for your team to do its work. Connect your website, business tools and everyday workflows without buying complexity you do not need.",
    fit: "Small businesses getting established, or teams whose collection of disconnected tools has become a daily obstacle.",
    signals: [
      "Your website does not clearly explain what you do or work well on a phone.",
      "Customer information lives in inboxes, spreadsheets and individual memory.",
      "You need a sensible plan for domains, business email, access and backups.",
    ],
    deliverables: [
      "A current-state inventory of your website, accounts, tools and ownership.",
      "A prioritized foundation plan with costs, dependencies and named owners.",
      "A scoped website or tool setup, with accessible content and tested customer journeys.",
      "An account handover checklist and practical guidance for the people using the tools.",
    ],
    decisions: "A managed website builder, an existing business platform or a simple integration may be a better fit than custom software. Compare recurring fees, accessibility, data export and who will maintain it before choosing.",
    measure: "Agree on a baseline such as time to update content, steps in a customer inquiry or duplicate data entry. Review the same workflow after adoption rather than promising a sales increase.",
    startingPoint: "Start with a digital-foundation discovery to identify the highest-friction customer or staff journey.",
  },
  {
    slug: "engineering-solutions",
    name: "Engineering Solutions",
    category: "Turn a difficult problem into a maintainable system",
    headline: "Build what matters. Keep it understandable.",
    summary: "Design, improve and connect software around real business needs. Move from uncertain requirements to small, testable changes that your team can operate and evolve.",
    fit: "Established teams building a product, integrating systems or modernizing software that is becoming expensive or risky to change.",
    signals: [
      "A valuable workflow cannot be supported by your existing tools.",
      "Releases are fragile, manual or difficult to roll back.",
      "Integrations, technical debt or unclear architecture are slowing delivery.",
    ],
    deliverables: [
      "A system and dependency map, with risks and architecture decisions recorded.",
      "A delivery backlog with scope boundaries and testable acceptance criteria.",
      "Scoped application, API or integration changes with automated checks.",
      "Deployment, rollback and operational handover documentation.",
    ],
    decisions: "Prefer improvements that fit your existing stack and team. Compare incremental modernization, integration and replacement; a rewrite or cloud migration is not automatically progress.",
    measure: "Choose measures such as lead time for a change, release failure rate, workflow completion or recovery time. Establish the baseline and constraints before implementation.",
    startingPoint: "Begin with a focused architecture or delivery review, then scope a thin, useful slice of implementation.",
  },
  {
    slug: "fractional-leadership",
    name: "Fractional Technology Leadership",
    category: "Make better technology decisions",
    headline: "A clear direction, without a full-time leadership hire.",
    summary: "Connect business priorities, technical decisions and delivery expectations. Bring structure to a roadmap, make trade-offs visible and give the team a plan it can actually use.",
    fit: "Business owners and engineering teams that need technology decision support, but not a full-time executive role.",
    signals: [
      "Your roadmap has more requests than the team can reasonably deliver.",
      "Vendor proposals are difficult to compare or challenge.",
      "Technical risks and investment decisions are not visible to business stakeholders.",
    ],
    deliverables: [
      "A prioritized roadmap linking technical work to business objectives.",
      "A decision and risk register with owners, dependencies and review dates.",
      "Vendor or build-versus-buy evaluation criteria and documented recommendations.",
      "An agreed planning and review cadence, with concise stakeholder updates.",
    ],
    decisions: "Leadership should make the internal team more capable, not create a permanent dependency. Clarify decision rights, access, availability and handover from the start; fractional support does not imply unlimited capacity.",
    measure: "Review decision turnaround, roadmap clarity, unresolved risks and delivery predictability against agreed goals. Advisory work is not a guarantee of revenue, funding or delivery dates.",
    startingPoint: "Use discovery to define the decisions that need support and whether a project or a bounded advisory retainer is appropriate.",
  },
  {
    slug: "ai-automation",
    name: "AI & Automation",
    category: "Reduce friction, not human judgment",
    headline: "A useful workflow comes before an impressive demo.",
    summary: "Find repeatable work worth simplifying. Use ordinary automation when rules are enough, and evaluate AI only where its uncertainty, operating cost and data requirements make sense.",
    fit: "Teams spending time on repetitive handoffs, document handling or information retrieval with a clear process owner.",
    signals: [
      "People copy the same information between tools or reconcile it manually.",
      "A team needs help finding information across approved sources.",
      "You have an AI idea but need to test usefulness, risk and operating cost.",
    ],
    deliverables: [
      "A workflow map and opportunity assessment comparing manual, rules-based and AI options.",
      "A bounded prototype using approved or synthetic data, with explicit access limits.",
      "An evaluation set covering useful answers, failure cases, cost and human review.",
      "For an approved implementation: fallback behavior, monitoring and an ownership runbook.",
    ],
    decisions: "Do not send confidential or personal data to an unapproved provider. Review data retention, permissions, model limitations and integration costs. Keep human approval for consequential actions and a way to stop or bypass automation.",
    measure: "Compare task time, correction rate, human review effort and cost per completed workflow. A prototype must earn its place in production; AI is not a requirement or a guarantee of accuracy.",
    startingPoint: "Choose one repeatable workflow and define what a useful result and an unacceptable failure look like.",
  },
  {
    slug: "cloud-cost-optimization",
    name: "Cloud Cost Optimization",
    category: "Understand the bill and the trade-offs",
    headline: "Spend deliberately. Protect what needs to keep running.",
    summary: "Connect cloud spend to the systems and business activities behind it. Identify avoidable costs without treating reliability, recovery or the team's operating time as free.",
    fit: "Organizations with an existing cloud footprint, unclear cost ownership or infrastructure that no longer matches actual usage.",
    signals: [
      "The bill is growing but nobody can explain which workloads drive it.",
      "Idle resources, oversized services or data transfer costs are hard to track.",
      "You want to compare hosting options before committing to a migration.",
    ],
    deliverables: [
      "A scoped billing and workload inventory with cost owners and visibility gaps.",
      "A prioritized opportunity register separating low-risk changes from architectural decisions.",
      "Recommendations covering utilization, storage, data transfer, budgets and alerts.",
      "A change and verification plan with reliability checks, rollback steps and follow-up measures.",
    ],
    decisions: "Start with billing exports or read-only access where possible. AWS, Azure, Google Cloud, managed hosting and SaaS all have trade-offs. Do not buy long-term commitments, remove backups or move workloads solely to make one month's bill smaller.",
    measure: "Compare normalized spend against workload volume and reliability needs. Include migration effort, licensing, support and team time. Savings depend on the baseline and approved changes; no percentage is promised.",
    startingPoint: "Start with a bounded cost assessment and agree which accounts, workloads and billing periods are in scope.",
  },
];

export const engagementModels = [
  {
    name: "Focused discovery",
    purpose: "When the problem or the next step is still unclear.",
    output: "A current-state assessment, options, risks and a prioritized recommendation you can use to make a decision.",
    boundary: "Agree the questions, access and discovery deliverables first. Discovery does not automatically commit you to implementation.",
  },
  {
    name: "Fixed-scope project",
    purpose: "When there is a defined outcome to design, build or improve.",
    output: "An agreed implementation, acceptance checks, documentation and an explicit handover.",
    boundary: "Define scope, dependencies and acceptance together. New requirements are reviewed as changes rather than silently added.",
  },
  {
    name: "Ongoing retainer",
    purpose: "When a team needs a continuing planning or improvement cadence.",
    output: "An agreed allocation of advisory or delivery capacity, a prioritized backlog and regular reviews.",
    boundary: "Set capacity, responsibilities and support boundaries explicitly. A retainer is not unlimited work or an implied 24/7 service.",
  },
];

export const stages = [
  {
    name: "Rethink",
    heading: "Get clear before getting busy.",
    body: "Listen to the people doing the work. Understand the business objective, current tools, constraints and risks before recommending a direction.",
    output: "A problem statement, options and a prioritized game plan.",
    checkpoint: "Agree what success means, what is out of scope and whether to proceed.",
  },
  {
    name: "Create",
    heading: "Make the plan tangible.",
    body: "Design and implement in useful increments. Demonstrate progress, test the important journeys and make trade-offs visible as the work develops.",
    output: "Working increments, acceptance evidence and operational documentation.",
    checkpoint: "Review against acceptance criteria and approve changes deliberately.",
  },
  {
    name: "Transform",
    heading: "Make the change stick.",
    body: "Help people adopt the solution, transfer ownership and compare results with the starting point. Prioritize maintenance and improvements based on what you learn.",
    output: "Training, handover, agreed measures and a next-step backlog.",
    checkpoint: "Confirm who owns the system and what any ongoing support includes.",
  },
];

export const faqs = [
  {
    question: "Are inquiries or discovery bookings open?",
    answer: "No. Public intake and discovery booking are closed. There is no live scheduling link, payment collection or promised response window.",
  },
  {
    question: "Do I need to know which service I need?",
    answer: "No. Start with the problem: what is difficult today, who is affected and what would improve. The small-business and enterprise paths help you explore likely starting points; discovery is intended to clarify the work rather than sell a predetermined tool.",
  },
  {
    question: "Do you work with small businesses and enterprise teams?",
    answer: "The service model is designed for both. Small-business work emphasizes practical foundations and manageable ownership. Enterprise work emphasizes architecture, integrations, delivery discipline and collaboration with existing teams. Scope depends on the specific problem and available capacity.",
  },
  {
    question: "Will you recommend AWS or custom software for everything?",
    answer: "No. The right answer may be an existing tool, managed platform, workflow change or no new software at all. AWS, Azure, Google Cloud and other hosting options should be evaluated against requirements, total cost, operational ownership and exit options.",
  },
  {
    question: "How are scope, pricing and timelines decided?",
    answer: "They depend on the work, dependencies, risks and available capacity. Discovery should produce enough clarity to agree deliverables, assumptions, acceptance criteria and an estimate. This site does not publish rates, deposits, payment terms or delivery guarantees.",
  },
  {
    question: "Can you improve an existing system instead of replacing it?",
    answer: "Yes, that is an important option to evaluate. An assessment should identify what can be retained, integrated or improved incrementally. Replacement needs a reason, a migration plan and a credible way for the team to operate what comes next.",
  },
  {
    question: "When does AI make sense?",
    answer: "When a defined workflow benefits from it and evaluation supports the cost and risks. Rules-based automation is often simpler. AI work needs approved data, access boundaries, test cases, human review where appropriate and fallback behavior when the output is wrong or unavailable.",
  },
  {
    question: "Can cloud savings be guaranteed?",
    answer: "No. Opportunities depend on your baseline, workload and reliability needs. Recommendations should distinguish estimated savings from verified results and include implementation effort, support costs and any new commitments.",
  },
  {
    question: "What happens after an implementation?",
    answer: "Plan for documentation, training, account ownership and an explicit handover. Maintenance, enhancements or advisory support can be scoped separately or within an agreed retainer. No automatic warranty, service level or round-the-clock support is implied by this site.",
  },
  {
    question: "What should I prepare, and what should I keep private?",
    answer: "Prepare a short problem statement, your current tools, constraints, decision-makers and desired outcome. Do not submit passwords, access keys, customer records, financial documents or other sensitive material through a public inquiry. Any later access should be explicitly approved and limited to the work.",
  },
];
