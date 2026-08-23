import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: '/worlds', destination: '/games', permanent: true }];
  },
  async rewrites() {
    return [{ source: '/docs/:path*\\.md', destination: '/docs-markdown/:path*' }];
  },
  // Demo assets are local, so no image or font domains need configuration.
};

export default nextConfig;
