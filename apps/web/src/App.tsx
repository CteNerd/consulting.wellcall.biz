import { brand } from "./branding.ts";
import { LeadForm } from "./LeadForm.tsx";
import "./style.css";

export function App() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header>
        <p className="wordmark">{brand.name}</p>
        <nav aria-label="Main navigation"><a href="#approach">Our approach</a><a href="#services">Services</a></nav>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="headline">
          <p className="eyebrow">Development preview / provisional brand</p>
          <h1 id="headline">Every great idea deserves a game plan.</h1>
          <p className="lead">{brand.philosophy}</p>
          <p>Practical engineering, architecture and technology leadership for small businesses and established teams.</p>
          <a className="button" href="#services">Explore the direction</a>
        </section>
        <section id="approach" aria-labelledby="approach-title">
          <h2 id="approach-title">From possibility to measurable change.</h2>
          <div className="cards">
            <article><span>01</span><h3>Rethink</h3><p>Understand the problem, challenge assumptions and choose the right next move.</p></article>
            <article><span>02</span><h3>Create</h3><p>Build a practical pathway from a promising idea to a working implementation.</p></article>
            <article><span>03</span><h3>Transform</h3><p>Support adoption, measure results and keep improving how the business works.</p></article>
          </div>
        </section>
        <section id="services" aria-labelledby="services-title">
          <h2 id="services-title">A foundation for what comes next.</h2>
          <ul><li>Digital foundations</li><li>Engineering, AI and automation</li><li>Fractional technology leadership</li></ul>
          <LeadForm />
        </section>
      </main>
      <footer>Development preview. Brand and public launch remain subject to approval.</footer>
    </>
  );
}
