import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { fetchHandpickedItchCatalog, HANDPICKED_ITCH_SOURCES } from '../src/providers/handpicked-client.ts';

const output = path.resolve(process.argv[2] ?? 'data/handpicked-sources.generated.json');
const retrievedAt = new Date().toISOString();
const catalog = await fetchHandpickedItchCatalog({ retrievedAt });
const aliasCount = HANDPICKED_ITCH_SOURCES.filter((source) => source.existing).length;
if (HANDPICKED_ITCH_SOURCES.length !== 19 || catalog.assets.length !== 13 || aliasCount !== 6) {
  throw new Error(`Handpicked coverage changed unexpectedly: ${HANDPICKED_ITCH_SOURCES.length} sources, ${catalog.assets.length} assets, ${aliasCount} aliases`);
}

const snapshot = {
  schemaVersion: 1,
  policy: 'handpicked-itch-html-metadata-only-no-archive-downloads',
  retrievedAt,
  sources: HANDPICKED_ITCH_SOURCES.map(({ url, catalogId, quality, existing }) => ({ url, catalogId, quality, existing })),
  assets: catalog.assets,
};
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
await mkdir(path.dirname(output), { recursive: true });
const temporary = `${output}.tmp`;
await writeFile(temporary, serialized, 'utf8');
await rename(temporary, output);
process.stdout.write(`Cataloged ${catalog.assets.length} handpicked itch assets and resolved ${aliasCount} existing aliases.\n`);
