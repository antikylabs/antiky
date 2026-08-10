import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BACKGROUND_CATALOG_LANDMARKS,
  BACKGROUND_LAYERS,
  backgroundCompositionAt,
} from '../src/environment.ts';
import { DELIVERY_X } from '../src/course.ts';

test('the authored environment composes catalog landmarks across distinct depth layers', () => {
  const layerDepths = BACKGROUND_LAYERS.map((layer) => layer.z);
  assert.ok(new Set(layerDepths).size >= 4);
  assert.ok(Math.max(...layerDepths) - Math.min(...layerDepths) >= 12);

  const assetKinds = new Set(BACKGROUND_CATALOG_LANDMARKS.map((landmark) => landmark.asset));
  assert.deepEqual(assetKinds, new Set([
    'tree',
    'cloud-small',
    'cloud-large',
    'coastal-cliff',
    'coastal-tree',
    'relay-tower',
  ]));

  for (const cameraX of [8, DELIVERY_X * 0.5, DELIVERY_X - 8]) {
    const composition = backgroundCompositionAt(cameraX);
    assert.ok(composition.catalog.length >= 30, `catalog coverage is sparse around x=${cameraX}`);
    assert.ok(new Set(composition.catalog.map((landmark) => landmark.layer)).size >= 3);
    assert.equal(composition.procedural.length, 0);
  }
});

test('the coastal backdrop is built from authored landmarks instead of flat panels and bars', () => {
  const composition = backgroundCompositionAt(84);
  const assetKinds = new Set<string>(composition.catalog.map((landmark) => landmark.asset));
  for (const required of ['cloud-small', 'cloud-large', 'coastal-cliff', 'coastal-tree', 'relay-tower']) {
    assert.ok(assetKinds.has(required), `missing layered landmark ${required}`);
  }
  assert.equal(composition.procedural.length, 0, 'flat atmosphere panels and debug-like bars must be removed');
});

test('background composition reuses its arrays and descriptors while moving the camera window', () => {
  const first = backgroundCompositionAt(8);
  const catalog = first.catalog;
  const procedural = first.procedural;
  const firstLandmark = catalog[0]!;
  const firstScale = firstLandmark.scale;
  const second = backgroundCompositionAt(96);

  assert.strictEqual(second, first);
  assert.strictEqual(second.catalog, catalog);
  assert.strictEqual(second.procedural, procedural);
  assert.strictEqual(second.catalog[0], firstLandmark);
  assert.strictEqual(second.catalog[0]!.scale, firstScale);
  assert.equal(second.catalog[0]!.x, -5);
});
