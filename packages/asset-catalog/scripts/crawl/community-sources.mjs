import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { fetchCommunityCatalog } from '../../src/providers/community-client.ts';

const output = resolve(process.cwd(), process.argv[2] ?? 'data/community-sources.generated.json');
const retrievedAt = new Date().toISOString();
const catalog = await fetchCommunityCatalog({ retrievedAt });

if (catalog.kaykit.length !== 17) throw new Error(`Expected 17 individual KayKit packs, found ${catalog.kaykit.length}`);
if (catalog.screamingBrain.length !== 62) throw new Error(`Expected 62 Screaming Brain asset packs, found ${catalog.screamingBrain.length}`);
if (catalog.openDuelyst.coveredFileCount < 6_000) {
  throw new Error(`OpenDuelyst resource coverage unexpectedly fell to ${catalog.openDuelyst.coveredFileCount} files`);
}

const assets = [...catalog.kaykit, ...catalog.openDuelyst.assets, ...catalog.screamingBrain]
  .sort((left, right) => left.id.localeCompare(right.id));
const snapshot = {
  schemaVersion: 1,
  policy: 'official-metadata-only-no-archive-downloads',
  retrievedAt,
  sources: {
    kaykit: { indexUrl: 'https://kaylousberg.com/game-assets', count: catalog.kaykit.length, excludedDuplicateBundles: ['complete-kaykit-collection'] },
    openDuelyst: {
      treeUrl: 'https://api.github.com/repos/open-duelyst/duelyst/git/trees/main?recursive=1',
      licenseUrl: 'https://github.com/open-duelyst/duelyst/blob/main/LICENSE', treeSha: catalog.openDuelyst.treeSha,
      groupCount: catalog.openDuelyst.assets.length, coveredFileCount: catalog.openDuelyst.coveredFileCount,
    },
    screamingBrainStudios: {
      indexUrl: 'https://screamingbrainstudios.itch.io/', count: catalog.screamingBrain.length,
      excludedSoftware: ['texture-manipulator', 'pixel-picker', 'random-name-generator', 'cubemap-splitter', 'isometric-tile-toolkit'],
    },
  },
  assets,
};
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Cataloged ${catalog.kaykit.length} KayKit, ${catalog.openDuelyst.assets.length} OpenDuelyst, and ${catalog.screamingBrain.length} Screaming Brain packs.`);
