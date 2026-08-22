#!/usr/bin/env node
/**
 * build-projects.mjs
 * ----------------------------------------------------------------------------
 * Generates a static page per project into docs/projects/<slug>/index.html,
 * plus docs/sitemap.xml covering the whole site.
 *
 * Runs after `vite build` (see package.json). Each project is described by its
 * own file in public/projects/*.json — kept separate from resume.json so the
 * resume payload the site and profile README share stays small.
 *
 * Public projects get live GitHub figures (stars, forks, language, last push)
 * fetched at build time and baked into the HTML. That is deliberate: the README
 * previously leaned on third-party stat widgets that went down and rendered
 * broken images, so this owns the data instead. A failed fetch degrades to
 * omitting the figures rather than failing the build.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'public', 'projects');
const OUT_DIR = path.join(ROOT, 'docs', 'projects');
const SITE = 'https://luke-angelo.com';

/* ------------------------------ helpers ---------------------------------- */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function fetchRepoStats(repo) {
  if (!repo) return null;
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'luke-angelo-site-build' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const d = await res.json();
    return {
      stars: d.stargazers_count,
      forks: d.forks_count,
      language: d.language,
      pushedAt: d.pushed_at ? d.pushed_at.slice(0, 10) : null,
      url: d.html_url
    };
  } catch (err) {
    console.warn(`  ! GitHub stats unavailable for ${repo}: ${err.message}`);
    return null;
  }
}

/* ------------------------------ rendering -------------------------------- */

function renderStats(stats, project) {
  const cells = [];
  if (stats) {
    if (stats.stars) cells.push(['Stars', stats.stars.toLocaleString()]);
    if (stats.forks) cells.push(['Forks', stats.forks.toLocaleString()]);
    if (stats.language) cells.push(['Primary language', stats.language]);
    if (stats.pushedAt) cells.push(['Last commit', stats.pushedAt]);
  }
  if (project.year) cells.push(['Year', project.year]);
  if (project.role) cells.push(['Role', project.role]);
  if (!cells.length) return '';

  return `<dl class="stats">${cells
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join('')}</dl>`;
}

function renderGallery(project) {
  const items = project.gallery ?? [];
  const note = project.galleryNote
    ? `<p class="note">${esc(project.galleryNote)}</p>`
    : '';
  if (!items.length) return note;

  const figures = items
    .map(
      (item) => `<figure${item.wide ? ' class="wide"' : ''}>
        <a href="/assets/projects/${esc(project.slug)}/${esc(item.src)}" target="_blank" rel="noreferrer">
          <img src="/assets/projects/${esc(project.slug)}/${esc(item.src)}" alt="${esc(item.caption)}" loading="lazy" decoding="async" />
        </a>
        <figcaption>${esc(item.caption)}</figcaption>
      </figure>`
    )
    .join('\n');

  // Nearest-neighbour scaling suits low-resolution pixel art (the OLED frames)
  // but smears UI screenshots, so it is opt-in per project.
  const cls = project.pixelated ? 'gallery gallery-pixel' : 'gallery';
  return `<div class="${cls}">${figures}</div>${note}`;
}

function renderList(title, items) {
  if (!items?.length) return '';
  return `<section><h2>${esc(title)}</h2><ul class="prose-list">${items
    .map((i) => `<li>${esc(i)}</li>`)
    .join('')}</ul></section>`;
}

function renderPage(project, stats) {
  const isPrivate = project.visibility === 'private';
  const badge = isPrivate
    ? '<span class="badge badge-private">Private repository</span>'
    : '<span class="badge">Open source</span>';

  const links = (project.links ?? [])
    .map((l) => `<a class="button" href="${esc(l.href)}" target="_blank" rel="noreferrer">${esc(l.label)}</a>`)
    .join('');

  const chips = (project.stack ?? []).map((s) => `<span>${esc(s)}</span>`).join('');

  // Social scrapers ignore SVG, so a project only supplies its own preview when
  // that image is a raster; otherwise it falls back to the site-wide card.
  const ogImage = /\.(png|jpe?g)$/i.test(project.ogImage ?? '') ? project.ogImage : '/assets/og.png';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(project.title)} — Luke-Angelo Strazzera</title>
