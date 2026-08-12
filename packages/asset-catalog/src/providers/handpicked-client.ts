import type { AssetKind, AssetProvider, AssetQuality, CatalogAsset } from '../index.ts';
import { createCuratedCc0Asset } from './curated.ts';
import { decodeHtml, metaContent, slugFromUrl, unique } from './source-html.ts';

export type HandpickedItchSource = Readonly<{
  url: string;
  catalogId: string;
  quality: AssetQuality;
  provider: AssetProvider;
  creator: string;
  kind: AssetKind;
  formats: readonly string[];
  categories: readonly string[];
  fileCount: number | null;
  existing: boolean;
}>;

const KAYKIT_PROVIDER = Object.freeze({ id: 'kaykit', name: 'KayKit', url: 'https://kaylousberg.com/game-assets' });
const QUATERNIUS_PROVIDER = Object.freeze({ id: 'quaternius', name: 'Quaternius', url: 'https://quaternius.com' });
const PIXEL_FROG_PROVIDER = Object.freeze({ id: 'pixel-frog', name: 'Pixel Frog', url: 'https://pixelfrog-assets.itch.io' });
const KEVINS_MOMS_HOUSE_PROVIDER = Object.freeze({ id: 'kevins-moms-house', name: "Kevin's Mom's House", url: 'https://kevins-moms-house.itch.io' });

