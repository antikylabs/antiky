import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { installCatalogAsset } from './node/install.ts';
import type { CatalogAsset } from './index.ts';

const bytes = new TextEncoder().encode('asset bytes');
const md5 = createHash('md5').update(bytes).digest('hex');

const asset = {
  id: 'poly-haven:forest-floor',
  slug: 'forest-floor',
  name: 'Forest Floor',
  description: 'Forest material.',
  kind: 'texture',
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
    url: '/previews/poly-haven/forest-floor.webp', sourceUrl: 'https://example.com/preview.png',
    width: 256, height: 256,
  },
  downloads: [{
    path: 'forest_floor_diff_1k.jpg',
    format: 'jpg',
    size: bytes.byteLength,
    url: 'https://dl.polyhaven.org/forest.jpg',
    hash: { algorithm: 'md5', value: md5 },
  }],
  license: {
    id: 'cc0-1.0', name: 'CC0 1.0 Universal',
    referenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    permitsModification: true, permitsRedistribution: true, requiresAttribution: false,
  },
  provenance: {
    creator: 'eye-candy.xyz', sourceUrl: 'https://polyhaven.com/a/forest_floor',
    retrievedAt: '2026-08-09T00:00:00.000Z', sourceSha256: 'files-hash',
  },
  attribution: { required: true, notice: 'Asset delivered through the Poly Haven API.' },
  verification: 'verified',
} satisfies CatalogAsset;

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'antiky-asset-install-'));
  await writeFile(join(root, 'test.antiky'), JSON.stringify({ schemaVersion: 1 }));
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
  assert.equal(registry.assets[0].files[0].sha256, createHash('sha256').update(bytes).digest('hex'));
});

test('rejects a download whose bytes do not match upstream provenance', async () => {
  const root = await project();
  await assert.rejects(
    installCatalogAsset({ asset, projectRoot: root, fetch: async () => new Response('asset bytez') }),
    /hash mismatch/i,
  );
});
