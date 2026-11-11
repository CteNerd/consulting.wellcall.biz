import { useEffect, useState, type ReactNode } from "react";
import { brand } from "./branding.ts";
import { presentation, publicCopy } from "./presentation.ts";
import { engagementModels, faqs, services, stages, type Service } from "./site-content.ts";
import { portfolioProjects, type PortfolioProject } from "./project-content.ts";
import { getPublicPageMetadata, publicPageMetadata } from "./route-metadata.ts";
import "./public-site.css";

const navigation = [
  { href: "/small-business", label: "Small business" },
  { href: "/enterprise", label: "Enterprise" },
  { href: "/work", label: "Work" },
  { href: "/services", label: "Services" },
  { href: "/approach", label: "Our approach" },
  { href: "/approach#owner-directed", label: "Owner-directed software" },
  { href: "/about", label: "About" },
];

export const publicRoutes = publicPageMetadata.map((page) => page.path);

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

function ServiceCards() {
  return (
    <div className="service-grid">
      {services.map((service) => (
        <article className="service-tile" key={service.slug}>
          <h3><a href={`/services/${service.slug}`}>{service.name} <Arrow /></a></h3>
          <p className="service-fit">{service.fit}</p>
          <p className="tile-note"><strong>Example output:</strong> {service.deliverables[0]}</p>
          <a className="text-link" href={`/services/${service.slug}`}>View details <Arrow /></a>
        </article>
      ))}
    </div>
  );
}

const approvedProjects = portfolioProjects.filter((project) => project.ownerApproval === "approved");

function ProjectCard({ project, compact = false }: { project: PortfolioProject; compact?: boolean }) {
  const statusLabel = {
    "in-use": "In use",
    "in-progress": "In progress",
    experimental: "Experiment",
  }[project.status];

  return (
    <article id={project.slug} className={compact ? "project-card project-card-compact" : "project-card"}>
      <div className="project-card-top">
        <p className="eyebrow">{project.category}</p>
        <span className={`project-status project-status-${project.status}`}>{statusLabel}</span>
      </div>
      <h3>{project.name}</h3>
      <p className="project-challenge"><strong>Challenge:</strong> {project.challenge}</p>
      {!compact && (
        <>
          <p><strong>Decision:</strong> {project.decision}</p>
          <h4>Work and evidence</h4>
          <ul className="project-work-list">{project.work.map((item) => <li key={item}>{item}</li>)}</ul>
          {project.verifiedOutcome && <p className="project-outcome"><strong>Verified now:</strong> {project.verifiedOutcome}</p>}
          {project.nextStep && <p className="project-next-step"><strong>Next:</strong> {project.nextStep}</p>}
          <div className="project-evidence">
            {project.evidenceLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <Arrow /></a>)}
          </div>
        </>
      )}
      {compact && <a className="text-link" href={`/work#${project.slug}`}>Explore project <Arrow /></a>}
    </article>
  );
}

function SelectedWork() {
  return (
    <section className="content-section selected-work">
      <SectionHeading label="Selected work" title="Real systems, with status and scope made clear.">
        Examples of delivered and active work—not hypothetical scenarios or promised results.
      </SectionHeading>
      <div className="project-grid">
        {approvedProjects.filter((project) => project.relationship !== "founder-experiment").slice(0, 3)
          .map((project) => <ProjectCard key={project.slug} project={project} compact />)}
      </div>
      <a className="text-link" href="/work">See all work and experiments <Arrow /></a>
    </section>
  );
}

function WorkPage() {
  const clientProjects = approvedProjects.filter((project) => project.relationship !== "founder-experiment");
  const experiments = approvedProjects.filter((project) => project.relationship === "founder-experiment");
  return (
    <>
      <PageIntro label="Work" title="Real work, with status and scope made clear.">
        <p>Each project distinguishes what is in use, what is still in progress and what is an independent experiment. No customer data, invented metrics or unverified outcomes.</p>
      </PageIntro>
      <section className="content-section" aria-label="Client work">
        <SectionHeading label="Client work" title="Implemented work and current engagements." />
        <div className="project-grid project-grid-detailed">{clientProjects.map((project) => <ProjectCard key={project.slug} project={project} />)}</div>
      </section>
      <section className="content-section muted-section" aria-label="Founder experiments and products">
        <SectionHeading label="Separate from client engagements" title="Experiments and products." />
        <div className="project-grid project-grid-detailed">{experiments.map((project) => <ProjectCard key={project.slug} project={project} />)}</div>
      </section>
    </>
  );
}

