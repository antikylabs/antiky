# Antiky asset catalog

This package owns the catalog schema, committed source metadata, build-time crawlers, and the static
JSON API deployed at `https://catalog-api.antikylabs.com/v1/`.

It does not run an API server. `npm run build` writes a deployment-ready `dist/` directory containing:

- `v1/index.json` — version manifest and URL templates;
- `v1/catalog.json` — the complete catalog;
- `v1/assets/{provider}/{slug}.json` — one document per asset;
- `previews/` — locally hosted catalog previews.

The Vercel project should use `packages/asset-catalog` as its root directory. Its `vercel.json`
publishes `dist` as static files, enables cross-origin browser reads, and adds cache headers. Crawlers
are explicit maintenance commands; neither deployment nor a catalog request crawls provider sites.
