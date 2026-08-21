import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { packExternalGltfToGlb, validateExternalGltfSource } from './gltf-pack-lib.mjs';

const root = new URL('../', import.meta.url);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const configurations = [
  {
    id: 'blackout-relay:dead-tree-trunk-runtime',
    catalogId: 'poly-haven:dead-tree-trunk',
    providerAssetUrl: 'https://polyhaven.com/a/dead_tree_trunk',
    sourceDirectory: 'dead-tree-trunk',
    gltfPath: 'dead_tree_trunk_1k.gltf',
    binPath: 'dead_tree_trunk.bin',
    diffusePath: 'textures/dead_tree_trunk_diff_1k.jpg',
    materialPath: 'textures/dead_tree_trunk_arm_1k.jpg',
    normalPath: 'textures/dead_tree_trunk_nor_gl_1k.jpg',
    imageUris: [
      'textures/dead_tree_trunk_nor_gl_1k.jpg',
      'textures/dead_tree_trunk_diff_1k.jpg',
      'textures/dead_tree_trunk_arm_1k.jpg',
    ],
    selectedMeshIndex: 0,
    outputPath: 'dead-tree-trunk-runtime.glb',
    diffuseName: 'dead_tree_trunk_diff',
    materialName: 'dead_tree_trunk_arm',
    normalName: 'dead_tree_trunk_nor',
    materialLayout: 'arm',
  },
  {
    id: 'blackout-relay:rock-moss-set-01-runtime',
    catalogId: 'poly-haven:rock-moss-set-01',
    providerAssetUrl: 'https://polyhaven.com/a/rock_moss_set_01',
    sourceDirectory: 'rock-moss-set-01',
    gltfPath: 'rock_moss_set_01_1k.gltf',
    binPath: 'rock_moss_set_01.bin',
    diffusePath: 'textures/rock_moss_set_01_diff_1k.jpg',
    materialPath: 'textures/rock_moss_set_01_rough_1k.jpg',
    normalPath: 'textures/rock_moss_set_01_nor_gl_1k.jpg',
    imageUris: [
      'textures/rock_moss_set_01_nor_gl_1k.jpg',
      'textures/rock_moss_set_01_diff_1k.jpg',
      'textures/rock_moss_set_01_rough_1k.jpg',
    ],
    selectedMeshIndex: 4,
    outputPath: 'rock-moss-set-01-runtime.glb',
    diffuseName: 'catalog_diff',
    materialName: 'catalog_material',
    normalName: 'catalog_normal',
    materialLayout: 'roughness-red',
  },
  {
    id: 'blackout-relay:tree-stump-01-runtime',
    catalogId: 'poly-haven:tree-stump-01',
    providerAssetUrl: 'https://polyhaven.com/a/tree_stump_01',
    sourceDirectory: 'tree-stump-01',
    gltfPath: 'tree_stump_01_1k.gltf',
    binPath: 'tree_stump_01.bin',
    diffusePath: 'textures/tree_stump_01_diff_1k.jpg',
    materialPath: 'textures/tree_stump_01_arm_1k.jpg',
    normalPath: 'textures/tree_stump_01_nor_gl_1k.jpg',
    imageUris: [
      'textures/tree_stump_01_nor_gl_1k.jpg',
      'textures/tree_stump_01_diff_1k.jpg',
      'textures/tree_stump_01_arm_1k.jpg',
    ],
    selectedMeshIndex: 0,
    outputPath: 'tree-stump-01-runtime.glb',
    diffuseName: 'catalog_diff',
    materialName: 'catalog_material',
    normalName: 'catalog_normal',
    materialLayout: 'arm',
  },
];

await mkdir(new URL('assets/derived/', root), { recursive: true });
const derivedAssets = [];
for (const configuration of configurations) {
  const sourceRoot = new URL(`assets/poly-haven/${configuration.sourceDirectory}/`, root);
  const sourceJsonBytes = await readFile(new URL(configuration.gltfPath, sourceRoot));
  const sourceJson = JSON.parse(sourceJsonBytes.toString('utf8'));
  validateExternalGltfSource(sourceJson, {
    bufferUri: configuration.binPath,
    imageUris: configuration.imageUris,
  });
  const sourceBin = await readFile(new URL(configuration.binPath, sourceRoot));
  const diffuse = await readFile(new URL(configuration.diffusePath, sourceRoot));
  const materialMap = await readFile(new URL(configuration.materialPath, sourceRoot));
  const normalMap = await readFile(new URL(configuration.normalPath, sourceRoot));
  const runtimeGlb = packExternalGltfToGlb({
    source: sourceJson,
    sourceBin,
    selectedMeshIndex: configuration.selectedMeshIndex,
    diffuse,
    materialMap,
    normalMap,
    diffuseName: configuration.diffuseName,
    materialName: configuration.materialName,
    normalName: configuration.normalName,
    generator: 'Antiky allowlisted external-gltf-to-glb packer v2',
  });
  const outputPath = `assets/derived/${configuration.outputPath}`;
  await writeFile(new URL(outputPath, root), runtimeGlb);
  derivedAssets.push({
    id: configuration.id,
    catalogId: configuration.catalogId,
    providerAssetUrl: configuration.providerAssetUrl,
    license: {
      id: 'cc0-1.0',
      referenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
    inputs: [
      [`assets/poly-haven/${configuration.sourceDirectory}/${configuration.gltfPath}`, sourceJsonBytes],
      [`assets/poly-haven/${configuration.sourceDirectory}/${configuration.binPath}`, sourceBin],
      [`assets/poly-haven/${configuration.sourceDirectory}/${configuration.diffusePath}`, diffuse],
      [`assets/poly-haven/${configuration.sourceDirectory}/${configuration.materialPath}`, materialMap],
    ].map(([path, bytes]) => ({ path, sha256: sha256(bytes) })),
    output: { path: outputPath, sha256: sha256(runtimeGlb), size: runtimeGlb.length },
    transform: {
      script: 'scripts/pack-catalog-models.mjs',
      library: 'scripts/gltf-pack-lib.mjs',
      version: 2,
      selectedMeshIndex: configuration.selectedMeshIndex,
      materialLayout: configuration.materialLayout,
      operations: [
        'Validate the exact external buffer/image URI allowlist and reject every other URI.',
        'Select one named source mesh without modifying its vertex, normal, UV, or index data.',
        'Embed the verified source binary plus diffuse and material JPEGs as GLB buffer views.',
        'Bind embedded diffuse and material maps to base-color and metallic-roughness slots.',
        'Omit the tangent-space normal binding because the runtime shader has no tangent basis.',
      ],
    },
  });
}

await writeFile(
  new URL('assets/derived-assets.json', root),
  `${JSON.stringify({ schemaVersion: 1, derivedAssets }, null, 2)}\n`,
);
