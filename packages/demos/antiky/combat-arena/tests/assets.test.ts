import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseGlb } from 'brometal';

const selectedAssets = Object.freeze([
  'room-small.glb',
  'template-floor-layer.glb',
  'cables.glb',
  'target-detail.glb',
  'grenade-a.glb',
]);

const sourceUrls = Object.freeze([
  new URL('../assets/kenney/modular-space-kit/room-small.glb', import.meta.url),
  new URL('../assets/kenney/modular-space-kit/template-floor-layer.glb', import.meta.url),
  new URL('../assets/kenney/modular-space-kit/cables.glb', import.meta.url),
  new URL('../assets/kenney/blaster-kit/target-detail.glb', import.meta.url),
  new URL('../assets/kenney/blaster-kit/grenade-a.glb', import.meta.url),
]);

test('selected catalog GLBs parse with embedded images through BroMetal', async () => {
  for (const sourceUrl of sourceUrls) {
    const bytes = await readFile(sourceUrl);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const model = parseGlb(data);
    assert.ok(model.meshes.length >= 1, fileURLToPath(sourceUrl));
    assert.ok(model.meshes.every((mesh) => mesh.positions.length > 0));
    assert.ok(model.images.length >= 1, fileURLToPath(sourceUrl));
    assert.ok(model.images.every((image) => image.mimeType === 'image/png' && image.data.length > 0));
  }
});

test('production build ships every selected GLB as a non-inlined asset', async () => {
  const outputDirectory = new URL('../dist/assets/', import.meta.url);
  const shipped = await readdir(outputDirectory);
  for (const asset of selectedAssets) {
    const stem = asset.slice(0, -'.glb'.length);
    assert.ok(
      shipped.some((fileName) => fileName.startsWith(`${stem}-`) && fileName.endsWith('.glb')),
      `${asset} was not emitted under dist/assets`,
    );
  }
});
