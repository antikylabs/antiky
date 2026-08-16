import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CATALOG_API_CATALOG_URL,
  catalogApiAssetPath,
  catalogApiAssetUrl,
} from '@antiky/asset-catalog/static-api';
import { catalogAsset, catalogCount } from '../../src/lib/assets.ts';

test('the website consumes the catalog package static delivery contract', async () => {
  const catalog = JSON.parse(await readFile(new URL('../../../asset-catalog/dist/v1/catalog.json', import.meta.url), 'utf8'));
  const natureKit = catalogAsset('kenney', 'nature-kit');

  assert.ok(natureKit);
  assert.equal(catalog.totalCatalogAssets, catalogCount());
  assert.deepEqual(catalog.assets.find((asset: { id: string }) => asset.id === natureKit.id), natureKit);
  assert.equal(CATALOG_API_CATALOG_URL, 'https://catalog-api.antikylabs.com/v1/catalog.json');
  assert.equal(catalogApiAssetPath('kenney', 'nature-kit'), '/v1/assets/kenney/nature-kit.json');
  assert.equal(catalogApiAssetUrl(natureKit), 'https://catalog-api.antikylabs.com/v1/assets/kenney/nature-kit.json');
});
