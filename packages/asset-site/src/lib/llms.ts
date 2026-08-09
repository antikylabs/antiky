import { CATALOG_ASSETS } from '@antiky/asset-catalog/catalog';

const origin = process.env.NEXT_PUBLIC_ASSET_SITE_URL ?? 'https://antikylabs.com';

export function buildAssetLlmsText(): string {
  const providerCounts = new Map<string, number>();
  for (const asset of CATALOG_ASSETS) {
    providerCounts.set(asset.provider.name, (providerCounts.get(asset.provider.name) ?? 0) + 1);
  }
  const providerSummary = [...providerCounts]
    .map(([provider, count]) => `- ${count.toLocaleString('en-US')} ${provider} ${count === 1 ? 'record' : 'packs or records'}`)
    .join('\n');

  return `# Antiky Assets

> Canonical agent guide for the Antiky CC0-first game asset catalog.

Antiky Assets provides ${CATALOG_ASSETS.length.toLocaleString('en-US')} CC0 asset records for game development. It catalogs official source metadata, licensing evidence, tags, formats, file or model counts when published, previews, and durable provenance. The catalog does not mirror every provider archive.

## Catalog coverage

${providerSummary}

## Search API

Use the JSON API instead of scraping the HTML catalog.

- Search: GET ${origin}/api/assets?q=forest&type=model&limit=100&offset=0
- One record: GET ${origin}/api/assets/{provider}/{slug}
- Human catalog: ${origin}/assets

Search parameters:

- q: text matched against names, descriptions, creators, providers, tags, and categories
- type: audio, font, hdri, model, sprite, or texture
- provider: kenney, quaternius, or poly-haven
- limit: 1 through 250; defaults to 100
- offset: zero-based result offset

The list response uses schemaVersion 2 and includes totalCatalogAssets, totalMatches, count, limit, offset, and assets. Each asset includes its stable ID, source URL, provider, creator, license, tags, formats, preview provenance, published facts, and verification state.

## Verification states

- cataloged: source and licensing metadata are recorded; downloadable bytes were not inspected
- source-verified: metadata came from an authoritative provider API or official source page and passed catalog validation
- install-verified: selected download URLs include sizes and hashes checked by the Antiky installer

Do not claim that cataloged metadata is install-verified. Do not claim that source-verified assets have been downloaded, mirrored, or hash-verified. If fileCount is null, report that the provider did not publish a meaningful file count.

## Recommended agent workflow

1. Search the API using the user's game concept and required asset type.
2. Inspect tags, formats, fileCount, license, provenance, and verification on promising records.
3. Fetch the permanent JSON record using its provider and slug.
4. Use the Antiky installer only for install-verified records.
5. For other records, direct the user or workflow to the official upstream source URL.
6. Preserve the catalog URL and upstream source URL with project provenance.

## Licensing

The current catalog is CC0-first. CC0 generally permits commercial use, modification, and redistribution without required creator attribution. Provider presentation requirements and rights outside copyright—including trademarks, privacy, publicity, and cultural restrictions—can still apply. Always retain the record's source and license-reference URLs.
`;
}

export function assetLlmsResponse(): Response {
  return new Response(buildAssetLlmsText(), {
    headers: {
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      'content-type': 'text/plain; charset=utf-8',
      link: `<${origin}/assets/llms.txt>; rel="canonical"`,
    },
  });
}
