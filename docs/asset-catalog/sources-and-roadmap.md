# Asset catalog sources and roadmap

This document records provider decisions for the Antiky asset catalog. The catalog is metadata-first: discovery does not download provider archives, mirror source files, or claim that an asset installs successfully.

## Current baseline

The first snapshot contains 1,000 records:

- 995 Poly Haven records selected reproducibly from one metadata response
- 3 Poly Haven starter packs with inspected download manifests
- 1 curated Kenney pack
- 1 curated Quaternius pack

The generated Poly Haven snapshot is about 2.5 MB. Its selection alternates models, textures, and HDRIs, ranking each group by provider download count. This creates a broad, useful initial collection without storing gigabytes of archives or a large local preview library.

Provider-hosted previews are acceptable only when a provider exposes them for this purpose. Otherwise, ingestion should store an approved local thumbnail or use a placeholder. Metadata requests must use caching, conditional requests when supported, a descriptive user agent, and conservative provider-specific rate limits.

## Provider priority

| Priority | Source | Integration | License and operational notes |
| --- | --- | --- | --- |
| 1 | [ambientCG](https://docs.ambientcg.com/api/v3/) | Paginate the official v3 API, up to 500 records per request. Import materials, HDRIs, decals, atlases, 3D models, terrain, and related types. | [Assets and preview renders are CC0](https://docs.ambientcg.com/license/). Strongest next automated source. |
| 2 | [Kenney](https://kenney.nl/assets) | Crawl the asset index and individual pack metadata conservatively; retain published categories, tags, file counts, and pack previews. | Pack pages identify CC0 assets. No stable public catalog API is currently documented, so use cached snapshots and low request rates. |
| 3 | [Quaternius](https://quaternius.com/faq.html) | Curate pack pages and their published metadata. Prefer pack-level entries until a stable machine-readable index exists. | The official FAQ states the models are CC0 and may be used commercially without attribution. |
| 4 | [Open Source 3D Assets](https://github.com/toxsam/open-source-3D-assets) | Read the public JSON registry and collection files; import only collections explicitly marked CC0. | The registry metadata is CC0, but each collection carries its own license. Treat it as an aggregator and preserve the original creator and collection provenance. |
| 5 | [Smithsonian Open Access](https://www.si.edu/openaccess/faq) | Use the API with an application key; filter to CC0-designated records with useful 3D files or game-relevant 2D media. | Rights, trademarks, privacy, publicity, and cultural-sensitivity concerns can remain even when a digital object is marked CC0. Keep these records source-only until reviewed. |
| 6 | [The Met Collection API](https://metmuseum.github.io/) | Search public-domain objects, then fetch selected object records within the published request limit. Focus on useful reference imagery and textures. | Public-domain status must be checked per object. Most records are reference material rather than game-ready assets. |
| 7 | [Mantissa](https://mantissa.xyz/free.html) | Curate pack-level entries for point clouds, landscapes, trees, and textures. | The free-resource page marks the listed resources public domain/CC0, but files can be several gigabytes and should not be mirrored during discovery. |
| 8 | [3DTextures.me](https://3dtextures.me/about/) | Add selected texture pages manually or through a conservative cached indexer if permitted. | The publisher states its textures are CC0. There is no documented public API, and one-by-one downloads make it a poor bulk-ingestion source. |

## Sources to hold or constrain

- [itch.io's CC0 filter](https://itch.io/game-assets/top-rated/assets-cc0/free) exposes a large and useful discovery pool, but licenses and download mechanisms are controlled per creator and item. Start with hand-reviewed publisher collections, not an unrestricted crawler.
- [OpenGameArt](https://opengameart.org/content/faq) carries CC0, attribution, share-alike, OGA-BY, GPL, and other licenses. Its FAQ also warns that preview images may not have the submitted asset's license. Import only explicit CC0 records and never infer preview rights from an asset license.
- Project PLATEAU is valuable open geospatial data, but its city-scale datasets, data licenses, and processing needs differ from ordinary game assets. Treat it as a future specialized importer rather than a general catalog source.
- Museum and archive sources should remain quarantined until the catalog can expose rights caveats, cultural context, and object-level provenance clearly.

## Ingestion contract

Every provider adapter should emit the shared catalog schema and preserve:

- a stable provider ID and upstream ID
- canonical source and license-reference URLs
- creator and provider attribution requirements
- asset kind, formats, categories, and at least three useful tags
- file or model count only when the provider publishes one
- preview origin and hosting policy
- retrieval time and any provider-supplied metadata revision or hash
- an honest verification state

Adapters must validate required fields, reject duplicate catalog IDs and canonical URLs, quarantine ambiguous licenses, and produce a deterministic snapshot plus a count-by-kind report. A scheduled refresh should create a reviewable diff rather than publishing provider changes automatically.

## Verification stages

1. **Cataloged metadata** — a source page was recorded; no claim is made about a downloadable archive.
2. **Source metadata verified** — an official API or machine-readable provider record supplied the metadata; files were not downloaded.
3. **Install verified** — download manifests and the installation path were inspected and tested.

Future quality work can promote selected high-value records by downloading them once, validating the declared file inventory, scanning formats, calculating archive and extracted-file hashes, generating normalized previews, and testing installation. Promotion should be demand-driven and cached. Bulk archive verification or mirroring should not be part of routine discovery.

## Direction after the first 1,000

1. Add ambientCG through its official API and broaden the texture, material, HDRI, and terrain coverage.
2. Build conservative Kenney and Quaternius pack indexers to improve game-ready 2D and low-poly coverage.
3. Import explicitly CC0 collections from Open Source 3D Assets while preserving creator-level provenance.
4. Add asset requests, popularity, and broken-link reporting so verification work follows actual use.
5. Promote popular assets to install-verified, then consider selective mirroring only when reliability or provider bandwidth warrants it.
6. Add AI-generated assets as a separate provider with model, prompt, generation date, review state, and distribution terms recorded independently from CC0 sources.
