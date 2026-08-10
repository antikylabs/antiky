# CC0 3D, materials, HDRI, terrain, vegetation, and animation research

Research checked against live first-party pages on 2026-08-09. “CC0” below means the source explicitly applies the Creative Commons Zero public-domain dedication to the asset. “Public domain” means a government or institutional source makes an equivalent claim but does not necessarily use CC0. “Open/mixed” is not treated as CC0.

## Executive recommendation

The first ingestion wave should be:

1. **Poly Haven** for exceptionally clean HDRIs, PBR materials, and realistic models. Its public API supplies metadata, files, dependencies, sizes, and hashes. It is the best compliance and automation fit.
2. **ambientCG** for breadth in PBR materials, decals, HDRIs, and some models. Its official API is machine-readable and the entire asset library is CC0.
3. **Kenney, Quaternius, and KayKit** for game-ready low-poly models, vegetation, modular environments, characters, and animation. These require pack-level adapters or creator cooperation but have unusually simple licensing.
4. **Smithsonian 3D Open Access** for scanned natural-history, cultural, scientific, and space objects. Its 3D API provides downloadable GLB/glTF/OBJ derivatives and CC0 records.
5. **Open Source 3D Assets (OS3A)** as an experimental GLB source. It is nearly turnkey JSON, but every upstream collection needs an independent provenance check before publication.
6. **TextureCan, 3DTextures.me, and cgbookcase** as manually curated/link-only candidates until their owners approve systematic ingestion or expose a supported feed.

Do not automate ShareTextures, scrape OpenGameArt broadly, or import “free” assets from Sketchfab, BlenderKit, Mixamo, Fab/Megascans, Objaverse, or marketplace aggregators without record-level license gates. “Free download,” “royalty free,” “open source,” and even a site-wide CC filter are not proof that an individual asset is CC0.

## Priority matrix

