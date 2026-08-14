import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseGlb } from 'brometal';

import { ENEMY_HULL_CONTRACTS, PLAYER_HULL_CONTRACT } from '../src/combat-hulls.ts';

const selectedAssets = Object.freeze([
  'room-small.glb',
  'template-floor-layer.glb',
  'target-detail.glb',
  'grenade-a.glb',
]);

const sourceUrls = Object.freeze([
  new URL('../assets/kenney/modular-space-kit/room-small.glb', import.meta.url),
  new URL('../assets/kenney/modular-space-kit/template-floor-layer.glb', import.meta.url),
  new URL('../assets/kenney/blaster-kit/target-detail.glb', import.meta.url),
  new URL('../assets/kenney/blaster-kit/grenade-a.glb', import.meta.url),
]);

const shipAssets = Object.freeze([
  'spitfire-blue.glb',
  'striker-red.glb',
  'omen-orange.glb',
  'imperial-red.glb',
  'executioner-red.glb',
] as const);

const shipUrls = Object.freeze(shipAssets.map((fileName) => (
  new URL(`../assets/quaternius/ultimate-spaceships/${fileName}`, import.meta.url)
)));
const shipTextureHashes = Object.freeze([
  '59965e110e6ebe0a3f62120a42099b5d6107a9d1ad124afa1189b9bc1954f08d',
  '43dfa2597eb1bae1db209686be0ef6cf12e307aa50a5c55d2e04341b3c356255',
  '4925ba424ad828b1928926e057ca07232b7bfb7af8eb3542fa5e3d77d1d14648',
  'eb9d56bdbf8d66a2241ea7dfcf3c6c032e82844c99427466b05461e03bc876be',
  '2b10363d811f45e1ad89e3e808d031ddbded91deb3107b142f84ec604dcd9879',
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

test('selected Ultimate Spaceships combatant GLBs expose textured ship silhouettes through BroMetal', async () => {
  for (const sourceUrl of shipUrls) {
    const bytes = await readFile(sourceUrl);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const model = parseGlb(data);
    assert.equal(model.meshes.length, 1, fileURLToPath(sourceUrl));
    assert.ok(model.meshes.every((mesh) => (
      mesh.positions.length > 0
      && mesh.normals !== null
      && mesh.uvs !== null
      && mesh.indices !== null
      && mesh.indices.length > 0
      && mesh.imageIndex === 0
    )));
    assert.equal(model.images.length, 1);
    assert.equal(model.images[0]!.mimeType, 'image/png');
    assert.ok(model.images[0]!.data.length > 500_000);
  }
});

test('selected Ultimate Spaceships embed distinct authored color textures', async () => {
  const imageHashes = new Set<string>();
  for (let assetIndex = 0; assetIndex < shipUrls.length; assetIndex += 1) {
    const sourceUrl = shipUrls[assetIndex]!;
    const bytes = await readFile(sourceUrl);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const image = parseGlb(data).images[0]!;
    const hash = createHash('sha256').update(image.data).digest('hex');
    assert.equal(hash, shipTextureHashes[assetIndex], fileURLToPath(sourceUrl));
    imageHashes.add(hash);
  }
  assert.equal(imageHashes.size, shipAssets.length);
});

test('Ultimate Spaceships ship bytes and decoded texture estimate stay explicit', async () => {
  let shippedBytes = 0;
  let decodedBaseBytes = 0;
  for (const sourceUrl of shipUrls) {
    shippedBytes += (await stat(sourceUrl)).size;
    const bytes = await readFile(sourceUrl);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const image = parseGlb(data).images[0]!.data;
    const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    assert.equal(width, 2_048);
    assert.equal(height, 2_048);
    decodedBaseBytes += width * height * 4;
  }
  assert.equal(shippedBytes, 15_375_156);
  const estimatedMipBytes = decodedBaseBytes * 4 / 3;
  assert.ok(Math.abs(estimatedMipBytes / 1_048_576 - 106.6667) < 0.001);
});

test('Ultimate Spaceships authored materials require two-sided rendering', async () => {
  for (const sourceUrl of shipUrls) {
    const bytes = await readFile(sourceUrl);
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as {
      materials?: readonly Readonly<{ doubleSided?: boolean }>[];
    };
    assert.ok(gltf.materials?.length);
    assert.ok(gltf.materials!.every((material) => material.doubleSided === true), fileURLToPath(sourceUrl));
  }
});

test('runtime hull radii equal the farthest scaled shipped vertex', async () => {
  const contracts = [
    PLAYER_HULL_CONTRACT,
    ENEMY_HULL_CONTRACTS.rusher,
    ENEMY_HULL_CONTRACTS.gunner,
    ENEMY_HULL_CONTRACTS['shield-anchor'],
    ENEMY_HULL_CONTRACTS.warden,
  ] as const;
  for (let assetIndex = 0; assetIndex < shipUrls.length; assetIndex += 1) {
    const bytes = await readFile(shipUrls[assetIndex]!);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const model = parseGlb(data);
    const contract = contracts[assetIndex]!;
    let radialMaximum = 0;
    for (const mesh of model.meshes) {
      for (let vertex = 0; vertex < mesh.positions.length; vertex += 3) {
        radialMaximum = Math.max(radialMaximum, Math.hypot(
          mesh.positions[vertex]! * contract.presentation.x,
          mesh.positions[vertex + 2]! * contract.presentation.z,
        ));
      }
    }
    assert.ok(
      Math.abs(contract.projectileRadius - radialMaximum) < 0.000_001,
      `${shipAssets[assetIndex]} contract ${contract.projectileRadius} versus parsed ${radialMaximum}`,
    );
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
  for (const asset of shipAssets) {
    const stem = asset.slice(0, -'.glb'.length);
    assert.ok(
      shipped.some((fileName) => fileName.startsWith(`${stem}-`) && fileName.endsWith('.glb')),
      `${asset} was not emitted under dist/assets`,
    );
  }
  assert.ok(!shipped.some((fileName) => fileName.startsWith('craft_') && fileName.endsWith('.glb')));
});
