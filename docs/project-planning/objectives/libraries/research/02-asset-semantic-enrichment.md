# Asset semantic enrichment directions

Research date: 2026-08-12

## Recommended direction

Keep pack-level catalog records, then add a subordinate content index built from layered evidence.
Lead with deterministic inventory and format inspection. Use models to propose human-facing
semantics after the evidence exists. Do not ask a model to recreate technical, membership, rights,
or compatibility facts that parsers and source records can establish.

This direction makes a useful distinction:

```text
pack record
  acquisition, publisher, rights, upstream revision, summary
      |
      +-> exact file manifest
      |     paths, hashes, formats, dimensions, parser results, dependencies
      |
      +-> logical content inventory
      |     tree-01, rock-large-03, knight rig, run-forward clip, UI panel family
      |
      `-> semantic annotations
            subject, style, mood, likely use, search aliases, visible condition
```

The first layer answers “which bytes and files exist?” The second answers “which useful things do
those files compose?” The third answers “how might a person search for and use them?” A single flat
list of file names or generated tags cannot answer all three questions.

## Three alternative designs

### A. Model-only pack summaries

Give a fast multimodal model the provider page and previews, then replace or augment descriptions
and tags.

**Strength:** It is cheap to prototype and may improve broad visual search quickly.

**Weakness:** It cannot see all pack members from one preview; it cannot prove membership,
technical characteristics, rights, dependencies, or compatibility; and it creates confident text
without an evidence model. This direction would improve prose while leaving the stated “what is in
the pack?” problem unresolved.

### B. File manifest only

Download or obtain the archive and publish exact paths, detected formats, hashes, and technical
metadata.

**Strength:** Reproducible, auditable, and useful for installation and tool compatibility.

**Weakness:** A 1,392-file sprite tree is not a semantic answer. Paths are provider-specific;
filenames can be misleading; one game object can require several files; and variant families are
hard to perceive in a flat list.

### C. Layered inventory and semantic claims

Keep exact technical evidence, derive logical groups, and add separately sourced semantic claims.

**Strength:** It answers both machine and human questions without asking generated prose to act as
truth. It also supports correction: one annotation can be rejected without invalidating an archive
hash or provider claim.

**Cost:** It requires a claim-level schema, safe inspection, representative evaluation, and an
explicit review policy.

**Inference:** C is the strongest design. A and B remain useful stages inside it, not complete
solutions.

## What deterministic inspection can establish

### Containers and member identity

ZIP central directories expose paths, compression, sizes, and CRC values. Safe inspection can add
cryptographic package and member hashes, normalized paths, detected media types, duplicates,
encrypted/unreadable entries, nested archives, traversal attempts, expansion ratios, manifests,
licenses, readmes, and dependency files.

A CRC is corruption evidence, not durable content identity. Filenames and directory position are
observations; any semantic role derived from them is a heuristic with a named rule.

### Models and scenes

The [glTF 2.0.1 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
deterministically exposes hierarchy, meshes, primitives, accessors, attributes, materials,
textures, images, samplers, skins, animations, cameras, extensions, and internal dependencies. A
tool can calculate counts, bounds, durations, joint and morph data, texture use, scene variants, and
external resource edges when it can read the necessary buffers.

The [Khronos validator](https://github.com/KhronosGroup/glTF-Validator) produces structured issues
and statistics. Its success means a file conforms within its supported validation scope. It does
not mean the scale is appropriate, an animation retargets to Antiky, or the art is good.

Embedded XMP, generator, copyright, and author names are source assertions. Preserve them with
their embedded origin rather than promoting them to verified catalog truth.

### Images and texture containers

[PNG](https://www.w3.org/TR/png-3/),
[OpenEXR](https://openexr.com/en/latest/TechnicalIntroduction.html), and
[KTX 2](https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html) expose dimensions, channels,
alpha, color metadata, layers, faces, mip levels, compression, and other typed facts.
[OpenImageIO](https://openimageio.readthedocs.io/en/latest/oiiotool.html) can report metadata,
channel statistics, non-finite pixels, constant images, and decoded-pixel hashes.

Native color metadata and effective use are different. For example, glTF assigns a color/data role
through the material texture slot. Preserve both rather than letting a filename such as `_normal`
decide the truth.

### Source formats and previews

Headless tools can inspect richer source formats and render canonical views, but these operations
must treat downloads as hostile. A worker should have bounded CPU, memory, file count, and output;
networking and auto-execution disabled; no secrets or project workspace; safe extraction; and
explicit parser/tool versions.

A canonical preview is evidence that one named renderer, camera, lighting setup, and revision
produced those pixels. It is not proof of Antiky compatibility or artistic suitability.

## What model assistance is good for

Models can propose:

- concise descriptions of visible subject and condition;
- subject, style, era, mood, biome, palette, and visual-complexity tags;
- controlled-vocabulary mappings and search synonyms;
- likely game uses and related semantic groups;
- human-friendly pack summaries derived from item records; and
- anomalies or grouping corrections for review.

Models must not be authoritative for:

- source, author, license, attribution, or permission;
- exact membership, hashes, counts, dimensions, scale, topology, rigging, or animation presence;
- dependency completeness, security, or malware state;
- renderer/engine compatibility and functional correctness; or
- “production ready,” visual equivalence, or legal interchangeability claims.

A fast model is a replaceable pipeline component, not an architecture choice. Codex Spark,
Cerebras-hosted models, Luna, or any later candidate should be evaluated against the same frozen
input set and acceptance contract. Model reputation and benchmark speed do not answer whether its
tags improve Antiky retrieval without unsupported claims.

## Claim-level evidence model

Each semantic or technical field needs an authority class. A useful initial vocabulary is:

| Authority | Meaning |
| --- | --- |
| `observed` | A named parser or tool read the bytes and produced this result |
| `provider_asserted` | The authoritative provider published this value |
| `embedded_asserted` | The source file contains this metadata |
| `rule_inferred` | A deterministic named heuristic inferred it from paths or fields |
| `model_suggested` | A named model proposed it from referenced evidence |
| `human_verified` | A reviewer accepted or corrected the claim for catalog use |

An individual claim should retain:

- the asset, pack, member, or group it describes;
- the value and vocabulary/schema version;
- authority class and evidence references;
- package/file hashes or provider response revision;
- extractor, rule, or model identity and version;
- configuration or prompt-template revision;
- creation time and review state; and
- supersession, correction, or invalidation history.

Do not use probabilistic confidence for exact parsed facts. Record coverage, diagnostics, and
unsupported state. Model self-confidence is not evidence; a numerical confidence threshold is
meaningful only after field-specific calibration on Antiky's evaluation set.

Negative claims require complete positive coverage. “No animations” is only supportable when the
relevant members were readable and the inspector supports those formats. Otherwise the value is
unknown.

## Logical inventory shape

The research supports three related subordinate records rather than thousands of top-level assets:

### Member

One exact archive or repository member: normalized path, size, hash, detected format, parser state,
technical facts, embedded assertions, and dependency edges.

### Content item

One usable object or behavior assembled from members: a model and its textures, a sprite animation
sequence, an audio loop, a font family, or an animation clip. It can reference variants and common
dependencies without pretending each map or frame is a separate catalog product.

### Group

A bounded semantic family inside the pack: trees, large rocks, locomotion clips, character heads,
inventory icons, or ambient loops. Groups make large packs browsable and give summaries stable
units even when exact filenames are verbose.

**Gap:** The owner still needs to choose whether the first useful product must expose exact members,
logical content items, groups, or all three. The research supports all three as separate levels,
but does not prove they all need to ship together.

## Count semantics

Replace one ambiguous count with named measurements. Candidate measurements include:

- published file count;
- observed member count;
- logical content-item count;
- unique base-object count;
- variant or recolor count;
- animation clip count;
- group count; and
- unclassified or unsupported member count.

Every count states whether it is exact, lower-bound, provider-claimed, observed, or inferred. A UI
can still show one useful summary, but the underlying meaning remains inspectable.

## Static delivery and context size

Do not embed every member in the current top-level catalog JSON. The current 1,466-record result is
already about 2.48 MB. Preserve:

- a compact top-level search projection;
- one exact pack record;
- one bounded inventory/group summary per pack; and
- member or evidence documents fetched only when needed.

This keeps the static-first architecture. Static JSON can support bounded indexes, sharded records,
and content-addressed evidence without introducing a server or database.

## Evaluation before model selection

Build a frozen, versioned gold set stratified by provider, pack size, format, content class, style,
language, and known failure mode. Use independent annotation and keep ambiguous and not-answerable
labels.

Measure the layers separately:

| Layer | Useful measures |
| --- | --- |
| Exact inventory | Member precision/recall, hash/size exactness, unsupported/error rate, repeated-run reproducibility |
| Grouping | Logical-item and dependency-edge precision/recall, variant-family accuracy |
| Technical facts | Exact match, numeric error, and false negatives for alpha, animation, LOD, rig, and dependencies |
| Tags | Per-tag precision/recall/F1, rare-tag macro score, publication precision, abstention coverage |
| Descriptions | Supported-claim precision, unsupported-claim and contradiction rates, omissions, reviewer usefulness |
| Retrieval | Recall@k, nDCG/MRR, hard-filter precision, scoped no-result accuracy, task completion |
| Operations | Cost per accepted item, reviewer time, quarantine rate, drift after tool/model changes |

Compare names-only, current provider metadata, deterministic enrichment, and
deterministic-plus-model enrichment. That comparison proves whether a model improves the user's
actual search problem.

Include misleading filenames, embedded instructions, corrupt and mismatched files, archive bombs,
external dependencies, duplicate names, multi-object source files, hidden objects, non-English
metadata, blank textures, and incomplete previews. Treat all retrieved text and media as data, not
instructions to the agent or model.

## Where to begin learning, not implementation sequencing

The current evidence suggests high-information research samples:

- **OpenDuelyst**, because the existing crawler already sees exact paths that are discarded;
- **Kenney Nature Kit**, because generic prose and a large count expose the semantic grouping
  problem clearly;
- **Quaternius Universal Animation Library**, because clip, rig, and compatibility semantics differ
  from ordinary model inventory; and
- **KayKit Forest Nature Pack**, because provider prose already distinguishes unique items from
  variants.

These are not approvals to download archives. Provider access terms and automation permission must
be rechecked for the exact proposed action. Metadata access, archive retrieval, inspection,
previewing, and mirroring remain separate permissions.

## Gaps and owner decisions

- Which subordinate inventory levels are required for the first useful outcome?
- Which semantic fields may publish automatically, which need sampling, and which need per-item
  review?
- What precision/recall and unsupported-claim thresholds are acceptable?
- Which provider and pack may be retrieved for an evaluation corpus?
- What canonical preview recipe and renderer are acceptable evidence?
- Which controlled vocabularies should be shared and which stay type-specific?
- How should a public catalog ID map to a project-owned asset after installation?

## Raw evidence and primary sources

- [`subagent_outputs/02-semantic-asset-enrichment.md`](subagent_outputs/02-semantic-asset-enrichment.md)
- [Khronos glTF 2.0.1](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator)
- [W3C PNG Third Edition](https://www.w3.org/TR/png-3/)
- [OpenEXR technical introduction](https://openexr.com/en/latest/TechnicalIntroduction.html)
- [KTX 2.0.4](https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html)
- [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
