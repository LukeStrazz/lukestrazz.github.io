#!/usr/bin/env node
/**
 * github-mirror.mjs
 * ----------------------------------------------------------------------------
 * Turns the built docs/ into the lukestrazz.github.io copy of the site: every
 * page becomes a redirect to the same path on luke-angelo.com.
 *
 * The site is served by Cloudflare Pages at luke-angelo.com; deploy.yml also
 * publishes this build to GitHub Pages, which left a second full copy of the
 * site indexable at lukestrazz.github.io. GitHub Pages can't send HTTP
 * redirects, so each page is replaced with an instant meta refresh (which
 * search engines treat as a permanent redirect) plus a script that keeps the
 * #fragment, and a canonical link to the real URL.
 *
 * Data files stay: the profile README sync reads /resume.json from here. The
 * résumé PDF and LaTeX source go, since they can't redirect and would remain
 * duplicate copies. Run only in the GitHub Pages job — never before the
 * Cloudflare build, which publishes docs/ as-is.
 */

import { readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(__dirname, '..', 'docs');
const SITE = 'https://luke-angelo.com';

const REMOVE = ['_headers', 'resume/Luke-Angelo-Strazzera-Resume.pdf', 'resume/Luke-Angelo-Strazzera-Resume.tex'];

function stub(url) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Moved to luke-angelo.com</title>
<link rel="canonical" href="${url}" />
<meta http-equiv="refresh" content="0; url=${url}" />
<script>location.replace(${JSON.stringify(url)} + location.search + location.hash);</script>
</head>
<body>
<p>This site has moved to <a href="${url}">${url}</a>.</p>
</body>
</html>
`;
}

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

async function main() {
  for (const file of await htmlFiles(DOCS)) {
    const rel = path.relative(DOCS, file).split(path.sep).join('/');
    // The 404 page must stay a real 404, not redirect to one.
    if (rel === '404.html') continue;
    const urlPath = rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
    await writeFile(file, stub(`${SITE}${urlPath}`), 'utf8');
    console.log(`  ${urlPath} → ${SITE}${urlPath}`);
  }

  for (const rel of REMOVE) await rm(path.join(DOCS, rel), { force: true });
  console.log(`  removed ${REMOVE.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
