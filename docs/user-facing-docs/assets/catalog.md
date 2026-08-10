# Find and use game assets

The Antiky asset library helps you find game-ready models, textures, and HDRIs without asking an
agent to search the general web. Each record keeps its source, creator, license, tags, formats, and
available file information together so you can decide whether it fits your game.

Open this search to find forest models:

<https://antikylabs.com/assets?q=forest&type=model>

The library currently contains 1,453 CC0 records. Search results show the provider, asset type,
quality tier, published file count when the provider supplies one, formats, tags, and catalog
status. Select an asset to see its permanent page and complete JSON record.

The default view uses a stable featured shuffle rather than alphabetical ordering. Kenney and
Quaternius are weighted toward the first pages, with 2D and 3D work mixed together. Filter by search
text, type, 2D or 3D, source, format, quality, or verification status. Sort the result using the
featured shuffle, quality, name, published file count, or catalog recency. Every selection is
encoded in the URL so it can be shared with another person or agent.

## Understand the supported sources

| Source | Current records | Asset types | How records enter the library |
| --- | ---: | --- | --- |
| Poly Haven | 998 | Models, textures, HDRIs | A reproducible snapshot reads the provider metadata API. Three starter records also contain selected install-verified files. |
| Kenney | 212 packs | 2D art, models, textures, audio, fonts | A reproducible crawler reads every pack currently exposed by the official 14-page asset index, then validates each source page's CC0 license and metadata. |
| Quaternius | 82 packs | Low-poly models, characters, animations, environments | A reproducible crawler reads every pack currently exposed by the official index and validates each pack page's CC0 license and metadata. |
| KayKit | 17 packs | Low-poly models, modular environments, characters, animations | The catalog reads every individual pack in Kay Lousberg's official index, validates CC0 on each pack page, and excludes the duplicate complete-collection bundle. |
| OpenDuelyst | 82 resource families / 9,438 files | Pixel units, animation, UI, cards, effects, maps, audio | A complete Git tree snapshot groups both runtime and original resource trees into useful families; every covered repository file belongs to exactly one family. |
| Screaming Brain Studios | 62 packs | Sprites, tiles, textures, UI, board-game art | The official creator index supplies collection-wide CC0 evidence and all public asset packs; five software utilities are deliberately excluded. |

Antiky does not copy complete provider archives during ordinary cataloging. The metadata snapshot
does not download a Poly Haven asset file, Kenney ZIP, or Quaternius ZIP. Provider-hosted previews
may load from their original CDN; selected editorial previews are stored with the site.

Quality is a discovery ranking, separate from verification and licensing. Lower is better: Kenney
and Quaternius are tier 0, KayKit and Poly Haven tier 1, OpenDuelyst tier 2, and Screaming Brain
Studios tier 3. It helps order results; it does not claim every item in a source fits every project.

## Read catalog status accurately

The status describes which checks Antiky has performed. It is not a rating of the artwork.

| Status | What Antiky checked | What it does not promise |
| --- | --- | --- |
| **Cataloged metadata** | A source page, license, preview, and descriptive metadata are recorded. | Antiky has not inspected or hashed the downloadable archive. |
| **Source metadata verified** | The record came from an authoritative provider API or official source page and passed catalog validation. | Individual download files are not ready for verified installation. |
| **Install verified** | Selected download URLs include byte sizes and hashes that the installer checks. | Other resolutions or formats not listed in the record are not verified. |

A provider may not publish a meaningful file count for one asset because it offers several
resolutions and formats. Those records say **File count not published** instead of inventing a
number. A curated pack can show its published source count even when its archive is not
install-verified.

## Install an install-verified asset

Run the asset command with a catalog identity and an Antiky project:

```sh
antiky asset install poly-haven:forest-floor --project path/to/harbor-lights.antiky
```

The command accepts only **Install verified** records. It downloads the selected files, checks their
recorded sizes and hashes, writes them under `assets/<provider>/<asset>/`, and updates
`assets/antiky-assets.json`. A cataloged or source-metadata-verified record remains useful for
discovery, but you download it from the original provider until Antiky adds an install-verified
selection.

See [Create and open an Antiky project](../studio/projects.md) for the project and provenance
registry workflow.

## Search from Studio or an agent

The asset site is generated statically with the rest of `antikylabs.com`. Search and filtering run
in your browser; they do not call an Antiky server. Agents can start with the concise site index:

```text
/llms.txt
```

Use the complete context file when the agent needs all public product docs, API reference pages,
and asset summaries together:

```text
/llms-full.txt
```

The catalog API is a set of versioned static JSON files generated during deployment. It has no
request-time database, crawler, or server function. Browser applications and agents can read its
version index and complete catalog directly:

```text
https://catalog-api.antikylabs.com/v1/
https://catalog-api.antikylabs.com/v1/catalog.json
```

Version 1 includes:

- `totalCatalogAssets` and the complete `assets` collection;
- names, descriptions, tags, categories, formats, and published facts;
- a numeric `quality` tier from 0 (best) through 5;
- provider, upstream ID, permanent source URL, and retrieval time;
- CC0 license terms and attribution guidance;
- preview source and whether the provider or Antiky hosts it;
- catalog status and selected downloads when they are install-verified.

Open one durable human-readable record with its provider and slug:

```text
/assets/poly-haven/forest-floor
```

Or read the corresponding static JSON record:

```text
https://catalog-api.antikylabs.com/v1/assets/poly-haven/forest-floor.json
```

An agent should use `llms.txt` for discovery, inspect the static catalog JSON or a permanent asset page, and
install only when the status is `install-verified`. For other records, it should send you to the
original source rather than claim that Antiky verified downloadable bytes.

## Check licensing and provenance

The current public catalog is CC0-first. CC0 permits commercial use, redistribution, and
modification without required creator attribution. Provider API or site attribution can still apply
to how Antiky presents the record, and credit is often appreciated.

Keep `assets/antiky-assets.json` with your project when you use the Antiky installer. For manual
downloads, keep the asset's permanent catalog URL and original provider URL with your project notes.
The catalog gives you useful licensing evidence, but you remain responsible for checking whether a
specific use introduces trademarks, recognizable people, privacy, or other rights beyond copyright.
