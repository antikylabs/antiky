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
