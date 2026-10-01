#!/usr/bin/env node
/**
 * validate-resume.mjs
 * ----------------------------------------------------------------------------
 * First step of `npm run build`. Checks public/resume.json against
 * public/resume.schema.json, then checks what a schema cannot: that every
 * project card image exists under public/ and every project `page` has a
 * matching public/projects/<slug>.json.
 *
 * Everything downstream — the site, the printable resume, the LaTeX PDF, and
 * the profile README — reads this file without defensive checks, so a typo'd
 * key or a renamed image would otherwise ship as a silently missing section or
 * a broken card. Failing here is cheaper than finding it on the live site.
 */

import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const readJson = async (file) => JSON.parse(await readFile(path.join(PUBLIC, file), 'utf8'));

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const [schema, resume] = await Promise.all([readJson('resume.schema.json'), readJson('resume.json')]);

  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const errors = validate(resume)
    ? []
    : validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`);

  for (const project of resume.projects ?? []) {
    if (project.image && !(await exists(path.join(PUBLIC, project.image)))) {
      errors.push(`/projects "${project.title}" image not found: public${project.image}`);
    }
    const slug = project.page?.match(/^\/projects\/([a-z0-9-]+)\/$/)?.[1];
    if (slug && !(await exists(path.join(PUBLIC, 'projects', `${slug}.json`)))) {
      errors.push(`/projects "${project.title}" page has no source: public/projects/${slug}.json`);
    }
  }

  if (errors.length) {
    console.error(`resume.json failed validation:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log('  resume.json valid');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
