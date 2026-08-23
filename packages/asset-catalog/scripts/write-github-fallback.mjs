import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATALOG_ASSETS } from '../src/catalog-data.ts';
import {
  CATALOG_API_SCHEMA_VERSION,
  CATALOG_API_VERSION,
} from '../src/static-api.ts';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(packageRoot, 'data/installable-assets.v1.json');
const temporary = `${target}.${process.pid}.tmp`;
const generatedAt = CATALOG_ASSETS.reduce(
  (latest, asset) => asset.provenance.retrievedAt > latest ? asset.provenance.retrievedAt : latest,
  '',
);
const assets = CATALOG_ASSETS
  .filter((asset) => asset.verification === 'install-verified')
  .toSorted((left, right) => left.id.localeCompare(right.id));

if (assets.length === 0) throw new Error('The GitHub fallback must contain an install-verified asset');

await writeFile(temporary, `${JSON.stringify({
  version: CATALOG_API_VERSION,
  schemaVersion: CATALOG_API_SCHEMA_VERSION,
  generatedAt,
  assets,
}, null, 2)}\n`, 'utf8');
await rename(temporary, target);
console.log(`Wrote ${assets.length} install-verified assets to ${target}.`);
