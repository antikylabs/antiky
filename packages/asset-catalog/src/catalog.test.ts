import assert from 'node:assert/strict';
import test from 'node:test';

import { searchAssets, type CatalogAsset } from './index.ts';

const assets: CatalogAsset[] = [
  {
    id: 'kenney:prototype-kit',
    name: 'Prototype Kit',
    description: 'Modular 3D forms for early game worlds.',
    kind: 'model',
    formats: ['glb'],
    tags: ['3d', 'prototype'],
    license: {
      id: 'cc0-1.0',
      name: 'CC0 1.0 Universal',
      referenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      permitsModification: true,
      permitsRedistribution: true,
      requiresAttribution: false,
    },
    provenance: {
      creator: 'Kenney',
      sourceUrl: 'https://kenney.nl/assets',
      retrievedAt: '2026-08-09',
      sourceSha256: 'pending-ingestion',
    },
    verification: 'pending',
  },
];

test('searches normalized asset metadata', () => {
  assert.deepEqual(searchAssets(assets, { text: 'KENNEY' }), assets);
  assert.deepEqual(searchAssets(assets, { text: 'prototype', kind: 'model' }), assets);
  assert.deepEqual(searchAssets(assets, { kind: 'audio' }), []);
});

test('can require verified catalog entries', () => {
  assert.deepEqual(searchAssets(assets, { verifiedOnly: true }), []);
});
