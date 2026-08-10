# Asset catalog acquisition roadmap

Research snapshot: 2026-08-09

## Outcome

Grow Antiky from a model-heavy list into a trusted game-building library: coherent 2D and 3D packs,
UI, VFX, audio, music, fonts, materials, environments, cultural/scientific source material, and a
separate lane for reusable components. Discovery remains metadata-first and bandwidth-light.

The detailed source decision table is in [`source-catalog.md`](source-catalog.md). The cited research
corpus and verification standard are indexed in [`research/README.md`](research/README.md).

## Baseline

The current generated catalog has 1,292 records:

- 998 Poly Haven records;
- 212 Kenney packs;
- 82 Quaternius packs;
- 464 models, 341 textures, 333 HDRIs, 143 sprites, 10 audio records, and 1 font.

The immediate problem is balance, not total count. Audio, fonts, UI, coherent sprite families,
characters, animation, VFX, and ready-to-use game kits are underrepresented.

## North-star collection shape

The next useful milestone is approximately 5,000 reviewed records, not an arbitrary million-link
index. The target mix is directional:

| Lane | Target | Why |
| --- | ---: | --- |
| 3D models and packs | 900–1,100 | Props, characters, rigs, animation, vegetation, modular worlds, and scientific objects. |
| Materials, textures, decals, terrain | 1,400–1,700 | Broad surface coverage from structured CC0 sources. |
| HDRIs | 450–600 | Enough scenario coverage without flooding results with near-duplicates. |
| 2D sprites, tiles, backgrounds, UI, VFX | 1,000–1,300 | Coherent art families that can produce complete games. |
| Audio, music, ambience, IRs | 400–650 | UI, movement, combat, environment, music, and specialist audio. |
| Fonts | 30–80 | A small high-quality CC0 shelf plus a separately labeled open-font lane. |
| Cultural/scientific curated records | 150–300 | Distinctive source material with stronger review and context. |

Pack-level records are preferred when the files form one coherent product. Do not inflate counts by
publishing every sprite frame, texture map, or glyph as an independent asset.

## Acquisition waves

### Wave 0 — verification infrastructure

Before adding another bulk source:

1. extend the schema with immutable license-evidence records, evidence scope, preview rights,
   ingestion decision, confidence, quarantine reasons, and last-reviewed time;
2. preserve provider metadata snapshots and produce deterministic, human-reviewable refresh diffs;
3. add source adapter contract tests for duplicate identity, canonical URLs, allowed licenses,
   preview policy, required tags, and changed/removed upstream records;
4. implement quarantine, correction, and takedown states without deleting historical evidence;
5. separate copyright/license status from technical verification and from non-copyright risk review.

Use the full framework in [`research/license-verification.md`](research/license-verification.md).

### Wave 1 — fix the catalog's largest game-development gaps

1. **Expand Kenney metadata** for its existing 212 packs: classify 2D/3D, sheet geometry, tile size,
   animation, vectors, source formats, audio categories, font families, and pack relationships.
2. **Expand Quaternius metadata** for animation, rigs, characters, vegetation, modularity, LODs, and
   engine formats.
3. **Ingest Screaming Brain Studios** at pack level after sampling archive/license consistency.
4. **Curate CC0 creator allowlists** for Ansimuz, 0x72, GrafxKid, Tallbeard/Abstraction, RavenTale,
   and other high-quality itch publishers; item evidence is mandatory.
5. **Import Game Assets for the People** after a complete 56-pack sample review.
6. **Create a CC0 font seed** from Kenney, reviewed OpenGameArt records, and Font Library's small
   CC0 subset.

Success gate: the first two result pages can supply coherent 2D, 3D, UI, audio, and font choices for
multiple game genres without relying on placeholder-quality one-offs.

### Wave 2 — structured breadth

1. implement the ambientCG API adapter for materials, decals, atlases, terrain, HDRIs, and selected
   models;
2. pilot the Open Source 3D Assets registry using a collection allowlist and upstream provenance;
3. audit FreeGameUI authorship and manifest/download behavior, then ingest category packs;
4. build family-level importers for OpenDuelyst and Glitch rather than one record per file;
5. sample Signature Sounds and a constrained Freesound CC0 API adapter;
6. contact TextureCan, 3DTextures.me, cgbookcase, and LazyTextures about feed, automation, and preview
   expectations before writing crawlers.

