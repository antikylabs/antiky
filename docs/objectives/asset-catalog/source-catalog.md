# Asset source catalog

Research snapshot: 2026-08-09

This is the concise operating catalog. The detailed evidence, caveats, formats, source links, and
proposed adapter behavior live in [`research/`](research/README.md). A priority is an acquisition
recommendation, not a warranty or permission to crawl.

## Current coverage and gaps

The shipped catalog contains 1,292 CC0 records: 998 Poly Haven, 212 Kenney, and 82 Quaternius.

| Kind | Current records | Assessment |
| --- | ---: | --- |
| Models | 464 | Strong realistic and low-poly baseline; needs rigs, animation, vegetation, characters, and genre variety. |
| Textures | 341 | Good Poly Haven baseline; ambientCG is the clearest expansion. |
| HDRIs | 333 | Already broad; prioritize quality and scenario gaps over raw volume. |
| Sprites | 143 | Too small; needs coherent pixel, vector, UI, VFX, tiles, and backgrounds. |
| Audio | 10 | Critical gap. Build coherent SFX/music/ambience packs before long-tail ingestion. |
| Fonts | 1 | Critical gap. Add a small verified CC0 shelf, then a separately labeled OFL lane. |

## Decision labels

- **Automate** — structured source with strong authoritative license evidence; implement a cached,
  rate-limited metadata adapter after sample review.
- **Curate** — good source without a safe bulk interface; ingest reviewed packs or items.
- **Contact first** — licensing may be sound, but automation, hotlinking, ownership, or access needs
  written clarification.
- **Quarantine** — useful specialist source requiring object-level rights or non-copyright review.
- **Discovery only** — use to find leads; never treat the provider/filter as rights evidence.
- **Separate lane** — useful permissive software/font content that must not receive a CC0 badge.

## P0: build next

