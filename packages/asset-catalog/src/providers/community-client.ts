import type { CatalogAsset } from '../index.ts';
import { createCuratedCc0Asset } from './curated.ts';
import { decodeHtml, metaContent, slugFromUrl, unique } from './source-html.ts';

export type KayKitIndexRecord = Readonly<{
  url: string;
  title: string;
  previewUrl: string;
  categories: readonly string[];
}>;

const KAYKIT_PROVIDER = Object.freeze({ id: 'kaykit', name: 'KayKit', url: 'https://kaylousberg.com/game-assets' });
const SCREAMING_BRAIN_PROVIDER = Object.freeze({ id: 'screaming-brain-studios', name: 'Screaming Brain Studios', url: 'https://screamingbrainstudios.itch.io' });
const OPEN_DUELYST_PROVIDER = Object.freeze({ id: 'open-duelyst', name: 'OpenDuelyst', url: 'https://github.com/open-duelyst/duelyst' });

function countFrom(text: string, pattern: RegExp): number | null {
  const value = pattern.exec(text)?.[1]?.replaceAll(',', '');
  return value ? Number(value) : null;
}

export function parseKayKitIndex(html: string): KayKitIndexRecord[] {
  return [...html.matchAll(/<a\s+href=['"](https:\/\/kaylousberg\.com\/game-assets\/([^'"]+))['"]\s+class=['"]([^'"]*\bproject\b[^'"]*)['"][^>]*>([\s\S]*?)<\/a>/gi)]
    .flatMap((match) => {
      const [, url, slug, classes, block] = match;
      if (!url || !slug || !classes || !block || slug === 'complete-kaykit-collection') return [];
      const previewUrl = /background-image\s*:\s*url\(["']?([^"')]+)["']?\)/i.exec(block)?.[1];
      const title = decodeHtml(/class=['"]overlay['"][^>]*>([^<]+)</i.exec(block)?.[1] ?? '');
      if (!previewUrl || !title) return [];
      const categories = classes.split(/\s+/).filter((value) => !['col-md-4', 'noselect', 'animated-short', 'fadeInUp', 'project', '>'].includes(value));
      return [{ url, title, previewUrl, categories: unique(categories) }];
    });
}

export function parseKayKitPage(html: string, record: KayKitIndexRecord, retrievedAt: string): CatalogAsset {
  if (!/CC0\s+Licensed/i.test(html)) throw new Error(`KayKit page is not explicitly CC0: ${record.url}`);
  const description = metaContent(html, 'og:description') || `${record.title}, a CC0 game-asset pack by Kay Lousberg.`;
  const totalModels = countFrom(description, /(\d[\d,]*)\+?\s+total models/i);
  const assets = countFrom(description, /(?:contains?|includes?)\s+(?:over\s+)?(\d[\d,]*)\+?\s+(?:unique\s+)?(?:assets?|models?|stylised)/i);
  const featureModels = countFrom(description, /Features:\s*(\d[\d,]*)\+?\s+Low poly optimized(?: 3D)? models/i);
  const characterModels = countFrom(description, /contain\s+(\d[\d,]*)\s+\([^)]*\)\s+stylised/i);
  const slug = slugFromUrl(record.url);
  const tags = unique([...record.categories.map((value) => value.toLocaleLowerCase()), '3d', 'low poly', 'game assets', 'cc0']);
  return createCuratedCc0Asset(KAYKIT_PROVIDER, {
    upstreamId: slug, slug, name: record.title, description, kind: 'model', quality: 1,
    fileCount: totalModels ?? assets ?? featureModels ?? characterModels, formats: ['blend', 'fbx', 'gltf', 'obj'], tags,
    categories: record.categories, creator: 'Kay Lousberg', sourceUrl: record.url,
    previewUrl: record.previewUrl, previewSourceUrl: record.previewUrl, previewHosting: 'provider',
    verification: 'source-verified', retrievedAt,
  });
}

const SCREAMING_BRAIN_TOOLS = new Set([
  'texture-manipulator', 'pixel-picker', 'random-name-generator', 'cubemap-splitter', 'isometric-tile-toolkit',
]);

function usefulWords(value: string): string[] {
  const ignored = new Set(['free', 'pack', 'the', 'and', 'for', 'with', 'tiles', 'tile', 'sprites', 'sprite']);
  return value.toLocaleLowerCase().replace(/&[^;]+;/g, ' ').split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !ignored.has(word));
}

export function parseScreamingBrainIndex(html: string, retrievedAt: string): CatalogAsset[] {
  if (!/All assets have been released under the Public[\s\S]{0,80}CC0/i.test(html)) {
    throw new Error('Screaming Brain profile does not contain collection-wide CC0 evidence');
  }
  const blocks = html.split(/(?=<div[^>]+class=["'][^"']*\bgame_cell\b)/i).slice(1);
  return blocks.flatMap((block) => {
    const url = /href=["'](https:\/\/screamingbrainstudios\.itch\.io\/([^"']+))["']/i.exec(block)?.[1];
    if (!url) return [];
    const slug = slugFromUrl(url);
    if (SCREAMING_BRAIN_TOOLS.has(slug)) return [];
    const previewUrl = /(?:data-lazy_src|src)=["']([^"']+)["']/i.exec(block)?.[1];
    const title = decodeHtml(/class=["'][^"']*\btitle\s+game_link\b[^"']*["'][^>]*>([^<]+)</i.exec(block)?.[1] ?? '');
    const description = decodeHtml(/class=["']game_text["'][^>]*>([^<]*)</i.exec(block)?.[1] ?? '');
    if (!previewUrl || !title) return [];
    const fileCount = countFrom(description, /(?:FREE\s+)?(\d[\d,]*)\s+/i);
    const tags = unique([...usefulWords(`${title} ${description}`).slice(0, 8), '2d', 'game assets', 'cc0']);
    const texture = /texture|grid|background|pattern|material/i.test(`${title} ${description}`);
    return [createCuratedCc0Asset(SCREAMING_BRAIN_PROVIDER, {
      upstreamId: slug, slug, name: title, description: description || `${title}, a CC0 2D game-asset pack.`,
      kind: texture ? 'texture' : 'sprite', quality: 3, fileCount, formats: ['png'], tags,
      categories: texture ? ['2d', 'texture'] : ['2d', 'sprite'], creator: 'Screaming Brain Studios',
      sourceUrl: url, previewUrl, previewSourceUrl: previewUrl, previewHosting: 'provider',
      verification: 'source-verified', retrievedAt,
    })];
  });
}

type GitTree = Readonly<{
  sha: string;
  truncated: boolean;
  tree: readonly Readonly<{ path: string; type: string; size?: number }>[];
}>;

export function parseOpenDuelystTree(tree: GitTree, retrievedAt: string): Readonly<{
  assets: readonly CatalogAsset[];
  coveredFileCount: number;
  treeSha: string;
}> {
  if (tree.truncated) throw new Error('OpenDuelyst Git tree is truncated');
  const eligible = tree.tree.filter((entry) => entry.type === 'blob' && /^(app\/resources|app\/original_resources)\//.test(entry.path));
  const groups = new Map<string, typeof eligible>();
  for (const entry of eligible) {
    const parts = entry.path.split('/');
    const group = `${parts[1]}/${parts[2] ?? '_root'}`;
    const values = groups.get(group) ?? [];
    values.push(entry);
    groups.set(group, values);
  }
  const assets = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([group, files]) => {
    const [root, family] = group.split('/');
    const slug = `${root === 'resources' ? 'runtime' : 'source'}-${family!.replaceAll('_', '-')}`;
    const titleFamily = family!.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
    const formats = unique(files.map((file) => file.path.split('.').at(-1)?.toLocaleLowerCase() ?? '').filter(Boolean)).sort();
    const previewPath = files.find((file) => /\.(png|jpe?g|gif)$/i.test(file.path))?.path;
    const previewUrl = previewPath
      ? `https://raw.githubusercontent.com/open-duelyst/duelyst/${tree.sha}/${previewPath}`
      : 'https://opengraph.githubassets.com/1/open-duelyst/duelyst';
    return createCuratedCc0Asset(OPEN_DUELYST_PROVIDER, {
      upstreamId: group, slug, name: `OpenDuelyst ${titleFamily} ${root === 'resources' ? 'Runtime' : 'Sources'}`,
      description: `${files.length} CC0 files from OpenDuelyst's ${root}/${family} resource family.`,
      kind: /sfx|audio|music/i.test(family!) ? 'audio' : 'sprite', quality: 2,
      fileCount: files.length, formats, tags: unique(['open duelyst', family!.replaceAll('_', ' '), root === 'resources' ? 'runtime' : 'source', 'game assets', 'cc0']),
      categories: ['OpenDuelyst', root, family!], creator: 'Counterplay Games and OpenDuelyst contributors',
      sourceUrl: `https://github.com/open-duelyst/duelyst/tree/${tree.sha}/app/${root}/${family}`,
      previewUrl, previewSourceUrl: previewUrl, previewHosting: 'provider', verification: 'source-verified', retrievedAt,
    });
  });
  return Object.freeze({ assets: Object.freeze(assets), coveredFileCount: eligible.length, treeSha: tree.sha });
}

export async function fetchCommunityCatalog(options: Readonly<{ fetch?: typeof fetch; retrievedAt?: string }> = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const headers = { accept: 'text/html, application/json', 'user-agent': 'AntikyAssetCatalog/1.0 (+https://antikylabs.com/assets)' };
  const read = async (url: string) => {
    const response = await fetcher(url, { headers });
    if (!response.ok) throw new Error(`Community source request failed (${response.status}): ${url}`);
    return response.text();
  };
  const kayIndex = parseKayKitIndex(await read(KAYKIT_PROVIDER.url));
  const kaykit = await Promise.all(kayIndex.map(async (record) => parseKayKitPage(await read(record.url), record, retrievedAt)));
  const screamingBrain = parseScreamingBrainIndex(await read(`${SCREAMING_BRAIN_PROVIDER.url}/`), retrievedAt);
  const openDuelyst = parseOpenDuelystTree(JSON.parse(await read('https://api.github.com/repos/open-duelyst/duelyst/git/trees/main?recursive=1')) as GitTree, retrievedAt);
  return Object.freeze({ kaykit, screamingBrain, openDuelyst });
}
