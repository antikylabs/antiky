# Current state and capability gaps

Research date: 2026-08-12

## Headline finding

This objective starts from two stronger foundations than [`idea.md`](../idea.md) assumes:

1. Antiky already has a substantial asset catalog. The current worktree contains 1,466 records,
   not only names. Every record has a description, tags, categories, rights context, provenance,
   and a preview. The real gap is visibility *inside* pack-level records and the uneven authority of
   current metadata.
2. BroMetal already has a shader library. Version 0.17.2 ships 30 complete compiled shaders, a
   sizeable typed `shader-functions` library, and agent-readable examples. The missing piece is not
   another pile of snippets. It is semantic context, honest integration recipes, evidence, and a
   path for promoting game-proven work to its correct owner.

These two problems are related because both need task-oriented discovery and claim provenance.
They are not the same catalog class. Media, code, materials, and multipass recipes have different
installation, compatibility, validation, and rights requirements.

## Evidence labels

- **Established** means verified in current repository source, generated data, accepted records, or
  a named primary external source.
- **Claimed** means asserted by a provider or project but not independently verified here.
- **Inferred** means a direction reasoned from established facts.
- **Gap** means the research could not establish the answer.

## Current asset library

### Established catalog baseline

Importing `CATALOG_ASSETS` from `packages/asset-catalog/src/catalog-data.ts` returns 1,466 records
across 17 provider IDs. The main distribution is:

| Provider | Records | Current unit |
| --- | ---: | --- |
| Poly Haven | 998 | Individual model, texture, or HDRI |
| Kenney | 212 | Pack |
| Quaternius | 82 | Pack |
| OpenDuelyst | 82 | Repository resource family |
| Screaming Brain Studios | 62 | Pack |
| KayKit | 17 | Pack |
| New handpicked providers | 13 | Pack or item page |

The current source has moved beyond the archived 1,453-record baseline by 13 handpicked records.
`docs/user-facing-docs/assets/catalog.md` still says 1,453 while the static-output test asserts
1,466. This is a documentation freshness defect, but more importantly it shows why query results
need a catalog revision rather than relying on prose totals.

The public `CatalogAsset` contract already includes name, description, kind, quality, a nullable
file count, formats, tags, categories, provider, upstream source, one preview, limited facts,
downloads, license, provenance, attribution, and verification. Current source coverage is:

| Field or evidence | Records | Coverage |
| --- | ---: | ---: |
| Non-empty description | 1,466 | 100% |
| Non-empty formats | 1,464 | 99.9% |
| Known `fileCount` | 457 | 31.2% |
| Non-empty `facts` | 995 | 67.9% |
| Non-null provenance source hash | 998 | 68.1% |
| Selected, hashed downloads | 3 | 0.2% |
| Locally hosted preview | 5 | 0.3% |

### Established pack-visibility failures

The schema has no pack members, logical asset groups, variants, animation clips, rigs, material or
texture roles, dimensions, scale, coordinate conventions, dependencies, or member-level previews.
Representative records show why one `fileCount` and one paragraph are inadequate:

- **Kenney Nature Kit** says 330 assets and has broad tree, rock, and foliage tags. It cannot say
  which trees or rocks exist, how they vary, or which files compose one useful game object. All 212
  Kenney descriptions use the same count-and-license template.
- **Quaternius Universal Animation Library** has `fileCount: 1`, while its prose claims 120+
  animations. It has no clip names, durations, root-motion facts, rig contract, or retarget proof.
- **KayKit Forest Nature Pack** describes 200+ unique and 1,500+ total models including recolors.
  Only 1,500 survives as `fileCount`, so unique objects and variants become indistinguishable.
- **OpenDuelyst Units Runtime** contains 1,392 PNG/PLIST files. Its crawler already reads exact Git
  paths and then collapses them into one resource-family count, format set, and preview.
- **Godot Skies** has `gdshader` format and shader categories but is typed as an HDRI because the
  media schema has no shader artifact class.

`fileCount` currently means published files, models, models including recolors, repository files,
or a provider's top-level item depending on the source. Comparing or sorting those values presents
different measurements as one measurement.

Taxonomy quality is also uneven. Fifty-nine of 82 Quaternius records contain at least one category
or tag longer than 50 characters, including concatenated values such as
`animationuniversalretargethumanoidlocomotion...`. The parser preserves hidden index text but splits
only on whitespace. Minimum tag-count tests cannot prove useful taxonomy.

### Inferred asset problem statement

The problem is not “generate descriptions for 1,466 blank records.” It is:

- preserve a pack as the coherent acquisition, rights, and discovery unit;
- expose a subordinate inventory of the logical things inside it;
- distinguish exact observations, provider claims, deterministic heuristics, model suggestions,
  and reviewed catalog assertions per field;
- make counts and compatibility statements say exactly what they measure; and
- retrieve a bounded useful subset without loading the whole catalog into agent context.

