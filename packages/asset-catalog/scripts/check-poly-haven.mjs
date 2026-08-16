import { readFile } from 'node:fs/promises';

import { CATALOG_ASSETS } from '../src/catalog-data.ts';
import {
  fetchPolyHavenMetadataCatalog,
  fetchPolyHavenStarterCatalog,
} from '../src/providers/poly/haven-client.ts';

const snapshot = JSON.parse(await readFile(new URL('../data/poly-haven.generated.json', import.meta.url), 'utf8'));

const committed = CATALOG_ASSETS.filter((asset) => (
  asset.provider.id === 'poly-haven' && asset.verification === 'install-verified'
));
const live = await fetchPolyHavenStarterCatalog({ retrievedAt: committed[0]?.upstream.retrievedAt });

function comparable(asset) {
  return {
    id: asset.id,
    filesHash: asset.upstream.filesHash,
    downloads: asset.downloads.map((file) => ({
      path: file.path, size: file.size, url: file.url, hash: file.hash,
    })),
  };
}

if (JSON.stringify(live.map(comparable)) !== JSON.stringify(committed.map(comparable))) {
  throw new Error('Committed Poly Haven records differ from the live API. Review and refresh the catalog.');
}

const metadata = await fetchPolyHavenMetadataCatalog({
  limit: snapshot.selection.limit,
  retrievedAt: snapshot.retrievedAt,
});
if (JSON.stringify(metadata) !== JSON.stringify(snapshot.assets)) {
  throw new Error('Committed Poly Haven metadata snapshot differs from the live API. Run npm run catalog:crawl and review the diff.');
}

process.stdout.write(`Verified ${live.length} install records and ${metadata.length} metadata records against the live Poly Haven API.\n`);
