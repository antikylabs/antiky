import assert from 'node:assert/strict';
import test from 'node:test';

import { catalogAsset, catalogSearch } from '../src/lib/catalog.ts';

test('supports the public forest model search query', () => {
  const results = catalogSearch({ q: 'forest', type: 'model' });
  assert.ok(results.some((asset) => asset.id === 'poly-haven:dead-tree-trunk'));
  assert.ok(results.every((asset) => asset.kind === 'model'));
});

test('resolves permanent provider and slug identities', () => {
  assert.equal(catalogAsset('poly-haven', 'forest-floor')?.upstream.id, 'forest_floor');
  assert.equal(catalogAsset('missing', 'forest-floor'), undefined);
});

test('exposes the expanded catalog to search and agents', () => {
  assert.ok(catalogSearch({}).length > 1_200);
  assert.equal(catalogAsset('poly-haven', 'grass-medium-01')?.verification, 'source-verified');
});

test('uses a stable shuffled mix weighted toward Kenney and Quaternius', () => {
  const firstPage = catalogSearch({}).slice(0, 48);
  assert.deepEqual(firstPage, catalogSearch({}).slice(0, 48));
  assert.notDeepEqual(firstPage.map((asset) => asset.name), firstPage.map((asset) => asset.name).toSorted());
  const providerCounts = new Map<string, number>();
  for (const asset of firstPage) {
    providerCounts.set(asset.provider.id, (providerCounts.get(asset.provider.id) ?? 0) + 1);
  }
  assert.ok((providerCounts.get('kenney') ?? 0) >= 18);
  assert.ok((providerCounts.get('quaternius') ?? 0) >= 18);
  assert.ok((providerCounts.get('poly-haven') ?? 0) >= 4);
  assert.ok(firstPage.filter((asset) => asset.kind === 'model' || asset.kind === 'hdri').length >= 18);
  assert.ok(firstPage.filter((asset) => asset.kind === 'sprite' || asset.kind === 'texture').length >= 12);
});

test('filters by dimension, format, and verification status', () => {
  const twoDimensional = catalogSearch({ dimension: '2d' });
  assert.ok(twoDimensional.length > 100);
  assert.ok(twoDimensional.every((asset) => asset.kind === 'sprite' || asset.kind === 'texture'));

  const gltf = catalogSearch({ format: 'gltf' });
  assert.ok(gltf.length > 10);
  assert.ok(gltf.every((asset) => asset.formats.includes('gltf')));

  const installVerified = catalogSearch({ verification: 'install-verified' });
  assert.equal(installVerified.length, 3);
  assert.ok(installVerified.every((asset) => asset.verification === 'install-verified'));
});

test('supports explicit catalog sort orders', () => {
  const ascending = catalogSearch({ sort: 'name-asc' });
  const descending = catalogSearch({ sort: 'name-desc' });
  const mostFiles = catalogSearch({ sort: 'files-desc' });

  assert.deepEqual(ascending.map((asset) => asset.name), ascending.map((asset) => asset.name).toSorted((a, b) => a.localeCompare(b)));
  assert.deepEqual(descending.map((asset) => asset.name), ascending.map((asset) => asset.name).toReversed());
  assert.ok((mostFiles[0]?.fileCount ?? 0) >= (mostFiles[1]?.fileCount ?? 0));
});
