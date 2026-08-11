import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AssetDetail } from '@/components/assets/AssetDetail';
import { catalogAsset } from '@/lib/assets';
import { CATALOG_ASSETS } from '@antiky/asset-catalog/catalog';

type Params = Promise<{ provider: string; slug: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return CATALOG_ASSETS.map((asset) => ({ provider: asset.provider.id, slug: asset.slug }));
}

export async function generateMetadata({ params }: Readonly<{ params: Params }>): Promise<Metadata> {
  const { provider, slug } = await params;
  const asset = catalogAsset(provider, slug);
  if (!asset) return {};
  return {
    title: asset.name,
    description: asset.description,
    alternates: { canonical: `/assets/${asset.provider.id}/${asset.slug}` },
  };
}

export default async function AssetPage({ params }: Readonly<{ params: Params }>) {
  const { provider, slug } = await params;
  const asset = catalogAsset(provider, slug);
  if (!asset) notFound();
  return <AssetDetail asset={asset} />;
}
