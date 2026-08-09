import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { fetchKenneyCatalog } from '../src/providers/kenney-client.ts';
import { fetchQuaterniusCatalog } from '../src/providers/quaternius-client.ts';

const output = path.resolve(process.argv[2] ?? 'data/curated-sources.generated.json');
const retrievedAt = new Date().toISOString();
const kenney = await fetchKenneyCatalog({ retrievedAt, concurrency: 4 });
const quaternius = await fetchQuaterniusCatalog({ retrievedAt, concurrency: 4 });
if (kenney.length < 200 || quaternius.length < 80) {
  throw new Error(`Source coverage unexpectedly low: Kenney ${kenney.length}, Quaternius ${quaternius.length}`);
}
const assets = [...kenney, ...quaternius];
const ids = new Set(assets.map((asset) => asset.id));
if (ids.size !== assets.length) throw new Error(`Generated source catalog contains ${assets.length - ids.size} duplicate IDs`);

const snapshot = {
  schemaVersion: 1,
  retrievedAt,
  sources: [
    { provider: 'kenney', indexUrl: 'https://kenney.nl/assets', count: kenney.length },
    { provider: 'quaternius', indexUrl: 'https://quaternius.com/index.html', count: quaternius.length },
  ],
  policy: 'official-html-metadata-only-no-archive-downloads',
  assets,
};
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
await mkdir(path.dirname(output), { recursive: true });
const temporary = `${output}.tmp`;
await writeFile(temporary, serialized, 'utf8');
await rename(temporary, output);
process.stdout.write(`Cataloged ${kenney.length} Kenney and ${quaternius.length} Quaternius packs; wrote ${serialized.length} bytes.\n`);
