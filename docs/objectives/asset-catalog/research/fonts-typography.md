# Fonts and typography research

Research date: 2026-08-09

## Executive summary

Fonts should be a first-class asset kind, but the catalog must not describe every open font as CC0. The useful supply divides into two different products:

1. **CC0/public-domain game fonts** — a small, high-value set of pixel fonts, bitmap atlases, and a few scalable families. These are the safest default for agents that want assets with no attribution workflow.
2. **Open-licensed scalable fonts** — a much larger and generally more polished collection, primarily under SIL OFL 1.1, with smaller Apache 2.0 and Ubuntu Font Licence groups. They can be used in games, including commercial games, but redistribution and modification carry notices, license preservation, and sometimes naming requirements.

The first ingestion milestone should be roughly 60–100 reviewed CC0 font assets from Kenney, selected OpenGameArt records, and Font Library's CC0 filter. The second milestone should add a separate `open-font` license tier using Google Fonts as the authoritative upstream and Fontsource as an optional delivery/metadata convenience. Never silently convert, subset, rasterize, or rebuild an OFL font under its original Reserved Font Name.

## License classes the product must show

| Catalog class | What a game creator can generally do | Catalog and redistribution requirement | Default policy |
| --- | --- | --- | --- |
| `CC0-1.0` | Use, modify, embed, and redistribute for commercial or noncommercial work without copyright attribution | Preserve the source URL and CC0 evidence in Antiky's metadata. CC0 does not waive trademark, patent, privacy, or third-party rights. | Preferred and eligible for “no attribution required.” |
| `public-domain` | Depends on the jurisdiction and the evidence for the public-domain claim | Record the legal basis, country/term evidence where relevant, digitizer/source, and exact upstream statement. | Quarantine unless provenance is stronger than a marketplace label. Prefer CC0 over an unqualified public-domain claim. |
| `OFL-1.1` | Bundle original fonts with commercial games; embed them; create graphics without applying OFL to the game/artwork | Preserve copyright and license information. Modified font software remains OFL. Subsetting and most conversions are modifications; declared Reserved Font Names may require renaming. | High-value secondary tier, never labeled CC0. |
| `Apache-2.0` | Use, modify, and redistribute, including commercially | Ship the license, preserve relevant notices, mark modified files, and carry an upstream `NOTICE` when one exists. | Accept, with automated notice packaging. |
| `UFL-1.0` | Use, modify, bundle, embed, and redistribute | Keep copyright and license with copies; derivatives remain UFL; changed versions have detailed renaming rules; trademark rights are not granted. | Accept only with an explicit UFL compliance path. |
| Other permissive/open licenses | Varies by family | Treat MIT, Bitstream Vera, M+ license, CC BY, GPL-with-font-exception, and similar licenses as distinct contracts. | Do not ingest until that license has a tested obligation template. Exclude “freeware” as an eligibility signal. |

Creative Commons describes CC0 as a waiver/dedication of the affirmer's copyright and related rights to the greatest extent possible, but explicitly does not waive trademark or patent rights and cannot clear rights held by other people ([CC0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en)). The OFL FAQ explicitly permits bundling OFL fonts with games and commercial software, and says that artwork made with an OFL font does not inherit the OFL ([OFL FAQ](https://openfontlicense.org/ofl-faq/)). Apache's redistribution terms require preservation of notices, prominent change notices in modified files, and handling an upstream NOTICE file when present ([Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)). Canonical's UFL text permits game-style bundling and embedding but defines format conversion as modification and imposes naming rules on changed fonts ([Ubuntu Font Licence 1.0](https://ubuntu.com/legal/font-licence)).

This is an engineering policy, not legal advice. Ambiguous ownership or conflicting files should be quarantined for review rather than interpreted optimistically.

## Source catalog

### Priority 1: Kenney Fonts

**Why:** Small, immediately useful, game-specific, and cleanly declared CC0 by the publisher.

