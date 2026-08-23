import type { AssetKind, CatalogAsset } from '../index.ts';
import { createKenneyPack } from './kenney.ts';
import { decodeHtml, metaContent, slugFromUrl, unique } from './source-html.ts';

const ROOT = 'https://kenney.nl';
const INDEX = `${ROOT}/assets`;

function categoryKind(categories: readonly string[], tags: readonly string[]): AssetKind {
  const values = [...categories, ...tags].map((value) => value.toLocaleLowerCase());
  if (values.includes('audio')) return 'audio';
  if (values.includes('textures')) return 'texture';
  if (values.includes('3d')) return 'model';
  if (values.some((value) => value.includes('font'))) return 'font';
  return 'sprite';
}

function formatsFor(kind: AssetKind): readonly string[] {
  if (kind === 'audio') return ['ogg', 'wav'];
  if (kind === 'font') return ['ttf'];
  if (kind === 'model') return ['fbx', 'glb', 'obj'];
  return ['png'];
}

export function parseKenneyIndexPage(html: string): Readonly<{
  records: readonly Readonly<{ url: string; previewUrl: string }>[]; pageCount: number;
}> {
  const records = [...html.matchAll(/<div class=["']asset["']>([\s\S]*?)<\/div>\s*<\/div>/gi)].flatMap((match) => {
    const block = match[1]!;
    const url = /href=["'](https:\/\/kenney\.nl\/assets\/[a-z0-9-]+)["']/i.exec(block)?.[1];
    const previewUrl = /background-image\s*:\s*url\(["']([^"']+)["']\)/i.exec(block)?.[1];
    return url && previewUrl ? [{ url, previewUrl }] : [];
  });
  const pages = [...html.matchAll(/\/assets\/page:(\d+)/g)].map((match) => Number(match[1]));
  return Object.freeze({ records: Object.freeze(records), pageCount: Math.max(1, ...pages) });
}

export function parseKenneyAssetPage(html: string, sourceUrl: string, retrievedAt: string, thumbnailUrl?: string): CatalogAsset {
  if (!/Creative Commons CC0/i.test(html)) throw new Error(`Kenney page is not explicitly CC0: ${sourceUrl}`);
  const slug = slugFromUrl(sourceUrl);
  const name = decodeHtml(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? slug);
  const tags = unique([...html.matchAll(/<a[^>]+class=["']tag["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => match[1]!));
  const categories = unique([...html.matchAll(/href=["'][^"']*\/(?:category|series):[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => match[1]!));
  const allTags = unique([...tags, ...categories, 'game assets', 'cc0']);
  const kind = categoryKind(categories, tags);
  const fileCountText = /<td[^>]*>\s*Files\s*<\/td>\s*<td[^>]*>\s*(\d+)/i.exec(html)?.[1];
  const preview = thumbnailUrl ?? metaContent(html, 'og:image');
  const localPreview = slug === 'nature-kit' ? '/previews/curated/kenney-nature-kit.webp' : preview;
  const description = metaContent(html, 'og:description') || `${name}, a CC0 ${kind} pack published by Kenney.`;
  if (!name || !preview) throw new Error(`Incomplete Kenney page: ${sourceUrl}`);
  return createKenneyPack({
    upstreamId: slug, slug, name, description, kind,
    quality: 0,
    fileCount: fileCountText ? Number(fileCountText) : null,
    formats: formatsFor(kind), tags: allTags, categories,
    creator: 'Kenney', sourceUrl, previewUrl: localPreview, previewSourceUrl: preview,
    previewHosting: slug === 'nature-kit' ? 'local' : 'provider', verification: 'source-verified', retrievedAt,
  });
}

async function fetchText(fetcher: typeof fetch, url: string): Promise<string> {
  const response = await fetcher(url, { headers: { accept: 'text/html', 'user-agent': 'AntikyAssetCatalog/1.0 (+https://antikylabs.com/assets)' } });
  if (!response.ok) throw new Error(`Kenney request failed (${response.status}): ${url}`);
  return response.text();
}

async function concurrentMap<T, R>(values: readonly T[], limit: number, map: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await map(values[index]!);
    }
  }));
  return results;
}

export async function fetchKenneyCatalog(options: Readonly<{
  fetch?: typeof fetch; retrievedAt?: string; concurrency?: number;
}> = {}): Promise<CatalogAsset[]> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const first = await fetchText(fetcher, INDEX);
  const index = parseKenneyIndexPage(first);
  const remainingPages = Array.from({ length: index.pageCount - 1 }, (_, offset) => `${INDEX}/page:${offset + 2}`);
  const remaining = await concurrentMap(remainingPages, options.concurrency ?? 4, (url) => fetchText(fetcher, url));
  const records = [index.records, ...remaining.map((html) => parseKenneyIndexPage(html).records)].flat();
  const uniqueRecords = [...new Map(records.map((record) => [record.url, record])).values()]
    .sort((left, right) => left.url.localeCompare(right.url));
  return concurrentMap(uniqueRecords, options.concurrency ?? 4, async (record) => (
    parseKenneyAssetPage(await fetchText(fetcher, record.url), record.url, retrievedAt, record.previewUrl)
  ));
}
