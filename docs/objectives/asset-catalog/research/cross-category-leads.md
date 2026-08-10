# Cross-category CC0 leads

Research date: 2026-08-09

This pass looked specifically for smaller or newer sources that broad “free game asset” lists tend
to hide. These are leads for ingestion, not automatic approval. Counts and license claims must be
captured again when an adapter is implemented.

## Strong candidates

### Game Assets for the People

- Source: [gameassets.joshmoody.org](https://gameassets.joshmoody.org/)
- Published scope: 56 packs spanning sprites, models, music, and sounds.
- License evidence: the publisher states on the catalog home page that everything on the site is
  released under CC0 and can be used without attribution.
- Catalog value: unusually useful cross-category, game-specific packs including low-poly scenes,
  pixel UI, city sprites, weapons, and sound effects.
- Integration direction: crawl the four category indexes and asset detail pages into pack-level
  records. Preserve creator, original detail URL, download URL, preview URL, formats, and the
  catalog-wide license statement. Begin source-metadata-verified; do not mirror archives.
- Priority: **high, small hand-reviewable source**.

### Free Game UI

- Source: [freegameui.net](https://freegameui.net/)
- Published scope: more than 2,000 SVG/PNG icons, buttons, panels, gauges, gradients, shapes,
  decorations, and noise textures across eight categories.
- License evidence: the [catalog](https://freegameui.net/) identifies all assets as CC0 1.0 with no
  attribution requirement and links dedicated license/about/FAQ pages.
- Catalog value: fills a major weakness in the current model-heavy catalog with engine-neutral
  vector interface primitives.
- Integration direction: determine whether the site exposes a manifest or stable category index;
  prefer individual records when titles and tags are meaningful, otherwise publish category packs.
  Verify that generated/edited downloads inherit the same CC0 declaration before indexing them.
- Priority: **high, pending publisher and manifest review**.

### Screaming Brain Studios

- Source: [screamingbrainstudios.com](https://screamingbrainstudios.com/)
- Published scope: a large collection of old-school 2D, isometric, procedural, texture, space, and
  animated asset packs, distributed through the publisher site, itch.io, and OpenGameArt.
- License evidence: the publisher states that every asset pack is CC0/public domain, permits
  commercial use, modification, and redistribution, and does not require credit.
- Catalog value: distinctive art directions and thousands of assets rather than more realistic PBR
  material variants.
- Integration direction: treat the publisher site as license authority and the official download
  pages as item authority. Prefer pack records. Record archive format because older releases may use
  RAR or other less convenient packaging. Avoid deriving rights from itch.io tags alone.
- Priority: **high for curated pack ingestion**.

### LazyTextures

- Source: [public API documentation](https://www.lazytextures.com/PublicAPI)
- Published scope at research time: the documented statistics example reports 214 assets across
  models, materials, HDRIs, textures, and miscellaneous resources.
- License evidence: the API documentation and FAQ state that all assets are CC0 1.0 and may be used
  commercially without attribution.
- Catalog value: machine-readable metadata, previews, categories, tags, dates, popularity, archive
  sizes, resolutions, and direct files make this a technically attractive adapter.
- Integration direction: use paginated endpoints, cache responses, and initially ingest metadata
  only. The documented API origin uses a nonstandard `:3000` port, so confirm production stability,
  HTTPS behavior, publisher identity, terms, and rate expectations before promotion. Store the API
  license page and each returned record as evidence.
- Priority: **medium-high after an ownership and uptime review**.

## Discovery-only or duplicate leads

- The [itch.io CC0 filter](https://itch.io/game-assets/assets-cc0) is valuable for discovery, but
  every item remains an independent publisher record. Tags and search filters are not sufficient
  license evidence. Create an allowlist of reviewed creators rather than crawling the full result.
- [OpenGameArt](https://opengameart.org/content/faq) is a mixed-license repository. Import only
  records whose detail page explicitly declares CC0, capture every offered license, and never reuse a
  preview until its rights relationship to the downloadable work is established.
- Sites repackaging Kenney or Quaternius content can improve engine-specific discovery but should
  not become a second provenance authority. Link the canonical creator record and avoid duplicate
  catalog entries.
- Community “ultimate free asset” lists and GitHub awesome lists are lead generators only. “Free,”
  “royalty-free,” and “open source” do not establish CC0 or public-domain status.

## Validation questions before adapter work

1. Is the person making the CC0 declaration demonstrably the creator or authorized publisher?
2. Is the declaration collection-wide, item-specific, or merely a search tag?
3. Are thumbnails, generated variants, and archives covered by the same declaration?
4. Can metadata and previews be fetched conservatively through an API, manifest, or stable index?
5. Does the source prohibit automated access, hotlinking, redistribution, or high-volume downloads?
6. Does each item have a stable identity and canonical URL that survives catalog refreshes?
7. Can Antiky represent the asset honestly without downloading or inspecting the archive?