function Home() {
  return (
    <>
      <section className="home-hero" aria-labelledby="page-title">
        <div className="hero-content">
          <p className="eyebrow">Technology consulting for growing businesses and engineering teams</p>
          <h1 id="page-title">Technology that earns its place in your business.</h1>
          <p className="hero-description">We help businesses decide what to buy, connect, improve or build—and make the right choice work in the real world.</p>
          <p className="hero-philosophy">{brand.philosophy}</p>
          <p className="hero-supporting">Every great idea deserves a game plan.</p>
          <div className="hero-actions">
            <a className="button" href="/work">See our work <Arrow /></a>
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
          Choose the situation that sounds familiar. The right next step depends on the work, not a predetermined service.
        </SectionHeading>
        <div className="problem-grid">
          <article className="problem-card">
            <span className="card-index">01 / GROWING BUSINESS</span>
            <h3>My business is growing; my tools are slowing me down.</h3>
            <p>Improve digital foundations and practical workflows sized to the business.</p>
            <a className="text-link" href="/small-business">Explore business foundations <Arrow /></a>
          </article>
          <article className="problem-card">
            <span className="card-index">02 / TECHNOLOGY DECISION</span>
            <h3>I have an idea. Do I buy it, connect tools, or build?</h3>
            <p>Assess the options, test a proof of concept when useful, and understand ownership.</p>
            <a className="text-link" href="/approach#owner-directed">Explore the decision process <Arrow /></a>
          </article>
          <article className="problem-card">
            <span className="card-index">03 / ENGINEERING COMPLEXITY</span>
            <h3>My systems are expensive or difficult to change.</h3>
            <p>Improve architecture, delivery and operating costs without assuming a full rebuild.</p>
            <a className="text-link" href="/enterprise">Explore engineering support <Arrow /></a>
          </article>
        </div>
      </section>
      <SelectedWork />
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
    </>
  );
}

function SmallBusinessPage() {
  const r3Project = approvedProjects.find((project) => project.slug === "r3-counseling");
  return (
    <>
      <PageIntro label="Small business" title="A website should help customers—and make the business easier to run.">
        <p>Start with the customer journey and the work your team repeats. Choose tools you can afford, understand and own.</p>
      </PageIntro>
      <section className="content-section">
        <SectionHeading label="Recognizable owner problems" title="Start with one point of friction." />
        <div className="problem-grid">
          <article className="problem-card"><span className="card-index">01 / CUSTOMER JOURNEY</span><h3>People cannot quickly find you or take the next step.</h3><p>Clarify what you offer, make contact information easy to find, and test the mobile experience.</p></article>
          <article className="problem-card"><span className="card-index">02 / REPEATED WORK</span><h3>Routine work depends on copying and chasing.</h3><p>Map the handoffs, simplify the process, and connect existing tools only when it helps.</p></article>
          <article className="problem-card"><span className="card-index">03 / TOOL CHOICE</span><h3>You need a better tool without buying a bigger problem.</h3><p>Compare managed products, configuration and custom work against cost and ownership.</p></article>
        </div>
      </section>
      <section className="content-section split-section muted-section">
        <SectionHeading label="A scoped engagement" title="Make the most useful change manageable." />
        <div>
          <p>Agree the customer or staff journey to improve, the tools and accounts involved, the cost boundary, and who will own the result.</p>
          <ul className="check-list">
            <li>A prioritized foundation plan that separates essentials from nice-to-haves.</li>
            <li>A tested website, tool setup or workflow change with clear acceptance checks.</li>
            <li>Training and handover so everyday updates do not depend on a developer.</li>
          </ul>
        </div>
      </section>
      {r3Project && <section className="content-section">
        <SectionHeading label="Relevant work" title="An actively used business website." />
        <div className="project-grid"><ProjectCard project={r3Project} compact /></div>
      </section>}
      <section className="content-section">
        <SectionHeading label="Relevant capabilities" title="Bring in only the help this work needs." />
        <ul className="related-links compact-links">
          <li><a href="/services/digital-foundations">Digital Foundations <Arrow /></a></li>
          <li><a href="/services/ai-automation">AI &amp; Automation <Arrow /></a></li>
          <li><a href="/services/fractional-leadership">Fractional Technology Leadership <Arrow /></a></li>
        </ul>
      </section>
    </>
  );
}

