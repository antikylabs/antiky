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

test('prioritizes and interleaves sources in the default catalog view', () => {
  const firstPage = catalogSearch({}).slice(0, 48);
  assert.deepEqual(firstPage.slice(0, 5).map((asset) => asset.provider.id), [
    'kenney', 'quaternius', 'kenney', 'quaternius', 'poly-haven',
  ]);
  const providerCounts = new Map<string, number>();
  for (const asset of firstPage) {
    providerCounts.set(asset.provider.id, (providerCounts.get(asset.provider.id) ?? 0) + 1);
  }
  assert.equal(providerCounts.get('kenney'), 20);
  assert.equal(providerCounts.get('quaternius'), 19);
  assert.equal(providerCounts.get('poly-haven'), 9);
});