- Official page: [Kenney Fonts](https://kenney.nl/assets/kenney-fonts)
- Published metadata: category 2D, tags `font`, `letter`, `pixel`, 11 files, CC0.
- Access: pack page and download link; no documented catalog API.
- Expected contents: inspect the archive rather than assuming all 11 files are distinct families or formats.
- Ingestion: curated pack record first, followed by family/face records only after archive inspection.
- Priority: **P0 seed asset**.

The official page itself supplies the license, tags, category, and file count, making it much stronger evidence than a repost ([Kenney Fonts](https://kenney.nl/assets/kenney-fonts)). Save a snapshot of that statement and its retrieval date. Do not rely on the itch.io mirror when the publisher page is available.

### Priority 1: OpenGameArt, CC0-only font records

**Why:** Best source of native game typography: pixel atlases, sprite fonts, BMFont files, and some TTF/OTF families.

- Official discovery: [CC0 Fonts collection](https://opengameart.org/content/cc0-fonts) and per-item pages.
- Access: HTML pages and item attachments; no stable, documented public API found.
- Metadata: author, submission date, tags, selected license(s), attribution instructions, attachment names/types/sizes, favorites/download counts, and description.
- Formats observed: PNG atlases, ZIP, BMFont XML `.fnt`, TTF, OTF, WOFF, and WOFF2.
- Strength: records often describe glyph coverage, cell dimensions, language support, and engine compatibility.
- Risk: user submissions can contain a license file that conflicts with the page, derived glyphs, font rips, or unclear authorship. A collection membership is not license proof; validate each item and archive independently.
- Ingestion: cached, low-rate item crawler plus manual review. Do not ingest an entire collection without resolving each record.
- Priority: **P0 for hand-reviewed items; P2 for automation**.

High-value seeds:

| Asset | Game value | Published evidence | Initial disposition |
| --- | --- | --- | --- |
| [GGBotNet Fonts CC0 (All-in-1)](https://opengameart.org/content/ggbotnet-fonts-cc0-all-in-1) | 45 scalable fonts; TTF, OTF, WOFF, WOFF2 | Author identifies the collection as their fonts and marks it CC0 | P0, but expand to one record per family only after names, coverage, and license metadata are inspected. |
| [Public Pixel Font](https://opengameart.org/content/public-pixel-font) | Monospaced 8×8 design, 1,324 glyphs, claimed support for 98 languages | CC0 item page, author statement, downloadable ZIP | P0; verify actual cmap coverage and bundled notices. |
| [Click Pixel Font](https://opengameart.org/content/click-pixel-font) | BMFont XML and image variants; page names Phaser, LibGDX, Godot, and Cocos2D | CC0 item page with attachment purpose documented | P0; unusually good engine-ready contract. |
| [Bitmap Font](https://opengameart.org/content/bitmap-font) | Small ASCII raster atlas plus width definition and XCF source | CC0 item page; explicit layout formula | P0 for prototypes and retro games. |
| [Three Little Bitmap Fonts](https://opengameart.org/content/three-little-bitmap-fonts) | Three grid sizes for retro UI | CC0 item page with coverage and dimensions | P1; catalog the limited character sets accurately. |
| [Frogatto & Friends bitmap fonts](https://opengameart.org/content/frogatto-friends-bitmap-fonts) | Latin, Cyrillic, some Greek; established game provenance | CC0 item page and ZIP | P1; confirm submitter authority/provenance because the named author and submitter differ. |
| [Squont8ASCII](https://opengameart.org/content/squont8ascii) | 8×8, one-bit, complete printable ASCII | CC0 item page | P1. |

Do not treat a page badge as sufficient when archive contents disagree. OpenGameArt itself advises users to inspect generated credits information and its general FAQ stresses that obligations depend on each selected license ([OpenGameArt FAQ](https://opengameart.org/content/faq)). A known example outside the CC0 shortlist has a page license and an archive license that conflict, demonstrating why archive-level checks are necessary ([Bitmap Font Pack](https://opengameart.org/content/bitmap-font-pack)).

### Priority 1: Font Library's CC0 filter

**Why:** A finite, filterable CC0 queue of scalable fonts with family/style metadata.

- Official filter: [Font Library CC0 search](https://fontlibrary.org/en/search?license=CC-0)
- Current CC0 result count: 10 families at research time.
- Named results: Seshat Regular, Marius1, Vegur, Medio, Penna, Pixel Operator, Aileron, FifteenTwenty, Tenderness, and Ferrum.
- Useful published fields: family, designer/uploader, style count, broad category, languages, and license filter.
- Access: HTML; no stable documented public JSON API found.
- Freshness concern: the public catalog's recent-update list is measured in years, so do not assume active maintenance.
- Ingestion: manually review all ten. Preserve item-level license files and identify the actual copyright holder; a platform's classification alone is not enough to re-host binaries.
- Priority: **P0 finite review queue**.

Font Library also reports 25 “Public Domain (not a license)” families, 927 OFL families, 30 Apache families, and many other license classes ([Font Library catalog](https://fontlibrary.org/en/catalogue/)). Only the CC0 ten belong in the zero-obligation queue. Public-domain entries require evidence per family, while OFL/Apache records belong in separate ingestion lanes. Font Library's own supported-license list includes everything from CC0 to GPL and “Freeware,” so mere inclusion on the site is not a uniform redistribution contract ([supported licenses](https://fontlibrary.org/en/guidebook/supported_licenses)).

### Priority 2: Google Fonts repository and Developer API

**Why:** The best machine-readable source for polished, multilingual, scalable fonts. It is not a CC0 source.

- Canonical files: [google/fonts](https://github.com/google/fonts)
- Metadata guide: [METADATA.pb documentation](https://googlefonts.github.io/gf-guide/metadata.html)
- API: [Google Fonts Developer API](https://developers.google.com/fonts/docs/developer_api)
- Repository structure: license-class top-level directories; family directories containing TTF files, `METADATA.pb`, license text, and descriptions.
- Family metadata: name, designers, license class, category/classifications, styles, weights, filenames, PostScript/full names, copyright, subsets/scripts, primary script, languages, source repository, dates, and variable-axis information.
- API metadata: families, subsets, variants, version, last-modified date, file URLs, axes, and tags; requires an API key.
- Formats: repository TTF plus API-delivered webfont variants; variable fonts and axis definitions are represented.
- Licensing: most families are OFL; some are Apache 2.0 or UFL. Google documents `OFL`, `APACHE2`, and `UFL` as the metadata license values and expects new submissions to be OFL ([metadata license field](https://googlefonts.github.io/gf-guide/metadata.html#license)).
- Ingestion: snapshot the Git repository or consume `METADATA.pb`; prefer repository license files over a generic Google Fonts attribution URL. Generate reviewable diffs from pinned commits.
- Priority: **P1 after the catalog supports license obligations**.

The repository states that every family folder carries its appropriate license file and that files are redistributable subject to those terms ([Google Fonts repository](https://github.com/google/fonts)). This makes it suitable for deterministic catalog generation. It does **not** make those fonts CC0, and Antiky should never copy a generic license label across every family.

### Priority 2: Fontsource

**Why:** Excellent normalized metadata and delivery ergonomics for Google Fonts and related open families; useful as an adapter or cross-check, not the final rights authority.

- API introduction: [Fontsource API](https://fontsource.org/docs/api/introduction)
- List/filter endpoint: [`GET /v1/fonts`](https://fontsource.org/docs/api/fonts)
- Variable axes: [`GET /v1/variable/{id}`](https://fontsource.org/docs/api/variable)
- Access: public read-only JSON API; documented fair-use posture and a hard ceiling of 2,500 requests per 10 seconds, with throttling reserved.
- Metadata: stable ID, family, subsets, weights, styles, default subset, variable flag, modification date, category, version, and source type; variable endpoint supplies axis minimum, maximum, default, and step.
- Delivery: npm packages and CDN CSS; WOFF/WOFF2-oriented web delivery. Fontsource v5 metadata uses a structured license object with type, URL, and attribution and packages include license files ([v5 license metadata](https://fontsource.org/docs/getting-started/migrate-v5)).
- Ingestion: fetch the whole font list once, cache it, then enrich selected families. Cross-check license and author data against the upstream font repository before publishing or mirroring.
- Priority: **P1 metadata adapter; P2 binary delivery dependency**.

Fontsource's own code license is MIT, but that does not relicense the fonts it packages. Preserve each family's upstream license. Its normalized WOFF/WOFF2 and unicode-range data can help web previews, while game downloads should prefer the upstream TTF/OTF package when available.

### Priority 3: Other marketplaces and discovery indexes

- **itch.io:** Useful for finding creator-owned CC0 pixel fonts and themed packs, but every item is creator-controlled and page structure/download gates vary. Ingest only a curated publisher allowlist. Record the exact item revision and license statement; never infer a pack's license from a search tag.
- **Font Squirrel, DaFont, 1001 Fonts, Fontesk, and similar directories:** Discovery only. Labels such as “free,” “free for commercial use,” or “public domain” are not a normalized license or proof the uploader owns the font. Follow the trail to the foundry/upstream repository and ingest from there.
- **Internet Archive and historical type scans:** Useful source material for new type design, not automatically safe font software. Public-domain status of a printed specimen does not automatically resolve rights in a modern digital font implementation.
- **System/platform fonts:** Exclude. A font installed with Windows, macOS, consoles, Adobe software, or an engine SDK is not thereby redistributable with a game.

## Font-specific asset schema

Each family record should extend the shared asset schema with:

- `family`, `faces[]`, `style`, numeric `weight`, and `stretch`
- `fontFormats[]`: `ttf`, `otf`, `woff`, `woff2`, `fnt`, `bmfont-xml`, `bmfont-text`, `png-atlas`, `sdf`, `msdf`, or source formats
- `isVariable`, plus `axes[]` containing four-character tag, name, minimum, maximum, default, and step
- `glyphCount`, `codepoints` or compressed ranges, `scripts[]`, `languages[]`, and `unicodeCoveragePercent`
- `monospace`, `colorFont`, OpenType feature tags, kerning presence, hinting presence, and bitmap strike sizes
- for atlases: image dimensions, cell width/height, baseline, line height, padding, spacing, channel layout, glyph-map format, and page count
- `licenseSpdx`, exact `licenseTextUrl`, bundled license filenames, copyright string, author/foundry, source repository, and Reserved Font Names
- `originalFileHashes[]`, upstream version, upstream commit/release, retrieval time, and canonical source URL
- `transformHistory[]`: format conversion, subsetting, rasterization, atlas generation, SDF/MSDF generation, renaming, and tool/version
- `engineCompatibility[]`: verified imports for Godot, Unity, Unreal, Phaser, Three.js/web, Love2D, LibGDX, or other targets
- `verification`: metadata-only, license-file-verified, font-sanitized, render-verified, or engine-import-verified

Family and face should be separate concepts. Search results normally show one family; downloads and engine imports operate on faces/files. Variable fonts need both the continuous axes and named instances so an agent can make a useful selection without opening the binary.

## Validation and license-verification pipeline

### 1. Establish provenance before downloading

1. Prefer the creator/foundry page or canonical source repository.
2. Record the page's license statement, canonical URL, author, version/release, and retrieval timestamp.
3. Reject scraped reposts when an upstream exists.
4. Require item-level evidence. A category, search filter, or collection is a discovery hint only.
5. Quarantine trademark-like fan fonts, franchise recreations, and uploads whose authorship claim is implausible even when marked CC0.

### 2. Verify the downloaded package once

1. Hash the original archive and each extracted file.
2. Inventory every file; reject path traversal, executables, nested password archives, and unexpected binaries.
3. Compare packaged license/copyright/readme text with the web claim. Conflicts fail closed.
4. Parse TTF/OTF/WOFF/WOFF2 name, OS/2, cmap, fvar, STAT, GSUB, GPOS, COLR/CPAL, CBDT/CBLC, and SVG tables.
5. Check that internal names, copyright, license URL, embedding bits, weight/style, and glyph coverage agree with catalog metadata.
6. Run OpenType Sanitizer and FontTools validation; render a specimen containing ASCII, punctuation, numerals, replacement/missing glyphs, and representative claimed scripts.
7. For bitmap fonts, validate descriptor coordinates against image bounds, detect overlapping/out-of-range glyphs, and render from the supplied mapping.
8. Preserve the untouched upstream files. Derived previews and conversions get separate hashes and provenance.

This verification is a one-time, cached promotion step, not something clients do and not a recurring redownload of every font. Discovery can remain metadata-only; high-demand candidates are promoted to verified after a controlled download.

### 3. Apply license-specific transformation rules

- **CC0:** transformations may retain the name from a copyright standpoint, but avoid implying publisher endorsement and preserve provenance in Antiky metadata.
- **OFL:** unchanged font files may be bundled with a game. Preserve copyright/license information. Subsetting is a modification. WOFF/WOFF2 compression can avoid being a modification only when font data and equivalent metadata remain functionally unchanged; tools do not guarantee this automatically. A modified font with declared Reserved Font Names normally needs a new name ([OFL webfont guidance](https://openfontlicense.org/webfonts-and-reserved-font-names/)).
- **OFL bitmap/SDF output:** a static image made using a font does not inherit OFL, but a reusable glyph atlas behaves more like redistributable font software than ordinary artwork. Treat generated atlases/SDFs conservatively as modified font software: preserve OFL, document the transformation, and rename when RFNs apply unless counsel or the author confirms a different interpretation.
- **Apache 2.0:** keep the license and required notices, mark transformed files as changed, and preserve relevant NOTICE content.
- **UFL:** conversion is explicitly a modification. Follow its exact original-versus-modified naming rules and keep derivatives under UFL.

Do not generate “optimized” downloadable derivatives by default. Ship originals plus engine recipes first. Generate atlases or subsets only for fonts whose license workflow is implemented and whose demand justifies the maintenance.

### 4. Verify actual game usefulness

- Render at small UI sizes and common device pixel ratios.
- Test numerals, punctuation, currency symbols, accented names, dialogue, and any claimed non-Latin scripts.
- Check missing-glyph behavior, line metrics, baseline consistency, kerning, and fallback compatibility.
- For pixel fonts, verify integer-scale sharpness and published cell sizes.
- For variable fonts, test defaults and axis extremes for clipping or broken metrics.
- Record compressed and uncompressed sizes per face/subset; large CJK families need deliberate packaging.
- Import a high-priority sample into at least one native engine and one browser-based engine before claiming compatibility.

## Recommended ingestion sequence

### Phase A — CC0 game-font shelf

1. Import Kenney Fonts as a pack, then inspect its 11 files.
2. Review all ten Font Library CC0 families against their downloaded license and internal metadata.
3. Review the OpenGameArt seeds above, beginning with GGBotNet, Public Pixel, Click, and the compact bitmap fonts.
4. Target 60–100 family/atlas records with previews, glyph coverage, formats, and honest verification states.
5. Make `CC0-1.0` and `public-domain` separate filters; do not display “attribution optional” as though it were a legal condition.

### Phase B — polished open-font shelf

1. Add the schema and packaging templates for OFL, Apache 2.0, and UFL.
2. Snapshot Google Fonts from a pinned repository commit and ingest per-family license files and `METADATA.pb`.
3. Select an initial game-oriented set rather than all families: readable UI sans/serif, monospace/debug, pixel/display, fantasy/horror/sci-fi display, broad multilingual coverage, and useful variable families.
4. Use Fontsource metadata to enrich web-preview formats, unicode ranges, and axes; cross-check upstream before publication.
5. Provide license/notice bundles alongside downloads and expose obligations in both human and agent-readable fields.

### Phase C — derived game-ready typography

1. Add reproducible bitmap-atlas and SDF/MSDF recipes.
2. Generate derivatives only for CC0 or for open fonts whose modification/naming obligations are fully satisfied.
3. Store tool versions, input/output hashes, character sets, atlas settings, and new font names where required.
4. Add engine import fixtures and promote only tested combinations to `engine-import-verified`.

## Decision matrix

| Direction | Supply | Quality | Automation | Legal/operational risk | Recommendation |
| --- | ---: | ---: | ---: | ---: | --- |
| Kenney CC0 | Small | High for pixel/game UI | Low | Low | Start immediately. |
| Reviewed OpenGameArt CC0 | Medium | Variable, often uniquely game-ready | Medium-low | Medium due to user uploads and archive conflicts | Curate aggressively; verify every archive. |
| Font Library CC0 | Very small | Mixed | Medium-low | Medium due to aging catalog and aggregator provenance | Review all ten as a finite queue. |
| Google Fonts OFL/Apache/UFL | Very large | High | High | Low-medium when notices and transformations are controlled | Best scalable second lane; never call it CC0. |
| Fontsource | Very large | High | High | Medium as an intermediary and transformed-package source | Use for normalized metadata/previews; verify licenses upstream. |
| itch.io CC0 | Medium | Variable | Low | Medium-high due to per-item claims and delivery | Publisher allowlist only. |
| Generic “free font” directories | Huge | Variable | Medium | High | Discovery only; follow to upstream. |

## Catalog product direction

The user-facing distinction should be simple:

- **No-attribution fonts:** reviewed CC0 assets with direct evidence.
- **Open fonts:** commercially usable fonts that ship with a generated compliance bundle.
- **Source-only candidates:** promising fonts whose license, archive, or authorship has not passed review.

Agents should be able to ask for constraints such as `licenseClass=cc0`, `format=bmfont-xml`, `script=Latn`, `monospace=true`, `pixel=true`, or `engine=godot`. A result should say exactly what gets installed, what notices travel with it, whether it is original or transformed, and what has actually been tested. That is more valuable than maximizing the raw family count.