| Priority | Source | Useful content | License confidence | Current scale / quality signal | Best integration |
| --- | --- | --- | --- | --- | --- |
| P0 | [Poly Haven](https://polyhaven.com/) | HDRIs, PBR materials, realistic models, some vegetation | True CC0; first-party creation/donation statement | Live API returned 984 HDRIs, 790 textures, and 521 models | Official API; cache metadata, never mirror by default |
| P0 | [ambientCG](https://ambientcg.com/) | PBR materials, decals, HDRIs, atlases, some models | True CC0, site-wide | Live API reported 2,877 assets; high-resolution maps and rich metadata | Official v2 API and per-asset ZIP metadata |
| P0 | [Kenney](https://kenney.nl/assets) | Low-poly models, modular kits, vehicles, nature, UI-adjacent 3D | True CC0, site-wide game assets | Hundreds of cohesive packs; engine-ready and lightweight | Pack manifest/manual feed; link to official pack downloads |
| P0 | [Quaternius](https://quaternius.com/) | Low-poly props, worlds, characters, creatures, vegetation, animation | True CC0, site-wide models | Large cohesive “Ultimate” packs; FBX/OBJ/Blend/glTF varies by pack | Pack adapter; request a first-party index/feed |
| P0 | [Smithsonian 3D](https://3d.si.edu/) | Scans of artifacts, animals, fossils, spacecraft, scientific objects | CC0 only when Open Access-designated | Smaller than its 5.1M-item total OA corpus, but highly distinctive scans | Official 3D API; require CC0 designation and rights review |
| P1 | [KayKit](https://kaylousberg.itch.io/) | Stylized modular environments, characters, props, animation | True CC0 on each pack page | Dozens of polished packs; multiple engine formats | Curated itch pack records; no scraping without permission |
| P1 | [OS3A](https://www.opensource3dassets.com/) | Themed GLB environments, props, creatures | Registry and claimed Polygonal Mind sets are CC0; verify upstream | Registry describes 991+ GLBs with JSON and permanent URLs | Consume GitHub JSON after collection-level provenance audit |
| P1 | [TextureCan](https://www.texturecan.com/) | PBR materials and a small set of textured models | True CC0 site terms, subject to marks in images | At least 4K materials; models include GLTF/FBX/Blend and sometimes LODs | Curate/link first; ask for bulk/feed permission |
| P1 | [3DTextures.me](https://3dtextures.me/) | Seamless PBR materials | True CC0 site-wide | Many production-ready sets; free tier commonly 1K, premium 4K/source | Manual discovery or owner-approved feed |
| P2 | [cgbookcase](https://www.cgbookcase.com/) | High-quality seamless PBR materials | Creator states CC0 | Hundreds of multi-map materials | Contact first; respect content signals and avoid crawling |
| P2 | [USGS 3DEP](https://www.usgs.gov/3d-elevation-program) | US terrain DEMs and lidar | US public domain, not CC0-labeled | Nationwide 10m coverage plus regional 1m DEM/lidar | Generate derived terrain tiles; retain geographic metadata |
| P2 | [OpenGameArt](https://opengameart.org/) | Long tail of 3D, vegetation, rigs, animation | Mixed; record-level CC0 only | A community CC0 3D collection lists hundreds, quality varies sharply | Human curation and per-record evidence; do not assume collection purity |
| P3 | [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) | Runtime test models and a few showcase objects | Mixed per asset/component | Excellent format-validation corpus, poor general game-library fit | Only ingest models whose complete component license is CC0 |
| P3 | [NASA 3D Resources](https://science.nasa.gov/3d-resources/) | Spacecraft, planets, terrain, scientific visualization | Generally US copyright-free, but usage/brand/third-party caveats | Unique subject matter; source formats and quality vary | Manual legal review and transform to game-ready GLB |

## Source profiles

### Poly Haven — P0

- **Why it matters:** a rare combination of photoreal quality, simple licensing, strong provenance, and a supported machine interface. Assets include unclipped HDRIs, tileable PBR textures, photogrammetry and authored models, LODs, dimensions, polycounts, and multiple resolutions.
- **License evidence:** Poly Haven’s [asset license](https://polyhaven.com/license) says every HDRI, texture, and 3D model is CC0 and describes the work as made by staff or directly donated/sold by artists. Attribution is not required and redistribution is allowed.
- **Scale:** a live `GET https://api.polyhaven.com/assets` check returned **2,295 assets**: 984 HDRIs (`type: 0`), 790 textures (`type: 1`), and 521 models (`type: 2`). Treat this as a dated snapshot, not a permanent count.
- **Formats:** the [API](https://polyhaven.com/our-api) exposes actual variants. HDRIs commonly include HDR and EXR through resolutions up to 24K; textures expose PBR maps and resolution choices; models can include Blend, FBX, glTF, USD, textures, and dependencies. Exact formats are record-specific.
- **Integration:** use `GET /assets` for metadata and `GET /files/{id}` for URLs, byte sizes, MD5 values, and dependency graphs. Send a unique Antiky user agent and visibly identify Poly Haven as the source; both are live-API conditions. Cache a normalized metadata snapshot and fetch asset files only when a user requests them.
- **Platform caveat:** the assets are CC0, but site thumbnails, text, and metadata are not automatically CC0. The license page’s site terms prohibit unsanctioned web scraping. Use the public API, not HTML extraction. API conditions can change, so snapshot their terms with every crawl.
- **Verification opportunity:** Poly Haven offers optional signed provenance attestations and bulk snapshots for organizations that need chain-of-custody assurances; the [corporate page](https://polyhaven.com/corporate) describes asset/version manifests and hashes.

### ambientCG — P0

- **Why it matters:** probably the fastest route to broad material coverage: ground, rock, brick, concrete, wood, metal, fabric, roofing, decals, cutouts, atlases, HDRIs, and a growing model subset. The API metadata includes creation method, physical dimensions, maps, tags, preview sizes, downloads, and release dates.
- **License evidence:** the official [license page](https://ambientcg.com/index.php?cpage=license) applies CC0 1.0 Universal to all ambientCG assets. This should be captured per crawl along with a CC0 legal-code reference.
- **Scale:** a live query to the official [`full_json` API](https://ambientcg.com/api/v2/full_json?include=basicData&limit=1) reported **2,877 assets**. The total mixes asset types; do not label every record a “material.”
- **Formats/quality:** materials commonly supply JPG/PNG PBR map sets at several resolutions, often up to 8K; some records expose Substance/SBSAR, USD, engine presets, physical size, DirectX and OpenGL normal variants. HDRIs and models have different bundles. Read each asset’s download-folder metadata rather than inventing a universal format list.
- **Integration:** use the official [API v2 documentation](https://docs.ambientcg.com/api/v2/) and `full_json` endpoint for incremental metadata. Store stable `assetId`, source page, preview, type, creation method, maps, dimensions, release date, and selected downloadable variants. Prefer the smallest useful game resolution in the catalog UI.
- **Robots/operations:** `robots.txt` currently allows `/` except `/hx/`. Even so, use the API, rate-limit, identify the client, and do not bulk mirror binaries merely because the asset license allows it.

### Kenney — P0

- **Why it matters:** highly coherent, lightweight packs designed for games rather than rendering demos. Strong categories include nature, roads, castles, cities, racing, survival, furniture, space, vehicles, characters, and modular construction.
- **License evidence:** Kenney’s [support page](https://kenney.nl/support) says all game assets on asset pages are public-domain CC0, including commercial projects. Every ingested pack should still preserve its own license file and asset-page claim; logos are excluded.
- **Quality/formats:** asset pages expose category, tags, file count, features such as variations or animations, release history, and license. For example, [Castle Kit](https://kenney.nl/assets/castle-kit) has 75 files and [Survival Kit](https://kenney.nl/assets/survival-kit) has 80 models plus animation. Packages usually include engine-neutral formats, but verify the ZIP manifest rather than assuming identical contents.
- **Integration:** build a pack-level manifest from official pages and ZIP license files. Catalog the pack before exploding it into objects; one pack page is the clean provenance unit. Ask Kenney for a structured feed or permission before systematic crawling because no supported public API or useful robots policy was found.
- **Caveat:** some Kenney products/tools are not the same as the free game-asset pages. Never infer CC0 from the creator name alone.

### Quaternius — P0

- **Why it matters:** broad stylized low-poly worlds and “Ultimate” kits, often with optimized atlas textures. Particularly useful for nature, farming, fantasy, medieval, city, vehicles, animals, monsters, characters, and animation.
- **License evidence:** the official [FAQ](https://quaternius.com/faq.html) says all models are CC0, usable commercially, modifiable, and attribution-free.
- **Formats:** the FAQ confirms Blend and FBX; many current pack pages also offer OBJ and glTF. Atlas-textured packs are efficient in games. Record exact pack contents and animation clips from the archive.
- **Integration:** discover packs through the official site, preserve pack/version/license evidence, and link to the creator’s download flow. There is no documented public API and `/robots.txt` currently returns the website rather than a policy file, so request permission before automating the catalog.
- **Caveat:** validate scale, origins, material assignment, animation naming, and glTF conformance. Older packs can differ materially from newer Ultimate packs.

### KayKit / Kay Lousberg — P1

- **Why it matters:** cohesive low-poly kits that complement Kenney and Quaternius, including dungeon, medieval, city, restaurant, prototype, character, skeleton, and animation content.
- **License/formats evidence:** the official [Character Animations page](https://kaylousberg.itch.io/kaykit-animations) explicitly states CC0, commercial use, no attribution, and supplies FBX/glTF animations plus FBX/OBJ/DAE/glTF character files. It lists more than 25 gameplay clips including locomotion, combat, shooting, climbing, interaction, and dodges.
- **Integration:** create one record per itch pack and child records per coherent object/character only after inspecting its ZIP. Retain page URL, page-captured license text, included license file, release/version, formats, and “legacy/current” status.
- **Caveat:** itch.io is the storefront, not a blanket license authority. Verify every KayKit page; do not assume patron-only extras or unrelated creator uploads inherit CC0. Downloads may require a browser interaction, so request a creator feed rather than automate checkout.

### Smithsonian 3D Open Access — P0/P1

- **Why it matters:** distinctive, authoritative scans that stylized game libraries do not cover—animals, fossils, anatomy, artifacts, sculptures, vehicles, spacecraft, and scientific instruments.
- **License evidence:** the Smithsonian [Open Access FAQ](https://www.si.edu/openaccess/faq) says Open Access-designated digital assets are CC0 and includes 3D media. It also warns that CC0 only addresses copyright; trademarks, privacy/publicity, cultural sensitivity, and other third-party rights may remain.
- **Formats:** Open Access 3D derivatives may include glTF, GLB, OBJ at 150K and full resolution, Voyager scenes, and JSON metadata.
- **Integration:** use the official [Smithsonian 3D API](https://3d-api.si.edu/api-docs/), especially `/api/v1.0/content/file/search`, which can filter by model type, file type, and quality and returns direct files. Require an explicit Open Access/CC0 signal, source object identifier, institution, title, credit line, source page, and derivative quality.
- **Game-readiness caveat:** scans can be huge, contain holes or scan artifacts, use inconvenient pivots/scales, or portray culturally sensitive and trademarked subjects. Publish a curated, optimized derivative only after topology, UV, material, and rights review; otherwise link to the original.

### Open Source 3D Assets (OS3A) — P1 experimental

- **Why it matters:** the [GitHub registry](https://github.com/toxsam/open-source-3D-assets) advertises 991+ GLB models and provides `projects.json` plus per-collection JSON with previews and permanent model URLs. The themes range from medieval and Egyptian environments to vaporwave spaces and rigged creatures.
- **License evidence:** the registry metadata itself is CC0, and it states its Polygonal Mind collections are CC0. It also allows future CC-BY collections, so CC0 must remain a record/collection filter rather than a source-wide assumption.
- **Integration:** consume the raw GitHub JSON at a pinned commit. Independently locate the originating creator/repository/license statement for each collection, then store both provenance URLs. Run GLB validation and preview generation locally; never treat the aggregator’s label as sufficient evidence by itself.
- **Caveat:** this is a young registry with few commits. Permanent-storage URLs reduce link rot but do not prove rights ownership. Start with a small manually audited collection before scaling.

### TextureCan — P1

- **Why it matters:** 4K-oriented PBR materials plus a smaller catalog of practical game objects. The [models page](https://www.texturecan.com/models/) documents GLTF, FBX, Blend, 4K texture maps, triangle counts, and sometimes several LODs.
- **License evidence:** the official [terms](https://www.texturecan.com/terms/) apply CC0 1.0 Universal to PBR textures, graphics, and photos and allow commercial use and redistribution with projects. The terms warn that logos, brands, and other protected graphics embedded in assets remain the user’s responsibility.
- **Integration:** link-only/manual curation first. Ask for a JSON feed and permission to ingest metadata/previews. If granted, preserve material maps, physical scale, resolution, model triangle/LOD counts, and mark-bearing review.
- **Caveat:** no supported API or usable `robots.txt` was found. A CC0 asset license is not permission to stress or scrape the site infrastructure.

### 3DTextures.me — P1/P2

- **Why it matters:** straightforward seamless materials with color, normal, displacement, roughness, AO, metallic, and occasional opacity maps. The official [license page](https://3dtextures.me/about/) says every texture is CC0 and redistribution is permitted.
- **Quality/scale:** free downloads are commonly 1K; current asset pages state that 4K uncompressed maps and SBS/SBSAR sources are supporter benefits. It is useful for game-ready resolution, less useful as a free high-resolution mirror.
- **Integration:** catalog source pages and point users to the original download. Seek an owner-approved feed for systematic metadata. Record which maps and resolutions are genuinely free for each item.
- **Caveat:** downloads are page-oriented and bulk access is a paid supporter benefit. Do not build an automated downloader that bypasses that model.

### cgbookcase — P2/contact first

- **Why it matters:** hundreds of well-presented seamless PBR materials with metalness/roughness and channel-packed workflows. Individual pages list AO, base color, height, normals, roughness, masks, and tiling previews.
- **License evidence:** the creator’s [project description](https://www.dorianzgraggen.com/projects/cgbookcase/) says the textures are CC0 and may be used commercially.
- **Integration:** contact the creator for a feed or permission. Current `robots.txt` publishes machine-readable content-use signals and expressly reserves some automated-content rights under EU law; the absence of a conventional allow rule should not be treated as consent. Until clarified, use hand-curated source links and no mirrored previews or metadata.

### USGS 3DEP terrain — P2 derived-assets track

- **Why it matters:** real-world terrain can seed heightfields, collision meshes, open-world prototypes, and realistic map regions. The [3DEP overview](https://www.usgs.gov/3d-elevation-program) says all products are free and without use restrictions.
- **License/scale:** 3DEP products are US public domain. The [1/3 arc-second collection](https://data.usgs.gov/datacatalog/data/USGS%3A3a81321b-c153-416f-98b7-cc8e5f0e17c3) provides continually updated, roughly 10-meter GeoTIFF DEM coverage of the continental US, Hawaii, Puerto Rico, territories, and limited Alaska; 1-meter DEM and lidar exist regionally.
- **Integration:** this is not a conventional asset catalog. Define curated regions, fetch GeoTIFF through official National Map services, reproject/crop, normalize height, generate a decimated mesh and splat/height maps, and publish the source bounding box, datum, resolution, acquisition date, transformation recipe, and public-domain evidence.
- **Caveat:** terrain data does not include a game-ready material, vegetation, collision tuning, or sensible world scale. Avoid named sensitive sites and huge raw downloads; generate small reproducible samples first.

## Long-tail and specialist directions

### OpenGameArt CC0 subset

OpenGameArt is valuable for rare props, creatures, vegetation, rigs, and legacy Blender assets. A community [CC0 3D collection](https://opengameart.org/content/3d-assets-cc0) currently lists hundreds of entries, including animated creatures, medieval modular kits, environments, vegetation, and KayKit mirrors. Individual pages such as [Cethiel’s Dragon](https://opengameart.org/content/cethiels-dragon-3d) clearly expose author, art type, files, and CC0.

However, OpenGameArt is a **mixed-license community repository**. Collections are user-maintained, uploads may include derived work, quality varies, and a CC0 filter is not a provenance warranty. Integration should be a review queue rather than a crawler:

1. Confirm the individual page says CC0—not merely the collection title.
2. Inspect description, collaborators, copyright notice, comments, and embedded third-party components.
3. Prefer assets authored by the uploader with editable source and an included license file.
4. Reject trademarked/fan-art subjects and unexplained conversions.
5. Download only after checking site terms/robots and store the original page snapshot and file hash.

### Khronos glTF Sample Assets

The official [glTF Sample Assets repository](https://github.com/KhronosGroup/glTF-Sample-Assets) is excellent for testing importers and render features. It includes GLB, separate glTF, and occasionally embedded glTF variants, plus per-model licensing. The corpus is **not wholly CC0**: it mixes CC0, CC-BY, proprietary sample licenses, trademarks, and multi-component works. Even “Fox” has CC0 modeling but CC-BY rigging/animation. Only ingest an asset when every required component is CC0. A better use is CI conformance, outside the public catalog.

### NASA 3D

NASA’s [media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) say its content, including polygon data and texture maps used in 3D models, is generally not subject to US copyright. That is **not a blanket CC0 dedication**: NASA identifiers are protected, third-party material may appear, usage must not imply endorsement, and the guidelines frame permitted uses. NASA assets can be a valuable “public-domain with caveats” collection, but require per-record review and a separate license label rather than “CC0.”

### Vegetation and animation gap

True CC0 vegetation and animation are much scarcer than static props:

- Start with vegetation inside Poly Haven, ambientCG cutout/atlas assets, Kenney Nature packs, Quaternius nature packs, KayKit environments, and individually reviewed OpenGameArt items.
- Use Quaternius, Kenney, and KayKit for animation-ready CC0 characters. KayKit’s legacy pack provides a particularly useful baseline clip vocabulary.
- Treat Mixamo, ActorCore, Rokoko, marketplace animation packs, and many mocap datasets as **non-CC0** even when downloads are free. Their product or research licenses generally restrict redistribution.
- Build a future “retargetable CC0 animation” program: commission a clean humanoid skeleton, locomotion/combat/social clip set, source motion files, GLB/FBX exports, and explicit CC0 dedication. This fills a real market gap more safely than aggregating ambiguous mocap.

## Sources to exclude or keep link-only

| Source | Why it is not an automatic CC0 ingestion source |
| --- | --- |
| [ShareTextures](https://www.sharetextures.com/p/terms) | Assets are described as CC0, but current platform terms forbid automated scraping, API use, hotlinking, download embedding, and redistribution as collections. Its separate license page calls this “Custom CC0” with restrictions. That is not unmodified CC0 operationally. Contact for written integration permission or stay link-only. |
| [Sketchfab](https://sketchfab.com/developers) | Mixed licenses per model; downloadable and “free” do not mean CC0. API authentication/platform terms apply, and uploader provenance can be weak. Use only after a formal API agreement and record-level CC0/derivative audit. |
| [BlenderKit](https://www.blenderkit.com/docs/licenses/) | Mixed CC0 and BlenderKit Royalty Free licenses. The latter is not CC0 and standalone redistribution is constrained. A CC0-only integration would need API-supported filtering and evidence retention. |
| [Fab / Quixel Megascans](https://www.fab.com/eula) | Free access under an Epic/Fab content license is not a public-domain dedication and does not permit building a general redistributable asset library. |
| Adobe Mixamo | Free with an Adobe account under product terms, not CC0; raw character/animation redistribution is not a safe catalog fit. |
| Objaverse / Objaverse-XL | A dataset index over third-party models with mixed and uploader-asserted licenses. Useful for discovery/research, not license truth. Resolve and verify the original asset record before considering any item. |
| Wikimedia Commons / Internet Archive / Thingiverse / Printables / NIH 3D | Mixed licenses and mixed provenance. Only item-level CC0/public-domain records with authoritative evidence should enter review. |
| “Royalty-free” model and texture sites | Royalty-free usually grants use under a contract; it does not waive copyright or permit redistribution. Do not map it to CC0. |

## License and asset verification contract

Each catalog record should be publishable only if the following evidence exists:

### 1. Identity and provenance

- Stable source asset ID and canonical source page.
- Source/creator name, original author where different, and upstream page for derivatives.
- Retrieval timestamp and the adapter version.
- Evidence that the person or institution applying CC0 plausibly owns the relevant rights.
- A `provenanceConfidence` value: `first-party`, `institutional`, `verified-derivative`, or `community-asserted`.

### 2. License evidence

- Exact license identifier: `CC0-1.0`, `Public-Domain-USGov`, or a non-eligible value. Never normalize “free” to CC0.
- Asset-specific license URL, plus source-wide terms URL when applicable.
- Captured license text or immutable license file and its SHA-256 hash.
- Effective/retrieval date; licenses and platform terms can change.
- Separate flags for attribution requested, trademarks/logos, personality/privacy, cultural sensitivity, third-party components, and redistribution/platform restrictions.

CC0 removes or waives copyright to the extent possible; it does not erase trademarks, patents, privacy/publicity rights, moral rights that cannot be waived, contractual site terms, or rights in an depicted object. “No known copyright restrictions” is not the same status as CC0.

### 3. Retrieval permission

Keep **asset rights** separate from **access rights**:

- `metadataAccess`: official API, owner feed, manual, or prohibited.
- `binaryAccess`: direct official URL, user-initiated source download, owner-approved mirror, or prohibited.
- `previewRights`: explicit asset preview permission, locally generated preview, or link-only.
- `robotsCheckedAt`, `termsCheckedAt`, rate limit, required user agent, source attribution requirement, and contact record.

If a source prohibits scraping or third-party download embedding, catalog only a title and canonical source link obtained manually unless written permission says otherwise. CC0 does not obligate a host to fund Antiky’s bandwidth.

### 4. File integrity and game readiness

- Download URL, byte size, MIME/type, archive member manifest, SHA-256, and provider hash if supplied.
- Reject path traversal, executables, scripts/macros, password-protected archives, and unexpected nested archives.
- Scan archives and cap expanded size/file count before extraction.
- Validate GLB/glTF with the [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator); record errors, warnings, extensions, external dependencies, and animation/skin counts.
- Inspect triangle/vertex counts, dimensions, units, axes, pivot, UV sets, normals/tangents, material/texture count, texture dimensions, alpha use, LODs, collision meshes, and draw-call implications.
- For PBR sets, identify workflow and map semantics explicitly: base color, normal orientation, roughness/gloss, metallic/specular, AO, height/displacement, opacity, packed channels, and physical tile size.
- Generate previews locally from the distributable asset. Do not assume a website thumbnail inherits the downloadable asset’s CC0 status.
- Keep original bytes immutable; publish normalization as a reproducible derivative with tool versions and its own hash.

### 5. Human review gates

Reject or quarantine assets that contain recognizable brands, copyrighted characters, scanned living people, unexplained copyrighted artwork, third-party music, culturally sensitive objects, unsafe weapons presented without context, or license conflicts between page/archive/components. Automated checks can find signals; they cannot settle ownership.

## Proposed ingestion order

### Wave 1 — highest-confidence structured sources

1. Poly Haven metadata and source links for all records; initially showcase game-sized variants rather than mirroring binaries.
2. ambientCG metadata with asset-type normalization and 1K/2K game-friendly downloads.
3. Smithsonian 3D API records explicitly marked Open Access/CC0, starting with 100 curated objects.
4. OS3A pilot of one Polygonal Mind collection after independent provenance review.

### Wave 2 — game-ready creator packs

1. Complete pack manifests for Kenney and Quaternius.
2. KayKit pack manifests and animation taxonomy.
3. Curated TextureCan model/material records after owner contact.
4. 3DTextures.me and cgbookcase source-link catalogs after access approval.

### Wave 3 — derived and long-tail assets

1. Small reproducible USGS terrain tiles in diverse biomes.
2. Human-reviewed OpenGameArt CC0 items that fill taxonomy gaps.
3. NASA public-domain-with-caveats records under a distinct license class.
4. Commissioned Antiky CC0 vegetation, humanoid rigs, and retargetable animation where aggregation remains weak.

## What “good” looks like

A useful catalog is not the largest list of URLs. It is a smaller set where an agent can answer, before downloading: what the asset depicts; whether it is truly CC0 or another public-domain class; who applied that license; what formats, maps, animations, LODs, scale, and dependencies exist; whether Antiky may retrieve or mirror it; whether it loads cleanly in a modern game pipeline; and what caveats survive the copyright waiver. Poly Haven is the reference integration because its metadata and file graph answer most of those questions. Every other adapter should move toward that standard rather than discarding uncertainty.