function EnterprisePage() {
  return (
    <>
      <PageIntro label="Enterprise engineering" title="Help your team deliver with a clearer direction.">
        <p>Focused architecture, technical leadership and hands-on engineering can complement an existing team. Work within real constraints, not an idealized greenfield system.</p>
      </PageIntro>
      <section className="content-section">
        <SectionHeading label="Engineering challenges" title="Find the constraint behind the symptom." />
        <div className="problem-grid">
          <article className="problem-card"><span className="card-index">01 / RELEASES</span><h3>Releases are fragile or difficult to roll back.</h3><p>Map the delivery path and agree acceptance, test and recovery checks.</p></article>
          <article className="problem-card"><span className="card-index">02 / ARCHITECTURE</span><h3>Dependencies and integration ownership are unclear.</h3><p>Document system boundaries, decision owners, risks and workable options.</p></article>
          <article className="problem-card"><span className="card-index">03 / OPERATIONS</span><h3>Cloud spend or AI workflow quality is hard to explain.</h3><p>Establish a baseline, operating responsibility and the evidence needed to evaluate changes.</p></article>
        </div>
      </section>
      <section className="content-section muted-section">
        <SectionHeading label="Support for the team" title="Leadership, architecture and delivery each have a job." />
        <div className="stage-grid">
          <article className="stage-card"><h3>Technical leadership</h3><p>Connect business priorities to an owned roadmap, decision record and review cadence.</p></article>
          <article className="stage-card"><h3>Architecture</h3><p>Make dependencies, integration boundaries, trade-offs and operational risks visible.</p></article>
          <article className="stage-card"><h3>Delivery</h3><p>Shape a bounded backlog with acceptance checks, test evidence, rollback and handover.</p></article>
        </div>
        <p className="experience-note">Founder background includes engineering leadership, enterprise architecture and delivery management. This describes professional experience, not a claim that employer projects were Third Down engagements.</p>
      </section>
      <section className="content-section split-section">
        <SectionHeading label="Work with the people who own it" title="An outside perspective should strengthen internal ownership." />
        <div><p>Agree decision rights, access controls, data boundaries and working practices before making changes. The team keeps ownership; a fractional leader or engineer adds focused capacity around the decisions and work in scope.</p>
          <ul className="related-links compact-links">
            <li><a href="/services/engineering-solutions">Engineering Solutions <Arrow /></a></li>
            <li><a href="/services/fractional-leadership">Fractional Technology Leadership <Arrow /></a></li>
            <li><a href="/services/cloud-cost-optimization">Cloud Cost Optimization <Arrow /></a></li>
          </ul>
        </div>
      </section>
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
    </>
  );
}

