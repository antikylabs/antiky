import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageRoot = new URL('../', import.meta.url);
const outputRoot = new URL('../dist/v1/', import.meta.url);

test('builds a versioned, frontend-readable static catalog API', async () => {
  const [manifest, index, catalog, natureKit] = await Promise.all([
    readFile(new URL('package.json', packageRoot), 'utf8').then(JSON.parse),
    readFile(new URL('index.json', outputRoot), 'utf8').then(JSON.parse),
    readFile(new URL('catalog.json', outputRoot), 'utf8').then(JSON.parse),
    readFile(new URL('assets/kenney/nature-kit.json', outputRoot), 'utf8').then(JSON.parse),
  ]);

  assert.equal(manifest.scripts.build, 'node --experimental-strip-types scripts/build-static-api.mjs');
  assert.equal(index.version, 'v1');
  assert.equal(index.catalogUrl, '/v1/catalog.json');
  assert.equal(index.assetUrlTemplate, '/v1/assets/{provider}/{slug}.json');
  assert.equal(index.totalCatalogAssets, 1292);
  assert.equal(catalog.version, 'v1');
  assert.equal(catalog.assets.length, 1292);
  assert.equal(natureKit.asset.id, 'kenney:nature-kit');
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
