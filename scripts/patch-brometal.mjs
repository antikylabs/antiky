/**
 * Apply Antiky's local patches to every installed copy of BroMetal.
 *
 * Each patch lives in its own module under `scripts/patch-brometal/`, one per defect or feature,
 * because each one is a separate upstream contribution. ADR 0021 records the practice: patch
 * locally, send a focused pull request per patch, retire the patch when it is accepted. A patch
 * that is its own file can be read, reviewed and deleted on its own when that happens.
 *
 * Run by `postinstall`, so it must be idempotent and must fail loudly rather than half-apply.
 */
import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { name as discard, apply as applyDiscard } from './patch-brometal/discard.mjs';
import { name as present, apply as applyPresent } from './patch-brometal/present.mjs';
import {
  name as renderTargetFiltering,
  apply as applyRenderTargetFiltering,
} from './patch-brometal/render-target-filtering.mjs';
import {
  name as offscreenMultisampling,
  apply as applyOffscreenMultisampling,
} from './patch-brometal/offscreen-multisampling.mjs';
import {
  name as attributeBufferDefects,
  apply as applyAttributeBufferDefects,
} from './patch-brometal/attribute-buffer-defects.mjs';

const EXPECTED_VERSION = '0.17.2';
const repositoryRoot = path.resolve(import.meta.dirname, '..');

/** Applied in order. Order matters only where two patches touch the same lines; none do today. */
export const PATCHES = Object.freeze([
  { name: discard, apply: applyDiscard },
  { name: present, apply: applyPresent },
  { name: renderTargetFiltering, apply: applyRenderTargetFiltering },
  { name: offscreenMultisampling, apply: applyOffscreenMultisampling },
  { name: attributeBufferDefects, apply: applyAttributeBufferDefects },
]);

/**
 * Every installed copy of BroMetal, not just the first one found.
 *
 * npm places a workspace dependency wherever hoisting allows, and that placement changes with the
 * dependency graph: BroMetal has been hoisted to the repository root and has also been nested
 * inside each demo workspace. Patching only the first copy leaves the others unpatched, and that
 * fails silently — the demo simply renders with the unpatched runtime.
 */
export async function findInstalls() {
  const roots = [
    // Test-only override, so the patch can be exercised against fixture packages with a wrong
    // version or a moved target without touching the real installation.
    ...(process.env.ANTIKY_BROMETAL_ROOT === undefined ? [] : [process.env.ANTIKY_BROMETAL_ROOT]),
    path.join(repositoryRoot, 'node_modules/brometal'),
    path.join(repositoryRoot, 'packages/demos/node_modules/brometal'),
  ];
  const demosRoot = path.join(repositoryRoot, 'packages/demos');
  for (const category of await readdir(demosRoot, { withFileTypes: true }).catch(() => [])) {
    if (!category.isDirectory() || category.name === 'node_modules') continue;
    const categoryRoot = path.join(demosRoot, category.name);
    for (const demo of await readdir(categoryRoot, { withFileTypes: true }).catch(() => [])) {
      if (!demo.isDirectory()) continue;
      roots.push(path.join(categoryRoot, demo.name, 'node_modules/brometal'));
    }
  }
  const found = [];
  for (const candidate of roots) {
    try {
      await access(path.join(candidate, 'package.json'));
      if (!found.includes(candidate)) found.push(candidate);
    } catch {
      // Not installed here.
    }
  }
  return found;
}

/**
 * The two editing primitives every patch module receives, bound to one installation.
 *
 * `replace` is a no-op when the result is already present, which is what makes running the whole
 * script twice safe. It throws when the target is absent, so a BroMetal upgrade that moves a patch
 * target fails the install rather than silently shipping an unpatched runtime.
 */
function editorFor(packageRoot) {
  const replace = async (relativePath, before, after) => {
    const file = path.join(packageRoot, relativePath);
    const source = await readFile(file, 'utf8');
    if (source.includes(after)) return;
    if (!source.includes(before)) throw new Error(`BroMetal patch target changed: ${relativePath}`);
    await writeFile(file, source.replace(before, after));
  };
  const replaceSection = async (relativePath, beforeStart, beforeEnd, after) => {
    const file = path.join(packageRoot, relativePath);
    const source = await readFile(file, 'utf8');
    if (source.includes(after)) return;
    const start = source.indexOf(beforeStart);
    const end = source.indexOf(beforeEnd, start);
    if (start < 0 || end < 0) throw new Error(`BroMetal patch target changed: ${relativePath}`);
    await writeFile(file, `${source.slice(0, start)}${after}${source.slice(end)}`);
  };
  return { replace, replaceSection };
}

export async function patchInstall(packageRoot) {
  const metadata = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  if (metadata.version !== EXPECTED_VERSION) {
    throw new Error(
      `Expected BroMetal ${EXPECTED_VERSION}, found ${metadata.version} at ${packageRoot}. `
      + 'Review the cut-out patch before upgrading.',
    );
  }
  const editor = editorFor(packageRoot);
  for (const patch of PATCHES) {
    try {
      await patch.apply(editor);
    } catch (cause) {
      throw new Error(`BroMetal patch "${patch.name}" failed at ${packageRoot}: ${cause.message}`);
    }
  }
}

const installs = await findInstalls();
if (installs.length === 0) {
  throw new Error('BroMetal is not installed. Run npm install before applying the repository patch.');
}
for (const packageRoot of installs) await patchInstall(packageRoot);