The current catalog's rights and static-delivery foundation should remain. Enrichment is a new
ingestion and evidence layer, not permission to weaken its admission rules.

## Current shader library

### Established BroMetal baseline

BroMetal 0.17.2 supplies:

- `brometal/shader-functions`, a typed function library whose dependencies are resolved and
  tree-shaken by the compiler;
- `brometal/shaders`, 30 precompiled full shader exports;
- `*.shader.ts` to typed `*.shader.gen.ts` compilation, including generated WGSL, interface records,
  layout offsets, locations, texture units, and binding information; and
- an examples package explicitly intended for people and coding agents to read.

The complete-shader export is semantically thin. Export names live in
`dist/shaders/index.d.ts`; title, intended use, texture requirements, and presentation are coded
separately in the example application. The example coerces heterogeneous shader interfaces through
an unsafe common type for display. This is a useful showcase, not a rich catalog contract.

### Established Antiky use today

Antiky Town imports 13 generated shader modules, but those modules are only one part of the effect.
Town also supplies:

- geometry and instance layouts;
- semantic texture roles and color-space policy;
- asset paths and material/default values;
- shadow, scene, and post targets and pass order;
- eight fixed practical-light slots;
- draw ordering and resource lifetime; and
- game-specific meanings such as camera distance packed in alpha.

The Antiky and pure BroMetal Town variants intentionally copy this renderer so they build
independently. Eight shader sources still match and five have diverged. That is evidence of a
reusable family and of copy drift. It is not an independent second use case that proves a stable
whole-renderer abstraction.

Repository tests supply valuable structural evidence: they recompile every shader, compare
development and production generated artifacts, check source/generated parity and imports, inspect
WGSL pipeline invariants, and enforce color/texture conventions. Those tests establish
reproducibility and selected contracts. They do not prove visual quality.

### Established ownership boundary

Accepted framework ADR 0021 assigns direct BroMetal ownership to an Antiky
`BroMetalRenderDriver`. Framework code outside that driver sends Antiky identities and semantic
render data, not GPU objects. A game may use BroMetal directly when the driver lacks the needed
capability, but then it owns the entire renderer path. Town currently takes that exception because
the general driver does not exist.

The in-progress rendering architecture proposes shader/material assets, explicit dependencies,
program slots, structured diagnostics, and last-good replacement. Its final driver, render graph,
layout compatibility, manifest coordination, and material interfaces remain open. Research cannot
treat those proposed types as an implemented API.

### Inferred shader problem statement

The useful goal is to connect several deliberately different reusable artifacts:

| Artifact | Meaning | Likely owner |
| --- | --- | --- |
| Shader function | Renderer-general typed GPU mathematics | BroMetal |
| Complete generic program | Ready-to-bind generic shader with a narrow host contract | BroMetal |
| Material or effect recipe | Semantic inputs, defaults, assets, render state, passes, and evidence | Antiky |
| Renderer capability | Repeatable resource/pass behavior needed by games | Antiky Framework driver, using BroMetal |
| Art-directed implementation | Tuned game composition with local assumptions | Game module |
| Discovery record | Search context, compatibility, rights, provenance, and evidence references | Static catalog surface |
| Agent workflow | How to select, adapt, compile, inspect, and evaluate | Skill, backed by real services |

The library should help a user or agent determine which of these it found. Calling every one a
“shader” hides the work needed to use it safely.

## Shared gaps, distinct contracts

Both libraries need stable catalog identities, source revisions, per-claim provenance, dependency
references, bounded retrieval, and evidence states. They can share a search envelope and website
experience.

They should not share one undifferentiated item schema:

- media is installed or transformed as data;
- shader source is code with compiler and runtime compatibility;
- materials combine source with semantic parameter and asset roles;
- multipass recipes include render targets, ordering, and host capabilities; and
- examples may contain separately licensed code, media, and previews.

The archived asset work already reached this conclusion for components, shaders, templates,
generators, and sample projects. The current `Godot Skies` misclassification is direct evidence
that tags cannot substitute for a separate artifact contract.

## Gaps that research did not close

- The intended inventory level: exact files, logical game objects, semantic groups, or all three.
- The controlled vocabularies needed across models, sprites, animation, textures, audio, and fonts.
- The mapping from public `provider:slug` catalog identities to UUIDv7 Framework `AssetId` values.
- Permission to retrieve and inspect archives for each provider.
- A measured quality, cost, and latency result for any proposed fast model.
- Final material, render graph, driver, and shader compatibility schemas.
- A truly independent second consumer for Town effects.
- The exact public/private boundary for shader source, generated artifacts, recipes, and previews.

## Raw evidence

- [`subagent_outputs/00-current-asset-catalog.md`](subagent_outputs/00-current-asset-catalog.md)
- [`subagent_outputs/01-current-brometal-shader-path.md`](subagent_outputs/01-current-brometal-shader-path.md)
