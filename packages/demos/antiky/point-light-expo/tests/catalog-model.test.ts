import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseGlb, type Model } from 'brometal';
import { validateExternalGltfSource } from '../scripts/gltf-pack-lib.mjs';

const SOURCE_ROOT = new URL('../assets/poly-haven/dead-tree-trunk/', import.meta.url);
const RUNTIME_MODEL = new URL('../assets/derived/dead-tree-trunk-runtime.glb', import.meta.url);
const PACKAGE_ROOT = new URL('../', import.meta.url);

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function glbJson(bytes: Uint8Array): Record<string, unknown> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).trim());
}

function containsExternalUri(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsExternalUri);
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => key === 'uri' || containsExternalUri(child));
}

const fakeModel: Model = {
  meshes: [{
    name: 'dead-tree',
    positions: new Float32Array(12),
    normals: new Float32Array(12),
    uvs: new Float32Array(8),
    indices: new Uint16Array([0, 1, 2]),
    imageIndex: 0,
  }],
  images: [
    { name: 'dead_tree_trunk_diff', mimeType: 'image/jpeg', data: new Uint8Array([1]) },
    { name: 'dead_tree_trunk_arm', mimeType: 'image/jpeg', data: new Uint8Array([2]) },
    { name: 'dead_tree_trunk_nor', mimeType: 'image/jpeg', data: new Uint8Array([3]) },
  ],
};

function fakeProgram(disposed: string[], failAttribute = false) {
  const retained = new Map<string, unknown>();
  const handle = (name: string) => ({
    set(value: unknown) {
      if (failAttribute && name === 'aNormal') throw new Error('injected model attribute failure');
      retained.set(name, value);
    },
  });
  return {
    retained,
    attributes: { aPosition: handle('aPosition'), aNormal: handle('aNormal'), aUv: handle('aUv') },
    instanceAttributes: {
      iOffset: handle('iOffset'), iScale: handle('iScale'), iRotation: handle('iRotation'),
      iTint: handle('iTint'), iMaterial: handle('iMaterial'),
    },
    uniforms: {
      uDiffuse: handle('uDiffuse'), uArm: handle('uArm'), uViewProj: handle('uViewProj'),
      uNormalMap: handle('uNormalMap'), uNormalStrength: handle('uNormalStrength'),
      uMaterialLayout: handle('uMaterialLayout'),
      uCameraPosition: handle('uCameraPosition'), uTime: handle('uTime'),
    },
    setIndices(value: unknown) { retained.set('indices', value); },
    draw() { retained.set('draws', (retained.get('draws') as number | undefined ?? 0) + 1); },
    dispose() { disposed.push('program'); },
  };
}

test('the verified external glTF is transformed into one BroMetal-parseable runtime GLB', async () => {
  const source = JSON.parse(await readFile(new URL('dead_tree_trunk_1k.gltf', SOURCE_ROOT), 'utf8'));
  assert.equal(source.buffers[0].uri, 'dead_tree_trunk.bin');
  assert.ok(source.images.every((image: { uri?: string }) => image.uri !== undefined));

  const runtimeBytes = await readFile(RUNTIME_MODEL);
  const model = parseGlb(arrayBuffer(runtimeBytes));
  assert.equal(model.meshes.length, 1);
  assert.ok(model.meshes[0]?.normals);
  assert.ok(model.meshes[0]?.uvs);
  assert.ok(model.meshes[0]?.indices);
  assert.deepEqual(model.images.map((image) => image.name), [
    'dead_tree_trunk_diff',
    'dead_tree_trunk_arm',
    // The normal map. It used to be downloaded, hash-verified, committed and then deleted at
    // pack time, which is why these scans read as clay.
    'dead_tree_trunk_nor',
  ]);
  const runtimeJson = glbJson(runtimeBytes);
  assert.equal(containsExternalUri(runtimeJson), false);
  const material = (runtimeJson.materials as { pbrMetallicRoughness: {
    baseColorTexture: { index: number };
    metallicRoughnessTexture: { index: number };
  } }[])[0]!;
  assert.equal(material.pbrMetallicRoughness.baseColorTexture.index, 0);
  assert.equal(material.pbrMetallicRoughness.metallicRoughnessTexture.index, 1);
});

