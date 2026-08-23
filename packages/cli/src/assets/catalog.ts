export const ASSET_CATALOG_ORIGIN = 'https://assets.antikylabs.com' as const;
export const ASSET_CATALOG_VERSION = 'v1' as const;
export const ASSET_CATALOG_SCHEMA_VERSION = 1 as const;
export const GITHUB_CATALOG_FALLBACK_URL = 'https://raw.githubusercontent.com/antikylabs/antiky/main/packages/asset-catalog/data/installable-assets.v1.json' as const;

const MAX_CATALOG_RESPONSE_BYTES = 1024 * 1024;
const CATALOG_REQUEST_TIMEOUT_MS = 10_000;
const HASH_ALGORITHMS = new Set(['md5', 'sha1', 'sha256']);
const ASSET_KINDS = new Set(['audio', 'font', 'hdri', 'model', 'sprite', 'texture']);
const VERIFICATION_LEVELS = new Set(['cataloged', 'source-verified', 'install-verified']);

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256';

export type CatalogAsset = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: 'audio' | 'font' | 'hdri' | 'model' | 'sprite' | 'texture';
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  fileCount: number | null;
  formats: readonly string[];
  tags: readonly string[];
  categories: readonly string[];
  provider: Readonly<{ id: string; name: string; url: string }>;
  upstream: Readonly<{
    id: string;
    url: string;
    filesHash: string;
    retrievedAt: string;
  }>;
  preview: Readonly<{
    url: string;
    sourceUrl: string;
    width: number;
    height: number;
    hosting: 'local' | 'provider';
  }>;
  facts: Readonly<{
    publishedAt?: string;
    downloadCount?: number;
    polygonCount?: number;
    maxResolution?: readonly number[];
  }>;
  downloads: readonly Readonly<{
    path: string;
    format: string;
    size: number;
    url: string;
    hash: Readonly<{ algorithm: HashAlgorithm; value: string }>;
  }>[];
  license: Readonly<{
    id: string;
    name: string;
    referenceUrl: string;
    permitsModification: boolean;
    permitsRedistribution: boolean;
    requiresAttribution: boolean;
  }>;
  provenance: Readonly<{
    creator: string;
    sourceUrl: string;
    retrievedAt: string;
    sourceHash: Readonly<{ algorithm: HashAlgorithm; value: string }> | null;
  }>;
  attribution: Readonly<{ required: boolean; notice: string }>;
  verification: 'cataloged' | 'source-verified' | 'install-verified';
}>;

export class CatalogUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogUnavailableError';
  }
}

export class CatalogInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogInvalidError';
  }
}

type UnknownRecord = Record<string, unknown>;

function invalid(path: string, expected: string): never {
  throw new CatalogInvalidError(`Invalid catalog response at ${path}: expected ${expected}`);
}

function record(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(path, 'an object');
  }
  return value as UnknownRecord;
}

function string(value: unknown, path: string, maximumLength = 4096): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximumLength
    || /[\u0000-\u001f\u007f-\u009f]/u.test(value)
  ) {
    invalid(path, `a non-empty string of at most ${maximumLength} characters`);
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path, 'a boolean');
  return value;
}

