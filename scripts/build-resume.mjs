#!/usr/bin/env node
/**
 * build-resume.mjs
 * ----------------------------------------------------------------------------
 * Generates docs/resume/index.html from public/resume.json — the same data the
 * site and the profile README consume, so the resume can never drift from them.
 *
 * On screen it matches the site's black-and-gold theme. Printing (or "Save as
 * PDF") switches to black-on-white via a print media query: dark backgrounds
 * waste ink and many PDF pipelines drop them anyway, and a light document is
 * what a recruiter or an ATS expects.
 *
 * Deliberately omits any current-employer framing — the data file is the source
 * of truth for what is and is not public.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SITE = 'https://luke-angelo.com';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function render(resume) {
  const { meta } = resume;

  const experience = resume.experience
    .map(
      (e) => `<article class="entry">
      <div class="entry-head">
        <h3>${esc(e.role)}</h3><span class="dates">${esc(e.dates)}</span>
      </div>
      <p class="org">${esc(e.company)}</p>
      <ul>${e.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </article>`
    )
    .join('\n');

  const skills = resume.skillGroups
    .map((g) => `<div class="skill-row"><dt>${esc(g.title)}</dt><dd>${g.items.map(esc).join(' · ')}</dd></div>`)
    .join('');

  const education = resume.education
    .map(
      (ed) => `<article class="entry">
      <div class="entry-head"><h3>${esc(ed.degree)}</h3><span class="dates">${esc(ed.dates)}</span></div>
      <p class="org">${esc(ed.school)}</p>
      <p class="detail">${ed.details.map(esc).join(' · ')}</p>
    </article>`
    )
    .join('\n');

  const projects = resume.projects
    .filter((p) => p.page)
    .map(
      (p) => `<li><strong>${esc(p.title)}</strong> — ${esc(p.text)}${
        p.repo ? ` <span class="url">${esc(p.repo.replace('https://', ''))}</span>` : ''
      }</li>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(meta.name)} — Résumé</title>
<meta name="description" content="Résumé of ${esc(meta.name)}, ${esc(meta.title)}." />
<link rel="canonical" href="${SITE}/resume/" />
<link rel="icon" type="image/png" href="/assets/brand-mark.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
:root{--ink:#030303;--paper:#0a0a0d;--text:#ece6d8;--muted:#a39c8e;--faint:#8a8378;--gold:#f7d98c;--gold-deep:#d4a23d;--line:rgba(212,162,61,.18);--display:'Space Grotesk',system-ui,sans-serif;--body:'Inter',system-ui,sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--ink);color:var(--text);font-family:var(--body);line-height:1.55;font-size:15px}
a{color:inherit;text-decoration:none}
:where(a,button):focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:6px}
.bar{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 24px;background:rgba(3,3,3,.8);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.bar a{font-family:var(--display);font-size:14px;color:var(--muted)}
.bar a:hover{color:var(--gold)}
.btn{border:1px solid var(--line);border-radius:99px;padding:8px 18px;color:var(--gold);cursor:pointer;background:transparent;font-family:var(--display);font-size:14px}
.btn:hover{background:rgba(212,162,61,.12)}
.sheet{max-width:820px;margin:0 auto;padding:44px 28px 72px}
header.top{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:26px}
h1{font-family:var(--display);font-size:clamp(30px,5vw,42px);letter-spacing:-.01em;color:var(--gold)}
.role{font-family:var(--display);font-size:16px;color:var(--muted);margin-top:4px}
.contact{margin-top:12px;font-size:14px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 18px}
.contact a:hover{color:var(--gold)}
.summary{margin-top:16px;color:var(--text);max-width:68ch}
section{margin-top:30px}
h2{font-family:var(--display);font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep);border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:14px}
.entry{margin-bottom:18px;break-inside:avoid}
.entry-head{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}
.entry h3{font-family:var(--display);font-size:16px}
.dates{font-size:13px;color:var(--faint);white-space:nowrap}
.org{font-size:14px;color:var(--gold-deep);margin-bottom:6px}
.detail{font-size:14px;color:var(--muted)}
ul{list-style:none;display:grid;gap:5px}
.entry li{position:relative;padding-left:16px;font-size:14.5px}
.entry li::before{content:"";position:absolute;left:0;top:9px;width:5px;height:5px;border-radius:50%;background:var(--gold-deep)}
.skill-row{display:grid;grid-template-columns:190px 1fr;gap:10px;padding:5px 0;break-inside:avoid}
.skill-row dt{font-family:var(--display);font-size:13.5px;color:var(--gold)}
.skill-row dd{font-size:14px;color:var(--muted)}
.projects li{padding-left:16px;position:relative;margin-bottom:7px;font-size:14.5px}
.projects li::before{content:"";position:absolute;left:0;top:9px;width:5px;height:5px;border-radius:50%;background:var(--gold-deep)}
.projects strong{color:var(--gold)}
.url{color:var(--faint);font-size:13px}
.signals li{padding-left:16px;position:relative;margin-bottom:5px;font-size:14.5px;color:var(--muted)}
.signals li::before{content:"";position:absolute;left:0;top:9px;width:5px;height:5px;border-radius:50%;background:var(--gold-deep)}

/* Print: swap to a light document. Dark fills waste ink and several PDF
   pipelines drop background colours entirely, which would leave pale gold
   text on white. */
@media print{
  @page{margin:14mm}
  body{background:#fff;color:#111;font-size:10.5pt;line-height:1.4}
  .bar{display:none}
  .sheet{max-width:none;margin:0;padding:0}
  h1{color:#111;font-size:24pt}
  h2{color:#111;border-bottom:1px solid #bbb;font-size:9pt}
  .role,.contact,.detail,.skill-row dd,.signals li{color:#333}
  .org,.projects strong,.skill-row dt{color:#111}
  .dates,.url{color:#555}
  header.top{border-bottom:1px solid #bbb}
  .entry li::before,.projects li::before,.signals li::before{background:#666}
  a{color:#111}
  section{margin-top:14pt}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
</head>
<body>
<nav class="bar">
  <a href="/">← ${esc(meta.name)}</a>
  <button class="btn" type="button" onclick="window.print()">Download PDF</button>
</nav>

<div class="sheet">
  <header class="top">
    <h1>${esc(meta.name)}</h1>
    <p class="role">${esc(meta.role ?? meta.title)}</p>
    <div class="contact">
      <a href="mailto:${esc(meta.email)}">${esc(meta.email)}</a>
      <a href="${esc(meta.website)}">${esc(meta.website.replace('https://', ''))}</a>
      <a href="${esc(meta.githubUrl)}">github.com/${esc(meta.github)}</a>
      <a href="${esc(meta.linkedin)}">LinkedIn</a>
    </div>
    <p class="summary">${esc(meta.summary)}</p>
  </header>

  <section><h2>Experience</h2>${experience}</section>
  <section><h2>Skills</h2><dl>${skills}</dl></section>
  <section><h2>Selected work</h2><ul class="projects">${projects}</ul></section>
  <section><h2>Education</h2>${education}</section>
  <section><h2>Additional</h2><ul class="signals">${resume.supportingSignals
    .map((s) => `<li>${esc(s)}</li>`)
    .join('')}</ul></section>
</div>
</body>
</html>
`;
}

async function main() {
  const resume = JSON.parse(await readFile(path.join(ROOT, 'public', 'resume.json'), 'utf8'));
  const dir = path.join(ROOT, 'docs', 'resume');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), render(resume), 'utf8');
  console.log('  built /resume/');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
