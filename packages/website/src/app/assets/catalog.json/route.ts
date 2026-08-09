import { CATALOG_ASSETS } from '@antiky/asset-catalog/catalog';

export const dynamic = 'force-static';

export function GET() {
  return Response.json({
    schemaVersion: 2,
    generatedAt: '2026-08-09',
    totalCatalogAssets: CATALOG_ASSETS.length,
    assets: CATALOG_ASSETS,
  }, {
    headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
