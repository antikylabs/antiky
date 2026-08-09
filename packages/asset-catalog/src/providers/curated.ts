import type { AssetKind, AssetProvider, CatalogAsset } from '../index.ts';

type CuratedInput = Readonly<{
  upstreamId: string;
  slug: string;
  name: string;
  description: string;
  kind: AssetKind;
  fileCount: number;
  formats: readonly string[];
  tags: readonly string[];
  categories: readonly string[];
  creator: string;
  sourceUrl: string;
  previewUrl: string;
  previewSourceUrl?: string;
  retrievedAt: string;
}>;

export function createCuratedCc0Asset(provider: AssetProvider, input: CuratedInput): CatalogAsset {
  return Object.freeze({
    id: `${provider.id}:${input.slug}`,
    slug: input.slug,
    name: input.name,
    description: input.description,
    kind: input.kind,
    fileCount: input.fileCount,
    formats: Object.freeze([...input.formats]),
    tags: Object.freeze([...input.tags]),
    categories: Object.freeze([...input.categories]),
    provider,
    upstream: Object.freeze({
      id: input.upstreamId,
      url: input.sourceUrl,
      filesHash: 'pending-curated-download',
      retrievedAt: input.retrievedAt,
    }),
    preview: Object.freeze({
      url: input.previewUrl,
      sourceUrl: input.previewSourceUrl ?? input.previewUrl,
      width: 256,
      height: 256,
    }),
    downloads: Object.freeze([]),
    license: Object.freeze({
      id: 'cc0-1.0',
      name: 'CC0 1.0 Universal',
      referenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      permitsModification: true,
      permitsRedistribution: true,
      requiresAttribution: false,
    }),
    provenance: Object.freeze({
      creator: input.creator,
      sourceUrl: input.sourceUrl,
      retrievedAt: input.retrievedAt,
      sourceSha256: 'pending-curated-download',
    }),
    attribution: Object.freeze({
      required: false,
      notice: `CC0 asset by ${input.creator}; credit is appreciated.`,
    }),
    verification: 'pending' as const,
  });
}
