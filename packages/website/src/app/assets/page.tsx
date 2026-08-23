import type { Metadata } from 'next';
import { AssetCatalog } from '@/components/assets/AssetCatalog';

export const metadata: Metadata = {
  title: 'CC0 game assets',
  description: 'Search game-ready CC0 assets with explicit licensing and durable provenance.',
  alternates: { canonical: '/assets' },
};

export default function AssetsPage() {
  return <AssetCatalog />;
}
