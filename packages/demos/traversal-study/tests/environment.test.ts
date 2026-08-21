import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BACKGROUND_CATALOG_LANDMARKS,
  backgroundCompositionAt,
  type EnvironmentAsset,
} from '../src/environment.ts';
import { DELIVERY_X } from '../src/course.ts';

/**
 * Every asset the background is allowed to draw, and the reason this list is written out by hand.
 *
 * The background used to carry a second `procedural` channel beside the catalog one, kept alive
 * with an assertion that it stayed empty so that flat atmosphere panels and debug-like bars could
 * not come back. The channel is gone; this list is what now holds that line. A landmark whose
 * asset is not a real catalog GLB fails here, which is the same defect the empty-channel assertion
 * was watching for.
 */
const CATALOG_ASSETS: ReadonlySet<EnvironmentAsset> = new Set<EnvironmentAsset>([
  'tree',
  'cloud-small',
  'cloud-large',
  'coastal-cliff',
  'coastal-tree',
  'relay-tower',
]);

test('every background landmark is a real catalog asset', () => {
  for (const landmark of BACKGROUND_CATALOG_LANDMARKS) {
    assert.ok(
      CATALOG_ASSETS.has(landmark.asset),
      `${landmark.asset} at x=${landmark.x} is not a catalog asset — flat panels and debug-like bars must stay out`,
    );
  }
  assert.deepEqual(new Set(BACKGROUND_CATALOG_LANDMARKS.map((landmark) => landmark.asset)), CATALOG_ASSETS);
});

test('the background stands in distinct depth bands rather than on one plane', () => {
  const depths = BACKGROUND_CATALOG_LANDMARKS.map((landmark) => landmark.z);
  const distinct = new Set(depths);
  assert.ok(distinct.size >= 3, `the background needs at least three distinct z bands, found ${distinct.size}`);
  const span = Math.max(...depths) - Math.min(...depths);
  assert.ok(span >= 15, `the background needs at least 15 units of depth separation, found ${span.toFixed(2)}`);
});

test('the authored environment covers the course with layered landmarks', () => {
  for (const cameraX of [8, DELIVERY_X * 0.5, DELIVERY_X - 8]) {
    const composition = backgroundCompositionAt(cameraX);
    assert.ok(composition.catalog.length >= 30, `catalog coverage is sparse around x=${cameraX}`);
  }

  const assetKinds = new Set<string>(backgroundCompositionAt(84).catalog.map((landmark) => landmark.asset));
  for (const required of ['cloud-small', 'cloud-large', 'coastal-cliff', 'coastal-tree', 'relay-tower']) {
    assert.ok(assetKinds.has(required), `missing layered landmark ${required}`);
  }
});

test('background composition reuses its arrays and descriptors while moving the camera window', () => {
  const first = backgroundCompositionAt(8);
  const catalog = first.catalog;
  const firstLandmark = catalog[0]!;
  const firstScale = firstLandmark.scale;
  const second = backgroundCompositionAt(96);

  assert.strictEqual(second, first);
  assert.strictEqual(second.catalog, catalog);
  assert.strictEqual(second.catalog[0], firstLandmark);
  assert.strictEqual(second.catalog[0]!.scale, firstScale);
  assert.equal(second.catalog[0]!.x, -5);
});
