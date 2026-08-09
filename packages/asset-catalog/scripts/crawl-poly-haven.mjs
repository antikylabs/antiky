import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { fetchPolyHavenMetadataCatalog } from '../src/providers/poly-haven-client.ts';

const output = path.resolve(process.argv[2] ?? 'data/poly-haven.generated.json');
const retrievedAt = new Date().toISOString();
const assets = await fetchPolyHavenMetadataCatalog({ limit: 995, retrievedAt });
const ids = new Set(assets.map((asset) => asset.id));
if (assets.length !== 995 || ids.size !== assets.length) {
  throw new Error(`Expected 995 unique Poly Haven records, received ${assets.length} (${ids.size} unique)`);
}

const byType = Object.fromEntries(['model', 'texture', 'hdri'].map((kind) => [
  kind,
  assets.filter((asset) => asset.kind === kind).length,
]));
const snapshot = {
  schemaVersion: 1,
  provider: 'poly-haven',
  sourceUrl: 'https://api.polyhaven.com/assets',
  retrievedAt,
  selection: {
    strategy: 'round-robin-by-type-then-download-count',
    limit: 995,
    excludedInstallVerifiedIds: ['dead_tree_trunk', 'forest_floor', 'forest_slope'],
    byType,
  },
  assets,
};
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
await mkdir(path.dirname(output), { recursive: true });
const temporary = `${output}.tmp`;
await writeFile(temporary, serialized, 'utf8');
await rename(temporary, output);
process.stdout.write(`Cataloged ${assets.length} Poly Haven records (${JSON.stringify(byType)}) from one metadata request; wrote ${serialized.length} bytes.\n`);
