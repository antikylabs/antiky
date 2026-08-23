import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CATALOG_API_BASE_URL,
  CATALOG_API_CATALOG_PATH,
  catalogApiAssetPath,
} from '../src/static-api.ts';
import { CATALOG_ASSETS } from '../src/catalog-data.ts';

const packageRoot = new URL('../', import.meta.url);
const outputRoot = new URL('../dist/v1/', import.meta.url);

test('builds a versioned, frontend-readable static catalog API', async () => {
  const [manifest, index, catalog, natureKit, githubFallback] = await Promise.all([
    readFile(new URL('package.json', packageRoot), 'utf8').then(JSON.parse),
    readFile(new URL('index.json', outputRoot), 'utf8').then(JSON.parse),
    readFile(new URL('catalog.json', outputRoot), 'utf8').then(JSON.parse),
    readFile(new URL('assets/kenney/nature-kit.json', outputRoot), 'utf8').then(JSON.parse),
    readFile(new URL('data/installable-assets.v1.json', packageRoot), 'utf8').then(JSON.parse),
  ]);

  assert.equal(manifest.scripts.build, 'node --experimental-strip-types scripts/build-static-api.mjs');
  assert.equal(index.version, 'v1');
  assert.equal(index.catalogUrl, CATALOG_API_CATALOG_PATH);
  assert.equal(index.assetUrlTemplate, '/v1/assets/{provider}/{slug}.json');
  assert.equal(index.totalCatalogAssets, 1466);
  assert.equal(catalog.version, 'v1');
  assert.equal(catalog.assets.length, 1466);
  assert.equal(natureKit.asset.id, 'kenney:nature-kit');
  assert.deepEqual(catalog.assets, CATALOG_ASSETS);
  assert.equal(CATALOG_API_BASE_URL, 'https://assets.antikylabs.com/v1');
  assert.equal(githubFallback.version, 'v1');
  assert.equal(githubFallback.schemaVersion, 1);
  assert.deepEqual(
    githubFallback.assets,
    CATALOG_ASSETS.filter((asset) => asset.verification === 'install-verified'),
  );

  for (const asset of CATALOG_ASSETS) {
    const document = JSON.parse(await readFile(new URL(`../dist${catalogApiAssetPath(asset.provider.id, asset.slug)}`, import.meta.url), 'utf8'));
    assert.deepEqual(document.asset, asset, `${asset.id} static document drifted from the package catalog`);
  }
});

test('deployment is static-only and permits browser clients to read JSON', async () => {
  const config = JSON.parse(await readFile(new URL('vercel.json', packageRoot), 'utf8'));

  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.headers[0].source, '/v1/(.*)');
  assert.ok(config.headers[0].headers.some(({ key, value }) => (
    key === 'Access-Control-Allow-Origin' && value === '*'
  )));
  await assert.rejects(readFile(new URL('api/index.ts', packageRoot)), { code: 'ENOENT' });
});
