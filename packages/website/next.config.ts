import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@antiky/demos'],
  // Demo assets are local, so no image or font domains need configuration.
};

export default nextConfig;
