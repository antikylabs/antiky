import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@antiky/demos'],
  // Every demo is a hand-written WebGL2 module in this repository; there are no
  // remote assets, so nothing here needs image or font domain configuration.
};

export default nextConfig;
