# Current asset catalog and pack visibility

## Scope and method

This was a read-only inspection of:

- `packages/asset-catalog/src/`, `data/`, `tests/`, `dist/v1/`, and preview assets
- `docs/user-facing-docs/assets/catalog.md`
- `docs/objectives/_archives/asset-catalog-summary.md`
- the website’s catalog presentation and filtering code where needed to determine what users can see

I did not refresh providers or download archives. I did not run `npm test`, because the package test starts with a build that removes and rewrites `dist/`. I inspected the tests and ran read-only imports and snapshot queries instead.

Representative commands:

```sh
rg --files packages/asset-catalog docs/user-facing-docs/assets docs/objectives/_archives | sort
jq '{poly: (.assets|length), retrievedAt, selection}' packages/asset-catalog/data/poly-haven.generated.json
jq '{curated: (.assets|length), retrievedAt, sources}' packages/asset-catalog/data/curated-sources.generated.json
jq '{community: (.assets|length), sources}' packages/asset-catalog/data/community-sources.generated.json
jq '{handpicked: (.assets|length), sources: (.sources|length), retrievedAt}' packages/asset-catalog/data/handpicked-sources.generated.json
node --experimental-strip-types --input-type=module -e 'const {CATALOG_ASSETS:a}=await import("./packages/asset-catalog/src/catalog-data.ts"); /* aggregate current records */'
nl -ba packages/asset-catalog/src/index.ts
nl -ba packages/asset-catalog/src/providers/community-client.ts
nl -ba packages/asset-catalog/src/providers/handpicked-client.ts
```

## Established findings

### 1. The current catalog has 1,466 records, not the documented 1,453

**Established.** Importing `CATALOG_ASSETS` from `packages/asset-catalog/src/catalog-data.ts` returns 1,466 records across 17 provider IDs.

The main provider distribution is:

| Provider | Records | Granularity |
| --- | ---: | --- |
| Poly Haven | 998 | Individual model, texture, or HDRI |
| Kenney | 212 | Pack |
| Quaternius | 82 | Pack |
| OpenDuelyst | 82 | Repository resource family |
| Screaming Brain Studios | 62 | Pack |
| KayKit | 17 | Pack |
| New handpicked providers | 13 | Pack or item page |

The 1,466 total is the archived 1,453-record six-source baseline plus 13 new handpicked records. `packages/asset-catalog/data/handpicked-sources.generated.json` contains 13 new assets from 19 reviewed sources; six of those sources alias existing records and adjust their quality rather than add records.

**Established drift.** `docs/user-facing-docs/assets/catalog.md:11` and `docs/objectives/_archives/asset-catalog-summary.md:20-22` still state 1,453. The current static-output test expects 1,466 at `packages/asset-catalog/tests/static-output.test.mjs:27-29`.

**Unknown.** I did not verify the production website or API over the network, so this proves source and local generated-output state, not deployed state.

### 2. The schema is strong at pack identity and rights context, but has no pack-content model

**Established.** `CatalogAsset` in `packages/asset-catalog/src/index.ts:36-73` records:

- identity, slug, name, description, kind, and quality
- one `fileCount`
- formats, tags, and categories
- provider and upstream source
- one preview
- limited facts
- selected downloads
- license, provenance, attribution, and verification state

It has no field for pack members, logical asset groups, variants, animation clips, rigs, skeleton compatibility, materials, texture slots, dimensions, scale, coordinate system, dependencies, or member-level previews.

**Inference.** The user’s stated problem is real, but “no description” is not literally true. Every current record has a non-empty `description`; the decisive gap is that many descriptions do not enumerate or structure what a pack contains.

### 3. Metadata completeness is highly uneven

Current source-import counts:

| Field or evidence | Records | Coverage |
| --- | ---: | ---: |
| Non-empty description | 1,466 | 100% |
| Non-empty formats | 1,464 | 99.9% |
| Known `fileCount` | 457 | 31.2% |
| Non-empty `facts` | 995 | 67.9% |
| Non-null provenance source hash | 998 | 68.1% |
| Selected, hashed downloads | 3 | 0.2% |
| Locally hosted preview | 5 | 0.3% |
| Provider-hosted preview | 1,461 | 99.7% |

Kinds are broad: 485 models, 369 textures, 334 HDRIs, 264 sprites, 12 audio records, and 2 fonts.

**Established.** All 995 metadata-only Poly Haven records have published/download/resolution facts, and its 331 model records have polygon counts. By contrast, `createCuratedCc0Asset` always emits empty `facts`, no downloads, no source hash, and the placeholder `filesHash: "not-requested-metadata-only"` (`packages/asset-catalog/src/providers/curated.ts:36-64`).

