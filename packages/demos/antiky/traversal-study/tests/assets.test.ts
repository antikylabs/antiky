import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import { parseGlb } from 'brometal';

import {
  TRAVERSAL_ASSETS,
  TRAVERSAL_CATALOG_IDS,
  TRAVERSAL_PRESENTATION_CATALOG_ID,
} from '../src/asset-catalog.ts';
import { TRAVERSAL_CATALOG_DRAW_CALLS } from '../src/render-plan.ts';
import { createDeterministicSelectionZip } from '../scripts/build-quaternius-selection.mjs';

const root = new URL('../', import.meta.url);

test('every catalog GLB parses with indexed geometry and an embedded image', async () => {
  const manifest = JSON.parse(await readFile(new URL('assets/antiky-assets.json', root), 'utf8'));
  // Model receipts only. This test is about GLBs parsing, and the manifest also carries texture
  // receipts now — a material set is not a catalog model and has no geometry to check.
  const modelIds = manifest.assets
    .filter((entry: { kind?: string }) => entry.kind !== 'texture')
    .map((entry: { catalogId: string }) => entry.catalogId);
  assert.deepEqual(modelIds, TRAVERSAL_CATALOG_IDS);

  for (const asset of TRAVERSAL_ASSETS) {
    const path = new URL(asset.relativePath, root);
    const bytes = await readFile(path);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const model = parseGlb(arrayBuffer);
    const manifestCatalog = manifest.assets.find((entry: { catalogId: string }) => entry.catalogId === asset.catalogId);
    assert.ok(manifestCatalog, `${asset.catalogId} is missing from asset provenance`);
    const manifestFile = manifestCatalog.files.find((entry: { derivedPath: string }) => entry.derivedPath === asset.relativePath);
    assert.ok(manifestFile, `${asset.fileName} is missing from asset provenance`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifestFile.derivedSha256);
    assert.ok(model.meshes.length >= 1, `${asset.fileName} has no mesh`);
    assert.ok(model.images.length >= 1, `${asset.fileName} has no embedded image`);
    assert.ok(model.images.every((image) => image.data.byteLength > 0));
    assert.ok(model.meshes.every((mesh) => mesh.indices !== null && mesh.imageIndex !== null && mesh.uvs !== null));
    assert.equal(model.meshes.length, TRAVERSAL_CATALOG_DRAW_CALLS[asset.id]);
  }
});

test('Quaternius presentation assets retain official source, CC0, transform, and material evidence', async () => {
  const manifest = JSON.parse(await readFile(new URL('assets/antiky-assets.json', root), 'utf8'));
  const presentation = manifest.assets.find(
    (entry: { catalogId: string }) => entry.catalogId === TRAVERSAL_PRESENTATION_CATALOG_ID,
  );
  assert.ok(presentation);
  assert.equal(presentation.license.id, 'CC0-1.0');
  assert.match(presentation.officialSourcePageUrl, /^https:\/\/quaternius\.com\//);
  assert.match(presentation.officialDownloadUrl, /^https:\/\/drive\.google\.com\//);
  assert.equal(presentation.publisherArchive.uploadId, '4975456');
  assert.equal(presentation.publisherArchive.accessPageUrl, 'https://quaternius.itch.io/ultimate-platformer-pack/purchase');
  assert.match(presentation.publisherArchive.sha256, /^[a-f0-9]{64}$/);
  assert.match(presentation.archive.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(presentation.archive.construction, {
    script: 'scripts/build-quaternius-selection.mjs',
    entryOrder: presentation.archive.contents,
    timestamp: '1980-01-01T00:00:00Z',
    compression: 'store',
  });
  assert.match(presentation.license.sourceSha256, /^[a-f0-9]{64}$/);
  const copiedLicense = await readFile(new URL(presentation.license.copiedTo, root));
  assert.equal(
    createHash('sha256').update(copiedLicense).digest('hex'),
    presentation.license.sourceSha256,
  );

  const presentationAssets = TRAVERSAL_ASSETS.filter(
    (asset) => asset.catalogId === TRAVERSAL_PRESENTATION_CATALOG_ID,
  );
  assert.equal(presentation.files.length, presentationAssets.length);
  for (const asset of presentationAssets) {
    const file = presentation.files.find(
      (entry: { derivedPath: string }) => entry.derivedPath === asset.relativePath,
    );
    assert.ok(file, `${asset.id} lacks provenance`);
    if (file.officialFileUrl === undefined) {
      assert.ok(file.officialArchivePath.endsWith(file.originalPath));
    } else {
      assert.match(file.officialFileUrl, /^https:\/\/drive\.google\.com\//);
    }
    assert.match(file.originalSha256, /^[a-f0-9]{64}$/);
    assert.ok(file.transformation.length > 30);
    assert.equal(file.validation.parser, 'brometal@0.15.0 parseGlb');
    assert.equal(file.validation.result, 'pass');
    assert.equal(file.validation.meshes, 1);
    assert.equal(file.validation.images, 1);

    const bytes = await readFile(new URL(asset.relativePath, root));
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const model = parseGlb(arrayBuffer);
    assert.equal(model.meshes.length, 1, `${asset.id} must remain one draw`);
    assert.equal(model.images.length, 1);
    assert.equal(model.images[0]!.mimeType, 'image/png');
    assert.equal(model.meshes[0]!.imageIndex, 0);
  }

  const tower = presentation.files.find(
    (entry: { derivedPath: string }) => entry.derivedPath.endsWith('/relay-tower.glb'),
  );
  assert.equal(
    tower.officialFileUrl,
    'https://drive.google.com/uc?export=download&id=1ZwygnPEOK0lNMNXfvmyuWl5C1hN6HDqg',
  );
});

test('the Quaternius selection archive recipe is byte-stable across source order', () => {
  const first = createDeterministicSelectionZip([
    { name: 'Tree.gltf', bytes: new Uint8Array([3, 1, 4]) },
    { name: 'Character.gltf', bytes: new Uint8Array([1, 5, 9]) },
  ]);
  const second = createDeterministicSelectionZip([
    { name: 'Character.gltf', bytes: new Uint8Array([1, 5, 9]) },
    { name: 'Tree.gltf', bytes: new Uint8Array([3, 1, 4]) },
  ]);
  assert.equal(createHash('sha256').update(first).digest('hex'), createHash('sha256').update(second).digest('hex'));
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.equal(first.readUInt32LE(first.length - 22), 0x06054b50);
});

test('the shipped presentation includes one coherent authored courier and coastal landmark family', () => {
  const assetIds = new Set<string>(TRAVERSAL_ASSETS.map((asset) => asset.id));
  for (const required of ['courier', 'cloud-small', 'cloud-large', 'coastal-cliff', 'coastal-tree', 'relay-tower']) {
    assert.ok(assetIds.has(required), `missing authored Quaternius presentation asset ${required}`);
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