<meta name="description" content="${esc(project.tagline)}" />
<link rel="canonical" href="${SITE}/projects/${esc(project.slug)}/" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Luke-Angelo Strazzera" />
<meta property="og:url" content="${SITE}/projects/${esc(project.slug)}/" />
<meta property="og:title" content="${esc(project.title)} — Luke-Angelo Strazzera" />
<meta property="og:description" content="${esc(project.tagline)}" />
<meta property="og:image" content="${SITE}${esc(ogImage)}" />
<meta property="og:image:alt" content="${esc(project.title)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(project.title)} — Luke-Angelo Strazzera" />
<meta name="twitter:description" content="${esc(project.tagline)}" />
<meta name="twitter:image" content="${SITE}${esc(ogImage)}" />
<link rel="icon" type="image/png" href="/assets/brand-mark.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/projects/project.css" />
</head>
<body>
<header class="topbar">
  <a class="brand" href="/"><img src="/assets/brand-mark.png" alt="" /><span>Luke‑Angelo <em>Strazzera</em></span></a>
  <a class="back" href="/#work">← All work</a>
</header>

<main>
  <article class="page">
    <p class="eyebrow">${badge}</p>
    <h1>${esc(project.title)}</h1>
    <p class="tagline">${esc(project.tagline)}</p>

    ${renderStats(stats, project)}

    <section><h2>Overview</h2><p class="lede">${esc(project.summary)}</p></section>

    ${renderGallery(project)}

    ${renderList('Highlights', project.highlights)}

    <section>
      <h2>Stack</h2>
      <div class="chips">${chips}</div>
    </section>

    ${renderList('How it was built', project.methodology)}

    ${links ? `<section><h2>Links</h2><div class="actions">${links}</div></section>` : ''}
  </article>
</main>

<footer class="footer">
  <p>© ${new Date().getFullYear()} Luke‑Angelo Strazzera · <a href="/">luke-angelo.com</a></p>
</footer>
</body>
</html>
`;
}

/* -------------------------------- styles --------------------------------- */

const CSS = `/* Generated by scripts/build-projects.mjs — shared by every project page.
   Mirrors the tokens in src/styles.css so the pages read as one site. */
