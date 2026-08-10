import snapshot from '../data/curated-sources.generated.json' with { type: 'json' };

import type { CatalogAsset } from './index.ts';

function validateAsset(value: unknown, index: number): CatalogAsset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid generated source asset at index ${index}`);
  }
  const asset = value as Partial<CatalogAsset>;
  if (
    typeof asset.id !== 'string'
    || typeof asset.slug !== 'string'
    || typeof asset.name !== 'string'
    || typeof asset.description !== 'string'
    || asset.quality !== 0
    || !Array.isArray(asset.tags) || asset.tags.length < 3
    || !Array.isArray(asset.categories)
    || !['kenney', 'quaternius'].includes(asset.provider?.id ?? '')
    || asset.verification !== 'source-verified'
    || !['local', 'provider'].includes(asset.preview?.hosting ?? '')
    || !Array.isArray(asset.downloads) || asset.downloads.length !== 0
    || !(asset.fileCount === null || typeof asset.fileCount === 'number' && Number.isSafeInteger(asset.fileCount) && asset.fileCount > 0)
  ) throw new Error(`Invalid generated source asset: ${asset.id ?? index}`);
  return Object.freeze(value) as CatalogAsset;
}

if (snapshot.schemaVersion !== 1 || snapshot.policy !== 'official-html-metadata-only-no-archive-downloads') {
  throw new Error('Unsupported generated Kenney and Quaternius catalog snapshot');
}

export const GENERATED_CURATED_ASSETS: readonly CatalogAsset[] = Object.freeze(snapshot.assets.map(validateAsset));

export const GENERATED_CURATED_REPORT = Object.freeze({
  retrievedAt: snapshot.retrievedAt,
  sources: snapshot.sources,
  count: snapshot.assets.length,
});