export const HANDPICKED_ITCH_SOURCES: readonly HandpickedItchSource[] = Object.freeze([
  {
    url: 'https://pixel-boy.itch.io/ninja-adventure-asset-pack', catalogId: 'pixel-boy:ninja-adventure-asset-pack', quality: 0,
    provider: { id: 'pixel-boy', name: 'pixel-boy', url: 'https://pixel-boy.itch.io' }, creator: 'pixel-boy',
    kind: 'sprite', formats: ['png'], categories: ['2d', 'sprite', 'top-down'], fileCount: null, existing: false,
  },
  {
    url: 'https://pixelfrog-assets.itch.io/tiny-swords', catalogId: 'pixel-frog:tiny-swords', quality: 0,
    provider: PIXEL_FROG_PROVIDER, creator: 'Pixel Frog', kind: 'sprite', formats: ['png'],
    categories: ['2d', 'sprite', 'strategy'], fileCount: null, existing: false,
  },
  {
    url: 'https://kaylousberg.itch.io/kaykit-medieval-hexagon', catalogId: 'kaykit:medieval-hexagon', quality: 0,
    provider: KAYKIT_PROVIDER, creator: 'Kay Lousberg', kind: 'model', formats: ['blend', 'fbx', 'gltf', 'obj'],
    categories: ['3d', 'medieval', 'strategy'], fileCount: 200, existing: true,
  },
  {
    url: 'https://kaylousberg.itch.io/kaykit-dungeon-pack', catalogId: 'kaykit:dungeon-remastered', quality: 0,
    provider: KAYKIT_PROVIDER, creator: 'Kay Lousberg', kind: 'model', formats: ['blend', 'fbx', 'gltf', 'obj'],
    categories: ['3d', 'dungeon', 'fantasy'], fileCount: 200, existing: true,
  },
  {
    url: 'https://kaylousberg.itch.io/kaykit-forest', catalogId: 'kaykit:forest-nature-pack', quality: 0,
    provider: KAYKIT_PROVIDER, creator: 'Kay Lousberg', kind: 'model', formats: ['blend', 'fbx', 'gltf', 'obj'],
    categories: ['3d', 'nature', 'forest'], fileCount: 1_500, existing: true,
  },
  {
    url: 'https://quaternius.itch.io/stylized-nature-megakit', catalogId: 'quaternius:stylizednaturemegakit', quality: 0,
    provider: QUATERNIUS_PROVIDER, creator: 'Quaternius', kind: 'model', formats: ['blend', 'fbx', 'gltf', 'obj'],
    categories: ['3d', 'nature', 'forest'], fileCount: 116, existing: true,
  },
  {
    url: 'https://pixelfrog-assets.itch.io/pixel-adventure-1', catalogId: 'pixel-frog:pixel-adventure-1', quality: 0,
    provider: PIXEL_FROG_PROVIDER, creator: 'Pixel Frog', kind: 'sprite', formats: ['png'],
    categories: ['2d', 'sprite', 'platformer'], fileCount: null, existing: false,
  },
  {
    url: 'https://quaternius.itch.io/universal-animation-library', catalogId: 'quaternius:universalanimationlibrary', quality: 1,
    provider: QUATERNIUS_PROVIDER, creator: 'Quaternius', kind: 'model', formats: ['blend', 'fbx', 'glb'],
    categories: ['3d', 'animation', 'character'], fileCount: 120, existing: true,
  },
  {
    url: 'https://kaylousberg.itch.io/kaykit-skeletons', catalogId: 'kaykit:characters-skeletons', quality: 1,
    provider: KAYKIT_PROVIDER, creator: 'Kay Lousberg', kind: 'model', formats: ['blend', 'fbx', 'gltf', 'obj'],
    categories: ['3d', 'character', 'fantasy'], fileCount: 4, existing: true,
  },
  {
    url: 'https://rgsdev.itch.io/free-3d-modular-low-poly-assets-for-prototyping-by-rgsdev',
    catalogId: 'rgsdev:free-3d-modular-low-poly-assets-for-prototyping-by-rgsdev', quality: 1,
    provider: { id: 'rgsdev', name: 'RGS_Dev', url: 'https://rgsdev.itch.io' }, creator: 'RGS_Dev',
    kind: 'model', formats: [], categories: ['3d', 'modular', 'prototype'], fileCount: 75, existing: false,
  },
  {
    url: 'https://kevins-moms-house.itch.io/four-seasons-platformer-tileset',
    catalogId: 'kevins-moms-house:four-seasons-platformer-tileset', quality: 1,
    provider: KEVINS_MOMS_HOUSE_PROVIDER, creator: "Kevin's Mom's House", kind: 'sprite', formats: ['png'],
    categories: ['2d', 'tileset', 'platformer'], fileCount: null, existing: false,
  },
  {
    url: 'https://0x72.itch.io/dungeontileset-ii', catalogId: '0x72:dungeontileset-ii', quality: 2,
    provider: { id: '0x72', name: '0x72', url: 'https://0x72.itch.io' }, creator: '0x72',
    kind: 'sprite', formats: ['png'], categories: ['2d', 'tileset', 'dungeon'], fileCount: null, existing: false,
  },
  {
    url: 'https://datagoblin.itch.io/monogram', catalogId: 'datagoblin:monogram', quality: 2,
    provider: { id: 'datagoblin', name: 'datagoblin', url: 'https://datagoblin.itch.io' }, creator: 'datagoblin',
    kind: 'font', formats: ['ttf', 'png', 'json', 'p8'], categories: ['font', 'pixel art', 'monospace'], fileCount: null, existing: false,
  },
  {
    url: 'https://fertile-soil-productions.itch.io/modular-village-pack',
    catalogId: 'fertile-soil-productions:modular-village-pack', quality: 2,
    provider: { id: 'fertile-soil-productions', name: 'Fertile Soil Productions', url: 'https://fertile-soil-productions.itch.io' },
    creator: 'Keith at Fertile Soil Productions', kind: 'model', formats: ['obj'],
    categories: ['3d', 'modular', 'village'], fileCount: 155, existing: false,
  },
  {
    url: 'https://kevins-moms-house.itch.io/fantasy', catalogId: 'kevins-moms-house:fantasy', quality: 2,
    provider: KEVINS_MOMS_HOUSE_PROVIDER, creator: "Kevin's Mom's House", kind: 'sprite', formats: ['png'],
    categories: ['2d', 'tileset', 'fantasy'], fileCount: null, existing: false,
  },
  {
    url: 'https://gibbongl.itch.io/gboracles-character-interior-pack',
    catalogId: 'gibbongl:gboracles-character-interior-pack', quality: 2,
    provider: { id: 'gibbongl', name: 'GibbonGL', url: 'https://gibbongl.itch.io' }, creator: 'GibbonGL',
    kind: 'sprite', formats: ['png'], categories: ['2d', 'character', 'interior'], fileCount: null, existing: false,
  },
  {
    url: 'https://binbun3d.itch.io/godot-skies', catalogId: 'binbun3d:godot-skies', quality: 3,
    provider: { id: 'binbun3d', name: 'Binbun', url: 'https://binbun3d.itch.io' }, creator: 'Binbun',
    kind: 'hdri', formats: ['gdshader'], categories: ['3d', 'sky', 'shader'], fileCount: 24, existing: false,
  },
  {
    url: 'https://voxel-dev.itch.io/low-poly-camping-asset-pack-free-demo',
    catalogId: 'voxel-dev:low-poly-camping-asset-pack-free-demo', quality: 4,
    provider: { id: 'voxel-dev', name: 'VOXEL DEV', url: 'https://voxel-dev.itch.io' }, creator: 'VOXEL DEV',
    kind: 'model', formats: [], categories: ['3d', 'camping', 'low poly'], fileCount: 8, existing: false,
  },
  {
    url: 'https://cc0gameassets.itch.io/lowpoly-3d-swords-cc0', catalogId: 'cc0-game-assets:lowpoly-3d-swords-cc0', quality: 4,
    provider: { id: 'cc0-game-assets', name: 'CC0 Game Assets', url: 'https://cc0gameassets.itch.io' }, creator: 'CC0 Game Assets',
    kind: 'model', formats: ['fbx', 'glb'], categories: ['3d', 'weapon', 'low poly'], fileCount: 50, existing: false,
  },
]);

