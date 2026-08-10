# CC0 2D sprites, tiles, UI, icons, VFX, and backgrounds

Research date: 2026-08-09

## Executive summary

The best near-term 2D expansion is a three-part portfolio:

1. **Ingest Kenney deeply** for dependable, engine-ready breadth: tiles, UI, input prompts, icons, sprites, and complete game kits.
2. **Add coherent creator collections** from Screaming Brain Studios, Ansimuz, 0x72, GrafxKid, and RavenTale. These fill stylistic gaps without turning the catalog into a pile of unrelated one-off images.
3. **Build special importers for OpenDuelyst, Glitch, and Openclipart.** These are large CC0 corpora, but they need asset-family grouping, trademark/provenance checks, format conversion, and aggressive quality controls before publication.

OpenGameArt, itch.io, SVG Repo, and similar marketplaces are **mixed-license discovery sources**, not trusted providers. A CC0 search result or page badge is evidence about one item only. Never inherit a marketplace-wide license assumption.

The catalog should prefer a smaller number of coherent, documented packs over tens of thousands of isolated icons. The goal is for an agent to find “a complete fantasy platformer set” or “matching sci-fi HUD controls,” not merely retrieve an image that matches a noun.

## Recommended priorities

| Priority | Source or direction | Why it matters | First action |
| --- | --- | --- | --- |
| P0 | Kenney 2D/UI/pixel catalog | Broad, consistent, explicit collection-wide CC0, strong metadata, pack downloads | Expand the existing Kenney importer and classify sheets, loose sprites, tile sizes, animations, and vector/source files |
| P0 | Screaming Brain Studios | Large, unusually varied 2D collection with one explicit CC0 policy | Crawl pack index; pilot space backgrounds, interfaces, tiles, and animated packs |
| P0 | Ansimuz, 0x72, GrafxKid | High-quality coherent pixel-art packs across platformer, RPG, sci-fi, characters, UI, and VFX | Curate creator allowlists, then capture license evidence per itch item and archive only the free CC0 downloads |
| P1 | OpenDuelyst | Production-quality coherent pixel characters, animations, card/UI art, and effects under repository-level CC0 | Inventory `app/resources`; group thousands of files into useful logical packs rather than cataloging every frame separately |
| P1 | FreeGameUI | More than 2,000 game-focused SVG/PNG UI elements, all claimed CC0 | Validate authorship/provenance and inspect download/index mechanics; ingest category bundles after review |
| P1 | Public Domain Game Assets | Small, clean, game-specific CC0 source with direct asset pages | Import all useful 2D packs and preserve page-level proof |
| P1 | RavenTale CC0 platformer collection | Complete non-pixel platformer art, layered backgrounds, UI/sprites, and PSD source | Import as one or several related packs; inspect embedded download host and license file |
| P1 | Glitch public-domain game art | More than 10,000 distinctive production assets and animations | Use the preserved archive, convert only open/modern formats, reconstruct families, and exclude logos/marks pending review |
| P2 | Openclipart | More than 180,000 public-domain vectors; excellent raw material for UI/icons/background props | Use only a game-oriented curated subset; reject trademarked, provenance-flagged, near-duplicate, and low-quality uploads |
| P2 | OpenGameArt CC0 subset | Deep long-tail supply of sprites, tiles, icons, VFX, and backgrounds | Treat as item-level ingestion with immutable evidence; no bulk trust of search filters |
| P2 | Summer Engine / Society of Play / FreeGameUI emerging collections | Interesting game-specific CC0 catalogs | Pilot small samples and validate provenance, stability, file access, and duplication before broad ingestion |

## Collection-wide CC0 sources

These sources publish an explicit policy that covers their asset collection, or a clearly bounded corpus with a repository/archive-level CC0 declaration. That makes them candidates for provider-level ingestion, although each downloaded pack must still preserve its own license evidence.

### Kenney

