import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseGlb } from 'brometal';
import { RELAY_PRESENTATION } from '../src/presentation.ts';
import { setupReliquaryModels } from '../src/reliquary-model-layout.ts';

const PACKAGE_ROOT = new URL('../', import.meta.url);

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function md5(bytes: Uint8Array): string {
  return createHash('md5').update(bytes).digest('hex');
}

function spans(values: Float32Array): readonly [number, number, number] {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < values.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis]!, values[index + axis]!);
      maximum[axis] = Math.max(maximum[axis]!, values[index + axis]!);
    }
  }
  return [maximum[0]! - minimum[0]!, maximum[1]! - minimum[1]!, maximum[2]! - minimum[2]!];
}

function glbJson(bytes: Uint8Array): Record<string, unknown> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)).trim());
}

function hasUri(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasUri);
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => key === 'uri' || hasUri(child));
}

function fakeProgram(disposed: string[]) {
  const retained = new Map<string, unknown>();
  const handle = (name: string) => ({ set(value: unknown) { retained.set(name, value); } });
  return {
    retained,
    attributes: { aPosition: handle('aPosition'), aNormal: handle('aNormal'), aUv: handle('aUv') },
    instanceAttributes: {
      iOffset: handle('iOffset'), iScale: handle('iScale'), iRotation: handle('iRotation'),
      iTint: handle('iTint'), iMaterial: handle('iMaterial'),
    },
    uniforms: {
      uDiffuse: handle('uDiffuse'), uArm: handle('uArm'), uMaterialLayout: handle('uMaterialLayout'),
      uNormalMap: handle('uNormalMap'), uNormalStrength: handle('uNormalStrength'),
    },
    setIndices(value: unknown) { retained.set('indices', value); },
    draw() { retained.set('draws', (retained.get('draws') as number | undefined ?? 0) + 1); },
    dispose() { disposed.push('program'); },
  };
}

test('official API receipts and shipped source bytes agree for rock and stump', async () => {
  const receipt = JSON.parse(await readFile(new URL('assets/source-assets.json', PACKAGE_ROOT), 'utf8'));
  assert.deepEqual(receipt.assets.map((asset: { catalogId: string }) => asset.catalogId), [
    'poly-haven:rock-moss-set-01',
    'poly-haven:tree-stump-01',
  ]);
  for (const asset of receipt.assets) {
    assert.equal(asset.license.id, 'cc0-1.0');
    assert.equal(asset.catalogGap, 'source-verified-no-installer-downloads');
    const apiSnapshot = await readFile(new URL(asset.apiSnapshot.path, PACKAGE_ROOT));
    assert.equal(sha256(apiSnapshot), asset.apiSnapshot.sha256);
    const api = JSON.parse(apiSnapshot.toString('utf8'));
    const gltf = api.gltf['1k'].gltf;
    const sourceDirectory = asset.apiSnapshot.path.replace(/\/api-files\.json$/, '');
    for (const file of asset.files) {
      const bytes = await readFile(new URL(file.path, PACKAGE_ROOT));
      const relativePath = file.path.slice(sourceDirectory.length + 1);
      const apiRecord = relativePath.endsWith('.gltf') ? gltf : gltf.include[relativePath];
      assert.ok(apiRecord, `${asset.catalogId} API record for ${relativePath}`);
      assert.equal(file.sourceUrl, apiRecord.url);
      assert.equal(file.size, apiRecord.size);
      assert.equal(file.md5, apiRecord.md5);
      assert.equal(bytes.length, file.size);
      assert.equal(md5(bytes), file.md5);
      assert.equal(sha256(bytes), file.sha256);
    }
    assert.equal(
      asset.upstream.infoApiUrl,
      `https://api.polyhaven.com/info/${asset.upstream.id}`,
    );
    assert.equal(typeof asset.infoSnapshot?.path, 'string');
    const infoSnapshot = await readFile(new URL(asset.infoSnapshot.path, PACKAGE_ROOT));
    assert.equal(sha256(infoSnapshot), asset.infoSnapshot.sha256);
    const info = JSON.parse(infoSnapshot.toString('utf8'));
    assert.equal(info.files_hash, asset.upstream.catalogSourceHash.value);
    assert.ok(Object.hasOwn(info.authors, asset.creator));
  }
});

