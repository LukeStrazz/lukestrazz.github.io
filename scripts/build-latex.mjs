#!/usr/bin/env node
/**
 * build-latex.mjs
 * ----------------------------------------------------------------------------
 * Generates a LaTeX résumé from public/resume.json and compiles it to PDF:
 *
 *   docs/resume/Luke-Angelo-Strazzera-Resume.tex
 *   docs/resume/Luke-Angelo-Strazzera-Resume.pdf
 *
 * The .tex is pure ASCII (every non-ASCII character is mapped to a LaTeX
 * command), so it compiles unchanged under pdfLaTeX, XeLaTeX, LuaLaTeX,
 * Tectonic, or Overleaf.
 *
 * Compilation uses Tectonic (see lib/tectonic.mjs, which fetches a pinned
 * release when none is installed). If no binary can be had, the .tex is still
 * written and the PDF is skipped — except in CI, where a missing PDF would ship
 * a dead download link, so the build fails.
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveTectonic } from './lib/tectonic.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASENAME = 'Luke-Angelo-Strazzera-Resume';

// Characters the data file actually uses. Anything else non-ASCII fails the
// build rather than silently rendering as a missing glyph.
const UNICODE = {
  '‑': '-', // non-breaking hyphen in the name
  '—': '---',
  '–': '--',
  '·': '\\textperiodcentered{}',
  '★': '$\\star$',
  'é': "\\'e",
  '’': "'",
  '‘': '`',
  '“': '``',
  '”': "''"
};

function tex(s) {
  const escaped = String(s)
    .replace(/\\/g, '\u0000')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\u0000/g, '\\textbackslash{}')
    .replace(/[^\x00-\x7f]/g, (ch) => {
      if (ch in UNICODE) return UNICODE[ch];
      throw new Error(`build-latex: no LaTeX mapping for "${ch}" (U+${ch.codePointAt(0).toString(16)}) in: ${s}`);
    });
  return escaped;
}

const url = (u) => String(u).replace(/([%#])/g, '\\$1');
const bare = (u) => tex(u.replace(/^https?:\/\//, '').replace(/\/$/, ''));

/**
 * Layouts tried in order until the PDF fits on one page. Each step tightens
 * spacing first and only then trims bullets, oldest roles first — `caps[i]`
 * is the most bullets shown for experience entry i. The current role is never
 * trimmed. The site and the HTML
 * resume always show every bullet; only the PDF is held to one page.
 */
const FITS = [
  { margin: '0.55in', spread: 1, gap: '8pt', caps: [] },
  { margin: '0.5in', spread: 0.97, gap: '6pt', caps: [5, 3, 2, 2, 1] },
  { margin: '0.45in', spread: 0.95, gap: '5pt', caps: [5, 3, 2, 1, 1] },
  { margin: '0.4in', spread: 0.93, gap: '4pt', caps: [5, 3, 1, 1, 1] }
];

