import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@antiky/demos'],
  async rewrites() {
    return [{ source: '/docs/:path*\\.md', destination: '/docs-markdown/:path*' }];
  },
  webpack(config, context) {
    if (!context.dev) {
      config.plugins.push(new context.webpack.NormalModuleReplacementPlugin(
        /development-inspection$/,
        resolve(context.dir, '../demos/src/react/development-inspection.production.ts'),
      ));
    }
    return config;
  },
  // Demo assets are local, so no image or font domains need configuration.
};

export default nextConfig;