test('the packer rejects unexpected external buffers, images, and extension URIs', () => {
  const valid = {
    buffers: [{ uri: 'tree.bin', byteLength: 4 }],
    images: [{ uri: 'diff.jpg' }, { uri: 'arm.jpg' }],
  };
  assert.doesNotThrow(() => validateExternalGltfSource(valid, {
    bufferUri: 'tree.bin',
    imageUris: ['diff.jpg', 'arm.jpg'],
  }));
  assert.throws(() => validateExternalGltfSource({
    ...valid,
    buffers: [...valid.buffers, { uri: 'extra.bin', byteLength: 4 }],
  }, { bufferUri: 'tree.bin', imageUris: ['diff.jpg', 'arm.jpg'] }), /buffers/);
  assert.throws(() => validateExternalGltfSource({
    ...valid,
    images: [...valid.images, { uri: 'surprise.jpg' }],
  }, { bufferUri: 'tree.bin', imageUris: ['diff.jpg', 'arm.jpg'] }), /images/);
  assert.throws(() => validateExternalGltfSource({
    ...valid,
    extensions: { EXT_external_payload: { uri: 'payload.bin' } },
  }, { bufferUri: 'tree.bin', imageUris: ['diff.jpg', 'arm.jpg'] }), /extension URI/);
});

test('catalog and derivation receipts match every shipped dead-tree byte', async () => {
  const registry = JSON.parse(await readFile(new URL('../assets/antiky-assets.json', import.meta.url), 'utf8'));
  const source = registry.assets.find((asset: { catalogId: string }) => (
    asset.catalogId === 'poly-haven:dead-tree-trunk'
  ));
  assert.ok(source);
  assert.equal(source.upstream.url, 'https://polyhaven.com/a/dead_tree_trunk');
  assert.equal(source.license.id, 'cc0-1.0');
  for (const file of source.files as readonly { path: string; sha256: string; size: number }[]) {
    const bytes = await readFile(new URL(file.path, PACKAGE_ROOT));
    assert.equal(bytes.length, file.size);
    assert.equal(sha256(bytes), file.sha256);
  }

  const receipt = JSON.parse(await readFile(new URL('../assets/derived-assets.json', import.meta.url), 'utf8'));
  const derived = receipt.derivedAssets[0];
  assert.equal(derived.catalogId, source.catalogId);
  assert.equal(derived.providerAssetUrl, source.upstream.url);
  assert.equal(derived.license.id, source.license.id);
  for (const input of derived.inputs as readonly { path: string; sha256: string }[]) {
    assert.equal(sha256(await readFile(new URL(input.path, PACKAGE_ROOT))), input.sha256);
  }
  const output = await readFile(new URL(derived.output.path, PACKAGE_ROOT));
  assert.equal(output.length, derived.output.size);
  assert.equal(sha256(output), derived.output.sha256);
});

test('catalog model construction rolls back textures, bitmaps, and the in-flight program', async () => {
  const { createReliquaryModelBatch } = await import('../src/reliquary-models.ts');
  const disposed: string[] = [];
  const closed: string[] = [];
  await assert.rejects(createReliquaryModelBatch({} as never, 2, {
    loadModel: async () => fakeModel,
    createBitmap: async (image) => ({ close() { closed.push(image.name); } }) as never,
    createTexture: (_renderer, _bitmap, role) => ({ dispose() { disposed.push(role); } }) as never,
    createProgram: () => fakeProgram(disposed, true) as never,
    createDepthProgram: () => fakeProgram(disposed) as never,
  }), /injected model attribute failure/);
  assert.deepEqual(closed, ['dead_tree_trunk_diff', 'dead_tree_trunk_arm', 'dead_tree_trunk_nor']);
  // Two programs now: the lit one and the shadow-pass one, both rolled back in reverse order.
  assert.deepEqual(disposed, ['program', 'program', 'normal', 'material', 'diffuse']);
});

test('catalog model uploads reuse retained instance storage and draw the parsed mesh', async () => {
  const { createReliquaryModelBatch } = await import('../src/reliquary-models.ts');
  const disposed: string[] = [];
  const program = fakeProgram(disposed);
  const depthProgram = fakeProgram(disposed);
  const batch = await createReliquaryModelBatch({} as never, 2, {
    loadModel: async () => fakeModel,
    createBitmap: async () => ({ close() {} }) as never,
    createTexture: (_renderer, _bitmap, role) => ({ role, dispose() { disposed.push(role); } }) as never,
    createProgram: () => program as never,
    createDepthProgram: () => depthProgram as never,
  });
  batch.setValues(0, 1, 2, 3, 4, 5, 6, 0.7, 0.8, 0.9, 0.2, 0.3, 0.4);
  batch.upload();
  const firstOffsets = program.retained.get('iOffset');
  batch.clear();
  batch.setValues(0, 2, 3, 4, 5, 6, 7, 0.6, 0.7, 0.8, 0.1, 0.2, 0.3);
  batch.upload();
  assert.equal(program.retained.get('iOffset'), firstOffsets);
  batch.draw();
  assert.equal(program.retained.get('draws'), 1);
  batch.dispose();
  // Two programs now: the lit one and the shadow-pass one, both rolled back in reverse order.
  assert.deepEqual(disposed, ['program', 'program', 'normal', 'material', 'diffuse']);
});
