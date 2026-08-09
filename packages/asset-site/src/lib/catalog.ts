import { findAsset, searchAssets, type AssetKind, type CatalogAsset } from '@antiky/asset-catalog';
import { CATALOG_ASSETS } from '@antiky/asset-catalog/catalog';

const kinds = new Set<AssetKind>(['audio', 'font', 'hdri', 'model', 'sprite', 'texture']);

export type PublicCatalogQuery = Readonly<{
  q?: string;
  type?: string;
  provider?: string;
}>;

const defaultProviderPattern = ['kenney', 'quaternius', 'kenney', 'quaternius', 'poly-haven'] as const;

function prioritizedProviderMix(assets: readonly CatalogAsset[]): CatalogAsset[] {
  const queues = new Map<string, CatalogAsset[]>();
  for (const asset of assets) {
    const queue = queues.get(asset.provider.id) ?? [];
    queue.push(asset);
    queues.set(asset.provider.id, queue);
  }
  const offsets = new Map<string, number>();
  const mixed: CatalogAsset[] = [];
  while (mixed.length < assets.length) {
    let added = false;
    for (const provider of defaultProviderPattern) {
      const queue = queues.get(provider) ?? [];
      const offset = offsets.get(provider) ?? 0;
      const asset = queue[offset];
      if (!asset) continue;
      mixed.push(asset);
      offsets.set(provider, offset + 1);
      added = true;
    }
    if (!added) break;
  }
  for (const [provider, queue] of queues) {
    let offset = offsets.get(provider) ?? 0;
    while (offset < queue.length) mixed.push(queue[offset++]!);
  }
  return mixed;
}

export function catalogSearch(query: PublicCatalogQuery): CatalogAsset[] {
  const kind = query.type && kinds.has(query.type as AssetKind) ? query.type as AssetKind : undefined;
  const matches = searchAssets(CATALOG_ASSETS, {
    text: query.q,
    kind,
    provider: query.provider,
  });
  return !query.q && !query.type && !query.provider ? prioritizedProviderMix(matches) : matches;
}

export function catalogAsset(provider: string, slug: string): CatalogAsset | undefined {
  return findAsset(CATALOG_ASSETS, provider, slug);
}

export function catalogProviders() {
  return [...new Map(CATALOG_ASSETS.map((asset) => [asset.provider.id, asset.provider])).values()];
}

export function catalogCount(): number {
  return CATALOG_ASSETS.length;
}
