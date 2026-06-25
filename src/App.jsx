/**
 * App.jsx
 * ----------------------------------------------------------------------------
 * The UI layer. Deliberately minimal so the 3D experience stays center stage:
 * thin glass panels, gold gradient type, and content that reveals itself as
 * the visitor scrolls. All page content lives in the data arrays up top so
 * copy edits never require touching markup.
 */

import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import profileImage from '../assets/optimized/fullstrazz-hero.jpg';
import buddy from '../assets/optimized/buddy-card.png';
import toonverse from '../assets/optimized/toonverse-card.png';
import brandMark from '../assets/noBGlogo.png';

// The 3D scene is code-split so the UI paints instantly.
const Experience = lazy(() => import('./Experience'));

/* --------------------------------- content -------------------------------- */

const quickFacts = [
  { label: 'Current Role', value: 'Developer Team Lead · Saberin Software' },
  { label: 'Focus', value: 'AI features, cloud delivery, identity, full-stack' },
  { label: 'Trajectory', value: 'Intern to team lead since 2023' }
];

const capabilities = [
  {
    title: 'Full-stack delivery',
    text: 'Production work across C#, .NET, React, JavaScript, TypeScript, SQL, and REST APIs, with a strong emphasis on stable releases and maintainable code.'
  },
  {
    title: 'AI and automation',
    text: 'Hands-on delivery with Azure OpenAI, the OpenAI API, prompt engineering, GitHub Copilot, and agent-assisted workflows for internal and customer-facing tools.'
  },
  {
    title: 'Cloud and identity',
    text: 'Azure and AWS experience spanning Entra ID, Azure AD B2C, app registrations, Blob Storage, Data Factory, EC2, S3, IAM, and CloudFront.'
  },
  {
    title: 'Team execution',
    text: 'Comfortable owning architecture, configuration, deployment, debugging, documentation, and stakeholder communication from kickoff through release.'
  }
];

const skillGroups = [
  {
    title: 'Languages & Frameworks',
    items: ['C#', '.NET', 'C++', 'JavaScript', 'TypeScript', 'React', 'SQL']
  },
  {
    title: 'AI & Automation',
    items: ['Azure OpenAI', 'OpenAI API', 'AI Agents', 'Prompt Engineering', 'GitHub Copilot']
  },
  {
    title: 'Cloud & DevOps',
    items: [
      'Microsoft Azure',
      'Entra ID / Azure AD',
      'Azure AD B2C',
      'Blob Storage',
      'Data Factory',
      'App Registrations',
      'AWS EC2',
      'AWS S3',
      'AWS IAM',
      'CloudFront',
      'CI/CD Pipelines',
      'YAML',
      'Azure DevOps',
      'GitHub Actions',
      'Git'
    ]
  },
  {
    title: 'Engineering & Architecture',
    items: [
      'REST APIs',
      'Cloud Identity & Access Management',
      'Application Configuration & Deployment',
      'Cloud Resource Definitions',
      'Secure Application Development',
      'Debugging',
      'API Design'
    ]
  },
  {
    title: 'Tools & Workflow',
    items: ['Visual Studio', 'GitHub', 'Jira', 'Confluence', 'Agile Development', 'Documentation', 'Communication']
  }
];

const experience = [
  {
    company: 'Saberin Software',
    role: 'Developer Team Lead',
    dates: 'Apr 2025 — Present',
    points: [
      'Lead production development for .NET applications, reviewing code for quality, security, performance, and long-term maintainability.',
      'Designed and shipped AI-powered features using Azure OpenAI for both internal workflows and customer-facing experiences.',
      'Own Azure delivery across subscriptions, Entra ID, Azure AD B2C, app registrations, Blob Storage, and Data Factory resources.'
    ]
  },
  {
    company: 'Saberin Software',
    role: 'Junior Software Developer',
    dates: 'Dec 2024 — Apr 2025',
    points: [
      'Built and deployed cloud-hosted applications across Azure and AWS, including EC2, S3, IAM, CloudFront, and Azure storage services.',
      'Maintained YAML-based CI/CD pipelines in Azure DevOps and GitHub Actions to support repeatable deployments.',
      'Delivered application features across APIs, configuration, and debugging workflows while collaborating directly with stakeholders.'
    ]
  },
  {
    company: 'Saberin Software',
    role: 'Entry Level Developer',
    dates: 'Aug 2023 — Dec 2024',
    points: [
      'Used GitHub Copilot and AI agent workflows to accelerate implementation, documentation, and troubleshooting without lowering code quality.',
      'Contributed to React and .NET application work, API integrations, SQL-backed flows, and production issue resolution.',
      'Grew from task execution into feature ownership while balancing software delivery with a full academic schedule.'
    ]
  },
  {
    company: 'Saberin Software',
    role: 'Software Developer Intern',
    dates: 'May 2023 — Aug 2023',
    points: [
      'Entered the team through hands-on production work with a strong focus on debugging, secure development practices, and reliability.',
      'Built the foundation for the intern-to-team-lead progression by showing consistency, communication, and ownership early.',
      'Worked inside established engineering workflows using Git, Visual Studio, Jira, Confluence, and team documentation standards.'
    ]
  }
];

