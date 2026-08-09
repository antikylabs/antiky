import type { AssetDownload, AssetKind, CatalogAsset } from '../index.ts';

export const POLY_HAVEN_PROVIDER = Object.freeze({
  id: 'poly-haven',
  name: 'Poly Haven',
  url: 'https://polyhaven.com',
});

export const POLY_HAVEN_API_ATTRIBUTION =
  'Asset and metadata delivered through the Poly Haven API. Assets are CC0; API attribution is required.';

export type PolyHavenMetadata = Readonly<{
  name: string;
  type: number;
  description: string;
  tags?: readonly string[];
  categories?: readonly string[];
  authors?: Readonly<Record<string, string>>;
  files_hash: string;
  thumbnail_url: string;
  date_published?: number;
  download_count?: number;
  polycount?: number;
  max_resolution?: readonly number[];
}>;

function slugify(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}

function readKind(type: number): AssetKind {
  if (type === 0) return 'hdri';
  if (type === 1) return 'texture';
  if (type === 2) return 'model';
  throw new Error(`Unsupported Poly Haven asset type: ${type}`);
}

export function createPolyHavenAsset(input: Readonly<{
  upstreamId: string;
  metadata: PolyHavenMetadata;
  files: readonly AssetDownload[];
  retrievedAt: string;
}>): CatalogAsset {
  const slug = slugify(input.upstreamId);
  const sourceUrl = `https://polyhaven.com/a/${input.upstreamId}`;
  const creators = Object.keys(input.metadata.authors ?? {});
  const formats = [...new Set(input.files.map((file) => file.format))].sort();

  return Object.freeze({
    id: `poly-haven:${slug}`,
    slug,
    name: input.metadata.name,
    description: input.metadata.description,
    kind: readKind(input.metadata.type),
    fileCount: input.files.length,
    formats,
    tags: Object.freeze([...(input.metadata.tags ?? [])]),
    categories: Object.freeze([...(input.metadata.categories ?? [])]),
    provider: POLY_HAVEN_PROVIDER,
    upstream: Object.freeze({
      id: input.upstreamId,
      url: sourceUrl,
      filesHash: input.metadata.files_hash,
      retrievedAt: input.retrievedAt,
    }),
    preview: Object.freeze({
      url: `/previews/poly-haven/${slug}.webp`,
      sourceUrl: input.metadata.thumbnail_url,
      width: 256,
      height: 256,
      hosting: 'local' as const,
    }),
    facts: Object.freeze({
      ...(input.metadata.date_published ? { publishedAt: new Date(input.metadata.date_published * 1000).toISOString() } : {}),
      ...(input.metadata.download_count !== undefined ? { downloadCount: input.metadata.download_count } : {}),
      ...(input.metadata.polycount !== undefined ? { polygonCount: input.metadata.polycount } : {}),
      ...(input.metadata.max_resolution ? { maxResolution: Object.freeze([...input.metadata.max_resolution]) } : {}),
    }),
    downloads: Object.freeze([...input.files]),
    license: Object.freeze({
      id: 'cc0-1.0',
      name: 'CC0 1.0 Universal',
      referenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      permitsModification: true,
      permitsRedistribution: true,
      requiresAttribution: false,
    }),
    provenance: Object.freeze({
      creator: creators.join(', ') || 'Poly Haven',
      sourceUrl,
      retrievedAt: input.retrievedAt,
      sourceHash: Object.freeze({ algorithm: 'sha1' as const, value: input.metadata.files_hash }),
    }),
    attribution: Object.freeze({ required: true, notice: POLY_HAVEN_API_ATTRIBUTION }),
    verification: 'install-verified' as const,
  });
}

export function createPolyHavenMetadataAsset(input: Readonly<{
  upstreamId: string;
  metadata: PolyHavenMetadata;
  retrievedAt: string;
}>): CatalogAsset {
  const slug = slugify(input.upstreamId);
  const sourceUrl = `https://polyhaven.com/a/${input.upstreamId}`;
  const creators = Object.keys(input.metadata.authors ?? {});
  const kind = readKind(input.metadata.type);
  const tags = [...new Set([
    ...(input.metadata.tags ?? []),
    ...(input.metadata.categories ?? []).filter((category) => !category.startsWith('collection:')),
    kind,
    'cc0',
  ].map((value) => value.trim()).filter(Boolean))];
  const formats = kind === 'model' ? ['blend', 'fbx', 'gltf']
    : kind === 'texture' ? ['exr', 'jpg', 'png'] : ['exr', 'hdr'];

  return Object.freeze({
    id: `poly-haven:${slug}`,
    slug,
    name: input.metadata.name,
    description: input.metadata.description,
    kind,
    fileCount: null,
    formats: Object.freeze(formats),
    tags: Object.freeze(tags),
    categories: Object.freeze([...(input.metadata.categories ?? [])]),
    provider: POLY_HAVEN_PROVIDER,
    upstream: Object.freeze({
      id: input.upstreamId,
      url: sourceUrl,
      filesHash: input.metadata.files_hash,
      retrievedAt: input.retrievedAt,
    }),
    preview: Object.freeze({
      url: input.metadata.thumbnail_url,
      sourceUrl: input.metadata.thumbnail_url,
      width: 256,
      height: 256,
      hosting: 'provider' as const,
    }),
    facts: Object.freeze({
      ...(input.metadata.date_published ? { publishedAt: new Date(input.metadata.date_published * 1000).toISOString() } : {}),
      ...(input.metadata.download_count !== undefined ? { downloadCount: input.metadata.download_count } : {}),
      ...(input.metadata.polycount !== undefined ? { polygonCount: input.metadata.polycount } : {}),
      ...(input.metadata.max_resolution ? { maxResolution: Object.freeze([...input.metadata.max_resolution]) } : {}),
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
      creator: creators.join(', ') || 'Poly Haven',
      sourceUrl,
      retrievedAt: input.retrievedAt,
      sourceHash: Object.freeze({ algorithm: 'sha1' as const, value: input.metadata.files_hash }),
    }),
    attribution: Object.freeze({ required: true, notice: POLY_HAVEN_API_ATTRIBUTION }),
    verification: 'source-verified' as const,
  });
}