**Inference.** A field’s presence does not always mean file-derived truth. For example, Kenney formats are inferred from broad kind in `formatsFor()` rather than inspected from an archive (`packages/asset-catalog/src/providers/kenney-client.ts:17-22`).

### 4. Representative packs show several distinct granularity failures

**Kenney Nature Kit**

- Record: `kenney:nature-kit`
- `fileCount: 330`
- Description: “Download this package (330 assets) for free, CC0 licensed!”
- Tags include nature/tree/rock/foliage.
- No member names, breakdown, variations, dimensions, materials, or file manifest.

All 212 Kenney descriptions match the same count-and-license template. The title and tags help broad discovery, but the record cannot answer “which trees and rocks are inside?”

**Quaternius Universal Animation Library**

- Record: `quaternius:universalanimationlibrary`
- Description says 120+ animations and names broad action families.
- `fileCount: 1`
- Formats are FBX, GLB, and Blend.
- No clip list, clip names, durations, root-motion details, rig contract, or retarget validation.

**Established.** `fileCount` here counts a published model/file concept, not semantic contents. The same field means pack assets for Kenney, total models including recolors for KayKit, repository files for OpenDuelyst, and models for Quaternius.

**KayKit Forest Nature Pack**

- Record: `kaykit:forest-nature-pack`
- Description distinguishes “200+ unique” from “1500+ total models including recolours.”
- `fileCount` stores 1,500 only.
- It mentions trees, bushes, rocks, grass, and terrain but has no structured counts or member list for those groups.

**OpenDuelyst Units Runtime**

- Record: `open-duelyst:runtime-units`
- `fileCount: 1,392`
- Formats: PLIST and PNG.
- Description only says these are files from the `resources/units` family.

`parseOpenDuelystTree()` reads every eligible Git-tree path, but collapses them by the first directory under `resources` or `original_resources`; the resulting record keeps count, format set, and one preview, not member paths (`packages/asset-catalog/src/providers/community-client.ts:95-129`).

**Inference.** OpenDuelyst is the clearest deterministic enrichment opportunity because the current crawler already sees exact filenames before discarding them.

**Handpicked Godot Skies**

- Record: `binbun3d:godot-skies`
- Format: `gdshader`
- Categories include `shader`
- Kind: `hdri`

**Established.** `AssetKind` has no shader kind (`packages/asset-catalog/src/index.ts:1`). The current schema therefore classifies a shader pack as an HDRI.

**Inference.** Shader records should not be added to this media schema merely by adding tags; the archived summary’s separate-catalog-class warning is supported by current behavior.

### 5. Taxonomy exists, but some values are not usable search concepts

**Established.** Tests require at least three tags per record (`packages/asset-catalog/src/catalog.test.ts:74-79`), and text search covers name, description, creator, provider, tags, and categories (`packages/asset-catalog/src/index.ts:82-100`).

However, 59 of 82 Quaternius records have at least one tag or category value longer than 50 characters. Examples include:

```text
animationuniversalretargethumanoidlocomotionrunjogwalkguncombatidlecrawlingdeath
naturetreesrocksgrassforestultimatepinewillowpalmrockgrassplantlogsflowerssnowedcactus
```

`parseQuaterniusIndex()` extracts hidden `<noscript>` text and splits only on whitespace (`packages/asset-catalog/src/providers/quaternius-client.ts:18-23`).

**Inference.** These concatenated values are likely a parser artifact and weaken exact semantic filtering even when free-text substring search sometimes finds a word inside them.

### 6. User visibility mirrors the schema’s limitations

**Established.** Asset cards expose provider, quality, kind, one file-count label, description, tags, formats, preview, and verification (`packages/website/src/components/assets/AssetCard.tsx`). Detail pages add creator, upstream ID, files hash, optional Poly Haven facts, attribution, source link, JSON link, and selected downloads (`AssetDetail.tsx`).

The website supports filters for kind, provider, 2D/3D, format, verification, and quality. It does not expose pack-member or semantic-facet queries because the catalog does not contain those structures.

**Established.** Tests prove identity uniqueness, broad field validity, provider counts, source-license gates, static-output equality, and a few representative records. They do not prove member-level semantic accuracy or pack completeness; there is no member schema to test.

## Gap matrix

