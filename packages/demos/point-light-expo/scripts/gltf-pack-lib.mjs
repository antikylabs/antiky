import { checkFidelity } from '../../scripts/asset-fidelity-policy.mjs';

function uriPaths(value, path = '', results = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      uriPaths(value[index], `${path}.${index}`, results);
    }
    return results;
  }
  if (value === null || typeof value !== 'object') return results;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path === '' ? key : `${path}.${key}`;
    if (key === 'uri') results.push(childPath);
    uriPaths(child, childPath, results);
  }
  return results;
}

export function validateExternalGltfSource(source, expected) {
  if (!Array.isArray(source.buffers) || source.buffers.length !== 1) {
    throw new Error('External glTF source must contain exactly one buffer in buffers.');
  }
  if (source.buffers[0]?.uri !== expected.bufferUri) {
    throw new Error(`External glTF buffer URI must be ${expected.bufferUri}.`);
  }
  if (!Array.isArray(source.images) || source.images.length !== expected.imageUris.length) {
    throw new Error('External glTF source images do not match the allowlist.');
  }
  for (let index = 0; index < expected.imageUris.length; index += 1) {
    if (source.images[index]?.uri !== expected.imageUris[index]) {
      throw new Error(`External glTF source images do not match allowlisted URI ${expected.imageUris[index]}.`);
    }
  }
  const expectedUriPaths = new Set([
    'buffers.0.uri',
    ...expected.imageUris.map((_, index) => `images.${index}.uri`),
  ]);
  for (const path of uriPaths(source)) {
    if (!expectedUriPaths.has(path)) {
      if (path.includes('extensions')) throw new Error(`External glTF contains an extension URI at ${path}.`);
      throw new Error(`External glTF contains an unexpected URI at ${path}.`);
    }
  }
}

function padded(bytes, pad = 0) {
  const length = Math.ceil(bytes.length / 4) * 4;
  const result = Buffer.alloc(length, pad);
  bytes.copy(result);
  return result;
}

export function packExternalGltfToGlb({
  source,
  sourceBin,
  selectedMeshIndex,
  diffuse,
  materialMap,
  normalMap,
  diffuseName,
  materialName,
  normalName,
  generator,
}) {
  // The normal map used to be downloaded, hash-verified, committed, and then deleted here. Without
  // it the Poly Haven scans lose every surface detail smaller than a triangle, which is why the
  // rock read as clay: nothing for a light to catch.
  if (!Buffer.isBuffer(normalMap) || normalMap.length === 0) {
    throw new Error('A packed catalog model must carry its normal map.');
  }
  if (source.buffers[0]?.byteLength !== sourceBin.length) {
    throw new Error('External glTF buffer length does not match its verified source binary.');
  }
  if (!Array.isArray(source.meshes) || selectedMeshIndex < 0 || selectedMeshIndex >= source.meshes.length) {
    throw new Error(`Selected mesh ${selectedMeshIndex} is outside the external glTF mesh list.`);
  }
  const selectedMesh = structuredClone(source.meshes[selectedMeshIndex]);
  if (
    !Array.isArray(selectedMesh.primitives)
    || selectedMesh.primitives.length !== 1
    || selectedMesh.primitives[0]?.indices === undefined
    || selectedMesh.primitives[0]?.attributes?.POSITION === undefined
    || selectedMesh.primitives[0]?.attributes?.NORMAL === undefined
    || selectedMesh.primitives[0]?.attributes?.TEXCOORD_0 === undefined
  ) throw new Error('Selected mesh must be one indexed position/normal/UV primitive.');
  selectedMesh.primitives[0].material = 0;

  const binParts = [padded(sourceBin)];
  let byteOffset = binParts[0].length;
  const embeddedImages = [diffuse, materialMap, normalMap].map((image) => {
    const view = { buffer: 0, byteOffset, byteLength: image.length };
    const bytes = padded(image);
    binParts.push(bytes);
    byteOffset += bytes.length;
    return view;
  });
  const binaryChunk = Buffer.concat(binParts);

  const material = structuredClone(source.materials?.[0] ?? { pbrMetallicRoughness: {} });
  material.pbrMetallicRoughness ??= {};
  material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
  material.pbrMetallicRoughness.metallicRoughnessTexture = { index: 1 };
  material.normalTexture = { index: 2 };
  const sourceBufferViews = structuredClone(source.bufferViews);
  const runtimeJson = {
    asset: { version: '2.0', generator },
    accessors: structuredClone(source.accessors),
    bufferViews: [...sourceBufferViews, ...embeddedImages],
    buffers: [{ byteLength: binaryChunk.length }],
    images: [
      { name: diffuseName, mimeType: 'image/jpeg', bufferView: sourceBufferViews.length },
      { name: materialName, mimeType: 'image/jpeg', bufferView: sourceBufferViews.length + 1 },
      { name: normalName, mimeType: 'image/jpeg', bufferView: sourceBufferViews.length + 2 },
    ],
    samplers: [structuredClone(source.samplers?.[0] ?? {})],
    textures: [{ sampler: 0, source: 0 }, { sampler: 0, source: 1 }, { sampler: 0, source: 2 }],
    materials: [material],
    meshes: [selectedMesh],
    nodes: [{ mesh: 0, name: selectedMesh.name ?? 'catalog-model' }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };

  const jsonChunk = padded(Buffer.from(JSON.stringify(runtimeJson)), 0x20);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binaryChunk.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  // The shared policy, read off the object that is about to be written rather than off the arguments
  // that were passed in.
  //
  // This check used to sit thirteen lines earlier and assert `packedMaterialMaps: ['normalTexture']`
  // as a literal — a constant compared against a constant, before the material existed. Deleting
  // `material.normalTexture` below left it green and shipped three models with no normal map.
  // Resolved all the way to the image, by name.
  //
  // Two weaker versions of this check passed while the normal map was missing. Asserting a literal
  // `['normalTexture']` compared a constant with a constant. Asserting the key exists passed because
  // the material is cloned from the source, which carries its own `normalTexture` — and asserting
  // the index is in range passed too, because the source's index happens to be valid in our shorter
  // texture list. Only following material -> texture -> image -> name proves the map we packed is
  // the map the material points at.
  const packedMaps = [];
  const normalIndex = runtimeJson.materials[0].normalTexture?.index;
  const normalSource = normalIndex === undefined ? undefined : runtimeJson.textures[normalIndex]?.source;
  if (normalSource !== undefined && runtimeJson.images[normalSource]?.name === normalName) {
    packedMaps.push('normalTexture');
  }
  const fidelity = checkFidelity({
    name: diffuseName,
    attributes: Object.keys(runtimeJson.meshes[0].primitives[0].attributes),
    sourceMaterialMaps: source.materials?.[0]?.normalTexture === undefined ? [] : ['normalTexture'],
    packedMaterialMaps: packedMaps,
    materialCount: runtimeJson.materials.length,
    uniqueUvCount: Number.POSITIVE_INFINITY,
  });
  if (fidelity.length > 0) throw new Error(fidelity.join('\n'));

  return Buffer.concat([header, jsonHeader, jsonChunk, binaryHeader, binaryChunk]);
}
