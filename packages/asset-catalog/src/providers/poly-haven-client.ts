import type { AssetDownload, CatalogAsset } from '../index.ts';
import {
  createPolyHavenAsset,
  createPolyHavenMetadataAsset,
  type PolyHavenMetadata,
} from './poly-haven.ts';

const API_ORIGIN = 'https://api.polyhaven.com';
const STARTER_IDS = ['dead_tree_trunk', 'forest_floor', 'forest_slope'] as const;
const REQUEST_HEADERS = Object.freeze({
  'User-Agent': 'AntikyAssetCatalog/0.1 (https://antikylabs.com/assets)',
});

type JsonRecord = Record<string, unknown>;
type RemoteFile = Readonly<{
  size: number;
  url: string;
  md5: string;
  include?: Readonly<Record<string, RemoteFile>>;
}>;

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid Poly Haven API ${label}`);
  }
  return value as JsonRecord;
}

function nested(value: unknown, keys: readonly string[], label: string): unknown {
  let current = value;
  for (const key of keys) current = record(current, label)[key];
  if (current === undefined) throw new Error(`Missing Poly Haven API ${label}: ${keys.join('.')}`);
  return current;
}

function remoteFile(value: unknown, label: string): RemoteFile {
  const item = record(value, label);
  if (
    typeof item.size !== 'number' || !Number.isSafeInteger(item.size) || item.size < 0
    || typeof item.url !== 'string' || !item.url.startsWith('https://dl.polyhaven.org/')
    || typeof item.md5 !== 'string' || !/^[a-f0-9]{32}$/u.test(item.md5)
  ) throw new Error(`Invalid Poly Haven API file: ${label}`);
  return item as unknown as RemoteFile;
}

function nameFromUrl(url: string): string {
  const name = new URL(url).pathname.split('/').at(-1);
  if (!name) throw new Error(`Poly Haven download has no filename: ${url}`);
  return decodeURIComponent(name);
}

function download(file: RemoteFile, path = nameFromUrl(file.url)): AssetDownload {
  const extension = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLocaleLowerCase() : 'bin';
  return Object.freeze({
    path,
    format: extension,
    size: file.size,
    url: file.url,
    hash: Object.freeze({ algorithm: 'md5' as const, value: file.md5 }),
  });
}

function modelDownloads(files: unknown): AssetDownload[] {
  const primary = remoteFile(nested(files, ['gltf', '1k', 'gltf'], 'model files'), 'model glTF');
  const dependencies = Object.entries(primary.include ?? {})
    .map(([path, file]) => download(remoteFile(file, path), path))
    .sort((left, right) => {
      const rank = (path: string) => path.endsWith('.bin') ? 0
        : path.includes('_diff') ? 1
          : path.includes('_nor_gl_') ? 2
            : path.includes('_arm') ? 3 : 4;
      return rank(left.path) - rank(right.path) || left.path.localeCompare(right.path);
    });
  return [download(primary), ...dependencies];
}

function textureDownloads(files: unknown): AssetDownload[] {
  return [
    ['Diffuse', '1k', 'jpg'], ['AO', '1k', 'jpg'],
    ['Rough', '1k', 'jpg'], ['nor_gl', '1k', 'jpg'],
  ].map((keys) => download(remoteFile(nested(files, keys, 'texture files'), keys.join('.'))));
}

function hdriDownloads(files: unknown): AssetDownload[] {
  return [download(remoteFile(nested(files, ['hdri', '1k', 'hdr'], 'HDRI files'), '1K HDRI'))];
}

async function getJson(fetcher: typeof fetch, url: string): Promise<unknown> {
  const response = await fetcher(url, { headers: REQUEST_HEADERS });
  if (!response.ok) throw new Error(`Poly Haven API request failed (${response.status}): ${url}`);
  return response.json();
}

function metadata(value: unknown, upstreamId: string): PolyHavenMetadata {
  const item = record(value, `metadata for ${upstreamId}`);
  if (
    typeof item.name !== 'string' || item.name.trim().length === 0
    || ![0, 1, 2].includes(item.type as number)
    || typeof item.description !== 'string' || item.description.trim().length === 0
    || typeof item.files_hash !== 'string' || !/^[a-f0-9]{40}$/u.test(item.files_hash)
    || typeof item.thumbnail_url !== 'string' || !item.thumbnail_url.startsWith('https://cdn.polyhaven.com/')
    || item.tags !== undefined && !Array.isArray(item.tags)
    || item.categories !== undefined && !Array.isArray(item.categories)
  ) throw new Error(`Invalid Poly Haven API metadata for ${upstreamId}`);
  return item as PolyHavenMetadata;
}

function selectRoundRobin(
  candidates: readonly Readonly<{ upstreamId: string; metadata: PolyHavenMetadata }>[],
  limit: number,
): Array<Readonly<{ upstreamId: string; metadata: PolyHavenMetadata }>> {
  const groups = [0, 1, 2].map((type) => candidates
    .filter((candidate) => candidate.metadata.type === type)
    .sort((left, right) => (
      (right.metadata.download_count ?? 0) - (left.metadata.download_count ?? 0)
      || left.upstreamId.localeCompare(right.upstreamId)
    )));
  const selected: Array<Readonly<{ upstreamId: string; metadata: PolyHavenMetadata }>> = [];
  for (let index = 0; selected.length < limit; index += 1) {
    let added = false;
    for (const group of groups) {
      const candidate = group[index];
      if (candidate && selected.length < limit) {
        selected.push(candidate);
        added = true;
      }
    }
    if (!added) break;
  }
  return selected;
}

export async function fetchPolyHavenMetadataCatalog(input: Readonly<{
  fetch?: typeof fetch;
  limit?: number;
  retrievedAt?: string;
  excludeIds?: readonly string[];
}> = {}): Promise<CatalogAsset[]> {
  const fetcher = input.fetch ?? fetch;
  const retrievedAt = input.retrievedAt ?? new Date().toISOString();
  const limit = input.limit ?? 995;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Poly Haven metadata limit must be positive');
  const excluded = new Set(input.excludeIds ?? STARTER_IDS);
  const allMetadata = record(await getJson(fetcher, `${API_ORIGIN}/assets`), 'asset list');
  const candidates = Object.entries(allMetadata)
    .filter(([upstreamId]) => !excluded.has(upstreamId))
    .map(([upstreamId, value]) => ({ upstreamId, metadata: metadata(value, upstreamId) }));
  return selectRoundRobin(candidates, Math.min(limit, candidates.length))
    .map(({ upstreamId, metadata: item }) => createPolyHavenMetadataAsset({
      upstreamId,
      metadata: item,
      retrievedAt,
    }));
}

export async function fetchPolyHavenStarterCatalog(input: Readonly<{
  fetch?: typeof fetch;
  retrievedAt?: string;
}> = {}): Promise<CatalogAsset[]> {
  const fetcher = input.fetch ?? fetch;
  const retrievedAt = input.retrievedAt ?? new Date().toISOString();
  const allMetadata = record(await getJson(fetcher, `${API_ORIGIN}/assets`), 'asset list');
  const assets: CatalogAsset[] = [];

  for (const [index, upstreamId] of STARTER_IDS.entries()) {
    const metadata = record(allMetadata[upstreamId], `metadata for ${upstreamId}`);
    const files = await getJson(fetcher, `${API_ORIGIN}/files/${upstreamId}`);
    const selections = [modelDownloads, textureDownloads, hdriDownloads] as const;
    assets.push(createPolyHavenAsset({
      upstreamId,
      metadata: metadata as Parameters<typeof createPolyHavenAsset>[0]['metadata'],
      files: selections[index]!(files),
      retrievedAt,
    }));
  }
  return assets;
}
