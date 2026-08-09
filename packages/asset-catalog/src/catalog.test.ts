import assert from 'node:assert/strict';
import test from 'node:test';

import { searchAssets, type CatalogAsset } from './index.ts';
import { createPolyHavenAsset } from './providers/poly-haven.ts';
import { fetchPolyHavenStarterCatalog } from './providers/poly-haven-client.ts';

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

test('imports the model, texture, and HDRI starter set through the Poly Haven API', async () => {
  const calls: string[] = [];
  const metadata = Object.fromEntries([
    ['dead_tree_trunk', 2], ['forest_floor', 1], ['forest_slope', 0],
  ].map(([id, type]) => [id, {
    name: id, type, description: `${id} description`, tags: ['forest'], categories: ['nature'],
    authors: { Creator: 'All' }, files_hash: `${id}-files`,
    thumbnail_url: `https://cdn.polyhaven.com/${id}.png`,
  }]));
  const file = (path: string) => ({ size: 4, url: `https://dl.polyhaven.org/${path}`, md5: '098f6bcd4621d373cade4e832627b4f6' });
  const files = {
    dead_tree_trunk: { gltf: { '1k': { gltf: { ...file('tree.gltf'), include: {
      'textures/tree_arm.jpg': file('textures/tree_arm.jpg'),
      'tree.bin': file('tree.bin'),
      'textures/tree_diff.jpg': file('textures/tree_diff.jpg'),
    } } } } },
    forest_floor: {
      Diffuse: { '1k': { jpg: file('diff.jpg') } }, AO: { '1k': { jpg: file('ao.jpg') } },
      Rough: { '1k': { jpg: file('rough.jpg') } }, nor_gl: { '1k': { jpg: file('normal.jpg') } },
    },
    forest_slope: { hdri: { '1k': { hdr: file('forest.hdr') } } },
  };
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/assets')) return Response.json(metadata);
    const id = url.slice(url.lastIndexOf('/') + 1) as keyof typeof files;
    return Response.json(files[id]);
  };

  const imported = await fetchPolyHavenStarterCatalog({
    fetch: fetcher as typeof fetch,
    retrievedAt: '2026-08-09T00:00:00.000Z',
  });
  assert.deepEqual(imported.map((asset) => asset.kind), ['model', 'texture', 'hdri']);
  assert.deepEqual(imported[0]?.downloads.map((item) => item.path), [
    'tree.gltf', 'tree.bin', 'textures/tree_diff.jpg', 'textures/tree_arm.jpg',
  ]);
  assert.equal(imported[1]?.downloads.length, 4);
  assert.equal(calls.length, 4);
});
