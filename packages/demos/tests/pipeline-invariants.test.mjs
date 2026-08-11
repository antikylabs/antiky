import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

/**
 * Source-level invariants that encode the defects the demo audit found, so they cannot return
 * quietly once they are fixed.
 *
 * These fail today. That is the point: each one is a defect that a later goal removes, and the
 * test is what proves the removal actually happened. They are deliberately excluded from
 * `npm test`, which stays green as a regression gate. Run them with `npm run demos:verify`.
 */

const demosRoot = path.resolve(import.meta.dirname, '..');
const ANTIKY_DEMOS = ['antiky-town', 'combat-arena', 'point-light-expo', 'traversal-study'];

async function shaderSources(slug) {
  const results = [];
  const roots = [
    path.join(demosRoot, 'antiky', slug, 'src', 'shaders'),
    path.join(demosRoot, 'antiky', slug, 'src', 'town', 'shaders'),
  ];
  for (const root of roots) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.shader.ts')) continue;
      if (entry.name.endsWith('.shader.gen.ts')) continue;
      const file = path.join(root, entry.name);
      results.push({ file, relative: path.relative(demosRoot, file), text: await readFile(file, 'utf8') });
    }
  }
  return results;
}

async function assetScripts() {
  const results = [];
  for (const slug of ANTIKY_DEMOS) {
    const root = path.join(demosRoot, 'antiky', slug, 'scripts');
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
      const file = path.join(root, entry.name);
      results.push({ relative: path.relative(demosRoot, file), text: await readFile(file, 'utf8') });
    }
  }
  return results;
}

test('no material shader tone-maps, because tone-mapping belongs in one post pass', async () => {
  const offenders = [];
  for (const slug of ANTIKY_DEMOS) {
    for (const shader of await shaderSources(slug)) {
      // A demo's single post pass is allowed to tone-map. Every material shader is not.
      if (/post\.shader\.ts$/.test(shader.relative)) continue;
      if (/tonemapACES/.test(shader.text)) offenders.push(shader.relative);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'Tone mapping is the last step of a frame. A material that tone-maps itself crushes the '
    + 'value range before anything can composite onto it, which is why the demo VFX read as flat '
    + 'stickers. Move it into the demo\'s post pass.',
  );
});

test('no asset script discards the normal map it downloaded', async () => {
  const offenders = [];
  for (const script of await assetScripts()) {
    if (/delete\s+\w+\.normalTexture/.test(script.text)) offenders.push(script.relative);
  }
  assert.deepEqual(
    offenders,
    [],
    'Normal maps are downloaded, hash-verified and committed, and then deleted at build time. '
    + 'Apply them through triplanar projection, which needs no tangent basis.',
  );
});

test('no asset script writes texture coordinates without reading the source ones', async () => {
  const offenders = [];
  for (const script of await assetScripts()) {
    const writesUvs = /\buvs\.push\(|paletteU/.test(script.text);
    // The read is `primitive.attributes.TEXCOORD_0`. A bare mention is not enough: these scripts
    // also *write* `TEXCOORD_0: 2` into the output GLB's attribute map, and matching that would
    // pass a script that synthesises every UV it emits.
    const readsSourceUvs = /attributes\.TEXCOORD_0/.test(script.text);
    if (writesUvs && !readsSourceUvs) offenders.push(script.relative);
  }
  assert.deepEqual(
    offenders,
    [],
    'A script that synthesises texture coordinates without reading TEXCOORD_0 throws away the '
    + 'authored UVs, which is how shipped textures became 1x1 pixels.',
  );
});

test('every shader in a demo agrees on the direction of the key light', async () => {
  const disagreements = [];
  for (const slug of ANTIKY_DEMOS) {
    const directions = new Map();
    for (const shader of await shaderSources(slug)) {
      const pattern = /const\s+(?:key|sun|light|keyLight|sunDirection)\s*=\s*normalize\(vec3\(([^)]*)\)\)/gi;
      for (const match of shader.text.matchAll(pattern)) {
        const vector = match[1].split(',').map((part) => part.trim()).join(', ');
        if (!directions.has(vector)) directions.set(vector, []);
        directions.get(vector).push(shader.relative);
      }
    }
    if (directions.size > 1) {
      disagreements.push({ demo: slug, directions: Object.fromEntries(directions) });
    }
  }
  assert.deepEqual(
    disagreements,
    [],
    'Objects lit by different suns cannot read as one space. Derive every shader\'s key light '
    + 'from a single shared constant per demo.',
  );
});

test('every shader in a demo agrees on its fog range', async () => {
  const disagreements = [];
  for (const slug of ANTIKY_DEMOS) {
    const ranges = new Map();
    for (const shader of await shaderSources(slug)) {
      const pattern = /smoothstep\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*length\(uCameraPosition/g;
      for (const match of shader.text.matchAll(pattern)) {
        const range = `${match[1]}..${match[2]}`;
        if (!ranges.has(range)) ranges.set(range, []);
        ranges.get(range).push(shader.relative);
      }
    }
    if (ranges.size > 1) disagreements.push({ demo: slug, ranges: Object.fromEntries(ranges) });
  }
  assert.deepEqual(
    disagreements,
    [],
    'Fog is a property of the scene, not of a material. Different ranges in one demo make near '
    + 'and far objects disagree about how far away they are.',
  );
});
