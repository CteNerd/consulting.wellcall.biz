import { useEffect, useState, type ReactNode } from "react";
import { brand } from "./branding.ts";
import { presentation, publicCopy } from "./presentation.ts";
import { LeadForm } from "./LeadForm.tsx";
import { engagementModels, faqs, services, stages, type Service } from "./site-content.ts";
import "./public-site.css";

const navigation = [
  { href: "/small-business", label: "Small business" },
  { href: "/enterprise", label: "Enterprise" },
  { href: "/services", label: "Services" },
  { href: "/approach", label: "Our approach" },
  { href: "/approach#owner-directed", label: "Owner-directed software" },
  { href: "/about", label: "About" },
];

export const publicRoutes = [
  "/", "/small-business", "/enterprise", "/services", "/approach", "/about", "/faq", "/contact",
  ...services.map((service) => `/services/${service.slug}`),
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function PageIntro({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <section className="page-intro" aria-labelledby="page-title">
      <p className="eyebrow">{label}</p>
      <h1 id="page-title">{title}</h1>
      <div className="intro-copy">{children}</div>
    </section>
  );
}

function SectionHeading({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{label}</p>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

function ServiceCards({ selection = services }: { selection?: Service[] }) {
  return (
    <div className="service-grid">
      {selection.map((service) => (
        <article className="service-tile" key={service.slug}>
          <p className="eyebrow">{service.category}</p>
          <h3><a href={`/services/${service.slug}`}>{service.name} <Arrow /></a></h3>
          <p>{service.summary}</p>
          <p className="tile-note">A starting point: {service.startingPoint}</p>
        </article>
      ))}
    </div>
  );
}

type ProjectStory = {
  title: string;
  challenge: string;
  decision: string;
  implementation: string;
};

const illustrativeStories: ProjectStory[] = [
  {
    title: "A growing business is repeating the same work",
    challenge: "Customer details move between disconnected tools and manual handoffs.",
    decision: "Map the workflow and compare a process change or existing integration before considering custom software.",
    implementation: "Agree the smallest useful change, its owner, and how the team will maintain it.",
  },
  {
    title: "An established system is difficult to change",
    challenge: "A team faces fragile releases, unclear dependencies, or growing delivery risk.",
    decision: "Identify what can be improved incrementally before proposing a replacement.",
    implementation: "Define a bounded change with acceptance checks, rollback steps, and an operational handover.",
  },
];

function ProjectStoryCard({ story }: { story: ProjectStory }) {
  return (
    <article className="scenario-card">
      <h3>{story.title}</h3>
      <dl>
        <div><dt>Challenge</dt><dd>{story.challenge}</dd></div>
        <div><dt>Decision</dt><dd>{story.decision}</dd></div>
        <div><dt>Implementation</dt><dd>{story.implementation}</dd></div>
      </dl>
    </article>
  );
}

function NextStep() {
  return (
    <aside className="next-step" aria-labelledby="next-step-title">
      <div>
        <p className="eyebrow">A useful next step</p>
        <h2 id="next-step-title">Start with the problem, not the platform.</h2>
        <p>{publicCopy("Inquiries are not open yet. In the meantime, get clear on the change you want to make.", "Inquiries are not open yet in this development preview. You can still prepare a useful outline.")}</p>
      </div>
      <a className="button" href="/contact">Prepare for discovery <Arrow /></a>
    </aside>
  );
}

function Home() {
  return (
    <>
      <section className="home-hero" aria-labelledby="page-title">
        <div className="hero-content">
          <p className="eyebrow">Technology consulting for growing businesses and engineering teams</p>
          <h1 id="page-title">Technology that earns its place in your business.</h1>
          <p className="hero-description">We help growing businesses and engineering teams decide what to build, what to buy, and what to improve—then turn the right decision into a solution that works.</p>
          <p className="hero-philosophy">{brand.philosophy}</p>
          <p className="hero-supporting">Every great idea deserves a game plan.</p>
          <div className="hero-actions">
            <a className="button" href="/services">Explore solutions <Arrow /></a>
            <a className="text-link" href="/approach">See how we work <Arrow /></a>
          </div>
        </div>
        <div className="game-plan" aria-hidden="true">
          <div className="field-line field-line-one" />
          <div className="field-line field-line-two" />
          <span className="play-marker marker-one">×</span>
          <span className="play-marker marker-two">○</span>
          <span className="play-marker marker-three">×</span>
          <div className="play-route" />
          <p>Think clearly.<br />Build deliberately.<br /><strong>Move forward.</strong></p>
          <span className="plan-caption">THE NEXT MOVE MATTERS.</span>
        </div>
      </section>
      <section id="your-next-move" className="content-section">
        <SectionHeading label="Start with the work" title="Recognize the problem. Find the right move.">
          Choose the situation that sounds familiar. The details help point to a useful next step—not a predetermined service.
        </SectionHeading>
        <div className="problem-grid">
          <article className="problem-card">
            <span className="card-index">01 / GROWING BUSINESS</span>
            <h3>Your business is growing. Your tools aren't keeping up.</h3>
            <p>Improve digital foundations, connect useful tools, and reduce manual work.</p>
            <a className="text-link" href="/small-business">Explore business foundations <Arrow /></a>
          </article>
          <article className="problem-card">
            <span className="card-index">02 / TECHNOLOGY DECISION</span>
            <h3>You have an idea. Should you buy, connect, or build?</h3>
            <p>Compare options objectively, then shape a practical prototype or delivery plan when it fits.</p>
            <a className="text-link" href="/approach#owner-directed">Explore the decision process <Arrow /></a>
          </article>
          <article className="problem-card">
            <span className="card-index">03 / ENGINEERING COMPLEXITY</span>
            <h3>Your systems are harder and more expensive to change.</h3>
            <p>Assess architecture, cloud costs, engineering needs, and ways to modernize incrementally.</p>
            <a className="text-link" href="/enterprise">Explore engineering support <Arrow /></a>
          </article>
        </div>
      </section>
      <section className="content-section muted-section">
        <SectionHeading label="Illustrative scenarios — not client case studies" title="What thoughtful project decisions can look like.">
          These examples describe possible approaches, not client engagements or measured outcomes.
        </SectionHeading>
        <div className="scenario-grid">
          {illustrativeStories.map((story) => <ProjectStoryCard key={story.title} story={story} />)}
        </div>
      </section>
      <section className="content-section decision-section">
        <SectionHeading label="Fit before features" title="Not everything needs to be custom-built.">
          Our job is to recommend the right option—not the most expensive one.
        </SectionHeading>
        <div className="decision-grid">
          {[
            ["Buy", "Adopt a suitable managed product or existing platform."],
            ["Connect", "Integrate the tools already in use."],
            ["Improve", "Simplify or modernize the current process or system."],
            ["Build", "Engineer custom software when the requirements and economics justify it."],
          ].map(([name, description]) => (
            <article className="decision-card" key={name}>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
        <p className="decision-note">Compare total cost, maintenance ownership, data portability, and whether the business can make routine changes independently. <a href="/approach#owner-directed">Learn about owner-directed software <Arrow /></a></p>
      </section>
      <section className="content-section muted-section">
        <SectionHeading label="Ways to work together" title="A clear scope for the support you need.">
          Engagements are shaped around the problem and available capacity; these are service models, not open booking offers.
        </SectionHeading>
        <div className="engagement-grid">{engagementModels.map((model) => (
          <article className="engagement-card" key={model.name}>
            <h3>{model.name}</h3>
            <p>{model.purpose}</p>
          </article>
        ))}</div>
        <a className="text-link" href="/approach#engagements">See engagement details <Arrow /></a>
      </section>
      <NextStep />
    </>
  );
}

function AudiencePage({ enterprise }: { enterprise: boolean }) {
  const selected = services.filter((service) => enterprise
    ? service.slug !== "digital-foundations"
    : service.slug !== "engineering-solutions");
  return (
    <>
      <PageIntro label={enterprise ? "Enterprise engineering" : "Small business solutions"} title={enterprise ? "Complexity needs a clear direction." : "Less friction. A stronger foundation."}>
        <p>{enterprise
          ? "Support your existing team with focused engineering, architecture and technical leadership. Make progress within real constraints—not around an idealized greenfield system."
          : "Your technology should make the business easier to run. Start with the customer journey and the work your team repeats, then choose tools you can realistically own."}</p>
      </PageIntro>
      <section className="content-section split-section">
        <SectionHeading label="Start with the work" title={enterprise ? "Make the next change a deliberate one." : "You do not need a bigger stack. You need a better fit."} />
        <div>
          <p>{enterprise
            ? "A useful starting point might be a release bottleneck, an integration that keeps breaking, an architecture decision or a cloud bill without a clear owner. Define one problem and the boundaries around it."
            : "A useful starting point might be a site customers cannot use on mobile, a booking process spread across inboxes or a spreadsheet that has become a second job. Fix the most important journey first."}</p>
          <h3>What a first engagement can produce</h3>
          <ul className="check-list">
            {(enterprise ? [
              "A system and dependency map with delivery and operational risks.",
              "An options assessment: improve, integrate, replace or leave alone.",
              "A scoped implementation plan with acceptance and rollback criteria.",
              "A handover plan that works with your team's ownership model.",
            ] : [
              "An inventory of the tools, accounts and workflows you rely on.",
              "A prioritized plan separating essentials from nice-to-haves.",
              "A scoped website, integration or workflow improvement.",
              "Training and handover so everyday changes do not depend on a developer.",
            ]).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>
      <section className="content-section muted-section">
        <SectionHeading label="Choose a direction" title={enterprise ? "Support where the team needs it." : "Practical help, sized to the business."} />
        <ServiceCards selection={selected} />
      </section>
      <section className="content-section split-section">
        <SectionHeading label="The right amount of technology" title={enterprise ? "Work with the team. Respect the constraints." : "Buy, connect or build—in that order of consideration."} />
        <div>
          <p>{enterprise
            ? "Existing architecture, procurement, access controls and review processes are part of the design. Agree decision rights, data boundaries and working practices before introducing changes. An outside perspective should strengthen internal ownership."
            : "A managed platform or a better use of an existing tool may solve the problem. Custom engineering should have a clear business reason and a realistic maintenance plan. Cloud infrastructure is an option, not a starting requirement."}</p>
          <a className="text-link" href={enterprise ? "/small-business" : "/enterprise"}>{enterprise ? "Looking for business foundations instead?" : "Working through a larger engineering challenge?"} <Arrow /></a>
        </div>
      </section>
      <NextStep />
    </>
  );
}

function ServicesPage() {
  return (
    <>
      <PageIntro label="Services" title="The right capability for the next move.">
        <p>Build a foundation, improve a system or make a better technology decision. Begin with the business outcome, then shape the work around it.</p>
      </PageIntro>
      <section className="content-section" aria-label="Service areas"><ServiceCards /></section>
      <section className="content-section split-section muted-section">
        <SectionHeading label="Fit before features" title="A good recommendation can be “use what you have.”" />
        <div>
          <p>Compare the simplest viable option with the cost of building and maintaining something new. Consider the team's skills, data sensitivity, accessibility, integration needs and exit options—not just the feature list.</p>
          <p>AWS is not the default. Managed platforms, SaaS, Azure, Google Cloud, existing infrastructure or a process change may be the better fit.</p>
          <a className="text-link" href="/approach#engagements">Compare engagement models <Arrow /></a>
        </div>
      </section>
      <NextStep />
    </>
  );
}

function ServicePage({ service }: { service: Service }) {
  return (
    <>
      <PageIntro label={service.name} title={service.headline}><p>{service.summary}</p></PageIntro>
      <nav className="page-jumps" aria-label="On this service page">
        <a href="#fit">Is this a fit?</a><a href="#deliverables">What you take away</a><a href="#decisions">Technology decisions</a>
      </nav>
      <section id="fit" className="content-section split-section">
        <SectionHeading label="A good fit when" title="Recognize the problem before choosing the solution.">{service.fit}</SectionHeading>
        <ul className="check-list">{service.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
      </section>
      <section id="deliverables" className="content-section muted-section">
        <SectionHeading label="Illustrative scope, agreed in discovery" title="What you take away.">
          These are candidate deliverables, not a bundled promise. The actual work, responsibilities and acceptance criteria are agreed before implementation.
        </SectionHeading>
        <ol className="deliverables">{service.deliverables.map((item, index) => <li key={item}><span aria-hidden="true">0{index + 1}</span><p>{item}</p></li>)}</ol>
      </section>
      <section id="decisions" className="content-section split-section">
        <SectionHeading label="Tools follow the problem" title="Appropriate technology. Explicit trade-offs." />
        <div><p>{service.decisions}</p><h3>How to evaluate progress</h3><p>{service.measure}</p></div>
      </section>
      <section className="starting-point">
        <p className="eyebrow">A sensible first move</p><h2>{service.startingPoint}</h2>
        <a className="text-link" href="/approach">See how an engagement works <Arrow /></a>
      </section>
      <section className="content-section">
        <SectionHeading label="Related capabilities" title="The work may connect." />
        <ul className="related-links">{services.filter((item) => item.slug !== service.slug).map((item) => <li key={item.slug}><a href={`/services/${item.slug}`}>{item.name} <Arrow /></a></li>)}</ul>
      </section>
      <NextStep />
    </>
  );
}

function ApproachPage() {
  return (
    <>
      <PageIntro label="Our approach" title="Clarity first. Progress you can inspect.">
        <p>Rethink the possibilities, create a practical pathway and transform how the work gets done. Each stage has an output and a decision—not just another meeting.</p>
      </PageIntro>
      <section className="content-section" aria-label="Engagement process">
        {stages.map((stage, index) => (
          <article className="process-row" key={stage.name}>
            <div><span className="stage-number">0{index + 1} / {stage.name}</span><h2>{stage.heading}</h2></div>
            <div><p>{stage.body}</p><h3>What you take away</h3><p>{stage.output}</p><p className="decision-point"><strong>Decision point:</strong> {stage.checkpoint}</p></div>
          </article>
        ))}
      </section>
      <section id="engagements" className="content-section muted-section">
        <SectionHeading label="Ways to work together" title="Discovery. Projects. Retainers.">
          Match the engagement to the uncertainty and the kind of support needed. These are service models, not currently open booking offers.
        </SectionHeading>
        <div className="engagement-grid">{engagementModels.map((model) => (
          <article className="engagement-card" key={model.name}><h3>{model.name}</h3><p>{model.purpose}</p><h4>Typical output</h4><p>{model.output}</p><p className="tile-note">{model.boundary}</p></article>
        ))}</div>
      </section>
      <section id="owner-directed" className="content-section owner-directed">
        <SectionHeading label="Owner-directed software / selfware" title="Start with the change you want to make.">
          People closest to the work should be able to describe the goal and simple changes in everyday language.
          Engineering turns that direction into reviewed, maintainable software—not unsupervised edits to live systems.
        </SectionHeading>
        <div className="stage-grid">
          <article className="stage-card">
            <span className="stage-number">01 / REQUEST</span>
            <h3>Write down the outcome.</h3>
            <p>For example: “When a task is marked ready, include its due date in the internal handoff note.” Add who needs it, what happens today and how you will recognize a useful result.</p>
          </article>
          <article className="stage-card">
            <span className="stage-number">02 / REVIEW</span>
            <h3>Make a small change inspectable.</h3>
            <p>Engineering checks assumptions, permissions and edge cases, then proposes a bounded change with tests, a review point and a handover. The owner confirms whether it solves the intended problem.</p>
          </article>
          <article className="stage-card">
            <span className="stage-number">03 / SCOPE</span>
            <h3>Map the larger workflow before connecting it.</h3>
            <p>If the request reaches inventory, billing or another system, first map the process, data, access, failure handling and ongoing ownership. That is a separate integration decision, not a hidden add-on.</p>
          </article>
        </div>
        <div className="split-section owner-tradeoffs">
          <div>
            <h3>Buy, configure or build?</h3>
            <p>Use an existing tool or managed product when it meets the need and the team can accept its recurring cost, data terms, limits and exit path. Custom software may fit when a distinctive workflow or integration justifies build, support and maintenance effort. Sometimes the best answer is to simplify the process and build nothing.</p>
          </div>
          <div>
            <h3>Keep sensitive work accountable.</h3>
            <p>For regulated needs, establish applicable requirements, authorized access, audit evidence, vendor agreements and independent review before choosing tools or implementation. AI is not compliance; any AI-assisted change still needs approved data boundaries, human review and testing.</p>
          </div>
        </div>
      </section>
      <section className="content-section split-section">
        <SectionHeading label="No surprises by design" title="Make the working agreement explicit." />
        <div><ul className="check-list">
          <li>Outcomes, scope, exclusions and acceptance criteria.</li>
          <li>Responsibilities, access needs and third-party dependencies.</li>
          <li>Review cadence, estimates and a process for scope changes.</li>
          <li>Training, documentation, ownership and any ongoing support boundaries.</li>
        </ul><p>Rates, timelines and commercial terms require a specific agreement. No payment terms, response-time guarantees or service levels are established by this site.</p></div>
      </section>
      <NextStep />
    </>
  );
}

function AboutPage() {
  return (
    <>
      <PageIntro label={`About ${brand.shortName}`} title="Technology should create a pathway, not another obstacle.">
        <p>{brand.name} {publicCopy("is built", "is a provisional consulting brand built")} around a practical idea: understand the problem, make a considered plan and help people use what gets built.</p>
      </PageIntro>
      <section className="content-section split-section">
        <SectionHeading label="The philosophy" title={brand.philosophy} />
        <div><p>Rethink what is possible by questioning assumptions. Create a pathway from an idea to something useful. Transform the business by helping people adopt, maintain and improve the result.</p><p>The game-plan language is intentional. Preparation matters, context changes the decision and the next move should serve the larger goal. The point is disciplined thinking—not sports metaphors in place of substance.</p></div>
      </section>
      <section className="content-section muted-section">
        <SectionHeading label="Working principles" title="Good judgment over fashionable technology." />
        <div className="stage-grid">
          <article className="stage-card"><h3>Understand before prescribing.</h3><p>Listen to business owners, users and technical teams. A recommendation needs a problem, constraints and a reason.</p></article>
          <article className="stage-card"><h3>Build for ownership.</h3><p>Prefer systems people can understand and maintain. Documentation, training and a practical handover are part of the work.</p></article>
          <article className="stage-card"><h3>Be honest about trade-offs.</h3><p>Make cost, risk, uncertainty and dependencies visible. A new platform, AI feature or rewrite is not inherently an improvement.</p></article>
        </div>
      </section>
      <section className="content-section split-section">
        <SectionHeading label="Where the work fits" title="Different scale. The same attention to fit." />
        <div><p>For small businesses, that means usable digital foundations and less fragmented day-to-day work. For established teams, it means focused engineering, architecture and leadership alongside the people already responsible for delivery.</p><p>{publicCopy("Explore the service areas to understand the approach, possible deliverables and decisions involved.", "This preview describes the service direction. It does not claim an approved legal identity, certifications, customer endorsements or published case-study results.")}</p><a className="text-link" href="/services">Explore the service areas <Arrow /></a></div>
      </section>
      <NextStep />
    </>
  );
}

function FaqPage() {
  return (
    <>
      <PageIntro label="Frequently asked questions" title="Useful answers before the first conversation."><p>What the service model includes, how decisions are made and what this site does not offer.</p></PageIntro>
      <section className="content-section faq-list" aria-label="Questions and answers">
        {faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
      </section>
      <NextStep />
    </>
  );
}

function ContactPage() {
  const { publicBrand } = presentation(import.meta.env);
  return (
    <>
      <PageIntro label="Discovery preparation / intake closed" title="A clearer brief is a better first move."><p>{publicCopy("Discovery booking and public inquiries are closed.", "Discovery booking and public inquiries are closed in this development preview.")} You can still prepare a useful outline of the problem—without sharing private information here.</p></PageIntro>
      <section className="content-section split-section">
        <SectionHeading label="Before a future conversation" title="Five things worth thinking through." />
        <ol className="preparation-list">
          <li><h3>The problem</h3><p>What is difficult today? Describe one concrete example and who it affects.</p></li>
          <li><h3>The desired change</h3><p>What would be meaningfully better? Think about time, reliability, customer experience or clearer decisions.</p></li>
          <li><h3>The current setup</h3><p>List the tools and systems involved, who owns them and what needs to keep working.</p></li>
          <li><h3>The constraints</h3><p>Note budget boundaries, timing, dependencies and any data or access restrictions.</p></li>
          <li><h3>The people</h3><p>Identify the decision-maker, the people doing the work and who would own the result.</p></li>
        </ol>
      </section>
      <section className="intake-panel" aria-labelledby="intake-title">
        <p className="eyebrow">{publicCopy("Discovery preparation", "Development preview")}</p><h2 id="intake-title">Intake status</h2>
        <LeadForm />
        {publicBrand && <p>Business line: <a href="tel:+12816927522">281-692-7522</a>. Discovery booking and public intake remain closed.</p>}
        <p>Do not share passwords, API keys, customer records or confidential business documents. This site has no live calendar or checkout.</p>
      </section>
      <section className="content-section">
        <SectionHeading label="Keep exploring" title="Get a feel for the right starting point." />
        <div className="related-links"><a href="/small-business">Small business solutions <Arrow /></a><a href="/enterprise">Enterprise engineering <Arrow /></a><a href="/faq">Read the FAQ <Arrow /></a></div>
      </section>
    </>
  );
}

function NotFound() {
  return <PageIntro label="Page not found" title="Let's find the next move."><p>This page is not part of this site.</p><a className="button" href="/">Return home <Arrow /></a></PageIntro>;
}

function resolvePage(path: string): { title: string; content: ReactNode } {
  const service = services.find((item) => path === `/services/${item.slug}`);
  if (service) return { title: service.name, content: <ServicePage service={service} /> };
  switch (path) {
    case "/": return { title: brand.philosophy, content: <Home /> };
    case "/small-business": return { title: "Small Business Solutions", content: <AudiencePage enterprise={false} /> };
    case "/enterprise": return { title: "Enterprise Engineering", content: <AudiencePage enterprise /> };
    case "/services": return { title: "Services", content: <ServicesPage /> };
    case "/approach": return { title: "Our Approach", content: <ApproachPage /> };
    case "/about": return { title: "About", content: <AboutPage /> };
    case "/faq": return { title: "Frequently Asked Questions", content: <FaqPage /> };
    case "/contact": return { title: "Discovery Preparation — Intake Closed", content: <ContactPage /> };
    default: return { title: "Page Not Found", content: <NotFound /> };
  }
}

export function PublicSite({ adminConfigured }: { adminConfigured: boolean }) {
  const { publicBrand } = presentation(import.meta.env);
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = resolvePage(path);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const config = presentation(import.meta.env);
    document.title = `${page.title} | ${brand.name}${config.publicBrand ? "" : " | Development preview"}`;
    if (config.origin) {
      let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.append(canonical);
      }
      canonical.href = `${config.origin}${path === "/" ? "/" : path}`;
    }
  }, [page.title, path]);

  return (
    <div className="public-site">
      <a className="skip" href="#main">Skip to content</a>
      <div className="preview-notice"><span>{publicCopy(brand.philosophy, "Development preview · Provisional brand")}</span><a href="/contact">Inquiries are not open yet <span aria-hidden="true">↗</span></a></div>
      <header className="site-header">
        <a className="brand-lockup" href="/" aria-label={`${brand.name} home`}>
          <span className="brand-symbol" aria-hidden="true">III<span>↗</span></span>
          <span>{brand.name}<small>{brand.philosophy}</small></span>
        </a>
        <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close menu" : "Menu"} <span aria-hidden="true">{menuOpen ? "−" : "+"}</span></button>
        <nav id="public-navigation" className={menuOpen ? "site-nav is-open" : "site-nav"} aria-label="Main navigation">
          {navigation.map((item) => <a key={item.href} href={item.href} aria-current={path === item.href || (item.href === "/services" && path.startsWith("/services/")) ? "page" : undefined}>{item.label}</a>)}
          <a className="nav-prepare" href="/contact" aria-current={path === "/contact" ? "page" : undefined}>Plan your next move <Arrow /></a>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {path !== "/" && <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span>{path.startsWith("/services/") && <><a href="/services">Services</a><span aria-hidden="true">/</span></>}<span aria-current="page">{page.title}</span></nav>}
        {page.content}
      </main>
      <footer className="site-footer">
        <div className="footer-top"><div><a className="footer-brand" href="/">{brand.shortName}</a><p>{brand.philosophy}</p><p>Practical technology.<br />A considered game plan.</p>{publicBrand && <p>Business line: <a href="tel:+12816927522">281-692-7522</a></p>}</div>
          <nav aria-label="Footer navigation"><a href="/services">Services</a><a href="/approach">Process & engagements</a><a href="/about">About</a><a href="/faq">FAQ</a><a href="/contact">Discovery preparation</a><a href="/?workspace">Team workspace</a>{adminConfigured && <a href="/?admin">Admin inbox</a>}</nav>
        </div>
        <div className="footer-bottom"><p>{publicCopy(`${brand.name} · ${brand.philosophy}`, `${brand.name} is a provisional display brand. Public launch remains subject to approval.`)}</p><p>{publicCopy("Intake closed. No booking or payment collection.", "Development preview. Intake closed. No booking or payment collection.")}</p></div>
      </footer>
    </div>
  );
}
