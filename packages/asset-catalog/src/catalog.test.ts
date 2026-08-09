import assert from 'node:assert/strict';
import test from 'node:test';

import { searchAssets, type CatalogAsset } from './index.ts';
import { createPolyHavenAsset } from './providers/poly-haven.ts';

const assets: CatalogAsset[] = [
  {
    id: 'kenney:prototype-kit',
    slug: 'prototype-kit',
    name: 'Prototype Kit',
    description: 'Modular 3D forms for early game worlds.',
    kind: 'model',
    formats: ['glb'],
    tags: ['3d', 'prototype'],
    categories: ['prototype'],
    provider: { id: 'kenney', name: 'Kenney', url: 'https://kenney.nl' },
    upstream: {
      id: 'prototype-kit',
      url: 'https://kenney.nl/assets/prototype-kit',
      filesHash: 'pending-ingestion',
      retrievedAt: '2026-08-09',
    },
    preview: { url: '/preview.webp', sourceUrl: 'https://example.com/preview.png', width: 256, height: 256 },
    downloads: [],
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
    attribution: { required: false, notice: 'Credit Kenney when practical.' },
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

test('normalizes Poly Haven API metadata and download files', () => {
  const asset = createPolyHavenAsset({
    upstreamId: 'dead_tree_trunk',
    metadata: {
      name: 'Dead Tree Trunk',
      type: 2,
      description: 'A weathered forest log.',
      tags: ['forest', 'log'],
      categories: ['nature'],
      authors: { 'Rob Tuytel': 'All' },
      files_hash: 'aggregate-sha1',
      thumbnail_url: 'https://cdn.polyhaven.com/tree.png?width=256&height=256',
    },
    files: [{
      path: 'dead_tree_trunk_1k.gltf',
      format: 'gltf',
      size: 2812,
      url: 'https://dl.polyhaven.org/tree.gltf',
      hash: { algorithm: 'md5', value: '7bbf9fc9fdf61b50ed0495a29c03ecab' },
    }],
    retrievedAt: '2026-08-09T00:00:00.000Z',
  });

  assert.equal(asset.id, 'poly-haven:dead-tree-trunk');
  assert.equal(asset.provider.id, 'poly-haven');
  assert.equal(asset.kind, 'model');
  assert.equal(asset.upstream.id, 'dead_tree_trunk');
  assert.equal(asset.downloads[0]?.hash.algorithm, 'md5');
  assert.match(asset.attribution.notice, /Poly Haven/);
});

test('searches provider records by text and type', () => {
  const forestModel = {
    ...assets[0]!,
    kind: 'model' as const,
    tags: ['forest'],
    verification: 'verified' as const,
  };
  assert.deepEqual(searchAssets([forestModel], { text: 'forest', kind: 'model' }), [forestModel]);
});
