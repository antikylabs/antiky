import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseGlb } from 'brometal';
import { checkFidelity } from '../../../scripts/asset-fidelity-policy.mjs';

const records = Object.freeze([
  {
    hull: 'player',
    scale: { x: 0.17, z: 0.22 },
    gltf: 'Spitfire.gltf',
    gltfId: '190E7T13jvAH8rVzD3dd484gPfN5fV8X3',
    gltfSha256: '65df89a9a163ca1ce2d2ef253668b1b4e670f6903052fd566f54162ac5a92920',
    texture: 'Spitfire_Blue.png',
    textureId: '1LM7mPH8IevKEeKI7_MnvA1ysmzzfupxU',
    textureSha256: '59965e110e6ebe0a3f62120a42099b5d6107a9d1ad124afa1189b9bc1954f08d',
    output: 'spitfire-blue.glb',
  },
  {
    hull: 'rusher',
    scale: { x: 0.28, z: 0.26 },
    gltf: 'Striker.gltf',
    gltfId: '1TmKsBDmZnMIHHZL1ec5WD2Yq1FVwu3Ai',
    gltfSha256: '2f6c4b1d16f11d5ce02833c5841ff17e19700418c83e52501ed29e3c2bc79359',
    texture: 'Striker_Red.png',
    textureId: '1PF7wvd9GFHBvjcjmxFgLcHZo6x_s1TF_',
    textureSha256: '43dfa2597eb1bae1db209686be0ef6cf12e307aa50a5c55d2e04341b3c356255',
    output: 'striker-red.glb',
  },
  {
    hull: 'gunner',
    scale: { x: 0.15, z: 0.16 },
    gltf: 'Omen.gltf',
    gltfId: '1AI4LO8e8-CRd9z9fm4h8XPG90OekGdZb',
    gltfSha256: 'dd77f3f08d17227083b714d80cbc0d0470a6b44480003cca9051a53183571160',
    texture: 'Omen_Orange.png',
    textureId: '1u_H0fMN_wSJCIwtoeDoKIOi30Cf4JY0z',
    textureSha256: '4925ba424ad828b1928926e057ca07232b7bfb7af8eb3542fa5e3d77d1d14648',
    output: 'omen-orange.glb',
  },
  {
    hull: 'shieldAnchor',
    scale: { x: 0.25, z: 0.14 },
    gltf: 'Imperial.gltf',
    gltfId: '1QWFecMijLgalCJpj9O_wihq6VE09Hrl-',
    gltfSha256: '389012d28270b859adb48ce12d1307af536f395ed734aafcb30f59ec8a9bb2e3',
    texture: 'Imperial_Red.png',
    textureId: '1rulcb694V2ZnHWEYFRIEQ2mfjvzRa2aI',
    textureSha256: 'eb9d56bdbf8d66a2241ea7dfcf3c6c032e82844c99427466b05461e03bc876be',
    output: 'imperial-red.glb',
  },
  {
    hull: 'warden',
    scale: { x: 0.48, z: 0.5 },
    gltf: 'Executioner.gltf',
    gltfId: '1DaCoRPG1Q54SFBOPMrhTOZNaNETsuRB1',
    gltfSha256: '95dd08b854b0588480e91515949c5fd3e329ec856882e2b58b71e4cdc41348f9',
    texture: 'Executioner_Red.png',
    textureId: '1SNmGO_0L4pOnDGW3Z86J2N7hnz6EmFuw',
    textureSha256: '2b10363d811f45e1ad89e3e808d031ddbded91deb3107b142f84ec604dcd9879',
    output: 'executioner-red.glb',
  },
]);

const license = Object.freeze({
  file: 'License.txt',
  id: '16iPJQOxZQgJB6UBiutO-PU35YROyGEL8',
  sha256: '83d8959f9fc56353ed571fbe2dc52e4bcd64508e2399501cd45ac2ce3df0bf8c',
});

const sourceDirectory = resolve(process.argv[2] ?? '');
if (process.argv[2] === undefined) {
  throw new Error('Usage: node scripts/intake-quaternius-ships.mjs <official-source-directory>');
}
const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(packageDirectory, 'assets/quaternius/ultimate-spaceships');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertHash(fileName, bytes, expected) {
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`${fileName} SHA-256 ${actual} did not match ${expected}`);
}

function paddedLength(length) {
  return (length + 3) & ~3;
}

function packGlb(gltf, binary) {
  const jsonBytes = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonLength = paddedLength(jsonBytes.length);
  const binaryLength = paddedLength(binary.length);
  const output = Buffer.alloc(12 + 8 + jsonLength + 8 + binaryLength);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonLength, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  output.fill(0x20, 20, 20 + jsonLength);
  jsonBytes.copy(output, 20);
  const binaryHeader = 20 + jsonLength;
  output.writeUInt32LE(binaryLength, binaryHeader);
  output.writeUInt32LE(0x004e4942, binaryHeader + 4);
  binary.copy(output, binaryHeader + 8);
  return output;
}