| Lane | Source | Rights basis | Access | Decision and first action |
| --- | --- | --- | --- | --- |
| PBR/3D | [ambientCG](https://ambientcg.com/) | Publisher states assets and previews are CC0 | Official API; 2,877 assets observed | **Automate.** Import materials, decals, atlases, terrain, HDRIs, and selected models using metadata only. |
| 2D/game packs | [Kenney](https://kenney.nl/assets) | Publisher-wide CC0 game assets | Existing conservative indexer | **Expand.** Classify sheets, tile sizes, animations, vector/source files, UI, audio, and fonts. |
| 3D/game packs | [Quaternius](https://quaternius.com/) | Publisher FAQ states models are CC0 | Existing conservative pack indexer | **Expand.** Improve animation, rig, vegetation, character, and modular-kit metadata. |
| 2D/isometric | [Screaming Brain Studios](https://screamingbrainstudios.com/) | Publisher states every pack is CC0/public domain | Publisher, itch.io, and OGA pack pages | **Curate then index.** Pilot space, UI, isometric, texture, and animated packs; record archive format. |
| Pixel art | Ansimuz, 0x72, GrafxKid | Explicit CC0 on reviewed creator/item pages | itch.io item pages/downloads | **Curated allowlist.** Capture item evidence; never trust itch tags alone. |
| Audio | Kenney audio packs | Same publisher-wide CC0 statement | Existing Kenney adapter | **Expand immediately.** Extract coherent UI, interface, impact, casino, digital, and music packs. |
| Audio/music | Tallbeard Studios / Abstraction | Publisher/item CC0 statements | Reviewed pack pages and repositories | **Curate.** Establish a coherent music and SFX starter shelf with pack-level provenance. |
| Fonts | Kenney fonts | Same publisher-wide CC0 statement | Existing pack records | **Expand immediately.** Parse TTF/OTF families, glyph coverage, and game-use samples. |
| Fonts | OpenGameArt CC0 font seeds | Per-item CC0 only | Item pages | **Curate.** Start with a small reviewed set; retain item evidence and archive license. |
| Components | [Godot Shaders CC0 archive](https://godotshaders.com/shader-license/cc0/) | Per-post CC0 applies to code, not screenshots/media | Filtered archive and post code | **Separate component lane.** Pilot shaders with locally rendered previews. |

## P1: high-value additions after adapter review

| Lane | Source | Rights/access boundary | Decision |
| --- | --- | --- | --- |
| 3D | [Smithsonian 3D](https://3d.si.edu/) | Only Open Access-designated records are CC0; object/cultural review remains | **Quarantine then curate** distinctive artifacts, animals, fossils, and spacecraft. |
| 3D | [KayKit](https://kaylousberg.itch.io/) | Pack pages state CC0; no permission to broadly scrape itch | **Curate** polished modular environments, characters, props, and animation. |
| 3D | [Open Source 3D Assets](https://www.opensource3dassets.com/) | Registry metadata and some collections claim CC0; upstream must agree | **Pilot adapter** against reviewed collection allowlist. |
| PBR | [TextureCan](https://www.texturecan.com/) | Publisher CC0 terms; automation permission unclear | **Contact first**, then curated metadata. |
| PBR | [3DTextures.me](https://3dtextures.me/) | Publisher states textures are CC0; no public API | **Curate** high-value sets or request a feed. |
| 2D/UI | [FreeGameUI](https://freegameui.net/) | Publisher claims 2,000+ SVG/PNG assets are CC0 | **Ownership/manifest review**, then category packs. |
| 2D | [Game Assets for the People](https://gameassets.joshmoody.org/) | Publisher states all 56 cross-media packs are CC0 | **Import all useful packs** after sample/archive review. |
| 2D | OpenDuelyst | Repository-level CC0 asset corpus | **Family importer** for production-quality characters, animations, UI, cards, and VFX. |
| 2D | RavenTale CC0 platformer collection | Bounded item/pack CC0 evidence | **Curate** layered backgrounds, sprites, UI, and PSD sources. |
| 2D | Glitch public-domain art | Preserved public-domain corpus; marks and families need review | **Family importer** with logo/trademark quarantine. |
| Audio | Signature Sounds | Publisher claims CC0 catalog; sample rights consistency needs review | **Sample audit**, then coherent pack ingestion. |
| Audio | Freesound CC0 records | License is per sound; API terms and preview/download identity matter | **Item-level API pilot**, CC0 only, with creator/uploader and file evidence. |
| Fonts | Font Library CC0 filter | Filter reports a small CC0 subset; verify every family/version | **Curate ten-family seed** and archive exact font/license files. |
| Archives | Smithsonian Open Access | Item-level CC0 flag across 2D/3D/data | **Automate metadata, quarantine media** for rights/context checks. |
| Archives | Art Institute of Chicago / Cleveland Museum of Art | API fields expose public-domain/CC0-compatible object rights | **Sample adapter** for textures, reference, props, and art-derived assets. |
| Components | Godot Asset Library CC0 filter | License per entry; repositories can contain mixed files | **Metadata pilot**, pin release and audit full dependency closure. |

## P2: specialist and long-tail directions

| Lane | Sources | Direction |
| --- | --- | --- |
| Vectors | Openclipart | Curate game-oriented subsets from 180,000+ claimed public-domain vectors; reject provenance flags, marks, duplicates, and unsafe SVG. |
| Mixed game art | OpenGameArt CC0 subset | Human/item-level ingestion only. Capture all displayed licenses; do not reuse previews without proof. |
| Terrain/maps | USGS 3DEP, Natural Earth, NGA | Create a specialized geospatial/derived-assets pipeline retaining dataset, bounds, CRS, resolution, and government-rights evidence. |
| Space/science | NASA, NOAA, NPS, USDA, USGS | Curate public-domain media with agency policy, third-party credit, logo, privacy, and endorsement review. |
| Museums | Met, Getty, Rijksmuseum, Walters, Paris Musées | Object-level rights only; ingest metadata first and quarantine media until evidence and context pass. |
| Nature/data | Biodiversity Heritage Library, GBIF | Use record-level licenses and scientific provenance; avoid treating database access as media rights. |
| PBR | cgbookcase | Contact first for feed/crawl and preview policy despite creator CC0 claim. |
| PBR/3D | LazyTextures | Technically strong JSON API; verify publisher ownership, API stability, port/origin behavior, and automation terms first. |
| Audio | NOAA/NPS/NASA/Wikimedia public-domain files | Curate per item for ambience, nature, historic, space, and science gaps; metadata/source credit is mandatory even when attribution is not. |
| Audio | OpenGameArt and itch.io CC0 | Creator/item allowlists only; preview and archive license must agree. |
| Impulse responses | OpenAIR and specialist IR repositories | Separate technical-audio subtype; validate source recordings and convolution format. |
| Fonts | Google Fonts / Fontsource | **Separate open-font lane**, primarily OFL/Apache/UFL rather than CC0; preserve notices, Reserved Font Names, and source version. |

## Components and templates: separate catalog class

Code, shaders, generators, prefabs, and sample projects should share discovery UI but not the CC0
media schema. Recommended sources include Three.js, Phaser, PlayCanvas, Babylon.js, Godot demos,
gl-transitions, FastNoiseLite, WaveFunctionCollapse, raylib, Bevy, Effekseer, and libGDX.

These are mainly MIT, Apache-2.0, zlib, or copyleft—not public-domain assets. Preserve SPDX license
expressions, notices, source commit/subpath, dependencies, bundled-media scope, engine version, and
build/render results. Detailed boundaries and a 100-record pilot are in
[`research/components-shaders-templates.md`](research/components-shaders-templates.md).

## Do not bulk ingest

| Source class | Reason |
| --- | --- |
| itch.io CC0 search/filter | Discovery metadata is not authoritative per-item license evidence; publishers and downloads vary. |
| OpenGameArt provider-wide | Mixed CC0, attribution, share-alike, GPL, and OGA licenses; previews may differ from download rights. |
| Sketchfab or generic 3D marketplaces | Mixed rights, account/API/download restrictions, unclear component textures, and marks. |
| “Royalty-free” marketplaces | Royalty-free is not CC0 and commonly prohibits redistribution of source assets. |
| SVG/icon aggregators | Mixed provenance, copied marks, unclear uploader authority, and unsafe SVG content. |
| ShareTextures | Current access terms reportedly prohibit scraping/API/download embedding; keep link-only/contact-first. |
| Shadertoy/arbitrary shader galleries | Publicly visible source is not public domain; require explicit per-work license. |
| Unity/Unreal marketplace samples | Vendor and ecosystem terms are not CC0 and can restrict redistribution or cross-engine use. |
| Repackagers of Kenney/Quaternius | Duplicate provenance; retain the canonical creator record instead. |

## Approval gate

A source moves from this catalog into adapter work only when the review template in
[`research/license-verification.md`](research/license-verification.md) is complete. At minimum it
must establish publisher authority, license scope, preview rights, metadata/database terms,
automation policy, stable identity, non-copyright risk handling, evidence retention, refresh diffs,
and a takedown path.
