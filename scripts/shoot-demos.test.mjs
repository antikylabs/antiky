import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import { readFrameStats } from './frame-stats.mjs';
import {
  DEMOS,
  buildCaptureInput,
  buildMetricsSidecar,
  evidencePngPath,
  resolveDemo,
  sourceDigest,
} from './shoot-demos.mjs';

/** These tests need no GPU, no browser, and no dev server. */

const repositoryRoot = path.resolve(import.meta.dirname, '..');

test('every registered demo manifest exists on disk', async () => {
  for (const [slug, manifest] of Object.entries(DEMOS)) {
    await access(path.join(repositoryRoot, manifest));
    assert.ok(manifest.endsWith('.antiky'), `${slug} must point at a manifest`);
  }
});

test('the demo registry and scripts/dev.mjs cover the same demos', async () => {
  const devSource = await import('node:fs/promises')
    .then((fs) => fs.readFile(path.join(repositoryRoot, 'scripts/dev.mjs'), 'utf8'));
  for (const slug of Object.keys(DEMOS)) {
    assert.match(
      devSource,
      new RegExp(`'${slug}':`),
      `scripts/dev.mjs is missing "${slug}", so npm run dev:demos cannot start it`,
    );
  }
});

test('an unknown slug names the demos that do exist', () => {
  assert.throws(() => resolveDemo('not-a-demo'), /Unknown demo "not-a-demo"/);
  assert.throws(() => resolveDemo('not-a-demo'), /point-light-expo/);
});

test('resolving a demo yields its manifest and directory', () => {
  const resolved = resolveDemo('combat-arena');
  assert.equal(resolved.manifest, 'packages/demos/antiky/combat-arena/combat-arena.antiky');
  assert.equal(resolved.directory, 'packages/demos/antiky/combat-arena');
});

test('the capture fence carries the identities the tool requires', () => {
  const input = buildCaptureInput({
    build: { developmentSessionId: 'session-1', acceptedBuildRevision: 7 },
    runtime: { observation: { runtimeInstanceId: 'runtime-1' } },
    capabilities: { target: { configuredWidth: 1280, configuredHeight: 720 } },
    warmUpFrames: 60,
    idempotencyKey: 'key-1',
  });

  assert.equal(input.schemaVersion, 3);
  assert.equal(input.expected.developmentSessionId, 'session-1');
  assert.equal(input.expected.acceptedBuildRevision, 7);
  assert.equal(input.expected.currentRuntimeInstanceId, 'runtime-1');
  assert.equal(input.runtimePolicy, 'managed-only');
  assert.deepEqual(input.target, { width: 1280, height: 720, deviceScaleFactor: 1 });
});

test('the fence tolerates no attached runtime', () => {
  const input = buildCaptureInput({
    build: { developmentSessionId: 'session-1', acceptedBuildRevision: 0 },
    runtime: { observation: null },
    capabilities: { target: { configuredWidth: 1280, configuredHeight: 720 } },
    warmUpFrames: 60,
    idempotencyKey: 'key-1',
  });
  assert.equal(input.expected.currentRuntimeInstanceId, null);
});

test('the capture target always uses a device scale factor of one', () => {
  // 1280x720 at scale factor 2 is rejected with CAPTURE_DIMENSIONS_MISMATCH even though the
  // result is inside the stated maximums. Encoding that here stops it being rediscovered.
  const input = buildCaptureInput({
    build: { developmentSessionId: 's', acceptedBuildRevision: 0 },
    runtime: { observation: null },
    capabilities: { target: { configuredWidth: 2560, configuredHeight: 1440 } },
    warmUpFrames: 1,
    idempotencyKey: 'k',
  });
  assert.equal(input.target.deviceScaleFactor, 1);
  assert.equal(input.target.width, 2560);
});

test('the evidence path follows the store layout', () => {
  const sessionId = 'session-abc';
  const expectedKey = createHash('sha256').update(sessionId).digest('hex');
  const resolved = evidencePngPath({
    demoDirectory: '/repo/packages/demos/antiky/combat-arena',
    developmentSessionId: sessionId,
    evidenceId: 'evidence-1',
    artifactId: 'artifact-2',
  });
  assert.equal(
    resolved,
    `/repo/packages/demos/antiky/combat-arena/.antiky/evidence/${expectedKey}/evidence-1/artifact-2.png`,
  );
});

test('the metrics sidecar records the numbers the budgets assert against', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-shoot-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // A half-black, half-white frame: a known, wide luminance spread.
  const width = 64;
  const height = 16;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = x < width / 2 ? 0 : 255;
      const offset = (y * width + x) * 3;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
    }
  }
  const file = path.join(directory, 'frame.png');
  await sharp(data, { raw: { width, height, channels: 3 } }).png().toFile(file);

  const sidecar = buildMetricsSidecar({
    slug: 'combat-arena',
    stats: await readFrameStats(file),
    capturedAt: '2026-08-11T00:00:00.000Z',
    warmUpFrames: 60,
    source: { digest: 'abc123', fileCount: 7 },
  });

  assert.equal(sidecar.schemaVersion, 2);
  // The digest is what stops a budget judging a capture taken from different code.
  assert.deepEqual(sidecar.source, { digest: 'abc123', fileCount: 7 });
  assert.equal(sidecar.demo, 'combat-arena');
  assert.equal(sidecar.warmUpFrames, 60);
  assert.deepEqual(sidecar.frame, { width: 64, height: 16 });
  assert.equal(sidecar.luminance.p05, 0);
  assert.equal(sidecar.luminance.p95, 1);
  assert.equal(sidecar.luminance.spread, 1);
  assert.equal(sidecar.clipping.high, 0.5);
  assert.equal(sidecar.clipping.low, 0.5);
  // The sidecar is committed, so it must serialise cleanly and stay diff-friendly.
  assert.equal(typeof JSON.parse(JSON.stringify(sidecar)).luminance.mean, 'number');
});

test('the source digest changes when the demo changes and not otherwise', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-digest-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'src');
  await mkdir(source, { recursive: true });
  await writeFile(path.join(source, 'game.ts'), 'export const speed = 1;');
  await writeFile(path.join(source, 'notes.md'), 'not code');

  const first = await sourceDigest(directory);
  assert.equal(first.fileCount, 1, 'only source files count towards the digest');

  // Re-reading unchanged files must give the same answer, or every budget goes stale immediately.
  assert.deepEqual(await sourceDigest(directory), first);

  await writeFile(path.join(source, 'game.ts'), 'export const speed = 2;');
  const second = await sourceDigest(directory);
  assert.notEqual(second.digest, first.digest, 'a changed demo must produce a different digest');

  // A file added deeper in the tree also counts: the walk is recursive on purpose.
  await mkdir(path.join(source, 'shaders'), { recursive: true });
  await writeFile(path.join(source, 'shaders', 'sky.shader.ts'), 'export default {};');
  const third = await sourceDigest(directory);
  assert.notEqual(third.digest, second.digest);
  assert.equal(third.fileCount, 2);
});
