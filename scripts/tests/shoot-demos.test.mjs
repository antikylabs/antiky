import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import { readFrameStats } from '../frame-stats.mjs';
import {
  DEMOS,
  DEMO_PROBES,
  CAPTURE_FIXTURES,
  CAPTURE_PAIRS,
  buildCaptureInput,
  buildMetricsSidecar,
  comparableCaptureIdentity,
  evidencePngPath,
  evaluateControlPair,
  measurePixelDrift,
  measureControlPair,
  pauseAndAdvanceToStep,
  resolveDemo,
  sealMetrics,
  sourceDigest,
} from '../shoot-demos.mjs';

/** These tests need no GPU, no browser, and no dev server. */

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

test('every registered demo manifest exists on disk', async () => {
  for (const [slug, manifest] of Object.entries(DEMOS)) {
    await access(path.join(repositoryRoot, manifest));
    assert.ok(manifest.endsWith('.antiky'), `${slug} must point at a manifest`);
  }
});

test('every Antiky demo declares its bounded Goal 19 evidence pairs', () => {
  assert.deepEqual(Object.keys(CAPTURE_PAIRS).sort(), Object.keys(DEMOS).sort());
  assert.deepEqual(
    CAPTURE_PAIRS['combat-arena'].map((entry) => entry.name),
    [
      'ac-v1-vfx-only',
      'ac-l7-camera-translation',
      'm13-bloom-halo',
      'm13-vignette-corner',
      'm13-shadow',
    ],
  );
  assert.deepEqual(
    CAPTURE_PAIRS['antiky-town'].map((entry) => entry.name),
    ['tree-translucency', 'm13-bloom-halo', 'm13-vignette-corner', 'm13-shadow'],
  );
  for (const [slug, pairs] of Object.entries(CAPTURE_PAIRS)) {
    assert.ok(pairs.length > 0, `${slug} must not pass through empty evidence discovery`);
    for (const pair of pairs) {
      assert.equal(pair.treatment.fixtureName, 'goal-19-evidence');
      assert.ok(pair.treatment.controls.length > 0);
      assert.ok(pair.roi.width > 0 && pair.roi.height > 0);
    }
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
  const sessionStatus = {
    session: {
      sessionId: 'game-session-1',
      clock: { completedStepCount: 12 },
      lastCompletedStep: { stateDigest: 'digest-12' },
    },
  };
  const input = buildCaptureInput({
    build: { developmentSessionId: 'session-1', acceptedBuildRevision: 7 },
    runtime: { observation: { runtimeInstanceId: 'runtime-1' } },
    capabilities: { target: { configuredWidth: 1280, configuredHeight: 720 } },
    warmUpFrames: 60,
    idempotencyKey: 'key-1',
    sessionStatus,
    fixture: CAPTURE_FIXTURES['combat-arena'].baseline,
  });

  assert.equal(input.schemaVersion, 3);
  assert.equal(input.expected.developmentSessionId, 'session-1');
  assert.equal(input.expected.acceptedBuildRevision, 7);
  assert.equal(input.expected.currentRuntimeInstanceId, 'runtime-1');
  assert.equal(input.expected.sessionId, 'game-session-1');
  assert.equal(input.expected.completedStepCount, 12);
  assert.equal(input.expected.stateDigest, 'digest-12');
  assert.equal(input.fixture.fixtureName, 'goal-19-evidence');
  assert.equal(input.runtimePolicy, 'managed-only');
  assert.deepEqual(input.target, { width: 1280, height: 720, deviceScaleFactor: 1 });
});

test('pause plus exact step reaches one requested paused identity without replaying a step', async () => {
  let completedStepCount = 7;
  const calls = [];
  const status = () => ({
    schemaVersion: 2,
    observation: { runtimeInstanceId: 'runtime-1' },
    session: {
      sessionId: 'game-session-1',
      mode: 'paused',
      clock: { completedStepCount },
      lastCompletedStep: { stateDigest: `digest-${completedStepCount}` },
    },
  });
  const settled = await pauseAndAdvanceToStep({
    manifest: 'demo.antiky',
    targetCompletedStepCount: 9,
    async callTool(name, input) {
      calls.push([name, input]);
      if (name === 'pause_simulation') return { result: { code: 'PAUSED' } };
      if (name === 'get_session_status') return status();
      assert.equal(input.expectedCompletedStepCount, completedStepCount);
      completedStepCount += 1;
      return { result: { code: 'STEPPED' }, session: status().session };
    },
  });
  assert.equal(settled.session.clock.completedStepCount, 9);
  assert.equal(settled.session.lastCompletedStep.stateDigest, 'digest-9');
  assert.deepEqual(
    calls.filter(([name]) => name === 'step_simulation').map(([, input]) => input),
    [{ expectedCompletedStepCount: 7 }, { expectedCompletedStepCount: 8 }],
  );
});

test('comparable capture identity ignores publication churn but keeps every capture fence', () => {
  const observation = {
    developmentSessionId: 'dev-1',
    acceptedBuildRevision: 4,
    runtimeInstanceId: 'runtime-1',
    publicationSequence: 20,
    publishedAt: '2026-08-16T00:00:00.000Z',
    session: { sessionId: 'session-1', completedStepCount: 9, stateDigest: 'digest-9' },
  };
  assert.deepEqual(comparableCaptureIdentity(observation), {
    developmentSessionId: 'dev-1',
    acceptedBuildRevision: 4,
    runtimeInstanceId: 'runtime-1',
    sessionId: 'session-1',
    completedStepCount: 9,
    stateDigest: 'digest-9',
  });
  assert.deepEqual(comparableCaptureIdentity({
    ...observation,
    publicationSequence: 21,
    publishedAt: '2026-08-16T00:00:01.000Z',
  }), comparableCaptureIdentity(observation));
});

test('exact stepping rejects a target behind the live session', async () => {
  await assert.rejects(() => pauseAndAdvanceToStep({
    manifest: 'demo.antiky',
    targetCompletedStepCount: 3,
    async callTool(name) {
      if (name === 'pause_simulation') return { result: { code: 'NO_OP' } };
      return { session: { mode: 'paused', clock: { completedStepCount: 4 } } };
    },
  }), /behind current step 4/);
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

  assert.equal(sidecar.schemaVersion, 5);
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
  // The §7.1 measurements: encoded luma over a half-black, half-white frame spans the range, and
  // an achromatic frame has no hue clusters rather than a spurious one.
  assert.equal(sidecar.encodedLuma.p05, 0);
  assert.equal(sidecar.encodedLuma.p95, 1);
  assert.equal(sidecar.encodedLuma.spread, 1);
  assert.equal(sidecar.encodedLuma.clipped, 0.5);
  assert.equal(sidecar.hue.clusters, 0);
  assert.equal(sidecar.hue.dominantShare, 0);
  assert.equal(sidecar.hue.chromaticFraction, 0);
  // No probes were requested, so the map is present and empty rather than missing.
  assert.deepEqual(sidecar.probes, {});
  // The sidecar is committed, so it must serialise cleanly and stay diff-friendly.
  assert.equal(typeof JSON.parse(JSON.stringify(sidecar)).luminance.mean, 'number');
});

test('repeatability reports bounded pixel drift over equal captured frames', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-repeatability-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const width = 16;
  const height = 8;
  const first = Buffer.alloc(width * height * 3, 64);
  const second = Buffer.from(first);
  second[0] = 65;
  const firstPath = path.join(directory, 'first.png');
  const secondPath = path.join(directory, 'second.png');
  await sharp(first, { raw: { width, height, channels: 3 } }).png().toFile(firstPath);
  await sharp(second, { raw: { width, height, channels: 3 } }).png().toFile(secondPath);
  const drift = await measurePixelDrift(firstPath, secondPath);
  assert.equal(drift.comparedPixels, width * height);
  assert.ok(drift.meanAbsoluteLuminanceDifference > 0);
  assert.ok(drift.p99AbsoluteLuminanceDifference <= drift.declaredP99Bound);
});

