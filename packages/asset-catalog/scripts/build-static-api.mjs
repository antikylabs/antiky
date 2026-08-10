import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATALOG_ASSETS } from '../src/catalog-data.ts';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(packageRoot, 'dist');
const versionRoot = path.join(outputRoot, 'v1');
const previewSource = path.resolve(packageRoot, '../asset-site/public/previews');

const generatedAt = CATALOG_ASSETS.reduce(
  (latest, asset) => asset.provenance.retrievedAt > latest ? asset.provenance.retrievedAt : latest,
  '',
);

const writeJson = async (target, value) => {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value)}\n`, 'utf8');
};

await rm(outputRoot, { recursive: true, force: true });

await writeJson(path.join(versionRoot, 'index.json'), {
  version: 'v1',
  schemaVersion: 1,
  generatedAt,
  totalCatalogAssets: CATALOG_ASSETS.length,
  catalogUrl: '/v1/catalog.json',
  assetUrlTemplate: '/v1/assets/{provider}/{slug}.json',
});

await writeJson(path.join(versionRoot, 'catalog.json'), {
  version: 'v1',
  schemaVersion: 1,
  generatedAt,
  totalCatalogAssets: CATALOG_ASSETS.length,
  assets: CATALOG_ASSETS,
});

for (const asset of CATALOG_ASSETS) {
  await writeJson(path.join(versionRoot, 'assets', asset.provider.id, `${asset.slug}.json`), {
    version: 'v1',
    schemaVersion: 1,
    generatedAt,
    asset,
  });
}

await cp(previewSource, path.join(outputRoot, 'previews'), { recursive: true });
console.log(`Built ${CATALOG_ASSETS.length} static asset records in ${versionRoot}.`);