test('rock and stump derivatives are distinct one-draw BroMetal models with embedded maps', async () => {
  const bytes = await Promise.all([
    readFile(new URL('assets/derived/rock-moss-set-01-runtime.glb', PACKAGE_ROOT)),
    readFile(new URL('assets/derived/tree-stump-01-runtime.glb', PACKAGE_ROOT)),
  ]);
  const models = bytes.map((source) => parseGlb(arrayBuffer(source)));
  const derivedReceipt = JSON.parse(await readFile(
    new URL('assets/derived-assets.json', PACKAGE_ROOT),
    'utf8',
  ));

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index]!;
    assert.equal(model.meshes.length, 1);
    assert.ok(model.meshes[0]?.normals);
    assert.ok(model.meshes[0]?.uvs);
    assert.ok(model.meshes[0]?.indices);
    assert.deepEqual(model.images.map((image) => image.name), ['catalog_diff', 'catalog_material', 'catalog_normal']);
    const json = glbJson(bytes[index]!);
    assert.equal(hasUri(json), false);
    const pbr = (json.materials as { pbrMetallicRoughness: {
      baseColorTexture: { index: number };
      metallicRoughnessTexture: { index: number };
    } }[])[0]!.pbrMetallicRoughness;
    assert.deepEqual([pbr.baseColorTexture.index, pbr.metallicRoughnessTexture.index], [0, 1]);
    const expectedCatalogId = index === 0
      ? 'poly-haven:rock-moss-set-01'
      : 'poly-haven:tree-stump-01';
    const receipt = derivedReceipt.derivedAssets.find((asset: { catalogId: string }) => (
      asset.catalogId === expectedCatalogId
    ));
    assert.ok(receipt);
    assert.equal(bytes[index]!.length, receipt.output.size);
    assert.equal(sha256(bytes[index]!), receipt.output.sha256);
  }
  const rockSpan = spans(models[0]!.meshes[0]!.positions);
  const stumpSpan = spans(models[1]!.meshes[0]!.positions);
  assert.ok(rockSpan.every((span) => span > 0.15));
  assert.ok(stumpSpan.every((span) => span > 0.15));
  assert.ok(Math.abs(rockSpan[1] / rockSpan[0] - stumpSpan[1] / stumpSpan[0]) > 0.2);
});

test('both primary model factories parse their catalog geometry into shared instance storage', async () => {
  const modelSources = await Promise.all([
    readFile(new URL('assets/derived/rock-moss-set-01-runtime.glb', PACKAGE_ROOT)),
    readFile(new URL('assets/derived/tree-stump-01-runtime.glb', PACKAGE_ROOT)),
  ]);
  const models = modelSources.map((source) => parseGlb(arrayBuffer(source)));
  const { createRockModelBatch, createStumpModelBatch } = await import('../src/reliquary-models.ts');
  const factories = [createRockModelBatch, createStumpModelBatch] as const;
  for (let index = 0; index < factories.length; index += 1) {
    const batch = await factories[index]!(1, {
      loadModel: async () => models[index]!,
      createBitmap: async () => ({ close() {} }) as never,
    });
    batch.setValues(0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0);

    assert.equal(batch.instanceData.iScale![0], 1);
    // The shadow pass has to see the same props the lit pass does. A batch handing the two passes
    // different arrays casts shadows from geometry that is no longer there.
    assert.equal(batch.depthInstanceData.iOffset, batch.instanceData.iOffset);
    assert.equal(batch.depthInstanceData.iScale, batch.instanceData.iScale);
    assert.equal(batch.depthInstanceData.iRotation, batch.instanceData.iRotation);
    // Three textures described, and both pipelines present.
    assert.equal(Object.keys(batch.textures).length, 3);
    assert.notEqual(batch.pipeline, batch.depthPipeline);
  }
});

test('actual transformed catalog geometry stays inside the projected reliquary bounds', async () => {
  const modelFiles = [
    'dead-tree-trunk-runtime.glb',
    'rock-moss-set-01-runtime.glb',
    'tree-stump-01-runtime.glb',
  ];
  const models = await Promise.all(modelFiles.map(async (file) => {
    const source = await readFile(new URL(`assets/derived/${file}`, PACKAGE_ROOT));
    return parseGlb(arrayBuffer(source));
  }));
  const instances: number[][][] = [[], [], []];
  const batches = instances.map((rows) => ({
    clear() {},
    setValues(...values: number[]) { rows.push(values); },
    upload() {},
  }));
  setupReliquaryModels(batches[0] as never, batches[1] as never, batches[2] as never);
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const positions = models[modelIndex]!.meshes[0]!.positions;
    for (const values of instances[modelIndex]!) {
      const [, offsetX, offsetY, offsetZ, scale, rotationX, rotationY, rotationZ] = values;
      for (let index = 0; index < positions.length; index += 3) {
        let x = positions[index]! * scale!;
        let y = positions[index + 1]! * scale!;
        let z = positions[index + 2]! * scale!;
        let cosine = Math.cos(rotationZ!);
        let sine = Math.sin(rotationZ!);
        [x, y] = [x * cosine - y * sine, x * sine + y * cosine];
        cosine = Math.cos(rotationX!);
        sine = Math.sin(rotationX!);
        [y, z] = [y * cosine - z * sine, y * sine + z * cosine];
        cosine = Math.cos(rotationY!);
        sine = Math.sin(rotationY!);
        [x, z] = [x * cosine - z * sine, x * sine + z * cosine];
        const world = [x + offsetX!, y + offsetY!, z + offsetZ!];
        for (let axis = 0; axis < 3; axis += 1) {
          minimum[axis] = Math.min(minimum[axis]!, world[axis]!);
          maximum[axis] = Math.max(maximum[axis]!, world[axis]!);
        }
      }
    }
  }
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(minimum[axis]! >= RELAY_PRESENTATION.reliquaryBounds.minimum[axis]!);
    assert.ok(maximum[axis]! <= RELAY_PRESENTATION.reliquaryBounds.maximum[axis]!);
  }
});
