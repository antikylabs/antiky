import type { MetadataRoute } from 'next';
import { CATALOG_ASSETS } from '@antiky/asset-catalog/catalog';

const origin = process.env.NEXT_PUBLIC_ASSET_SITE_URL ?? 'https://antikylabs.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: new URL('/assets', origin).toString(), changeFrequency: 'weekly', priority: 0.9 },
    ...CATALOG_ASSETS.map((asset) => ({
      url: new URL(`/assets/${asset.provider.id}/${asset.slug}`, origin).toString(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
