import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import { parseGlb } from 'brometal';

import { TRAVERSAL_ASSETS, TRAVERSAL_CATALOG_ID } from '../src/asset-catalog.ts';

const root = new URL('../', import.meta.url);

test('every catalog GLB parses with indexed geometry and an embedded image', async () => {
  const manifest = JSON.parse(await readFile(new URL('assets/antiky-assets.json', root), 'utf8'));
  assert.equal(manifest.assets[0].catalogId, TRAVERSAL_CATALOG_ID);

  for (const asset of TRAVERSAL_ASSETS) {
    const path = new URL(`assets/kenney/platformer-kit/${asset.fileName}`, root);
    const bytes = await readFile(path);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const model = parseGlb(arrayBuffer);
    const manifestFile = manifest.assets[0].files.find((entry: { derivedPath: string }) => entry.derivedPath.endsWith(asset.fileName));
    assert.ok(manifestFile, `${asset.fileName} is missing from asset provenance`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifestFile.derivedSha256);
    assert.ok(model.meshes.length >= 1, `${asset.fileName} has no mesh`);
    assert.ok(model.images.length >= 1, `${asset.fileName} has no embedded image`);
    assert.ok(model.images.every((image) => image.data.byteLength > 0));
    assert.ok(model.meshes.every((mesh) => mesh.indices !== null && mesh.imageIndex !== null));
  }
});

test('the production bundle ships every referenced GLB as a non-inlined asset', async () => {
  const bundle = await readFile(new URL('dist/antiky.game.js', root), 'utf8');
  const shipped = await readdir(new URL('dist/assets/', root));
  for (const asset of TRAVERSAL_ASSETS) {
    const stem = asset.fileName.slice(0, -4);
    const bundledName = shipped.find((name) => name.startsWith(`${stem}-`) && name.endsWith('.glb'));
    assert.ok(bundledName, `${asset.fileName} was not emitted to dist/assets`);
    assert.match(bundle, new RegExp(bundledName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
