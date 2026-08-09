import { CATALOG_ASSETS } from '@antiky/asset-catalog/catalog';

export function GET() {
  const records = CATALOG_ASSETS.map((asset) => (
    `- [${asset.name}](https://antikylabs.com/assets/${asset.provider.id}/${asset.slug}): ${asset.kind}, ${asset.license.name}, ${asset.verification}`
  ));
  return new Response(`# Antiky Assets\n\nGame assets with explicit licensing and provenance.\n\n${records.join('\n')}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