function ApproachPage() {
  return (
    <>
      <PageIntro label="Our approach" title="Work in clear stages, with decisions along the way.">
        <p>Rethink the problem, create a practical solution and transform how the work gets done. Each stage has an output, an owner and a decision checkpoint.</p>
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
        <SectionHeading label="Owner-directed software" title="Describe the outcome. Engineering makes the change safe to own.">
          The people closest to the work should be able to explain what needs to change. Software changes remain reviewed, tested and maintainable.
        </SectionHeading>
        <div className="stage-grid">
          <article className="stage-card">
            <span className="stage-number">01 / DESCRIBE</span>
            <h3>Start with the work.</h3>
            <p>Note who is affected, what happens today and what would be better. Keep the request focused on an observable outcome.</p>
          </article>
          <article className="stage-card">
            <span className="stage-number">02 / REVIEW</span>
            <h3>Make a small change inspectable.</h3>
            <p>Engineering checks assumptions, access and edge cases, then defines acceptance checks, testing, owner review and handover.</p>
          </article>
          <article className="stage-card">
            <span className="stage-number">03 / EXPAND</span>
            <h3>Scope connections separately.</h3>
            <p>Integrations need a process map, approved data and access, failure handling and an ongoing owner—not a hidden add-on.</p>
          </article>
        </div>
        <div className="split-section owner-tradeoffs">
          <div>
            <h3>Buy, configure or build?</h3>
            <p>Prefer an existing tool when it meets the need and the team accepts its cost, data terms and limits. Build only when the workflow justifies implementation and maintenance; sometimes the right change is to simplify and build nothing.</p>
          </div>
          <div>
            <h3>Protect data and ownership.</h3>
            <p>Confirm applicable requirements, authorized access, vendor terms and independent review before regulated work. AI is not compliance: use approved data, human review and testing. Every engagement includes an explicit scope-change and handover plan.</p>
          </div>
        </div>
      </section>
    </>
  );
}

function AboutPage() {
  return (
    <>
      <PageIntro label={`About ${brand.shortName}`} title="Good technology decisions start with understanding the work.">
        <p>I’m Roderick C. Tomlin II, founder of {brand.shortName}. I help business owners and engineering teams choose practical technology and make it useful in the real world.</p>
      </PageIntro>
      <section className="content-section split-section">
        <SectionHeading label="Why Third Down exists" title="Judgment first. Implementation when it earns its place." />
        <div>
          <p>My background spans engineering leadership, enterprise architecture and delivery management, along with hands-on software and product implementation. That mix helps connect business priorities to the system details a team needs to deliver and own its work.</p>
          <p>Prior service and professional football also shaped how I think about preparation, clear roles and follow-through. They inform my approach; the work itself is technology consulting.</p>
          <p>{publicCopy("Third Down Technologies puts that approach into practice.", "Third Down Technologies is a provisional display brand; publication does not establish legal clearance.")}</p>
        </div>
      </section>
      <section className="content-section muted-section">
        <SectionHeading label="Working principles" title="Useful work over fashionable technology." />
        <div className="stage-grid">
          <article className="stage-card"><h3>Understand before prescribing.</h3><p>Listen to business owners, users and technical teams. A recommendation needs a problem, constraints and a reason.</p></article>
          <article className="stage-card"><h3>Build for ownership.</h3><p>Prefer systems people can understand and maintain. Documentation, training and a practical handover are part of the work.</p></article>
          <article className="stage-card"><h3>Be honest about trade-offs.</h3><p>Make cost, risk, uncertainty and dependencies visible. A new platform, AI feature or rewrite is not inherently an improvement.</p></article>
        </div>
      </section>
      <section className="content-section">
        <SectionHeading label="Rethink. Create. Transform." title="The same discipline, at the scale the work needs." />
        <ul className="related-links compact-links"><li><a href="/work">Selected work <Arrow /></a></li><li><a href="/small-business">Small business solutions <Arrow /></a></li><li><a href="/enterprise">Enterprise engineering <Arrow /></a></li><li><a href="/approach">How engagements work <Arrow /></a></li></ul>
      </section>
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
    </>
  );
}

function ContactPage() {
  return (
    <>
      <PageIntro label="Contact / current status" title="Public inquiries and discovery booking are closed.">
        <p>This page is preparation guidance only; it does not send an inquiry. Use it to organize a brief without sharing private information.</p>
      </PageIntro>
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
        <p className="eyebrow">A safe first step</p><h2 id="intake-title">Keep the outline private for now.</h2>
        <p>There is no live inquiry form, calendar or checkout. Do not share passwords, API keys, customer records or confidential business documents here.</p>
      </section>
      <section className="content-section">
        <SectionHeading label="Keep exploring" title="Get a feel for the right starting point." />
        <div className="related-links"><a href="/small-business">Small business solutions <Arrow /></a><a href="/enterprise">Enterprise engineering <Arrow /></a><a href="/faq">Read the FAQ <Arrow /></a></div>
      </section>
    </>
  );
}

