import snapshot from '../data/poly-haven.generated.json' with { type: 'json' };

import type { CatalogAsset } from './index.ts';

function validateAsset(value: unknown, index: number): CatalogAsset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid generated catalog asset at index ${index}`);
  }
  const asset = value as Partial<CatalogAsset>;
  if (
    typeof asset.id !== 'string'
    || typeof asset.slug !== 'string'
    || typeof asset.name !== 'string'
    || typeof asset.description !== 'string'
    || !Array.isArray(asset.tags) || asset.tags.length < 3
    || !Array.isArray(asset.categories)
    || asset.provider?.id !== 'poly-haven'
    || asset.verification !== 'source-verified'
    || asset.preview?.hosting !== 'provider'
    || !Array.isArray(asset.downloads) || asset.downloads.length !== 0
    || asset.fileCount !== null
  ) throw new Error(`Invalid generated Poly Haven asset: ${asset.id ?? index}`);
  return Object.freeze(value) as CatalogAsset;
}

if (snapshot.schemaVersion !== 1 || snapshot.provider !== 'poly-haven') {
  throw new Error('Unsupported generated Poly Haven catalog snapshot');
}

export const GENERATED_POLY_HAVEN_ASSETS: readonly CatalogAsset[] = Object.freeze(
  snapshot.assets.map(validateAsset),
);

export const GENERATED_POLY_HAVEN_REPORT = Object.freeze({
  retrievedAt: snapshot.retrievedAt,
  sourceUrl: snapshot.sourceUrl,
  selection: snapshot.selection,
  count: snapshot.assets.length,
});
