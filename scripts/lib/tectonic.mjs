/**
 * tectonic.mjs
 * ----------------------------------------------------------------------------
 * Resolves a Tectonic binary for build-latex.mjs, in order:
 *
 *   1. $TECTONIC, if set
 *   2. `tectonic` on PATH
 *   3. a pinned release downloaded into node_modules/.cache, checksum-verified
 *
 * Step 3 is what makes the build self-contained. The site is built by two
 * hosts — GitHub Actions and Cloudflare Pages — and only one of them can be
 * given an install step. Cloudflare's build image has no Tectonic, so a build
 * that assumed one shipped nothing at all and left the custom domain serving a
 * weeks-old deploy. Downloading here means every host runs the same build.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const VERSION = '0.17.0';

// From the GitHub release's published asset digests.
const SHA256 = {
  'aarch64-apple-darwin': 'a3f1cac7c5678f01661a92212f58480ae3b0634115d880dbc59e2953ded45667',
  'x86_64-apple-darwin': '7c90ef5b6ddb1eb1937e4337add5237b79338e4b9676459fa91187d24d6cdf80',
  'aarch64-unknown-linux-musl': 'b10954a95404f3ab2328d2fa59a5ebab8e657f893fab096f98be8db7c0c979b8',
  'x86_64-unknown-linux-musl': '8533d07f9ccbd7a65824b9e0459041bca34af1eb33daba48f59215593753a3b7'
};

function target() {
  const arch = { arm64: 'aarch64', x64: 'x86_64' }[os.arch()];
  const platform = { darwin: 'apple-darwin', linux: 'unknown-linux-musl' }[os.platform()];
  return arch && platform ? `${arch}-${platform}` : null;
}

function onPath(bin) {
  try {
    execFileSync(bin, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function download(root) {
  const triple = target();
  if (!triple) return null;

  const dir = path.join(root, 'node_modules', '.cache', `tectonic-${VERSION}`);
  const bin = path.join(dir, 'tectonic');
  try {
    await access(bin);
    return bin;
  } catch {}

  const name = `tectonic-${VERSION}-${triple}.tar.gz`;
  const url = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${VERSION}/${name}`;
  console.log(`  fetching ${name}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tectonic download failed: ${res.status} ${url}`);
  const archive = Buffer.from(await res.arrayBuffer());

  const digest = createHash('sha256').update(archive).digest('hex');
  if (digest !== SHA256[triple]) throw new Error(`tectonic checksum mismatch for ${name}`);

  await mkdir(dir, { recursive: true });
  const tarball = path.join(dir, name);
  await writeFile(tarball, archive);
  execFileSync('tar', ['-xzf', tarball, '-C', dir]);
  await rm(tarball);
  await chmod(bin, 0o755);
  return bin;
}

/** Returns a runnable Tectonic path, or null when none can be found or fetched. */
export async function resolveTectonic(root) {
  if (process.env.TECTONIC) return process.env.TECTONIC;
  if (onPath('tectonic')) return 'tectonic';
  return download(root);
}
