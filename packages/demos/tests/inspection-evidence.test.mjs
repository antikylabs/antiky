import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  CAPTURE_PAIRS,
  comparableCaptureIdentity,
  sealMetrics,
  sourceDigest,
} from '../../../scripts/shoot-demos.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

for (const [slug, declarations] of Object.entries(CAPTURE_PAIRS)) {
  test(`${slug} retains sealed exact-step inspection evidence`, async () => {
    const directory = path.join(repositoryRoot, 'packages', 'demos', 'antiky', slug);
    const sidecar = JSON.parse(await readFile(path.join(directory, 'visual-metrics.json'), 'utf8'));
    assert.equal(sidecar.schemaVersion, 5);
    assert.equal(sidecar.seal, sealMetrics(sidecar));
    assert.deepEqual(sidecar.source, await sourceDigest(directory));

    const { inspection } = sidecar;
    assert.equal(inspection.observation.session.mode, 'paused');
    assert.ok(inspection.observation.session.completedStepCount > 0);
    assert.equal(
      inspection.observation.session.stateDigest,
      inspection.comparableIdentity.stateDigest,
    );
    assert.deepEqual(
      comparableCaptureIdentity(inspection.observation),
      inspection.comparableIdentity,
    );
    assert.ok(
      inspection.repeatability.p99AbsoluteLuminanceDifference
      <= inspection.repeatability.declaredP99Bound,
    );
    if (inspection.frameTime.supported === 'upper-bound-only') {
      assert.ok(inspection.frameTime.frameTimeUpperBoundMilliseconds > 0);
      assert.match(inspection.frameTime.limitation, /refresh/i);
    } else {
      assert.equal(inspection.frameTime.supported, false);
      assert.equal(typeof inspection.frameTime.limitation, 'string');
    }

    assert.deepEqual(Object.keys(inspection.criteria), declarations.map(({ name }) => name));
    for (const declaration of declarations) {
      const criterion = inspection.criteria[declaration.name];
      assert.ok(criterion.outcome === 'pass' || criterion.outcome === 'fail');
      assert.deepEqual(criterion.region, declaration.roi);
      assert.match(criterion.artifacts.control.sha256, /^[a-f0-9]{64}$/u);
      assert.match(criterion.artifacts.treatment.sha256, /^[a-f0-9]{64}$/u);
      assert.equal(criterion.fixtures.control.fixtureName, 'goal-19-evidence');
      assert.equal(criterion.fixtures.treatment.fixtureName, 'goal-19-evidence');
      if (declaration.kind === 'vfx-boundary') {
        assert.ok(criterion.measurement.measuredBoundaryPixels > 0);
        assert.ok(criterion.measurement.changedPixelFraction > 0);
      }
      if (declaration.kind === 'camera-registration') {
        assert.deepEqual(criterion.measurement.knownWorldDelta, { x: 0.5, y: 0, z: 0 });
        assert.ok(criterion.measurement.comparedPixels > 0);
      }
      if (declaration.kind === 'translucency') {
        assert.ok(criterion.measurement.changedPixelFraction > 0);
      }
    }
  });
}
