import snapshot from '../../data/community-sources.generated.json' with { type: 'json' };

import type { CatalogAsset } from '../index.ts';

const expectedQuality = Object.freeze({ kaykit: 1, 'open-duelyst': 2, 'screaming-brain-studios': 3 });

function validateAsset(value: unknown, index: number): CatalogAsset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid generated community asset at ${index}`);
  const asset = value as Partial<CatalogAsset>;
  const quality = expectedQuality[asset.provider?.id as keyof typeof expectedQuality];
  if (quality === undefined || asset.quality !== quality || !asset.id || !asset.name
    || !Array.isArray(asset.tags) || asset.tags.length < 3
    || !Array.isArray(asset.formats) || !Array.isArray(asset.downloads) || asset.downloads.length !== 0
    || asset.verification !== 'source-verified'
    || !(typeof asset.fileCount === 'number' && Number.isSafeInteger(asset.fileCount) && asset.fileCount > 0 || asset.fileCount === null)) {
    throw new Error(`Invalid generated community asset: ${asset.id ?? index}`);
  }
  return Object.freeze(value) as CatalogAsset;
}

if (snapshot.schemaVersion !== 1 || snapshot.policy !== 'official-metadata-only-no-archive-downloads') {
  throw new Error('Unsupported generated community catalog snapshot');
}

export const GENERATED_COMMUNITY_ASSETS: readonly CatalogAsset[] = Object.freeze(snapshot.assets.map(validateAsset));
export const GENERATED_COMMUNITY_REPORT = Object.freeze(snapshot.sources);
