import type { MetadataRoute } from 'next';
import { DEMOS } from '@antiky/demos/catalog';
import { canonical } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['/', '/framework', '/worlds', '/research', '/demos'];
  return [
    ...pages.map((path) => ({ url: canonical(path), changeFrequency: 'weekly' as const, priority: path === '/' ? 1 : 0.8 })),
    ...DEMOS.map((demo) => ({
      url: canonical(`/demos/${demo.slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