const reviewedQuality = new Map(HANDPICKED_ITCH_SOURCES.map((source) => [source.catalogId, source.quality]));

export function applyHandpickedQuality(asset: CatalogAsset): CatalogAsset {
  const quality = reviewedQuality.get(asset.id);
  return quality === undefined || quality === asset.quality ? asset : Object.freeze({ ...asset, quality });
}

function cc0Evidence(html: string): boolean {
  const publisherPage = html.split(/<div[^>]+id=["']community_topic/i)[0] ?? html;
  return /itch\.io\/game-assets\/assets-cc0|creativecommons\.org\/publicdomain\/zero\/1\.0|tldrlegal\.com\/license\/creative-commons-cc0|(?:^|[^a-z0-9])CC-?0\b|Creative Commons Zero/i.test(publisherPage);
}

function itchTags(html: string): string[] {
  const panel = /<div[^>]+class=["'][^"']*\bgame_info_panel_widget\b[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1] ?? '';
  const tagsCell = /<td>\s*Tags\s*<\/td>\s*<td>([\s\S]*?)<\/td>/i.exec(panel)?.[1] ?? '';
  return [...tagsCell.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => decodeHtml(match[1] ?? ''));
}

export function parseHandpickedItchPage(html: string, source: HandpickedItchSource, retrievedAt: string): CatalogAsset {
  if (!cc0Evidence(html)) throw new Error(`Handpicked itch page lost its CC0 evidence: ${source.url}`);
  const name = decodeHtml(/<h1[^>]+class=["'][^"']*\bgame_title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? '');
  const description = metaContent(html, 'og:description');
  const previewUrl = metaContent(html, 'og:image');
  if (!name || !description || !previewUrl) throw new Error(`Handpicked itch page is missing required metadata: ${source.url}`);
  const slug = source.catalogId.slice(source.catalogId.indexOf(':') + 1);
  const tags = unique([...itchTags(html), ...source.categories, source.kind, 'game assets', 'cc0']);
  return createCuratedCc0Asset(source.provider, {
    upstreamId: slugFromUrl(source.url), slug, name, description, kind: source.kind, quality: source.quality,
    fileCount: source.fileCount, formats: source.formats, tags, categories: source.categories,
    creator: source.creator, sourceUrl: source.url, previewUrl, previewSourceUrl: previewUrl,
    previewHosting: 'provider', verification: 'source-verified', retrievedAt,
  });
}

export async function fetchHandpickedItchCatalog(options: Readonly<{ fetch?: typeof fetch; retrievedAt?: string }> = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const headers = { accept: 'text/html', 'user-agent': 'AntikyAssetCatalog/1.0 (+https://antikylabs.com/assets)' };
  const assets: CatalogAsset[] = [];
  for (let offset = 0; offset < HANDPICKED_ITCH_SOURCES.length; offset += 4) {
    const batch = HANDPICKED_ITCH_SOURCES.slice(offset, offset + 4);
    const pages = await Promise.all(batch.map(async (source) => {
      const response = await fetcher(source.url, { headers });
      if (!response.ok) throw new Error(`Handpicked source request failed (${response.status}): ${source.url}`);
      return { source, html: await response.text() };
    }));
    for (const { source, html } of pages) {
      if (!cc0Evidence(html)) throw new Error(`Handpicked itch page lost its CC0 evidence: ${source.url}`);
      if (!source.existing) assets.push(parseHandpickedItchPage(html, source, retrievedAt));
    }
  }
  return Object.freeze({ assets: Object.freeze(assets.sort((left, right) => left.id.localeCompare(right.id))) });
}