- **Scope and quality:** the strongest general-purpose source. The official catalog exposes 2D, UI, pixel, texture, audio, and 3D facets. Individual pages carry tags, category, file count, version, preview, and license. For example, [UI Pack](https://kenney.nl/assets/ui-pack) contains 430 files and is marked Creative Commons CC0. The amount-sorted index surfaces complete packs such as Roguelike/RPG, Input Prompts, 1-Bit Pack, modern-city tiles, platformer art, mobile controls, and pixel UI ([catalog](https://kenney.nl/assets?sort=amount)).
- **License proof:** Kenney's official [support page](https://kenney.nl/support) says all game assets on asset pages are public-domain licensed CC0, including commercial use, with no attribution required. It also explicitly excludes the Kenney logo; do not ingest it.
- **Formats:** commonly PNG sheets and loose PNGs, SVG/vector sources for UI/icons, tilemap metadata, fonts for some prompt/icon packs, and source/project files depending on the pack. Kenney's [tilemap guide](https://kenney.nl/knowledge-base/game-assets-2d/importing-and-using-tilemaps) documents uniform sprite sheets and `tilemap.txt` metadata.
- **Access:** crawlable official catalog and stable asset pages; downloads may be gated behind a donation interstitial. There is no documented public catalog API in the reviewed official material.
- **Ingestion:** one record per authored pack, plus a structured file manifest. Extract tile dimensions, sprite-sheet grids, animation names, vector availability, intended perspective, palette, and input platform. Generate representative montage previews rather than showing a raw sheet at thumbnail scale.
- **Caveats:** exclude logos; distinguish free asset pages from store/all-in-one products; preserve version and page URL because packs are revised.

### Screaming Brain Studios

- **Scope and quality:** dozens of cohesive packs covering space textures, interfaces, tile sets, board-game elements, game kits, animations, tools, planets, and backgrounds. The [official downloads index](https://screamingbrainstudios.com/downloads/) exposes useful category filters and pack pages.
- **License proof:** the downloads page states every asset pack is CC0/public domain and may be used commercially, modified, and redistributed without credit.
- **Formats/access:** downloadable packs are also linked through itch.io. Expect PNG sheets/tiles and project/source files depending on pack. There is no documented API; crawl the official index and resolve each pack/download deliberately.
- **Scale:** the creator reports collections exceeding 10,000 assets across more than 30 packs; treat those figures as creator claims until manifests are counted locally.
- **Ingestion:** index packs from the official page, then store a pack-level manifest and previews. Prioritize Space Backgrounds, interfaces, 2D planets, tile sets, animated flags, and full game kits.
- **Caveats:** pack quality and resolution vary; older output has a deliberately retro look. Keep support-only downloads or patron exclusives out unless their public CC0 status is independently explicit.

### Public Domain Game Assets / Game Assets for the People

- **Scope and quality:** a small game-specific catalog with sprites, models, music, and sounds; the homepage currently reports 56 assets and highlights City Sprites and Pixel Art UI ([official catalog](https://gameassets.joshmoody.org/)).
- **License proof:** the same homepage states everything on the site is CC0, usable for any purpose without attribution.
- **Access:** simple, crawlable asset pages; no API was discovered. The bounded catalog makes a periodic full crawl practical.
- **Ingestion:** import useful 2D entries as complete packs, record author/source page, and retain the site-wide declaration plus page snapshot/hash in the provenance record.
- **Caveats:** smaller supply and uneven styles; use it to fill niches, not define the catalog's visual baseline.

### FreeGameUI

- **Scope and quality:** [FreeGameUI](https://freegameui.net/) advertises more than 2,000 game UI assets across icons, buttons, panels, gauges, gradients, shapes, decorations, and noise textures. It offers SVG and PNG and includes browser editing/export tools.
- **License proof:** its official homepage says everything is CC0 1.0, usable commercially with no attribution.
- **Access:** searchable/browsable categories and direct item downloads; no documented public API was found in this review.
- **Ingestion:** first perform a provenance sample across categories, then ingest by coherent visual family/category. Retain original SVG, render normalized PNG previews, sanitize SVG, and record dimensions/view box.
- **Caveats:** this is a newer source than Kenney/OpenGameArt. Before trusting the site-wide claim, verify who created the assets, scan for copied trademark/platform glyphs, and confirm the archive/download path is stable. Avoid creating 2,000 nearly indistinguishable top-level catalog records.

### Openclipart

- **Scope and quality:** more than 180,000 vector graphics, with enormous coverage for icons, objects, decorations, silhouettes, and background elements. The official [FAQ](https://openclipart.org/share) describes the collection and its moderation flags.
- **License proof:** the FAQ says all submitted art is released into the public domain using CC0 1.0 and permits commercial use.
- **Formats/access:** SVG is primary, with rendered PNG/PDF variants. Search and asset pages are crawlable. Some upload/API-era endpoints exist, but no stable documented public search API was established; do not depend on undocumented endpoints.
- **Ingestion:** create a curated game-art subset only. Search by game concepts, cluster related works/remixes, sanitize SVG, rasterize previews, and attach upload author/date/source.
- **Caveats:** community uploads are not automatically provenance-perfect. The site uses `pd_issue` for questionable provenance and `need-review` for new contributors; reject both. Detect trademark/logo terms, famous characters, clip-art spam, near duplicates, malformed SVG, embedded raster data, scripts, external URLs, and fonts. This source needs the strictest visual and legal review of any collection-wide candidate.

### OpenDuelyst corpus

- **Scope and quality:** a complete commercial game's source and resources, including polished animated pixel units, effects, UI, card art, maps, and other coherent production assets. Resources live in [`app/resources`](https://github.com/open-duelyst/duelyst/tree/main/app/resources).
- **License proof:** the official repository has a root [CC0 1.0 license](https://github.com/open-duelyst/duelyst/blob/main/LICENSE) covering the released project.
- **Formats/access:** a Git repository is ideal for reproducible ingestion, immutable commit IDs, file manifests, and incremental updates. Expect PNG sprites/atlases, JSON metadata, audio, fonts, and application-specific organization.
- **Ingestion:** pin a reviewed commit. Build logical records for factions, units, spell effects, tiles, card frames, or UI families; do not emit one catalog asset per animation frame. Parse atlas/animation metadata where available and render motion/contact sheets.
- **Caveats:** CC0 does not erase trademark concerns or guarantee every third-party dependency was authored by the licensor. Exclude the Duelyst name/logo and audit bundled fonts, SDK art, publisher/platform marks, and dependency directories. Preserve original paths so suspicious files can be traced.

### Glitch public-domain game art

- **Scope and quality:** a rare, very large body of distinctive production game art. The preserved corpus is described as images and animations in PNG, SWF, and FLA archives. A Wikimedia batch-upload investigation records thousands of PNGs in one archive and points to the surviving [Internet Archive copy](https://archive.org/details/glitch-public-domain-game-art) ([research record](https://commons.wikimedia.org/wiki/Commons:Batch_uploading/Glitch_Artwork)).
- **License proof:** the original game's art/code release was under CC0; the archival record applies CC0 to the released artwork. Because the original domain is no longer authoritative, retain the archive item metadata and contemporaneous release evidence with the import.
- **Formats/access:** bulk archives rather than a clean catalog API. PNG is immediately usable; FLA/SWF requires conversion tooling and a security review.
- **Ingestion:** start with the PNG archive, reconstruct families from filenames/directories, identify animation sequences, generate sprite sheets/montages, and catalog coherent groups. Treat FLA/SWF conversion as a later offline pipeline; never serve or execute legacy Flash.
- **Caveats:** exclude game name/logos and any third-party marks; verify archive integrity; some tiny production pieces are meaningless alone. This is a curation and reconstruction project, not a URL harvester.

## Bounded creator collections and packs

The following authors have strong CC0 work, but their storefront/profile must not automatically be treated as collection-wide CC0. Verify every item and every included file.

### Ansimuz

- **What is available:** polished, coherent 16-bit/pixel packs with platformer and top-down characters, animated enemies, items, props, tiles, parallax backgrounds, VFX, and sometimes audio or engine projects.
- **Evidence/examples:** [SunnyLand](https://ansimuz.itch.io/sunny-land-pixel-game-art) is marked CC0 and includes animated characters/enemies, items, props, VFX, music, raw files, and Godot/Phaser projects. [Warped: Super Grotto Escape](https://ansimuz.itch.io/super-grotto-escape-pack), [Grotto Escape](https://ansimuz.itch.io/grotto-escape-game-art-pack), and [Synth Cities](https://ansimuz.itch.io/cyberpunk-street-environment) are also item-level CC0 examples.
- **Ingestion:** creator allowlist plus per-item verification. Separate free base files from paid expansions/coupon material even when one product page mentions both. Prefer the raw-art ZIP over engine project duplicates; preserve animation frame dimensions and parallax layer order.
- **Caveat:** some descriptions add requests or restrictions inconsistent with pure CC0 wording. Escalate any item whose prose says “do not redistribute/sell individually” even if its badge says CC0; do not silently reinterpret conflicting terms.

### 0x72

- **What is available:** exceptionally useful small pixel packs for dungeon, industrial, fantasy, UI, top-down, isometric, and platformer games.
- **Evidence/examples:** [16x16 DungeonTileset II](https://0x72.itch.io/dungeontileset-ii) is explicitly CC0 and includes a versioned ZIP; [16x16 Industrial](https://0x72.itch.io/16x16-industrial-tileset), [µFantasy](https://0x72.itch.io/microfantasy), and [DungeonUI](https://0x72.itch.io/dungeonui) also state CC0.
- **Formats/access:** mostly compact PNG sheets and ZIPs, sometimes JSON frame timing or demo code. itch pages expose file names/sizes but downloads can require an interactive itch flow; no general asset API should be assumed.
- **Ingestion:** group original authored packs, extract sheet geometry and animation timing, and link extensions/remixes as separate works only after separately verifying their creators and licenses.
- **Caveat:** an original pack's CC0 does not prove that community extensions linked from its description are CC0.

### GrafxKid

- **What is available:** highly rated, cohesive pixel tiles and sprites. [Cave Tileset](https://grafxkid.itch.io/cave-tileset) provides 16×16 tiles, two color styles, detail variants, background elements, and a looping background; itch marks it CC0.
- **Ingestion:** crawl the creator profile for candidates but admit only pages with explicit CC0 proof. Record tile dimensions, palette/style variants, animation coverage, and ratings as discovery signals—not as license evidence.
- **Caveat:** do not infer that all GrafxKid products share this license.

### RavenTale Studio

- **What is available:** a coherent [CC0 platformer collection](https://www.raventalestudio.com/free_tileset) with more than 120 2D elements: terrain, water/lava, hollow tiles, platformer sprites, UI-adjacent elements, and a 22-layer 2048×1546 parallax background with PSD source.
- **License proof:** the official collection page calls the files public domain and permits personal/commercial use without required credit.
- **Ingestion:** preserve transparent PNGs and PSD source, record 128×128 tile geometry and parallax layer order, and publish a montage showing actual tiles/background depth.
- **Caveats:** inspect the third-party embedded download target and included license before mirroring. Attribute optional courtesy credit without presenting it as a legal obligation.

### Summer Engine, Society of Play, and other emerging collections

- [Summer Engine's UI Pack](https://www.summerengine.com/asset-store/pack/ui-pack) claims 100 CC0 2D game assets; its [Scribble Platformer](https://www.summerengine.com/asset-store/pack/scribble-platformer) similarly states every file is CC0.
- [Society of Play's Public Library](https://societyofplay.itch.io/society-of-plays-public-library) states its bounded library is CC0.
- These are promising pilots, especially for complete kits and UI, but receive **P2** status until authorship, included-file scope, stable downloads, duplication, and catalog longevity are sampled. Record them as sources; do not bulk trust neighboring store products.

## Mixed-license discovery sources

### OpenGameArt

- **Value:** the deepest long-tail source for sprites, tiles, UI, icons, VFX, backgrounds, and remixes. Its moderation process attempts to verify public-domain uploads.
- **License reality:** OpenGameArt accepts CC0 alongside CC BY, CC BY-SA, OGA-BY, GPL, and other licenses. Its official [FAQ](https://opengameart.org/content/faq) explains that terms are item-specific and that CC0 needs no credit. Therefore the provider is mixed-license even when a search is filtered.
- **Access:** searchable HTML pages and direct attachment URLs. An official forum thread asking for a search/download API does not establish a supported API ([API discussion](https://opengameart.org/forumtopic/api)); design a respectful crawler with cache, backoff, and change detection.
- **Safe ingestion:** require page-level CC0 to be present as the sole accepted asset license; capture title, author, canonical URL, attribution/provenance notice, attachment URLs, preview, and evidence timestamp. Reject ambiguous multi-license displays until the parser understands whether the user may elect CC0. Preserve revisions/remix lineage.
- **Quality:** use ratings/downloads/collections for discovery only. Human or model-assisted visual review must check sheet completeness, consistent palette, transparency, animation, and thumbnail legibility.

### itch.io

- **Value:** excellent creator storefronts and explicit per-item “Asset license: Creative Commons Zero” fields; item pages often expose format, size, tags, ratings, screenshots, and download filenames.
- **License reality:** itch is radically mixed-license. Free, name-your-own-price, and “royalty free” do not mean CC0. Product descriptions can conflict with the license field, mix free and paid files, or restrict redistribution.
- **Access:** browse/search pages and individual listings; downloads may require forms, cookies, or creator-controlled external links. Do not scrape private/purchase URLs or assume a public catalog API.
- **Safe ingestion:** use creator allowlists for discovery, but validate every listing's license badge and prose. Archive evidence before following the download, identify exactly which downloadable files are free/CC0, and reject contradictory restrictions. Ansimuz, 0x72, GrafxKid, RavenTale-linked packs, Yoo Game Art, gurigraphics, and Jamie Cross are candidate queues—not provider-wide approvals.

### SVG Repo and general vector sites

- **Value:** very large icon supply, editable SVG, PNG renditions, and per-item/license collection labels; individual pages can explicitly state CC0, as this [CC0 clipboard entry](https://www.svgrepo.com/svg/311929/clipboard) demonstrates.
- **License reality:** licenses vary by collection/item. “Free SVG” is not enough. Brand icons are especially risky even where copyright permission is broad.
- **Ingestion:** admit only items with explicit CC0 evidence and a clean provenance trail, preferably by curated collection. Sanitize SVG and exclude brand/logo/trademark/personality content. Do not bulk import search results.
- **PublicDomainVectors and similar directories:** keep as research leads until an official, current license statement and stable access path are captured. Search snippets and third-party descriptions are insufficient evidence for automated ingestion.

## Quality and license verification contract

Every imported pack should carry evidence sufficient to answer “why did Antiky believe this exact file was safe?” without revisiting a mutable webpage.

### Required provenance fields

- Canonical source page and creator/publisher.
- Exact license identifier (`CC0-1.0`), official license URL, and scope (`site`, `collection`, `pack`, or `file`).
- Verbatim license evidence excerpt kept internally, evidence URL, retrieval time, and snapshot/content hash. The public catalog can paraphrase it.
- Download URL, source filename, byte size, cryptographic hash, and upstream version/date or Git commit.
- Whether the download contained its own license file and whether that file agrees with the page.
- Declared author versus uploader; original/remix relationship; any external source cited by the uploader.
- Review status for trademark, identifiable character/person, third-party font, embedded code, or conflicting terms.

### Admission rules

1. **Require affirmative CC0 evidence.** “Free,” “royalty free,” “publicly downloadable,” permissive custom licenses, and missing license fields fail closed.
2. **Resolve scope.** A creator profile, search filter, collection title, or parent work does not license unrelated items, remixes, extensions, paid expansions, or bundled dependencies.
3. **Treat conflicts as rejection.** If a page says CC0 but also prohibits redistribution, commercial use, modification, or resale, quarantine it for human review. Do not attempt to decide which term wins in the crawler.
4. **Check the archive.** Compare the page declaration with included `LICENSE`, `COPYING`, readme, metadata, and per-folder notices. A non-CC0 embedded font or sample invalidates only the affected component if it can be cleanly separated; otherwise reject the pack.
5. **Review provenance and marks.** CC0 from an uploader cannot cure copied Nintendo art, a sports logo, a platform glyph, or a celebrity likeness. Reject obvious third-party IP and preserve a report path.
6. **Pin immutable content.** Hash files and retain the evidence record at ingestion. A hash is not license proof; it binds the reviewed proof to the exact bytes.
7. **Revalidate mutable sources.** Periodically detect deleted pages, changed license text, changed archives, or moderation flags. Do not silently replace reviewed bytes when an upstream ZIP changes.

### 2D technical validation

- Decode every raster; reject corrupt images, implausible dimensions, thumbnails accidentally included as source, and unexpected color profiles.
- Detect alpha/transparency, padding, black bars, duplicate/near-duplicate frames, and sprites touching unintended sheet boundaries.
- For sheets, infer and verify cell dimensions, margins, spacing, animation row/frame counts, and pivot/baseline consistency. Store explicit uncertainty rather than inventing animation semantics.
- Sanitize SVG: remove scripts, event handlers, external URLs, foreign objects, embedded fonts, and unnecessary metadata; render in an isolated pipeline and visually compare the sanitized result.
- Extract PSD/ASE/ASEPRITE/source files only in an offline sandbox. Serve safe originals as downloads but generate web previews from normalized PNG/WebP.
- Evaluate usefulness at pack level: coherent style, complete movement/action states, seamless tiles, repeatable backgrounds, readable UI at target resolution, palette consistency, and clear engine-ready organization.
- Generate contact sheets or animated previews so a user can evaluate a pack without downloading it. A single arbitrary frame is poor catalog UX.

## Suggested ingestion sequence

### Phase 1: dependable breadth

1. Inventory all Kenney 2D, UI, pixel, input, icon, platformer, RPG, shooter, puzzle, board/card, and isometric packs.
2. Import Screaming Brain Studios' pack index and the useful 2D portion of Public Domain Game Assets.
3. Add a per-item itch pipeline and curate Ansimuz, 0x72, GrafxKid, and RavenTale.
4. Establish mandatory evidence, archive inspection, SVG sanitization, and sprite-sheet validation before increasing volume.

### Phase 2: distinctive depth

1. Pilot FreeGameUI with 50–100 representative items across categories and review provenance/duplicates.
2. Build the OpenDuelyst resource grouper and publish a small reviewed set of character families, UI families, and effects.
3. Extract the Glitch PNG archive and reconstruct a few complete animation/object families.
4. Add tightly curated CC0 OpenGameArt items where they fill catalog gaps: VFX, animated creatures, top-down interiors, and genre-specific UI.

### Phase 3: large searchable vectors

1. Build a game-oriented Openclipart candidate index without publishing everything.
2. Apply provenance/moderation, trademark, NSFW, duplicate, SVG safety, and visual-quality gates.
3. Publish coherent icon/decorative families rather than isolated results.
4. Reassess SVG Repo/PublicDomainVectors only after their per-item license and acquisition contracts are automated and testable.

## Coverage targets

The first useful 2D release should optimize for playable prototypes rather than raw count:

- 20–30 complete environment/tileset packs across platformer, top-down, isometric, dungeon, modern, nature, sci-fi, and space.
- 15–25 character/enemy families with clearly mapped animations.
- 10–15 coherent UI themes plus broad input prompts and common HUD symbols.
- 10–20 VFX families: impact, projectile, smoke, fire, magic, weather, pickups, and transitions.
- 10–15 parallax/background families.
- 5–10 card/board/game-kit families.
- SVG icon families useful for inventory, controls, status, map, crafting, and dialogue.

A pack counts only when its license evidence, archive manifest, tags, preview, technical metadata, and source link pass validation. Thousands of raw frames from OpenDuelyst or Glitch should not inflate the public “asset pack” count.

## Sources intentionally excluded from automatic CC0 ingestion

- **Game-icons.net:** valuable and game-focused, but primarily attribution-licensed rather than CC0; it belongs in a future attribution-aware track.
- **CraftPix, Unity Asset Store, Unreal Marketplace, GameDev Market, Pixabay, Pexels, Unsplash, and generic “royalty-free” sites:** custom terms and redistribution restrictions do not satisfy a CC0-only catalog.
- **Liberated Pixel Cup:** coherent and useful, but its assets commonly use attribution/share-alike licenses.
- **Wikimedia Commons and museum open-access collections:** excellent future source material, but item rights, public-domain marks, jurisdiction, subjects, and game-readiness require a separate cultural-heritage pipeline.
- **AI-generated itch packs with only seller-asserted CC0:** quarantine until the catalog adopts a provenance policy for training/source claims and reviews potential imitation or third-party IP.

## Open questions

- Should the public catalog expose only pack records, or also a searchable secondary file/sprite index? The recommended answer is pack-first UI with file-level search behind it.
- Will Antiky mirror original archives or only metadata and source links? Mirroring CC0 assets improves reliability but raises bandwidth, abuse scanning, takedown, and revalidation responsibilities.
- How should conflicting “CC0 plus restrictions” pages be represented? Recommended: rejected/quarantined, with a machine-readable reason.
- Are trademark-cleared input glyphs a distinct policy category? Kenney notes that protected platform symbols may require special construction; generic versus platform-branded prompts should be explicitly tagged.
- What minimum animation schema should cataloged sprite sheets expose: named clips, frame rectangles, timing, pivot, direction, loop mode, and event markers?
