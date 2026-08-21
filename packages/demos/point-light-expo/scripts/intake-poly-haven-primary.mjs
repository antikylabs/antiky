import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const retrievedAt = new Date().toISOString();

function md5(bytes) {
  return createHash('md5').update(bytes).digest('hex');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const assets = [
  {
    catalogId: 'poly-haven:rock-moss-set-01',
    upstreamId: 'rock_moss_set_01',
    directory: 'rock-moss-set-01',
    canonicalUrl: 'https://polyhaven.com/a/rock_moss_set_01',
    files: [
      ['rock_moss_set_01_1k.gltf', 'gltf', 9987, '75113cc1c21806cca5d8badad4737af7'],
      ['rock_moss_set_01.bin', 'include', 1466380, '207a51c9f56d34732e9814bbf9cc07b1'],
      ['textures/rock_moss_set_01_diff_1k.jpg', 'include', 168099, 'b8742301e6b4bc5683d2de712e83f772'],
      ['textures/rock_moss_set_01_rough_1k.jpg', 'include', 82624, 'ed9d8a2c863262f76f881346e8047c6a'],
      ['textures/rock_moss_set_01_nor_gl_1k.jpg', 'include', 209975, 'eb7ebd31ad08e78d0497900652ff1568'],
    ],
  },
  {
    catalogId: 'poly-haven:tree-stump-01',
    upstreamId: 'tree_stump_01',
    directory: 'tree-stump-01',
    canonicalUrl: 'https://polyhaven.com/a/tree_stump_01',
    files: [
      ['tree_stump_01_1k.gltf', 'gltf', 2793, 'fedfc620634a8dbaf6345413b13abe1a'],
      ['tree_stump_01.bin', 'include', 965380, 'acb292727949126b92e58217fd50fca9'],
      ['textures/tree_stump_01_diff_1k.jpg', 'include', 907451, 'c71fe60400276a37b8847048cbec3720'],
      ['textures/tree_stump_01_arm_1k.jpg', 'include', 825646, '09b7aa228dccb93f5cf4188ba5530578'],
      ['textures/tree_stump_01_nor_gl_1k.jpg', 'include', 1238404, 'cc2a3c6e4682a521b15cccc61a416bbf'],
    ],
  },
];

async function responseBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Poly Haven request failed (${response.status}) for ${url}.`);
  return Buffer.from(await response.arrayBuffer());
}

const receipts = [];
for (const asset of assets) {
  const apiUrl = `https://api.polyhaven.com/files/${asset.upstreamId}`;
  const infoApiUrl = `https://api.polyhaven.com/info/${asset.upstreamId}`;
  const apiBytes = await responseBytes(apiUrl);
  const infoBytes = await responseBytes(infoApiUrl);
  const api = JSON.parse(apiBytes.toString('utf8'));
  const info = JSON.parse(infoBytes.toString('utf8'));
  const gltf = api.gltf?.['1k']?.gltf;
  if (gltf === undefined) throw new Error(`${asset.upstreamId} has no official 1K glTF response.`);
  const creators = Object.keys(info.authors ?? {});
  if (typeof info.files_hash !== 'string' || creators.length === 0) {
    throw new Error(`${asset.upstreamId} official info response lacks a file hash or creator.`);
  }
  const targetRoot = new URL(`assets/poly-haven/${asset.directory}/`, root);
  await mkdir(new URL('textures/', targetRoot), { recursive: true });
  const files = [];
  for (const [path, sourceKind, expectedSize, expectedMd5] of asset.files) {
    const record = sourceKind === 'gltf' ? gltf : gltf.include?.[path];
    if (
      record === undefined
      || record.size !== expectedSize
      || record.md5 !== expectedMd5
      || typeof record.url !== 'string'
      || !record.url.startsWith('https://dl.polyhaven.org/file/ph-assets/')
    ) throw new Error(`${asset.upstreamId} API metadata drifted for ${path}.`);
    const bytes = await responseBytes(record.url);
    if (bytes.length !== expectedSize || md5(bytes) !== expectedMd5) {
      throw new Error(`${asset.upstreamId} download verification failed for ${path}.`);
    }
    await writeFile(new URL(path, targetRoot), bytes);
    files.push({
      path: `assets/poly-haven/${asset.directory}/${path}`,
      sourceUrl: record.url,
      size: bytes.length,
      md5: expectedMd5,
      sha256: sha256(bytes),
    });
  }
  const apiSnapshotPath = `assets/poly-haven/${asset.directory}/api-files.json`;
  const infoSnapshotPath = `assets/poly-haven/${asset.directory}/api-info.json`;
  const normalizedApi = Buffer.from(`${JSON.stringify(api, null, 2)}\n`);
  const normalizedInfo = Buffer.from(`${JSON.stringify(info, null, 2)}\n`);
  await writeFile(new URL(apiSnapshotPath, root), normalizedApi);
  await writeFile(new URL(infoSnapshotPath, root), normalizedInfo);
  receipts.push({
    catalogId: asset.catalogId,
    catalogGap: 'source-verified-no-installer-downloads',
    provider: { id: 'poly-haven', name: 'Poly Haven', url: 'https://polyhaven.com' },
    upstream: {
      id: asset.upstreamId,
      url: asset.canonicalUrl,
      apiUrl,
      infoApiUrl,
      catalogSourceHash: { algorithm: 'sha1', value: info.files_hash },
      retrievedAt,
    },
    creator: creators.join(', '),
    license: {
      id: 'cc0-1.0',
      referenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
    attribution: {
      required: true,
      notice: 'Asset and metadata delivered through the Poly Haven API. Assets are CC0; API attribution is required.',
    },
    apiSnapshot: { path: apiSnapshotPath, sha256: sha256(normalizedApi) },
    infoSnapshot: { path: infoSnapshotPath, sha256: sha256(normalizedInfo) },
    files,
  });
}

await writeFile(
  new URL('assets/source-assets.json', root),
  `${JSON.stringify({ schemaVersion: 1, assets: receipts }, null, 2)}\n`,
);
