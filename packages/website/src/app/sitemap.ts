import type { MetadataRoute } from 'next';
import { DEMOS } from '@/lib/demos';
import { getDocsEntries } from '@/lib/docs';
import { canonical } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['/', '/thesis', '/framework', '/studio', '/games', '/research', '/demos'];
  const docs = await getDocsEntries();
  return [
    ...pages.map((path) => ({ url: canonical(path), changeFrequency: 'weekly' as const, priority: path === '/' ? 1 : 0.8 })),
    ...docs.map((entry) => ({
      url: canonical(entry.href),
      changeFrequency: 'weekly' as const,
      priority: entry.slug.length === 0 ? 0.8 : 0.7,
    })),
    ...DEMOS.map((demo) => ({
      url: canonical(`/demos/${demo.slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