:root{--ink-950:#030303;--ink-900:#0a0a0d;--gold-200:#ffeebc;--gold-300:#f7d98c;--gold-400:#e8bc5a;--gold-500:#d4a23d;--gold-700:#8a6420;--text:#ece6d8;--muted:#a39c8e;--faint:#6f6a60;--line:rgba(212,162,61,.16);--line-strong:rgba(212,162,61,.38);--glass:rgba(8,8,11,.58);--font-display:'Space Grotesk',system-ui,sans-serif;--font-body:'Inter',system-ui,sans-serif;--radius:20px;--radius-sm:12px}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--ink-950);color:var(--text);font-family:var(--font-body);font-size:16px;line-height:1.7;-webkit-font-smoothing:antialiased;background-image:radial-gradient(60% 50% at 85% 0%,rgba(212,162,61,.10),transparent 70%);background-repeat:no-repeat}
img{display:block;max-width:100%}
a{color:inherit;text-decoration:none}
::selection{background:var(--gold-500);color:var(--ink-950)}
.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;background:rgba(3,3,3,.72);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:12px;font-family:var(--font-display);font-weight:600;letter-spacing:.2px}
.brand img{width:34px}
.brand em{font-style:normal;color:var(--gold-300)}
.back{color:var(--muted);font-size:14px;border:1px solid var(--line);padding:8px 14px;border-radius:999px;transition:color .2s,border-color .2s}
.back:hover{color:var(--gold-300);border-color:var(--line-strong)}
main{padding:56px 24px 80px}
.page{max-width:860px;margin:0 auto}
.eyebrow{margin-bottom:18px}
.badge{display:inline-block;font-family:var(--font-display);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-300);border:1px solid var(--line-strong);border-radius:999px;padding:6px 14px}
.badge-private{color:var(--muted);border-color:var(--line)}
h1{font-family:var(--font-display);font-size:clamp(36px,6vw,60px);line-height:1.05;letter-spacing:-.02em;background:linear-gradient(120deg,var(--gold-200),var(--gold-300) 40%,var(--gold-500) 75%,var(--gold-700));-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:14px}
.tagline{color:var(--muted);font-size:clamp(17px,2.2vw,20px);max-width:60ch}
h2{font-family:var(--font-display);font-size:20px;letter-spacing:.01em;color:var(--gold-300);margin-bottom:14px}
section{margin-top:44px}
.lede{max-width:70ch}
.prose-list{list-style:none;display:grid;gap:12px;max-width:72ch}
.prose-list li{position:relative;padding-left:22px;color:var(--text)}
.prose-list li::before{content:"";position:absolute;left:0;top:11px;width:7px;height:7px;border-radius:50%;background:var(--gold-500)}
.stats{margin-top:32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.stats>div{background:var(--glass);border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px 16px}
.stats dt{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-bottom:6px}
.stats dd{font-family:var(--font-display);font-size:18px;color:var(--gold-200)}
.gallery{margin-top:44px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}
.gallery figure{background:var(--glass);border:1px solid var(--line);border-radius:var(--radius);padding:14px;transition:border-color .25s,transform .25s}
.gallery figure:hover{border-color:var(--line-strong);transform:translateY(-3px)}
.gallery img{width:100%;border-radius:var(--radius-sm);background:#060608}
.gallery-pixel img{image-rendering:pixelated}
.gallery figcaption{margin-top:10px;font-size:13px;color:var(--muted);text-align:center}
.gallery figure.wide{grid-column:1/-1}
.gallery figure.wide img{max-height:none}
.note{margin-top:18px;font-size:14px;color:var(--faint);border-left:2px solid var(--line-strong);padding-left:14px;max-width:70ch}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips span{font-size:13px;color:var(--gold-300);background:rgba(212,162,61,.07);border:1px solid var(--line);border-radius:999px;padding:6px 13px}
.actions{display:flex;flex-wrap:wrap;gap:12px}
.button{font-family:var(--font-display);font-size:14px;border:1px solid var(--line-strong);border-radius:999px;padding:11px 20px;color:var(--gold-200);transition:background .2s,transform .2s}
.button:hover{background:rgba(212,162,61,.12);transform:translateY(-2px)}
.footer{border-top:1px solid var(--line);padding:26px 24px;text-align:center;color:var(--faint);font-size:14px}
.footer a{color:var(--gold-300)}
:where(a,button):focus-visible{outline:2px solid var(--gold-300);outline-offset:3px;border-radius:6px}
@media (max-width:640px){main{padding:36px 18px 60px}.topbar{padding:14px 16px}.brand span{display:none}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

/* --------------------------------- main ---------------------------------- */

async function main() {
  let files;
  try {
    files = (await readdir(SRC_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    console.log('No public/projects directory — skipping project pages.');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'project.css'), CSS, 'utf8');

  const slugs = [];
  for (const file of files) {
    const project = JSON.parse(await readFile(path.join(SRC_DIR, file), 'utf8'));
    const stats = await fetchRepoStats(project.repo);
    const dir = path.join(OUT_DIR, project.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), renderPage(project, stats), 'utf8');
    slugs.push(project.slug);
    const starNote = stats?.stars ? ` (${stats.stars}★)` : '';
    console.log(`  built /projects/${project.slug}/${starNote}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/resume/`, priority: '0.9' },
    ...slugs.sort().map((s) => ({ loc: `${SITE}/projects/${s}/`, priority: '0.8' }))
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join('\n')}
</urlset>
`;
  await writeFile(path.join(ROOT, 'docs', 'sitemap.xml'), sitemap, 'utf8');
  console.log(`  sitemap.xml — ${urls.length} URLs`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