function normalize(gltfBytes, textureBytes, textureName) {
  const gltf = JSON.parse(gltfBytes.toString('utf8'));
  if (gltf.buffers?.length !== 1 || !gltf.buffers[0].uri?.startsWith('data:application/octet-stream;base64,')) {
    throw new Error('Expected one archive-authored embedded data buffer');
  }
  if (gltf.images?.length !== 1 || gltf.images[0].bufferView === undefined) {
    throw new Error('Expected one archive-authored bufferView image');
  }
  // The shared policy. This script copies the source GLB's structure wholesale, which is why its
  // 2048x2048 ship textures kept their unwraps while a merging script would have lost them — but
  // "it happens to be right" is not a guarantee, so it asserts like the other two.
  const primitive = gltf.meshes?.[0]?.primitives?.[0];
  const fidelity = checkFidelity({
    name: textureName,
    attributes: Object.keys(primitive?.attributes ?? {}),
    sourceMaterialMaps: gltf.materials?.[0]?.normalTexture === undefined ? [] : ['normalTexture'],
    packedMaterialMaps: gltf.materials?.[0]?.normalTexture === undefined ? [] : ['normalTexture'],
    materialCount: Math.max(1, gltf.materials?.length ?? 1),
    uniqueUvCount: Number.POSITIVE_INFINITY,
  });
  if (fidelity.length > 0) throw new Error(fidelity.join('\n'));

  const sourceBinary = Buffer.from(gltf.buffers[0].uri.split(',', 2)[1], 'base64');
  const imageBufferView = gltf.images[0].bufferView;
  const chunks = [];
  let byteOffset = 0;
  for (let index = 0; index < gltf.bufferViews.length; index += 1) {
    const view = gltf.bufferViews[index];
    const source = index === imageBufferView
      ? textureBytes
      : sourceBinary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const alignedOffset = paddedLength(byteOffset);
    if (alignedOffset > byteOffset) chunks.push(Buffer.alloc(alignedOffset - byteOffset));
    chunks.push(source);
    view.buffer = 0;
    view.byteOffset = alignedOffset;
    view.byteLength = source.length;
    byteOffset = alignedOffset + source.length;
  }
  const binary = Buffer.concat(chunks);
  gltf.buffers = [{ byteLength: binary.length }];
  gltf.images[0].name = textureName.replace(/\.png$/i, '');
  gltf.images[0].mimeType = 'image/png';
  gltf.asset.extras = {
    ...(gltf.asset.extras ?? {}),
    antikyNormalization: 'Repacked embedded data URI as GLB BIN and substituted selected official color texture',
  };
  return packGlb(gltf, binary);
}

function deriveFootprint(output, record) {
  const data = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
  const model = parseGlb(data);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let radialRadius = 0;
  for (const mesh of model.meshes) {
    for (let vertex = 0; vertex < mesh.positions.length; vertex += 3) {
      const x = mesh.positions[vertex];
      const z = mesh.positions[vertex + 2];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      radialRadius = Math.max(radialRadius, Math.hypot(x * record.scale.x, z * record.scale.z));
    }
  }
  return {
    asset: record.output,
    scale: record.scale,
    span: {
      width: (maxX - minX) * record.scale.x,
      length: (maxZ - minZ) * record.scale.z,
    },
    radialRadius,
  };
}

await mkdir(outputDirectory, { recursive: true });
const footprints = {
  schemaVersion: 1,
  derivation: 'Maximum hypot(position.x * runtimeScale.x, position.z * runtimeScale.z) over every BroMetal-parsed shipped vertex',
  ships: {},
};
for (const record of records) {
  const gltfBytes = await readFile(resolve(sourceDirectory, record.gltf));
  const textureBytes = await readFile(resolve(sourceDirectory, record.texture));
  assertHash(record.gltf, gltfBytes, record.gltfSha256);
  assertHash(record.texture, textureBytes, record.textureSha256);
  const output = normalize(gltfBytes, textureBytes, basename(record.texture));
  await writeFile(resolve(outputDirectory, record.output), output);
  footprints.ships[record.hull] = deriveFootprint(output, record);
  process.stdout.write(`${record.output} ${sha256(output)}\n`);
}
const generatedFootprints = `/* Generated by scripts/intake-quaternius-ships.mjs. Do not edit. */\n\nexport const SHIP_FOOTPRINTS = ${JSON.stringify(footprints, null, 2)} as const;\n`;
await writeFile(resolve(packageDirectory, 'src/ship-footprints.gen.ts'), generatedFootprints);
const licenseBytes = await readFile(resolve(sourceDirectory, license.file));
assertHash(license.file, licenseBytes, license.sha256);
await copyFile(resolve(sourceDirectory, license.file), resolve(outputDirectory, license.file));
