import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATALOG_ASSETS } from '../src/catalog-data.ts';
import {
  CATALOG_API_ASSET_PATH_TEMPLATE,
  CATALOG_API_BASE_PATH,
  CATALOG_API_CATALOG_PATH,
  CATALOG_API_SCHEMA_VERSION,
  CATALOG_API_VERSION,
  catalogApiAssetPath,
} from '../src/static-api.ts';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(packageRoot, 'dist');
const versionRoot = path.join(outputRoot, CATALOG_API_BASE_PATH.slice(1));
const previewSource = path.resolve(packageRoot, 'public/previews');

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
  version: CATALOG_API_VERSION,
  schemaVersion: CATALOG_API_SCHEMA_VERSION,
  generatedAt,
  totalCatalogAssets: CATALOG_ASSETS.length,
  catalogUrl: CATALOG_API_CATALOG_PATH,
  assetUrlTemplate: CATALOG_API_ASSET_PATH_TEMPLATE,
});

await writeJson(path.join(versionRoot, 'catalog.json'), {
  version: CATALOG_API_VERSION,
  schemaVersion: CATALOG_API_SCHEMA_VERSION,
  generatedAt,
  totalCatalogAssets: CATALOG_ASSETS.length,
  assets: CATALOG_ASSETS,
});

for (const asset of CATALOG_ASSETS) {
  await writeJson(path.join(outputRoot, catalogApiAssetPath(asset.provider.id, asset.slug).slice(1)), {
    version: CATALOG_API_VERSION,
    schemaVersion: CATALOG_API_SCHEMA_VERSION,
    generatedAt,
    asset,
  });
}

await cp(previewSource, path.join(outputRoot, 'previews'), { recursive: true });
console.log(`Built ${CATALOG_ASSETS.length} static asset records in ${versionRoot}.`);
