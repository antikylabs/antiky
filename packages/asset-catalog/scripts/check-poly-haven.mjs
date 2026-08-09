import { CATALOG_ASSETS } from '../src/catalog-data.ts';
import { fetchPolyHavenStarterCatalog } from '../src/providers/poly-haven-client.ts';

const committed = CATALOG_ASSETS.filter((asset) => asset.provider.id === 'poly-haven');
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

process.stdout.write(`Verified ${live.length} Poly Haven records against the live API.\n`);
