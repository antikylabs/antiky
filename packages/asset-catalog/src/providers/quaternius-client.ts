import type { CatalogAsset } from '../index.ts';
import { createQuaterniusPack } from './quaternius.ts';
import { decodeHtml, metaContent, slugFromUrl, unique } from './source-html.ts';

const ROOT = 'https://quaternius.com';
const INDEX = `${ROOT}/index.html`;

type QuaterniusIndexRecord = Readonly<{ tags: readonly string[]; previewUrl: string }>;

export function parseQuaterniusIndex(html: string): ReadonlyMap<string, QuaterniusIndexRecord> {
  const records = new Map<string, QuaterniusIndexRecord>();
  for (const match of html.matchAll(/<div class=["']pack["']>([\s\S]*?)(?=<div class=["']pack["']>|<footer)/gi)) {
    const block = match[1]!;
    const path = /href=["'](\/packs\/[a-z0-9-]+\.html)["']/i.exec(block)?.[1];
    if (!path) continue;
    const previewPath = /class=["']gallery-img["'][^>]+src=["']([^"']+)["']/i.exec(block)?.[1];
    if (!previewPath) continue;
    const publicTags = [...block.matchAll(/class=["']viewtag tags["'][^>]*>([\s\S]*?)<\/div>/gi)].map((tag) => tag[1]!);
    const hidden = decodeHtml(/<noscript>([\s\S]*?)<\/noscript>/i.exec(block)?.[1] ?? '')
      .split(/\s+/).filter((tag) => tag.length > 2);
    records.set(new URL(path, ROOT).toString(), {
      tags: unique([...publicTags, ...hidden]), previewUrl: new URL(previewPath, ROOT).toString(),
    });
  }
  return records;
}

export function parseQuaterniusPackPage(
  html: string, sourceUrl: string, indexTags: readonly string[], retrievedAt: string, thumbnailUrl?: string,
): CatalogAsset {
  if (!/>\s*CC0\s*</i.test(html)) throw new Error(`Quaternius page is not explicitly CC0: ${sourceUrl}`);
  const upstreamId = slugFromUrl(sourceUrl);
  const slug = upstreamId === 'ultimatenature' ? 'ultimate-nature' : upstreamId;
  const title = decodeHtml(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? slug).replace(/^Quaternius\s*•\s*/i, '');
  const description = metaContent(html, 'description') || `${title}, a CC0 low-poly model pack published by Quaternius.`;
  const previewPath = metaContent(html, 'og:image');
  const preview = thumbnailUrl ?? new URL(previewPath, ROOT).toString();
  const localPreview = upstreamId === 'ultimatenature' ? '/previews/curated/quaternius-ultimate-nature.webp' : preview;
  const modelCount = /Models[\s\S]{0,160}?class=["']text-right["'][^>]*>\s*(\d+)/i.exec(html)?.[1];
  const formatBlock = /Formats([\s\S]*?)License/i.exec(html)?.[1] ?? '';
  const formats = unique([...formatBlock.matchAll(/class=["']text-right tags["'][^>]*>([^<]+)</gi)].map((match) => match[1]!));
  const tags = unique([...indexTags, '3d', 'model', 'low poly', 'cc0']);
  if (!title || !previewPath) throw new Error(`Incomplete Quaternius page: ${sourceUrl}`);
  return createQuaterniusPack({
    upstreamId, slug, name: title, description, kind: 'model',
    fileCount: modelCount ? Number(modelCount) : null,
    formats: formats.length > 0 ? formats : ['fbx', 'obj', 'blend'],
    tags, categories: unique([...indexTags, '3d']), creator: 'Quaternius', sourceUrl,
    previewUrl: localPreview, previewSourceUrl: preview,
    previewHosting: upstreamId === 'ultimatenature' ? 'local' : 'provider',
    verification: 'source-verified', retrievedAt,
  });
}

async function fetchText(fetcher: typeof fetch, url: string): Promise<string> {
  const retryable = new Set([408, 425, 429, 500, 502, 503, 504]);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetcher(url, { headers: { accept: 'text/html', 'user-agent': 'AntikyAssetCatalog/1.0 (+https://antikylabs.com/assets)' } });
    if (response.ok) return response.text();
    if (!retryable.has(response.status) || attempt === 3) {
      throw new Error(`Quaternius request failed (${response.status}): ${url}`);
    }
  }
  throw new Error(`Quaternius request failed after retries: ${url}`);
}

export async function fetchQuaterniusCatalog(options: Readonly<{
  fetch?: typeof fetch; retrievedAt?: string; concurrency?: number;
}> = {}): Promise<CatalogAsset[]> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const index = parseQuaterniusIndex(await fetchText(fetcher, INDEX));
  const entries = [...index.entries()].sort(([left], [right]) => left.localeCompare(right));
  const results = new Array<CatalogAsset>(entries.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(options.concurrency ?? 4, entries.length) }, async () => {
    while (cursor < entries.length) {
      const offset = cursor++;
      const [url, record] = entries[offset]!;
      results[offset] = parseQuaterniusPackPage(
        await fetchText(fetcher, url), url, record.tags, retrievedAt, record.previewUrl,
      );
    }
  }));
  return results;
}
