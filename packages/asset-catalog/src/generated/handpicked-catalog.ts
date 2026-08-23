import snapshot from '../../data/handpicked-sources.generated.json' with { type: 'json' };

import type { CatalogAsset } from '../index.ts';
import { HANDPICKED_ITCH_SOURCES } from '../providers/handpicked-client.ts';

const newSources = new Map(HANDPICKED_ITCH_SOURCES.filter((source) => !source.existing).map((source) => [source.catalogId, source]));

function validateAsset(value: unknown, index: number): CatalogAsset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid handpicked asset at ${index}`);
  const asset = value as Partial<CatalogAsset>;
  const source = newSources.get(asset.id ?? '');
  if (!source || asset.quality !== source.quality || asset.provider?.id !== source.provider.id
    || !asset.name || !Array.isArray(asset.tags) || asset.tags.length < 3
    || !Array.isArray(asset.formats) || !Array.isArray(asset.downloads) || asset.downloads.length !== 0
    || asset.verification !== 'source-verified'
    || !(typeof asset.fileCount === 'number' && Number.isSafeInteger(asset.fileCount) && asset.fileCount > 0 || asset.fileCount === null)) {
    throw new Error(`Invalid generated handpicked asset: ${asset.id ?? index}`);
  }
  return Object.freeze(value) as CatalogAsset;
}

if (snapshot.schemaVersion !== 1 || snapshot.policy !== 'handpicked-itch-html-metadata-only-no-archive-downloads') {
  throw new Error('Unsupported generated handpicked catalog snapshot');
}
if (snapshot.sources.length !== HANDPICKED_ITCH_SOURCES.length) throw new Error('Generated handpicked source coverage is incomplete');

export const GENERATED_HANDPICKED_ASSETS: readonly CatalogAsset[] = Object.freeze(snapshot.assets.map(validateAsset));
export const GENERATED_HANDPICKED_REPORT = Object.freeze({
  retrievedAt: snapshot.retrievedAt,
  sourceCount: snapshot.sources.length,
  assetCount: snapshot.assets.length,
  aliasCount: snapshot.sources.filter((source) => source.existing).length,
});
