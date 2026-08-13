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
  DEMO_PROBES,
  buildCaptureInput,
  buildMetricsSidecar,
  evidencePngPath,
  resolveDemo,
  sealMetrics,
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

  assert.equal(sidecar.schemaVersion, 3);
  // The digest is what stops a budget judging a capture taken from different code.
  assert.deepEqual(sidecar.source, { digest: 'abc123', fileCount: 7 });
  // Sealed, so a hand-edited measurement stops matching.
  assert.equal(typeof sidecar.seal, 'string');
  assert.equal(sidecar.seal, sealMetrics(sidecar));
  assert.notEqual(
    sealMetrics({ ...sidecar, localContrast: { ...sidecar.localContrast, median: 99 } }),
    sidecar.seal,
    'changing a measured value must change the seal',
  );
  // The timestamp is outside the seal: re-capturing an unchanged demo should not look like tampering.
  assert.equal(sealMetrics({ ...sidecar, capturedAt: '2030-01-01T00:00:00.000Z' }), sidecar.seal);
  assert.equal(sidecar.demo, 'combat-arena');
  assert.equal(sidecar.warmUpFrames, 60);
  assert.deepEqual(sidecar.frame, { width: 64, height: 16 });
  assert.equal(sidecar.luminance.p05, 0);
  assert.equal(sidecar.luminance.p95, 1);
  assert.equal(sidecar.luminance.spread, 1);
  assert.equal(sidecar.clipping.high, 0.5);
  assert.equal(sidecar.clipping.low, 0.5);
  assert.equal(typeof sidecar.edges.hard, 'number');
  // No probes were requested, so the map is present and empty rather than missing.
  assert.deepEqual(sidecar.probes, {});
  // The sidecar is committed, so it must serialise cleanly and stay diff-friendly.
  assert.equal(typeof JSON.parse(JSON.stringify(sidecar)).luminance.mean, 'number');
});

test('the source digest changes when the demo changes and not otherwise', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-digest-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'src');
  await mkdir(source, { recursive: true });
  await writeFile(path.join(source, 'game.ts'), 'export const speed = 1;');
  // Art counts too. A digest that ignored textures let an atlas be repainted with no change at all,
  // which is the wrong boundary for a repository whose defects have been about texture data.
  await mkdir(path.join(directory, 'assets'), { recursive: true });
  await writeFile(path.join(directory, 'assets', 'atlas.png'), Buffer.from([1, 2, 3]));

  const first = await sourceDigest(directory);
  assert.ok(first.fileCount >= 1, 'source files count towards the digest');

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

  // Repainting art must move the digest.
  await writeFile(path.join(directory, 'assets', 'atlas.png'), Buffer.from([9, 9, 9]));
  const fourth = await sourceDigest(directory);
  assert.notEqual(fourth.digest, third.digest, 'a repainted texture must produce a different digest');

  // The metrics file is the output of measuring, not an input to it, so it must not be included —
  // otherwise every capture would invalidate the digest it just recorded.
  await writeFile(path.join(directory, 'visual-metrics.json'), '{"anything":true}');
  assert.equal((await sourceDigest(directory)).digest, fourth.digest);
});

test('a declared probe reaches the sidecar and lands on its own rectangle', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-probe-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // Black everywhere except one bright band inside the probe. A whole-frame number barely notices
  // a band this size, which is the reason probes exist: point-light-expo lost its entire onboarding
  // panel while every frame-wide metric stayed inside budget.
  const width = 128;
  const height = 64;
  const probe = { x: 16, y: 16, width: 32, height: 32 };
  const data = Buffer.alloc(width * height * 3);
  for (let y = 20; y < 28; y += 1) {
    for (let x = 20; x < 44; x += 1) {
      const offset = (y * width + x) * 3;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
    }
  }
  const file = path.join(directory, 'frame.png');
  await sharp(data, { raw: { width, height, channels: 3 } }).png().toFile(file);

  const stats = await readFrameStats(file, { probes: { panel: probe } });
  const sidecar = buildMetricsSidecar({
    slug: 'point-light-expo',
    stats,
    capturedAt: '2026-08-12T00:00:00.000Z',
    warmUpFrames: 60,
    source: { digest: 'abc123', fileCount: 7 },
  });

  assert.equal(sidecar.probes.panel.pixels, probe.width * probe.height);
  assert.ok(
    sidecar.probes.panel.standardDeviation > 0.2,
    'a bright band inside the probe should spread it',
  );
  // The same frame measured whole barely moves, so the probe is reading its rectangle and not
  // inheriting the frame.
  assert.ok(
    sidecar.probes.panel.meanLuminance > stats.meanLuminance * 3,
    `probe ${sidecar.probes.panel.meanLuminance} should far exceed frame ${stats.meanLuminance}`,
  );
  // A measured probe is part of what the seal covers, so it cannot be edited afterwards either.
  assert.notEqual(
    sealMetrics({
      ...sidecar,
      probes: { panel: { ...sidecar.probes.panel, standardDeviation: 0 } },
    }),
    sidecar.seal,
  );
});

test('every demo with declared probes is a demo that exists', () => {
  for (const slug of Object.keys(DEMO_PROBES)) {
    assert.ok(DEMOS[slug] !== undefined, `DEMO_PROBES names "${slug}", which is not a demo`);
  }
  // A guard against the map quietly emptying and the probe assertions passing on nothing.
  assert.ok(Object.keys(DEMO_PROBES).length >= 1);
});