const projects = [
  {
    title: 'Saberin Software',
    label: 'Production delivery',
    image: profileImage,
    text: 'Secure .NET delivery, AI integration, cloud identity work, team leadership, and shipping features that hold up in production.'
  },
  {
    title: 'VitalVues',
    label: 'OpenAI application',
    image: toonverse,
    text: 'An AI diet and workout planner built around the OpenAI API, prompt design, recommendation flows, and a clean user-facing experience.'
  },
  {
    title: 'StrazzTunedBuddy',
    label: 'Embedded side project',
    image: buddy,
    text: 'A hardware-focused project proving out C++ and embedded tinkering while still showing personality and design instinct.'
  }
];

const supportingSignals = [
  'B.S. in Computer Science from Farmingdale State College, completed January 2025 with a 3.65 GPA.',
  "President's List 2023 and Dean's List 2023 to 2024.",
  'Strong communicator with experience translating technical work for stakeholders, teammates, and clients.',
  'Built professional discipline in high-pressure service roles before moving full-time into software.'
];

const workingStyle = [
  'Agile development',
  'Client communication',
  'Technical documentation',
  'Mentorship',
  'Cross-functional teamwork',
  'Production debugging'
];

const navItems = [
  { label: 'About', href: '#about' },
  { label: 'Skills', href: '#skills' },
  { label: 'Experience', href: '#experience' },
  { label: 'Work', href: '#work' },
  { label: 'Contact', href: '#contact' }
];

/* --------------------------------- helpers -------------------------------- */

/**
 * Drops back to lighter effects on small screens, touch devices, and for
 * visitors who prefer reduced motion. Mirrored onto <html> as a class so
 * CSS can react too.
 */
function useAdaptiveEffects() {
  const [reducedEffects, setReducedEffects] = useState(false);

  useEffect(() => {
    const mediaQueries = [
      window.matchMedia('(max-width: 960px)'),
      window.matchMedia('(pointer: coarse)'),
      window.matchMedia('(hover: none)'),
      window.matchMedia('(prefers-reduced-motion: reduce)')
    ];

    const sync = () => {
      const matches = mediaQueries.some((query) => query.matches);
      setReducedEffects(matches);
      document.documentElement.classList.toggle('reduced-effects', matches);
    };

    sync();
    mediaQueries.forEach((query) => query.addEventListener('change', sync));

    return () => {
      mediaQueries.forEach((query) => query.removeEventListener('change', sync));
      document.documentElement.classList.remove('reduced-effects');
    };
  }, []);

  return reducedEffects;
}

/**
 * Reveal-on-scroll wrapper: starts hidden, fades and rises into place the
 * first time it enters the viewport. `delay` staggers siblings.
 */
function Reveal({ as: Tag = 'div', className = '', delay = 0, children }) {
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
    <Tag ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
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
  const reducedEffects = useAdaptiveEffects();

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="site" id="top">
      {/* Fixed 3D backdrop — everything else floats above it. */}
      <div className="experience-layer" aria-hidden="true">
        <Suspense fallback={<div className="experience-fallback" />}>
          <Experience reducedEffects={reducedEffects} />
        </Suspense>
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
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <a className="button button-ghost topbar-cta" href="mailto:lukestrazzera@gmail.com">
          Get in touch
        </a>
      </header>

      <main className="page">
        {/* ------------------------------ hero ------------------------------ */}
        <section className="hero">
          <Reveal className="hero-inner">
            <p className="eyebrow hero-eyebrow">AI · Cloud · Full‑Stack Engineering</p>
            <h1 className="hero-title">
              Luke‑Angelo
              <br />
              <span className="gradient-text">Strazzera</span>
            </h1>
            <p className="hero-sub">
              Software engineer building secure applications, modern interfaces, and production-ready systems — across
              C#, .NET, React, Azure, AWS, and OpenAI-powered workflows.
            </p>

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
            {quickFacts.map((fact) => (
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
              {capabilities.map((capability, index) => (
                <Reveal as="article" className="card" key={capability.title} delay={index * 90}>
                  <h3>{capability.title}</h3>
                  <p>{capability.text}</p>
                </Reveal>
              ))}
            </div>
            <div className="signal-row">
              {supportingSignals.map((signal) => (
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
              {skillGroups.map((group, index) => (
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
              {experience.map((entry, index) => (
                <Reveal as="article" className="timeline-item" key={entry.role} delay={index * 100}>
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
              {projects.map((project, index) => (
                <Reveal as="article" className="project-card" key={project.title} delay={index * 110}>
                  <div className="project-image">
                    <img src={project.image} alt={project.title} loading="lazy" decoding="async" />
                  </div>
                  <div className="project-copy">
                    <p className="project-label">{project.label}</p>
                    <h3>{project.title}</h3>
                    <p>{project.text}</p>
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
            <a className="contact-email gradient-text" href="mailto:lukestrazzera@gmail.com">
              lukestrazzera@gmail.com
            </a>
            <div className="contact-actions">
              <a className="button button-primary" href="mailto:lukestrazzera@gmail.com">
                Email me
              </a>
              <a className="button button-ghost" href="https://github.com/LukeStrazz" target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a
                className="button button-ghost"
                href="https://www.linkedin.com/in/luke-angelo-strazzera-83b7171b4"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
              </a>
            </div>
            <div className="chips working-style">
              {workingStyle.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Luke‑Angelo Strazzera</p>
      </footer>

      <button className="back-to-top" type="button" onClick={scrollToTop} aria-label="Back to top">
        ↑
      </button>
    </div>
  );
}
