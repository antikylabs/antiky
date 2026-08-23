import type { CatalogAsset } from './index.ts';

export const CATALOG_API_VERSION = 'v1' as const;
export const CATALOG_API_SCHEMA_VERSION = 1 as const;
export const CATALOG_API_ORIGIN = 'https://catalog-api.antikylabs.com' as const;
export const CATALOG_API_BASE_PATH = `/${CATALOG_API_VERSION}` as const;
export const CATALOG_API_BASE_URL = `${CATALOG_API_ORIGIN}${CATALOG_API_BASE_PATH}` as const;
export const CATALOG_API_CATALOG_PATH = `${CATALOG_API_BASE_PATH}/catalog.json` as const;
export const CATALOG_API_CATALOG_URL = `${CATALOG_API_ORIGIN}${CATALOG_API_CATALOG_PATH}` as const;
export const CATALOG_API_ASSET_PATH_TEMPLATE = `${CATALOG_API_BASE_PATH}/assets/{provider}/{slug}.json` as const;

export function catalogApiAssetPath(provider: string, slug: string): string {
  return `${CATALOG_API_BASE_PATH}/assets/${encodeURIComponent(provider)}/${encodeURIComponent(slug)}.json`;
}

export function catalogApiAssetUrl(asset: Pick<CatalogAsset, 'provider' | 'slug'>): string {
  return `${CATALOG_API_ORIGIN}${catalogApiAssetPath(asset.provider.id, asset.slug)}`;
}
