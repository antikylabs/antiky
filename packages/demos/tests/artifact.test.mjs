import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const demos = ['antiky-town', 'town-study', 'shader-study'];
const execute = promisify(execFile);

async function buildDemo(slug) {
  await execute('npm', ['run', 'build', '--workspace', `@antiky/demo-${slug}`], {
    cwd: repositoryRoot,
  });
}

function sha256(source) {
  return createHash('sha256').update(source).digest('hex');
}

test('every demo build describes a bounded portable game artifact', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'antiky-demo-artifacts-'));
  try {
    for (const slug of demos) {
      await buildDemo(slug);
      const dist = path.join(repositoryRoot, 'packages/demos', slug, 'dist');
      const manifestSource = await readFile(path.join(dist, 'antiky-artifact.json'), 'utf8');
      const manifest = JSON.parse(manifestSource);
      assert.equal(manifest.schemaVersion, 1);
      assert.equal(manifest.gameModuleContractVersion, 1);
      assert.equal(manifest.slug, slug);
      assert.equal(manifest.entry, 'antiky.game.js');
      assert.equal(manifest.requirements.webgpu, true);
      assert.match(manifest.sourceRevision, /^sha256:[a-f0-9]{64}$/);
      assert.doesNotMatch(manifestSource, /(?:createdAt|timestamp|credential|\.antiky\/|\/Users\/)/i);

      const copiedDist = path.join(temporaryRoot, slug);
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
  const dist = path.join(repositoryRoot, 'packages/demos/shader-study/dist');
  await buildDemo('shader-study');
  const firstManifest = await readFile(path.join(dist, 'antiky-artifact.json'));
  const firstEntry = await readFile(path.join(dist, 'antiky.game.js'));
  await buildDemo('shader-study');
  assert.deepEqual(await readFile(path.join(dist, 'antiky-artifact.json')), firstManifest);
  assert.deepEqual(await readFile(path.join(dist, 'antiky.game.js')), firstEntry);
});