Success gate: every automated provider produces a deterministic snapshot, count-by-kind report,
evidence bundle, quarantine report, and zero unexplained license/identity changes.

### Wave 3 — distinctive curated material

1. add Smithsonian Open Access and Smithsonian 3D candidates with object-level CC0 and contextual
   review;
2. pilot Art Institute of Chicago and Cleveland Museum APIs for clearly public-domain records;
3. create specialist pipelines for NASA/NOAA/NPS science media and USGS/Natural Earth terrain;
4. curate KayKit, long-tail OpenGameArt CC0 records, Openclipart subsets, and public-domain nature
   audio based on actual game-building requests;
5. generate game-ready derived previews or terrain only from cleared inputs, recording every input,
   transformation, tool version, and output license basis.

Success gate: cultural, scientific, human, sacred, trademark-adjacent, and location-sensitive items
cannot publish without their required review flags and context.

### Wave 4 — components and agent-ready recipes

Launch a separate `component` catalog class:

1. pilot 35 CC0 Godot Shaders entries with locally rendered, cleared previews;
2. add code-only examples from Three.js, Phaser, and PlayCanvas, excluding bundled media unless
   separately cleared;
3. add Godot demo projects and procedural recipes based on FastNoiseLite and WaveFunctionCollapse;
4. preserve SPDX expressions, license/notice files, source commit, dependency closure, runtime and
   engine versions, build output, and render verification;
5. keep GPL/copy-left results behind an explicit filter and never label MIT/OFL/Apache code or fonts
   as CC0.

Success gate: an agent can install a pinned component with all required notices and reproduce its
build/render without hidden network or media dependencies.

## What we validate

### Source and rights

- The creator or authorized publisher made the declaration.
- The exact item/package, download, preview, metadata, and database scopes are known separately.
- CC0, Public Domain Mark, government public domain, OFL, and software licenses are not conflated.
- The catalog stores the canonical URL, evidence URL, captured statement, retrieval time, evidence
  digest, creator, publisher, stable upstream ID, and reviewer decision.
- Mixed-license providers are approved per record; filters and API fields are leads, not proof.

### Non-copyright risk

- Trademark, endorsement, privacy, publicity, moral rights, patent/design, cultural heritage, sacred
  objects, human remains, sensitive locations, and community protocols have explicit review fields.
- Museum/government/scientific records can remain quarantined even when the digital file is CC0 or
  public domain.

### Technical quality

- Archive paths are safe; declared formats match bytes; dimensions, duration, sample rate, glyphs,
  meshes, materials, rigs, animations, and dependencies parse successfully.
- Previews represent the downloadable work and are either separately cleared, provider-hosted under
  an approved policy, or generated locally from cleared inputs.
- Duplicates, empty assets, broken sheets, unsafe SVG, corrupt audio, missing textures, extreme
  geometry, executable payloads, and undeclared remote dependencies are rejected or quarantined.
- Technical verification states name what was tested. They never imply legal certainty.

## Bandwidth policy

- Crawl metadata only through official APIs/manifests when possible.
- Cache and use conditional requests, conservative provider limits, and a descriptive user agent.
- Never download full provider archives during routine discovery.
- Download a sample once when needed to validate an adapter or promote a high-value record.
- Mirror only selected assets when reliability or normalized delivery justifies the storage and all
  mirrored files have passed scope review.
- Do not hash third-party archives merely to make metadata look “verified.” Hash only exact bytes
  Antiky downloads, validates, installs, derives, or mirrors.

## Refresh and correction policy

Each refresh is a reviewable proposal, not automatic publication. Classify additions, removals,
metadata edits, license changes, creator changes, URL changes, preview changes, and binary changes.
License narrowing, lost evidence, owner disputes, or takedown requests immediately quarantine the
record and stop new Antiky distribution while preserving the audit trail.

## Concrete next implementation slices

1. Implement the evidence/quarantine schema and adapter contract-test harness.
2. Improve metadata for the 294 existing Kenney and Quaternius records.
3. Add ambientCG as the next structured provider.
4. Add one bounded 2D publisher (Screaming Brain) and one bounded audio/music publisher
   (Tallbeard/Abstraction).
5. Publish the first 10–25 CC0 font records.
6. Run the 100-record component pilot only after media and component schemas are visibly separate.

These slices maximize useful game-building coverage while preserving the catalog's core promise:
every record explains where it came from, what evidence supports its use, what Antiky actually
validated, and what remains the user's responsibility.
