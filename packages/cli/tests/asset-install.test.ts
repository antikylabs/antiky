import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  GITHUB_CATALOG_FALLBACK_URL,
  resolveCatalogAsset,
  type CatalogAsset,
} from '../src/assets/catalog.ts';
import { installCatalogAsset } from '../src/assets/install.ts';

const bytes = new TextEncoder().encode('asset bytes');
const md5 = createHash('md5').update(bytes).digest('hex');

const asset = {
  id: 'poly-haven:forest-floor',
  slug: 'forest-floor',
  name: 'Forest Floor',
  description: 'Forest material.',
  kind: 'texture',
  quality: 1,
  fileCount: 1,
  formats: ['jpg'],
  tags: ['forest'],
  categories: ['nature'],
  provider: { id: 'poly-haven', name: 'Poly Haven', url: 'https://polyhaven.com' },
  upstream: {
    id: 'forest_floor',
    url: 'https://polyhaven.com/a/forest_floor',
    filesHash: 'files-hash',
    retrievedAt: '2026-08-09T00:00:00.000Z',
  },
  preview: {
    url: '/previews/poly-haven/forest-floor.webp',
    sourceUrl: 'https://example.com/preview.png',
    width: 256,
    height: 256,
    hosting: 'local',
  },
  facts: {},
  downloads: [{
    path: 'forest_floor_diff_1k.jpg',
    format: 'jpg',
    size: bytes.byteLength,
    url: 'https://dl.polyhaven.org/forest.jpg',
    hash: { algorithm: 'md5', value: md5 },
  }],
  license: {
    id: 'cc0-1.0',
    name: 'CC0 1.0 Universal',
    referenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    permitsModification: true,
    permitsRedistribution: true,
    requiresAttribution: false,
  },
  provenance: {
    creator: 'eye-candy.xyz',
    sourceUrl: 'https://polyhaven.com/a/forest_floor',
    retrievedAt: '2026-08-09T00:00:00.000Z',
    sourceHash: { algorithm: 'sha1', value: 'files-hash' },
  },
  attribution: { required: true, notice: 'Asset delivered through the Poly Haven API.' },
  verification: 'install-verified',
} satisfies CatalogAsset;

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'antiky-cli-asset-install-'));
  await writeFile(join(root, 'test.antiky'), '{}\n');
  return root;
}

test('installs verified bytes and records durable project provenance', async () => {
  const root = await project();
  const receipt = await installCatalogAsset({
    asset,
    projectRoot: root,
    fetch: async () => new Response(bytes),
    installedAt: '2026-08-09T01:00:00.000Z',
  });

  assert.equal(receipt.catalogId, asset.id);
  assert.equal(await readFile(join(root, receipt.files[0]!.path), 'utf8'), 'asset bytes');
  const registry = JSON.parse(await readFile(join(root, 'assets', 'antiky-assets.json'), 'utf8'));
  assert.equal(registry.assets[0].upstream.id, 'forest_floor');
  assert.equal(
    registry.assets[0].files[0].sha256,
    createHash('sha256').update(bytes).digest('hex'),
  );
});

test('rejects downloaded bytes that do not match catalog provenance', async () => {
  const root = await project();
  await assert.rejects(
    installCatalogAsset({ asset, projectRoot: root, fetch: async () => new Response('asset bytez') }),
    /hash mismatch/iu,
  );
});

test('rejects catalog paths that escape the project', async () => {
  const root = await project();
  const download = asset.downloads[0]!;
  const unsafeAsset = {
    ...asset,
    downloads: [{ ...download, path: '../escape.jpg' }],
  } satisfies CatalogAsset;

  await assert.rejects(
    installCatalogAsset({ asset: unsafeAsset, projectRoot: root, fetch: async () => new Response(bytes) }),
    /unsafe catalog asset path/iu,
  );
});

test('accepts every record in the committed GitHub fallback artifact', async () => {
  const source = await readFile(
    new URL('../../asset-catalog/data/installable-assets.v1.json', import.meta.url),
    'utf8',
  );
  const document = JSON.parse(source) as { assets: Array<{ id: string }> };

  for (const expected of document.assets) {
    const [provider, slug] = expected.id.split(':');
    assert.ok(provider && slug);
    const resolved = await resolveCatalogAsset({
      provider,
      slug,
      allowGithubFallback: true,
      fetch: async (input) => String(input) === GITHUB_CATALOG_FALLBACK_URL
        ? new Response(source)
        : new Response('unavailable', { status: 503 }),
    });
    assert.equal(resolved?.id, expected.id);
    assert.equal(resolved?.verification, 'install-verified');
  }
});
