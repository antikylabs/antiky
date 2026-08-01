import type { MetadataRoute } from 'next';
import { canonical } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: canonical('/sitemap.xml'),
  };
}
