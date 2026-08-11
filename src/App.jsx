/**
 * App.jsx
 * ----------------------------------------------------------------------------
 * The UI layer. Deliberately minimal so the 3D experience stays center stage:
 * thin glass panels, gold gradient type, and content that reveals itself as
 * the visitor scrolls.
 *
 * All copy lives in /public/resume.json — the same file the GitHub profile
 * README is generated from — so updating one JSON file keeps this site and
 * the README in sync. Fetched at runtime from /resume.json (see useResume
 * below); project card images stay local bundled assets, matched by key.
 */

import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import brandMark from '../assets/noBGlogo.png';

// The 3D scene is code-split so the UI paints instantly.
const Experience = lazy(() => import('./Experience'));

/** Fetches the shared resume.json data source once on mount. */
function useResume() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/resume.json')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => console.error('Failed to load resume.json', err));

    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

/* --------------------------------- helpers -------------------------------- */

/**
 * Drops back to lighter effects on small screens, touch devices, and for
 * visitors who prefer reduced motion. Mirrored onto <html> as a class so
 * CSS can react too.
 *
 * `prefersReducedMotion` is reported separately because it means something
 * stronger than "go lighter": those visitors skip the 3D scene entirely, so
 * the three.js chunk is never fetched for them.
 */
const EFFECT_QUERIES = ['(max-width: 960px)', '(pointer: coarse)', '(hover: none)'];
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Reads the queries synchronously so the first render already knows. */
function readEffectState() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return { reducedEffects: false, prefersReducedMotion: false };
  }
  const prefersReducedMotion = window.matchMedia(MOTION_QUERY).matches;
  const reducedEffects =
    prefersReducedMotion || EFFECT_QUERIES.some((q) => window.matchMedia(q).matches);
  return { reducedEffects, prefersReducedMotion };
}

function useAdaptiveEffects() {
  // Must be a lazy initialiser, not `false`: with a deferred value the first
  // render mounts <Experience> and fires its dynamic import before the effect
  // runs, so the three.js chunk downloads even for reduced-motion visitors.
  const [state, setState] = useState(readEffectState);

  useEffect(() => {
    const motionQuery = window.matchMedia(MOTION_QUERY);
    const mediaQueries = [...EFFECT_QUERIES.map((q) => window.matchMedia(q)), motionQuery];

    const sync = () => {
      const matches = mediaQueries.some((query) => query.matches);
      setState({ reducedEffects: matches, prefersReducedMotion: motionQuery.matches });
      document.documentElement.classList.toggle('reduced-effects', matches);
    };

    sync();
    mediaQueries.forEach((query) => query.addEventListener('change', sync));

    return () => {
      mediaQueries.forEach((query) => query.removeEventListener('change', sync));
      document.documentElement.classList.remove('reduced-effects');
    };
  }, []);

  return state;
}

/**
 * Reveal-on-scroll wrapper: starts hidden, fades and rises into place the
 * first time it enters the viewport. `delay` staggers siblings.
 */