test('control-pair measurement reports a non-vacuous named VFX boundary', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-control-pair-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const width = 32;
  const height = 32;
  const control = Buffer.alloc(width * height * 3, 0);
  const treatment = Buffer.alloc(width * height * 3, 0);
  for (let y = 8; y < 24; y += 1) {
    for (let x = 8; x < 24; x += 1) {
      const value = Math.max(0, 255 - Math.round(Math.hypot(x - 16, y - 16) * 24));
      const offset = (y * width + x) * 3;
      treatment.fill(value, offset, offset + 3);
    }
  }
  const controlPath = path.join(directory, 'control.png');
  const treatmentPath = path.join(directory, 'treatment.png');
  await sharp(control, { raw: { width, height, channels: 3 } }).png().toFile(controlPath);
  await sharp(treatment, { raw: { width, height, channels: 3 } }).png().toFile(treatmentPath);
  const measurement = await measureControlPair(controlPath, treatmentPath, {
    kind: 'vfx-boundary',
    roi: { x: 0, y: 0, width, height },
  });
  assert.ok(measurement.changedPixelFraction > measurement.declaredChangedPixelMinimum);
  assert.ok(measurement.measuredBoundaryPixels > 0);
  assert.ok(measurement.p99LuminanceGradientPerPixel > 0);
  assert.equal(evaluateControlPair('vfx-boundary', measurement), 'fail');
});

test('control-pair outcomes preserve target failures as data', () => {
  assert.equal(evaluateControlPair('camera-registration', {
    comparedPixels: 100,
    p99AbsoluteLuminanceDifference: 0.05,
    declaredP99Bound: 0.1,
  }), 'pass');
  assert.equal(evaluateControlPair('bloom', {
    changedPixelFraction: 0,
    controlToTreatmentRatio: 1,
  }), 'fail');
  assert.equal(evaluateControlPair('translucency', {
    changedPixelFraction: 0.2,
    controlToTreatmentRatio: 1.1,
  }), 'fail');
  assert.equal(evaluateControlPair('vignette', {
    cornerAttenuation: 0.15,
    declaredAttenuationRange: [0.1, 0.25],
  }), 'pass');
  assert.equal(evaluateControlPair('shadow', {
    changedPixelFraction: 0.4,
    controlToTreatmentRatio: 0.7,
  }), 'pass');
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