| Area | Current state | Representative evidence | Material gap |
| --- | --- | --- | --- |
| Pack membership | No member field | Nature Kit has 330 only; OpenDuelyst paths are discarded after grouping | Cannot answer which assets/files are included |
| Count semantics | One nullable `fileCount` | 1 file can mean 120+ animations; 1,500 can include recolors | Counts are not comparable across sources |
| Description | Present on all records | All 212 Kenney descriptions are generic templates | Presence is mistaken for semantic detail |
| Semantic groups | Free-form tags/categories | KayKit mentions trees/bushes/rocks only in prose | No structured contents or group counts |
| Animation/rig data | Not represented | Universal Animation Library has no clip or rig manifest | Cannot evaluate reuse or compatibility |
| Model technical data | Mostly Poly Haven aggregate facts | Curated packs have empty `facts` | No scale, dimensions, topology, materials, LODs, or rig data |
| Format evidence | Nearly complete but often inferred | Kenney formats are chosen by broad kind | No per-member or archive-verified format provenance |
| Preview evidence | One preview per record | 1,461 provider-hosted previews | Cannot demonstrate pack breadth or member identity |
| File provenance | Only three install-verified selections | 1,463 records have no selected downloads | Cannot reproduce or validate member bytes |
| Taxonomy quality | Minimum tag counts enforced | 59 Quaternius records contain concatenated long values | Tags are not normalized or field-evidenced |
| Confidence/provenance | Record-wide source verification | No per-field method/confidence | Extracted and model-generated claims cannot be distinguished |
| Shader classification | No shader kind | Godot Skies is stored as HDRI | Media schema cannot faithfully represent software artifacts |
| Stable identity | Catalog IDs are `provider:slug` | Installer persists `catalogId` | Unknown relationship to UUIDv7 framework asset identities |

## Implications and directions

1. **Inference: preserve pack-level records and add a subordinate content index.** The archived rule against publishing every frame or component as a top-level asset remains sound. A pack can retain one catalog identity while linking to structured members or semantic groups.

2. **Inference: do not add full member manifests to the top-level catalog document.** The serialized current asset array is about 2.48 MB before adding member data. Separate per-pack summaries and member documents would preserve the static-first design and keep broad discovery bounded.

3. **Inference: split count concepts.** At minimum, future data should distinguish published file count, logical asset count, unique asset count, variant/recolor count, animation clip count, and whether each is exact, lower-bound, provider-claimed, or extracted.

4. **Inference: keep source facts and enrichment separate.** Model-generated tags or summaries should not overwrite publisher descriptions or appear under record-wide `source-verified`. Store field-level method, evidence reference, timestamp, confidence, model/tool version, and review state.

5. **Inference: deterministic extraction should lead where bytes or trees are available.** Filenames, extensions, directory grouping, image dimensions, glTF scenes/nodes/materials/meshes/animations, and archive manifests can supply reproducible facts. Model assistance is better suited to naming groups, normalizing vocabulary, and summarizing visual purpose.

6. **Inference: prioritize current information loss before adding equivalent providers.** OpenDuelyst already exposes exact paths to its crawler; Quaternius descriptions already contain useful composition clues; KayKit prose often distinguishes unique assets from recolors. Recovering and structuring these signals directly addresses the objective without maximizing record count.

7. **Established constraint.** Any archive inspection would be a new ingestion lane. Current snapshot policies explicitly say metadata-only/no-archive-downloads, and the archived rules separate metadata retrieval from asset retrieval permission.

8. **Inference: a shader library needs its own semantic contract.** The `Godot Skies` misclassification and the archived summary’s software-license/dependency requirements show that shader source, dependencies, engine/runtime version, inputs, render evidence, and notices cannot fit safely into the current media record by tagging alone.

## Explicit unknowns

- **Unknown:** Which providers permit automated archive retrieval for metadata extraction under current terms. Historical CC0 asset rights do not establish crawler or bulk-download permission.
- **Unknown:** Whether member manifests can be obtained from provider APIs or page data without downloading full archives.
- **Unknown:** Whether the owner wants semantic membership at exact file level, logical game-object level, grouped summary level, or all three.
- **Unknown:** What vocabulary should be controlled across 2D sprites, models, animations, textures, audio, and fonts.
- **Unknown:** How model-produced facts will be reviewed, corrected, versioned, and re-evaluated when a source changes.
- **Unknown:** Whether catalog `provider:slug` IDs are intentionally separate locators from framework UUIDv7 asset IDs, and where conversion should occur during installation.
- **Unknown:** Whether production currently serves 1,453 or 1,466 records; only the current worktree and local generated output were inspected.
- **Unknown:** What pack-level semantic quality threshold would make enrichment demonstrably useful to humans and agents. A representative-query evaluation set does not yet exist.