function NotFound() {
  return <PageIntro label="Page not found" title="This page is not available."><p>Use the site navigation to continue.</p><a className="button" href="/">Return home <Arrow /></a></PageIntro>;
}

function setMetaContent(attribute: "name" | "property", key: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }
  meta.content = content;
}

function resolvePage(path: string): { title: string; description: string; content: ReactNode } {
  const { title, description } = getPublicPageMetadata(path);
  const service = services.find((item) => path === `/services/${item.slug}`);
  if (service) return { title, description, content: <ServicePage service={service} /> };
  let content: ReactNode;
  switch (path) {
    case "/": content = <Home />; break;
    case "/small-business": content = <SmallBusinessPage />; break;
    case "/enterprise": content = <EnterprisePage />; break;
    case "/work": content = <WorkPage />; break;
    case "/services": content = <ServicesPage />; break;
    case "/approach": content = <ApproachPage />; break;
    case "/about": content = <AboutPage />; break;
    case "/faq": content = <FaqPage />; break;
    case "/contact": content = <ContactPage />; break;
    default: content = <NotFound />;
  }
  return { title, description, content };
}

export function PublicSite() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = resolvePage(path);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const config = presentation(import.meta.env);
    document.title = `${brand.name} | ${page.title}${config.publicBrand ? "" : " | Development preview"}`;
    setMetaContent("name", "description", page.description);
    if (config.origin) {
      let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.append(canonical);
      }
      const routeUrl = `${config.origin}${path === "/" ? "/" : path}`;
      canonical.href = routeUrl;
      setMetaContent("property", "og:title", document.title);
      setMetaContent("property", "og:description", page.description);
      setMetaContent("property", "og:url", routeUrl);
      setMetaContent("name", "twitter:title", document.title);
      setMetaContent("name", "twitter:description", page.description);
    }
  }, [page.description, page.title, path]);

  return (
    <div className="public-site">
      <a className="skip" href="#main">Skip to content</a>
      <div className="preview-notice"><span>{publicCopy(brand.philosophy, "Development preview · Provisional brand")}</span></div>
      <header className="site-header">
        <a className="brand-lockup" href="/" aria-label={`${brand.name} home`}>
          <span className="brand-symbol" aria-hidden="true">III<span>↗</span></span>
          <span>{brand.name}<small>Technology consulting</small></span>
        </a>
        <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close menu" : "Menu"} <span aria-hidden="true">{menuOpen ? "−" : "+"}</span></button>
        <nav id="public-navigation" className={menuOpen ? "site-nav is-open" : "site-nav"} aria-label="Main navigation">
          {navigation.map((item) => <a key={item.href} href={item.href} aria-current={path === item.href || (item.href === "/services" && path.startsWith("/services/")) ? "page" : undefined}>{item.label}</a>)}
          <a className="nav-prepare" href="/contact" aria-current={path === "/contact" ? "page" : undefined}>Contact <Arrow /></a>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {path !== "/" && <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span>{path.startsWith("/services/") && <><a href="/services">Services</a><span aria-hidden="true">/</span></>}<span aria-current="page">{page.title}</span></nav>}
        {page.content}
      </main>
      <footer className="site-footer">
        <div className="footer-top"><div><a className="footer-brand" href="/">{brand.shortName}</a><p>Practical technology.<br />A considered game plan.</p></div>
          <nav aria-label="Footer navigation"><a href="/services">Services</a><a href="/approach">Process &amp; engagements</a><a href="/about">About</a><a href="/faq">FAQ</a><a href="/contact">Contact status</a></nav>
        </div>
        <div className="footer-bottom"><p>{publicCopy(brand.name, `${brand.name} is a provisional display brand. Public launch remains subject to approval.`)}</p></div>
      </footer>
    </div>
  );
}