function Reveal({ as: Tag = 'div', className = '', delay = 0, children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Thin gold bar across the top of the viewport tracking scroll progress. */
function ScrollProgress() {
  const bar = useRef(null);

  useEffect(() => {
    const update = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      if (bar.current) bar.current.style.transform = `scaleX(${window.scrollY / max})`;
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return <div className="scroll-progress" ref={bar} aria-hidden="true" />;
}

function SectionHeader({ eyebrow, title, body }) {
  return (
    <header className="section-header">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {body ? <p className="section-body">{body}</p> : null}
    </header>
  );
}

/* ----------------------------------- app ---------------------------------- */

export default function App() {
  const { reducedEffects, prefersReducedMotion } = useAdaptiveEffects();
  const resume = useResume();

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="site" id="top">
      {/* Fixed 3D backdrop — everything else floats above it. Visitors who ask
          for reduced motion get the static gradient instead, which also means
          the three.js chunk is never requested for them. */}
      <div className="experience-layer" aria-hidden="true">
        {prefersReducedMotion ? (
          <div className="experience-fallback" />
        ) : (
          <Suspense fallback={<div className="experience-fallback" />}>
            <Experience reducedEffects={reducedEffects} />
          </Suspense>
        )}
      </div>
      {/* Radial vignette keeps text readable against the bright core. */}
      <div className="vignette" aria-hidden="true" />
      {/* Black veil that lifts as the black hole ignites on first load. */}
      <div className="intro-veil" aria-hidden="true" />

      <ScrollProgress />

      <header className="topbar">
        <a className="brand" href="#top">
          <img className="brand-mark" src={brandMark} alt="" />
          <span className="brand-name">
            Luke‑Angelo <em>Strazzera</em>
          </span>
        </a>

        <nav className="nav" aria-label="Primary">
          {(resume?.nav ?? []).map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <a className="button button-ghost topbar-cta" href="mailto:lukestrazzera@gmail.com">
          Get in touch
        </a>
      </header>

      {!resume ? null : (
        <>
          <main className="page">
            {/* ------------------------------ hero ------------------------------ */}
            <section className="hero">
              <Reveal className="hero-inner">
                <p className="eyebrow hero-eyebrow">{resume.meta.tagline}</p>
                <h1 className="hero-title">
                  {resume.meta.heroFirstLine}
                  <br />
                  <span className="gradient-text">{resume.meta.heroLastLine}</span>
                </h1>
                <p className="hero-sub">{resume.meta.summary}</p>

                <div className="hero-actions">
                  <a className="button button-primary" href="#work">
                    View work
                  </a>
                  <a className="button button-ghost" href="#experience">
                    Experience
                  </a>
                </div>
              </Reveal>

              <Reveal className="hero-stats" delay={2600}>
                {resume.quickFacts.map((fact) => (
                  <article className="stat" key={fact.label}>
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </article>
                ))}
              </Reveal>

              <a className="scroll-cue" href="#about" aria-label="Scroll to content">
                <span />
              </a>
            </section>

            {/* ------------------------------ about ----------------------------- */}
            <section className="section" id="about">
              <Reveal className="panel">
                <SectionHeader
                  eyebrow="What I bring"
                  title="Engineering depth, delivery discipline."
                  body="Not one tool — the combination of technical range, growth speed, and client-facing communication."
                />
                <div className="card-grid">
                  {resume.capabilities.map((capability, index) => (
                    <Reveal as="article" className="card" key={capability.title} delay={index * 90}>
                      <h3>{capability.title}</h3>
                      <p>{capability.text}</p>
                    </Reveal>
                  ))}
                </div>
                <div className="signal-row">
                  {resume.supportingSignals.map((signal) => (
                    <p key={signal}>{signal}</p>
                  ))}
                </div>
              </Reveal>
            </section>

            {/* ------------------------------ skills ---------------------------- */}
            <section className="section" id="skills">
              <Reveal className="panel">
                <SectionHeader
                  eyebrow="Skills"
                  title="Tools and systems I actively work with."
                  body="Engineering fundamentals, cloud delivery, AI integration, and team execution."
                />
                <div className="skills-grid">
                  {resume.skillGroups.map((group, index) => (
                    <Reveal as="article" className="skill-card" key={group.title} delay={index * 80}>
                      <h3>{group.title}</h3>
                      <div className="chips">
                        {group.items.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    </Reveal>
                  ))}
                </div>
              </Reveal>
            </section>

            {/* ---------------------------- experience --------------------------- */}
            <section className="section" id="experience">
              <Reveal className="panel">
                <SectionHeader
                  eyebrow="Experience"
                  title="A fast progression backed by real production responsibility."
                  body="Intern to team lead in under two years — the timeline shows both pace and range."
                />
                <div className="timeline">
                  {resume.experience.map((entry, index) => (
                    <Reveal as="article" className="timeline-item" key={`${entry.role}-${entry.dates}`} delay={index * 100}>
                      <div className="timeline-marker" aria-hidden="true" />
                      <div className="timeline-card">
                        <div className="timeline-head">
                          <div>
                            <p>{entry.company}</p>
                            <h3>{entry.role}</h3>
                          </div>
                          <span>{entry.dates}</span>
                        </div>
                        <ul>
                          {entry.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </Reveal>
            </section>

            {/* ------------------------------- work ------------------------------ */}
            <section className="section" id="work">
              <Reveal className="panel">
                <SectionHeader
                  eyebrow="Selected work"
                  title="Projects and roles that reinforce the skill set."
                  body="Enterprise delivery, AI product work, and enough curiosity to keep building outside the day job."
                />
                <div className="project-grid">
                  {resume.projects.map((project, index) => (
                    <Reveal
                      as={project.page ? 'a' : 'article'}
                      className={`project-card${project.page ? ' project-card-link' : ''}`}
                      key={project.title}
                      delay={index * 110}
                      href={project.page}
                    >
                      {/* Covers are plain URLs under /assets, so adding or swapping
                          one is a resume.json edit — no import or rebuild of code. */}
                      <div className="project-image">
                        <img src={project.image} alt={project.title} loading="lazy" decoding="async" />
                      </div>
                      <div className="project-copy">
                        <p className="project-label">{project.label}</p>
                        <h3>{project.title}</h3>
                        <p>{project.text}</p>
                        {project.page ? <span className="project-more">Read more →</span> : null}
                      </div>
                    </Reveal>
                  ))}
                </div>
              </Reveal>
            </section>

            {/* ------------------------------ contact ---------------------------- */}
            <section className="section" id="contact">
              <Reveal className="panel contact-panel">
                <SectionHeader
                  eyebrow="Contact"
                  title="Open to strong teams, useful products, and ambitious technical work."
                  body="If the role values engineering range, clear communication, and a bias toward ownership — there's probably a fit."
                />
                <a className="contact-email gradient-text" href={`mailto:${resume.meta.email}`}>
                  {resume.meta.email}
                </a>
                <div className="contact-actions">
                  <a className="button button-primary" href={`mailto:${resume.meta.email}`}>
                    Email me
                  </a>
                  <a className="button button-ghost" href={resume.meta.githubUrl} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                  <a className="button button-ghost" href={resume.meta.linkedin} target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                </div>
                <div className="chips working-style">
                  {resume.workingStyle.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </Reveal>
            </section>
          </main>

          <footer className="footer">
            <p>© {new Date().getFullYear()} {resume.meta.name}</p>
          </footer>

          <button className="back-to-top" type="button" onClick={scrollToTop} aria-label="Back to top">
            ↑
          </button>
        </>
      )}
    </div>
  );
}
