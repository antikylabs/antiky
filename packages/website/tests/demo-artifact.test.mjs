import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import { buildPublishedDemo } from '../scripts/build-public-demos.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const publication = JSON.parse(await readFile(new URL('../demo-publication.json', import.meta.url), 'utf8'));
const demos = publication.demos;

test('publication includes the complete renderer showcase', () => {
  assert.deepEqual(demos.map(({ slug, renderer }) => ({ slug, renderer })), [
    { slug: 'combat-arena', renderer: 'antiky' },
    { slug: 'traversal-study', renderer: 'antiky' },
    { slug: 'antiky-town', renderer: 'antiky' },
    { slug: 'point-light-expo', renderer: 'antiky' },
    { slug: 'town-study', renderer: 'brometal' },
    { slug: 'shader-study', renderer: 'brometal' },
    { slug: 'solar-forge', renderer: 'brometal' },
    { slug: 'luminous-reef', renderer: 'brometal' },
    { slug: 'orbital-atlas', renderer: 'threejs' },
    { slug: 'glass-garden', renderer: 'threejs' },
  ]);
});

async function buildDemo(slug) {
  const demo = demos.find((candidate) => candidate.slug === slug);
  assert.ok(demo, `Missing publication entry for ${slug}`);
  await buildPublishedDemo({ repositoryRoot, demo });
  return demo;
}

function sha256(source) {
  return createHash('sha256').update(source).digest('hex');
}

test('every demo build describes a bounded portable game artifact', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'antiky-demo-artifacts-'));
  try {
    for (const demo of demos) {
      await buildDemo(demo.slug);
      const dist = path.join(repositoryRoot, demo.projectDirectory, 'dist');
      const manifestSource = await readFile(path.join(dist, 'antiky-artifact.json'), 'utf8');
      const manifest = JSON.parse(manifestSource);
      assert.equal(manifest.schemaVersion, 1);
      assert.equal(manifest.gameModuleContractVersion, 1);
      assert.equal(manifest.slug, demo.slug);
      assert.equal(manifest.entry, 'antiky.game.js');
      assert.equal(manifest.requirements.webgpu, demo.renderer !== 'threejs');
      assert.match(manifest.sourceRevision, /^sha256:[a-f0-9]{64}$/);
      assert.doesNotMatch(manifestSource, /(?:createdAt|timestamp|credential|\.antiky\/|\/Users\/)/i);

      const copiedDist = path.join(temporaryRoot, demo.slug);
      await cp(dist, copiedDist, { recursive: true });
      for (const file of manifest.files) {
        assert.match(file.path, /^(?!\/)(?!.*\.\.)(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+$/);
        const source = await readFile(path.join(copiedDist, file.path));
        assert.equal(source.byteLength, file.size);
        assert.equal(sha256(source), file.sha256);
      }
      const gameModule = await import(pathToFileURL(path.join(copiedDist, manifest.entry)).href);
      assert.equal(typeof gameModule.default, 'function');
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('rebuilding the same source produces the same artifact manifest and bytes', async () => {
  const demo = demos.find((candidate) => candidate.slug === 'shader-study');
  assert.ok(demo);
  const dist = path.join(repositoryRoot, demo.projectDirectory, 'dist');
  await buildDemo('shader-study');
  const firstManifest = await readFile(path.join(dist, 'antiky-artifact.json'));
  const firstEntry = await readFile(path.join(dist, 'antiky.game.js'));
  await buildDemo('shader-study');
  assert.deepEqual(await readFile(path.join(dist, 'antiky-artifact.json')), firstManifest);
  assert.deepEqual(await readFile(path.join(dist, 'antiky.game.js')), firstEntry);
});

test('a published demo resolves its assets relative to itself, not to the site root', async () => {
  // Reported by the owner: every model-loading demo failed on the website with
  //   BroMetal: could not load model 'http://127.0.0.1:3020/assets/room-small-CB95YPvN.glb' (HTTP 404)
  //
  // Vite rewrites `new URL('../assets/x.glb', import.meta.url)` using its `base`, which defaults to
  // '/'. That emits `new URL("/assets/x.glb", import.meta.url)`, and a root-absolute path discards
  // the base URL's directory entirely — so the lookup lands on the site root. The CLI dev host
  // serves a demo at its own root, so it never saw this; the website serves demos under
  // `/demo-builds/<slug>/`, where it is always a 404.
  const offenders = [];
  for (const { slug } of demos) {
    const bundle = await readFile(
      new URL(`../public/demo-builds/${slug}/antiky.game.js`, import.meta.url),
      'utf8',
    );
    const absolute = bundle.match(/new URL\("\/[^"]*"/g) ?? [];
    if (absolute.length > 0) offenders.push(`${slug}: ${absolute.length} root-absolute asset URL(s)`);
  }
  assert.deepEqual(offenders, [], 'Set `base: "./"` in the demo\'s vite config.');
});

test('every demo vite config pins a relative base', async () => {
  // The guard above only catches a demo that already ships assets. This one catches the next demo
  // to add its first `new URL(...)` asset, which is when the defect would otherwise reappear.
  const offenders = [];
  for (const { slug, renderer } of demos) {
    const family = renderer === 'antiky' ? 'antiky' : renderer;
    const config = await readFile(
      new URL(`../../demos/${family}/${slug}/vite.config.ts`, import.meta.url),
      'utf8',
    );
    if (!/base:\s*'\.\/'/.test(config)) offenders.push(`${slug}`);
  }
  assert.deepEqual(offenders, []);
});

test('a build output is validated by its file set, not by two different sort orders', async () => {
  const script = await readFile(
    new URL('../scripts/stage-demo-artifacts.mjs', import.meta.url),
    'utf8',
  );

  // `filesBelow` walks with `localeCompare(name, 'en')` and the expected list uses the default
  // code-unit `.sort()`. Those two orderings disagree whenever case or punctuation is involved, and
  // the check compares the lists element by element — so an identical set of files was reported as
  // "missing or extra files" with nothing missing and nothing extra. Goal 05's wall panels were the
  // first filenames to expose it: `template-wall-Dzn8tX6E.glb` sorts before
  // `template-wall-detail-a-Dmly8Er6.glb` by code unit and after it by locale.
  assert.match(
    script,
    /const actualFiles = \(await filesBelow\([^)]*\)\)\.sort\(\)/,
    'the actual file list must be sorted the same way as the expected one before comparison',
  );

  // The orderings really do differ, or the assertion above is guarding nothing.
  const pair = ['template-wall-detail-a-Dmly8Er6.glb', 'template-wall-Dzn8tX6E.glb'];
  const byCodeUnit = [...pair].sort();
  const byLocale = [...pair].sort((left, right) => left.localeCompare(right, 'en'));
  assert.notDeepEqual(byCodeUnit, byLocale, 'these two names no longer distinguish the sort orders');
});
