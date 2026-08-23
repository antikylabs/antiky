# Antiky asset catalog

This package owns the catalog schema, committed source metadata, build-time crawlers, and the static
JSON API at `https://assets.antikylabs.com/v1/`.

It does not run an API server. `npm run build` writes a deployment-ready `dist/` directory containing:

- `v1/index.json` - version manifest and URL templates;
- `v1/catalog.json` - the complete catalog;
- `v1/assets/{provider}/{slug}.json` - one document per asset;
- `previews/` - locally hosted catalog previews.

## Deploy to Cloudflare Pages

Configure the Pages project from the repository root with:

- Build command: `npm run build --workspace @antiky/asset-catalog`
- Build output directory: `packages/asset-catalog/dist`

Serve the build output as static files. Crawlers are explicit maintenance commands; neither the
deployment nor a catalog request crawls provider sites.

## Update the GitHub fallback

After changing an install-verified record, refresh the CLI fallback artifact:

```sh
npm run catalog:fallback:write --workspace @antiky/asset-catalog
```

Commit `packages/asset-catalog/data/installable-assets.v1.json` with the catalog change. The CLI
reads this file from GitHub only when the primary site is unavailable and the user explicitly
allows the fallback.
