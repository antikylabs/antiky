import { findAsset, searchAssets, type AssetKind, type CatalogAsset } from '@antiky/asset-catalog';
import { CATALOG_ASSETS } from '@antiky/asset-catalog/catalog';

const kinds = new Set<AssetKind>(['audio', 'font', 'hdri', 'model', 'sprite', 'texture']);

export type PublicCatalogQuery = Readonly<{
  q?: string;
  type?: string;
  provider?: string;
}>;

export function catalogSearch(query: PublicCatalogQuery): CatalogAsset[] {
  const kind = query.type && kinds.has(query.type as AssetKind) ? query.type as AssetKind : undefined;
  return searchAssets(CATALOG_ASSETS, {
    text: query.q,
    kind,
    provider: query.provider,
  });
}

export function catalogAsset(provider: string, slug: string): CatalogAsset | undefined {
  return findAsset(CATALOG_ASSETS, provider, slug);
}

export function catalogProviders() {
  return [...new Map(CATALOG_ASSETS.map((asset) => [asset.provider.id, asset.provider])).values()];
}
