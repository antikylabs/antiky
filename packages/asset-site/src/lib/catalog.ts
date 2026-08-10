import { findAsset, searchAssets, type AssetKind, type AssetVerification, type CatalogAsset } from '@antiky/asset-catalog';
import { CATALOG_ASSETS } from '@antiky/asset-catalog/catalog';

const kinds = new Set<AssetKind>(['audio', 'font', 'hdri', 'model', 'sprite', 'texture']);

export type PublicCatalogQuery = Readonly<{
  q?: string;
  type?: string;
  provider?: string;
  dimension?: string;
  format?: string;
  verification?: string;
  quality?: string;
  sort?: string;
}>;

const defaultProviderPattern = [
  'kenney', 'quaternius', 'kenney', 'quaternius',
  'kenney', 'quaternius', 'kenney', 'quaternius',
  'kaykit', 'open-duelyst', 'screaming-brain-studios', 'poly-haven',
] as const;

function prioritizedProviderMix(assets: readonly CatalogAsset[]): CatalogAsset[] {
  const queues = new Map<string, CatalogAsset[]>();
  for (const asset of assets) {
    const queue = queues.get(asset.provider.id) ?? [];
    queue.push(asset);
    queues.set(asset.provider.id, queue);
  }
  for (const queue of queues.values()) queue.sort((left, right) => featuredRank(left) - featuredRank(right));
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

function featuredRank(asset: CatalogAsset): number {
  let hash = 2166136261;
  for (const character of `antiky-featured-v1:${asset.id}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function assetDimension(asset: CatalogAsset): '2d' | '3d' | 'other' {
  if (asset.kind === 'model' || asset.kind === 'hdri') return '3d';
  if (asset.kind === 'sprite' || asset.kind === 'texture') return '2d';
  return 'other';
}

const verificationStates = new Set<AssetVerification>(['cataloged', 'source-verified', 'install-verified']);

function sortAssets(assets: readonly CatalogAsset[], sort: string | undefined): CatalogAsset[] {
  if (!sort || sort === 'random') return prioritizedProviderMix(assets);
  const sorted = [...assets];
  if (sort === 'name-asc') return sorted.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  if (sort === 'name-desc') return sorted.sort((left, right) => right.name.localeCompare(left.name) || right.id.localeCompare(left.id));
  if (sort === 'files-desc') return sorted.sort((left, right) => (right.fileCount ?? -1) - (left.fileCount ?? -1) || left.name.localeCompare(right.name));
  if (sort === 'quality-asc') return sorted.sort((left, right) => left.quality - right.quality || featuredRank(left) - featuredRank(right));
  if (sort === 'newest') return sorted.sort((left, right) => right.provenance.retrievedAt.localeCompare(left.provenance.retrievedAt) || left.name.localeCompare(right.name));
  return prioritizedProviderMix(assets);
}

export function catalogSearch(query: PublicCatalogQuery): CatalogAsset[] {
  const kind = query.type && kinds.has(query.type as AssetKind) ? query.type as AssetKind : undefined;
  let matches = searchAssets(CATALOG_ASSETS, {
    text: query.q,
    kind,
    provider: query.provider,
  });
  if (query.dimension === '2d' || query.dimension === '3d') {
    matches = matches.filter((asset) => assetDimension(asset) === query.dimension);
  }
  if (query.format) {
    const format = query.format.toLocaleLowerCase();
    matches = matches.filter((asset) => asset.formats.includes(format));
  }
  if (query.verification && verificationStates.has(query.verification as AssetVerification)) {
    matches = matches.filter((asset) => asset.verification === query.verification);
  }
  if (/^[0-5]$/.test(query.quality ?? '')) {
    matches = matches.filter((asset) => asset.quality === Number(query.quality));
  }
  return sortAssets(matches, query.sort);
}

export function catalogAsset(provider: string, slug: string): CatalogAsset | undefined {
  return findAsset(CATALOG_ASSETS, provider, slug);
}

export function catalogProviders() {
  return [...new Map(CATALOG_ASSETS.map((asset) => [asset.provider.id, asset.provider])).values()];
}

export function catalogFormats(): string[] {
  return [...new Set(CATALOG_ASSETS.flatMap((asset) => asset.formats))].sort();
}

export function catalogCount(): number {
  return CATALOG_ASSETS.length;
}