function integer(value: unknown, path: string, minimum: number, maximum: number): number {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < minimum
    || value > maximum
  ) {
    invalid(path, `an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function stringArray(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 512) invalid(path, 'an array with at most 512 strings');
  return Object.freeze(value.map((entry, index) => string(entry, `${path}[${index}]`, 1024)));
}

function httpsUrl(value: unknown, path: string): string {
  const text = string(value, path, 8192);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    invalid(path, 'an HTTPS URL');
  }
  if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') {
    invalid(path, 'an HTTPS URL without credentials');
  }
  return parsed.href;
}

function previewUrl(value: unknown, path: string): string {
  const text = string(value, path, 8192);
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  return httpsUrl(text, path);
}

function timestamp(value: unknown, path: string): string {
  const text = string(value, path, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(text)) {
    invalid(path, 'an ISO 8601 UTC timestamp');
  }
  return text;
}

function hash(value: unknown, path: string, strictValue: boolean): Readonly<{
  algorithm: HashAlgorithm;
  value: string;
}> {
  const source = record(value, path);
  const algorithm = string(source.algorithm, `${path}.algorithm`, 16);
  if (!HASH_ALGORITHMS.has(algorithm)) invalid(`${path}.algorithm`, 'md5, sha1, or sha256');
  const digest = string(source.value, `${path}.value`, 256).toLocaleLowerCase('en-US');
  const expectedLength = algorithm === 'md5' ? 32 : algorithm === 'sha1' ? 40 : 64;
  if (strictValue && !new RegExp(`^[a-f0-9]{${expectedLength}}$`, 'u').test(digest)) {
    invalid(`${path}.value`, `a ${expectedLength}-character hexadecimal digest`);
  }
  return Object.freeze({ algorithm: algorithm as HashAlgorithm, value: digest });
}

function optionalNaturalNumber(value: unknown, path: string): number | undefined {
  return value === undefined ? undefined : integer(value, path, 0, Number.MAX_SAFE_INTEGER);
}

function readFacts(value: unknown, path: string): CatalogAsset['facts'] {
  const source = record(value, path);
  const publishedAt = source.publishedAt === undefined
    ? undefined
    : timestamp(source.publishedAt, `${path}.publishedAt`);
  const downloadCount = optionalNaturalNumber(source.downloadCount, `${path}.downloadCount`);
  const polygonCount = optionalNaturalNumber(source.polygonCount, `${path}.polygonCount`);
  let maxResolution: readonly number[] | undefined;
  if (source.maxResolution !== undefined) {
    if (!Array.isArray(source.maxResolution) || source.maxResolution.length > 3) {
      invalid(`${path}.maxResolution`, 'an array with at most three dimensions');
    }
    maxResolution = Object.freeze(source.maxResolution.map((dimension, index) => (
      integer(dimension, `${path}.maxResolution[${index}]`, 1, 1_000_000)
    )));
  }
  return Object.freeze({
    ...(publishedAt === undefined ? {} : { publishedAt }),
    ...(downloadCount === undefined ? {} : { downloadCount }),
    ...(polygonCount === undefined ? {} : { polygonCount }),
    ...(maxResolution === undefined ? {} : { maxResolution }),
  });
}

function readCatalogAsset(value: unknown, provider: string, slug: string, path: string): CatalogAsset {
  const source = record(value, path);
  const expectedId = `${provider}:${slug}`;
  const id = string(source.id, `${path}.id`, 256);
  if (id !== expectedId) invalid(`${path}.id`, expectedId);
  const assetSlug = string(source.slug, `${path}.slug`, 128);
  if (assetSlug !== slug) invalid(`${path}.slug`, slug);

  const kind = string(source.kind, `${path}.kind`, 32);
  if (!ASSET_KINDS.has(kind)) invalid(`${path}.kind`, 'a supported asset kind');
  const quality = integer(source.quality, `${path}.quality`, 0, 5);
  const fileCount = source.fileCount === null
    ? null
    : integer(source.fileCount, `${path}.fileCount`, 0, 10_000_000);

  const providerRecord = record(source.provider, `${path}.provider`);
  const providerId = string(providerRecord.id, `${path}.provider.id`, 128);
  if (providerId !== provider) invalid(`${path}.provider.id`, provider);

  const upstream = record(source.upstream, `${path}.upstream`);
  const preview = record(source.preview, `${path}.preview`);
  const previewHosting = string(preview.hosting, `${path}.preview.hosting`, 16);
  if (previewHosting !== 'local' && previewHosting !== 'provider') {
    invalid(`${path}.preview.hosting`, 'local or provider');
  }

  if (!Array.isArray(source.downloads) || source.downloads.length > 1024) {
    invalid(`${path}.downloads`, 'an array with at most 1024 downloads');
  }
  const downloads = Object.freeze(source.downloads.map((entry, index) => {
    const downloadPath = `${path}.downloads[${index}]`;
    const download = record(entry, downloadPath);
    return Object.freeze({
      path: string(download.path, `${downloadPath}.path`, 1024),
      format: string(download.format, `${downloadPath}.format`, 64),
      size: integer(download.size, `${downloadPath}.size`, 1, 64 * 1024 * 1024),
      url: httpsUrl(download.url, `${downloadPath}.url`),
      hash: hash(download.hash, `${downloadPath}.hash`, true),
    });
  }));

  const license = record(source.license, `${path}.license`);
  const provenance = record(source.provenance, `${path}.provenance`);
  const attribution = record(source.attribution, `${path}.attribution`);
  const verification = string(source.verification, `${path}.verification`, 32);
  if (!VERIFICATION_LEVELS.has(verification)) {
    invalid(`${path}.verification`, 'a supported verification level');
  }

  const sourceHash = provenance.sourceHash === null
    ? null
    : hash(provenance.sourceHash, `${path}.provenance.sourceHash`, false);

  return Object.freeze({
    id,
    slug: assetSlug,
    name: string(source.name, `${path}.name`, 512),
    description: string(source.description, `${path}.description`, 8192),
    kind: kind as CatalogAsset['kind'],
    quality: quality as CatalogAsset['quality'],
    fileCount,
    formats: stringArray(source.formats, `${path}.formats`),
    tags: stringArray(source.tags, `${path}.tags`),
    categories: stringArray(source.categories, `${path}.categories`),
    provider: Object.freeze({
      id: providerId,
      name: string(providerRecord.name, `${path}.provider.name`, 512),
      url: httpsUrl(providerRecord.url, `${path}.provider.url`),
    }),
    upstream: Object.freeze({
      id: string(upstream.id, `${path}.upstream.id`, 512),
      url: httpsUrl(upstream.url, `${path}.upstream.url`),
      filesHash: string(upstream.filesHash, `${path}.upstream.filesHash`, 512),
      retrievedAt: timestamp(upstream.retrievedAt, `${path}.upstream.retrievedAt`),
    }),
    preview: Object.freeze({
      url: previewUrl(preview.url, `${path}.preview.url`),
      sourceUrl: httpsUrl(preview.sourceUrl, `${path}.preview.sourceUrl`),
      width: integer(preview.width, `${path}.preview.width`, 1, 100_000),
      height: integer(preview.height, `${path}.preview.height`, 1, 100_000),
      hosting: previewHosting,
    }),
    facts: readFacts(source.facts, `${path}.facts`),
    downloads,
    license: Object.freeze({
      id: string(license.id, `${path}.license.id`, 128),
      name: string(license.name, `${path}.license.name`, 512),
      referenceUrl: httpsUrl(license.referenceUrl, `${path}.license.referenceUrl`),
      permitsModification: boolean(license.permitsModification, `${path}.license.permitsModification`),
      permitsRedistribution: boolean(license.permitsRedistribution, `${path}.license.permitsRedistribution`),
      requiresAttribution: boolean(license.requiresAttribution, `${path}.license.requiresAttribution`),
    }),
    provenance: Object.freeze({
      creator: string(provenance.creator, `${path}.provenance.creator`, 512),
      sourceUrl: httpsUrl(provenance.sourceUrl, `${path}.provenance.sourceUrl`),
      retrievedAt: timestamp(provenance.retrievedAt, `${path}.provenance.retrievedAt`),
      sourceHash,
    }),
    attribution: Object.freeze({
      required: boolean(attribution.required, `${path}.attribution.required`),
      notice: string(attribution.notice, `${path}.attribution.notice`, 8192),
    }),
    verification: verification as CatalogAsset['verification'],
  });
}

async function parseJsonResponse(response: Response, url: string): Promise<unknown> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null && Number(declaredLength) > MAX_CATALOG_RESPONSE_BYTES) {
    throw new CatalogInvalidError(`Catalog response from ${url} exceeds ${MAX_CATALOG_RESPONSE_BYTES} bytes`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_CATALOG_RESPONSE_BYTES) {
    throw new CatalogInvalidError(`Catalog response from ${url} exceeds ${MAX_CATALOG_RESPONSE_BYTES} bytes`);
  }
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new CatalogInvalidError(`Catalog response from ${url} is not valid UTF-8`);
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new CatalogInvalidError(`Catalog response from ${url} is not valid JSON`);
  }
}

async function request(fetcher: typeof fetch, url: string): Promise<Response> {
  try {
    return await fetcher(url, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(CATALOG_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new CatalogUnavailableError(`Could not reach ${url}`);
  }
}

function validateDocumentHeader(source: UnknownRecord, path: string): void {
  if (source.version !== ASSET_CATALOG_VERSION) invalid(`${path}.version`, ASSET_CATALOG_VERSION);
  if (source.schemaVersion !== ASSET_CATALOG_SCHEMA_VERSION) {
    invalid(`${path}.schemaVersion`, String(ASSET_CATALOG_SCHEMA_VERSION));
  }
  timestamp(source.generatedAt, `${path}.generatedAt`);
}

export function catalogAssetUrl(provider: string, slug: string): string {
  return `${ASSET_CATALOG_ORIGIN}/${ASSET_CATALOG_VERSION}/assets/${encodeURIComponent(provider)}/${encodeURIComponent(slug)}.json`;
}

async function fetchPrimaryAsset(
  provider: string,
  slug: string,
  fetcher: typeof fetch,
): Promise<CatalogAsset | undefined> {
  const url = catalogAssetUrl(provider, slug);
  const response = await request(fetcher, url);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new CatalogUnavailableError(`The asset catalog returned HTTP ${response.status}`);
  const document = record(await parseJsonResponse(response, url), '$');
  validateDocumentHeader(document, '$');
  return readCatalogAsset(document.asset, provider, slug, '$.asset');
}

async function fetchFallbackAsset(
  provider: string,
  slug: string,
  fetcher: typeof fetch,
): Promise<CatalogAsset | undefined> {
  const response = await request(fetcher, GITHUB_CATALOG_FALLBACK_URL);
  if (!response.ok) {
    throw new CatalogUnavailableError(`The GitHub catalog fallback returned HTTP ${response.status}`);
  }
  const document = record(await parseJsonResponse(response, GITHUB_CATALOG_FALLBACK_URL), '$');
  validateDocumentHeader(document, '$');
  if (!Array.isArray(document.assets) || document.assets.length > 1024) {
    invalid('$.assets', 'an array with at most 1024 assets');
  }
  const expectedId = `${provider}:${slug}`;
  const matches = document.assets.filter((candidate) => (
    candidate !== null
    && typeof candidate === 'object'
    && !Array.isArray(candidate)
    && (candidate as UnknownRecord).id === expectedId
  ));
  if (matches.length === 0) return undefined;
  if (matches.length > 1) invalid('$.assets', `one record for ${expectedId}`);
  return readCatalogAsset(matches[0], provider, slug, '$.assets');
}

export async function resolveCatalogAsset(input: Readonly<{
  provider: string;
  slug: string;
  allowGithubFallback: boolean;
  fetch?: typeof fetch;
}>): Promise<CatalogAsset | undefined> {
  const fetcher = input.fetch ?? fetch;
  try {
    return await fetchPrimaryAsset(input.provider, input.slug, fetcher);
  } catch (cause) {
    if (cause instanceof CatalogInvalidError) throw cause;
    if (!(cause instanceof CatalogUnavailableError)) throw cause;
    if (!input.allowGithubFallback) {
      throw new CatalogUnavailableError(
        'The Antiky asset catalog is unavailable. Rerun with --allow-github-fallback to fetch the versioned fallback from GitHub.',
      );
    }
    return fetchFallbackAsset(input.provider, input.slug, fetcher);
  }
}