function render(resume, fit) {
  const { meta } = resume;

  const contact = [
    `\\href{mailto:${url(meta.email)}}{${tex(meta.email)}}`,
    `\\href{${url(meta.website)}}{${bare(meta.website)}}`,
    `\\href{${url(meta.githubUrl)}}{github.com/${tex(meta.github)}}`,
    `\\href{${url(meta.linkedin)}}{LinkedIn}`
  ].join(' \\quad\\textbar\\quad ');

  // Consecutive roles at one company share a single company line, so a
  // promotion history reads as a progression instead of repeating the name.
  const experience = resume.experience
    .map((e, i, all) => {
      const points = e.points.slice(0, fit.caps[i] ?? e.points.length);
      const company = all[i - 1]?.company === e.company ? '' : tex(e.company);
      const list = points.length
        ? `\n\\begin{itemize}\n${points.map((p) => `  \\item ${tex(p)}`).join('\n')}\n\\end{itemize}`
        : '';
      return `\\entry{${tex(e.role)}}{${tex(e.dates)}}{${company}}${list}`;
    })
    .join('\n\n');

  const skills = resume.skillGroups
    .map((g) => `\\textbf{${tex(g.title)}:} ${g.items.map(tex).join(', ')}\\par`)
    .join('\n');

  const projects = resume.projects
    .filter((p) => p.page)
    .map(
      (p) =>
        `  \\item \\textbf{${tex(p.title)}} --- ${tex(p.text)}${
          p.repo ? ` \\href{${url(p.repo)}}{\\footnotesize ${bare(p.repo)}}` : ''
        }`
    )
    .join('\n');

  const education = resume.education
    .map(
      (ed) =>
        `\\textbf{${tex(ed.degree)}}, \\textit{${tex(ed.school)}}\\hfill{\\small ${tex(ed.dates)}}\\par
${ed.details.map(tex).join(' \\textperiodcentered{} ')}\\par`
    )
    .join('\n\n');

  return `% ${tex(meta.name)} -- resume
% Generated from ${url(meta.website)}/resume.json by scripts/build-latex.mjs.
% Pure ASCII: compiles with pdfLaTeX, XeLaTeX, LuaLaTeX, Tectonic, or Overleaf.
\\documentclass[10pt,letterpaper]{article}

\\usepackage[margin=${fit.margin}]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{textcomp}
\\usepackage{microtype}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage[hidelinks]{hyperref}

\\hypersetup{pdftitle={${tex(meta.name)} -- Resume}, pdfauthor={${tex(meta.name)}}}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\linespread{${fit.spread}}
\\raggedright

\\titleformat{\\section}{\\large\\bfseries\\scshape}{}{0pt}{}[\\vspace{1pt}\\titlerule]
\\titlespacing*{\\section}{0pt}{${fit.gap}}{3pt}
\\setlist[itemize]{leftmargin=1.2em, topsep=1pt, itemsep=0.5pt, parsep=0pt}

% \\entry{title}{dates}{organization}; an empty organization is omitted.
\\newcommand{\\entry}[3]{%
  \\par\\vspace{3pt}\\textbf{#1}\\hfill{\\small #2}\\par
  \\if\\relax\\detokenize{#3}\\relax\\else\\textit{#3}\\par\\fi}

\\begin{document}

\\begin{center}
  {\\Huge\\bfseries ${tex(meta.name)}}\\\\[3pt]
  {\\large ${tex(meta.role ?? meta.title)}}\\\\[4pt]
  {\\small ${contact}}
\\end{center}

${tex(meta.summary)}

\\section{Experience}
${experience}

\\section{Skills}
{\\setlength{\\parskip}{1.5pt}
${skills}
}

\\section{Selected Work}
\\begin{itemize}
${projects}
\\end{itemize}

\\section{Education}
${education}

\\end{document}
`;
}

async function main() {
  const resume = JSON.parse(await readFile(path.join(ROOT, 'public', 'resume.json'), 'utf8'));
  const dir = path.join(ROOT, 'docs', 'resume');
  await mkdir(dir, { recursive: true });
  const texPath = path.join(dir, `${BASENAME}.tex`);
  await writeFile(texPath, render(resume, FITS[0]), 'utf8');

  let tectonic = null;
  try {
    tectonic = await resolveTectonic(ROOT);
  } catch (err) {
    console.warn(`  ${err.message}`);
  }
  if (!tectonic) {
    if (process.env.CI) throw new Error('build-latex: tectonic is required in CI to publish the PDF');
    console.warn('  tectonic unavailable — wrote the .tex, skipped the PDF');
    return;
  }

  // Compile each layout until one fits on a single page; the page count comes
  // from the engine's log ("Output written on ... (N pages").
  const logPath = path.join(dir, `${BASENAME}.log`);
  for (const [level, fit] of FITS.entries()) {
    await writeFile(texPath, render(resume, fit), 'utf8');
    execFileSync(tectonic, ['--keep-logs', '--outdir', dir, texPath], { stdio: ['ignore', 'ignore', 'inherit'] });
    const pages = Number((await readFile(logPath, 'utf8')).match(/\((\d+) pages?/)?.[1]);
    await rm(logPath, { force: true });
    if (pages === 1) {
      console.log(`  built /resume/${BASENAME}.pdf (1 page, layout ${level})`);
      return;
    }
  }
  throw new Error(`build-latex: resume does not fit on one page even at the tightest layout — trim resume.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
