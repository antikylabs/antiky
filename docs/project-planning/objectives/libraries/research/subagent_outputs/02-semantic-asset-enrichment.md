# Research line C — Semantic asset enrichment methods

Research date: 2026-08-12  
Scope: External primary-source research only. No files changed.

## Headline conclusion

**Inference:** Use a layered evidence pipeline, not a model-first cataloging job.

1. Preserve provider and package evidence.
2. Extract file and format facts deterministically.
3. Validate and, where necessary, render files in a controlled environment.
4. Give models only the resulting evidence and canonical previews.
5. Store model output as proposed semantic annotations, not catalog facts.
6. Publish or promote annotations only under field-specific evaluation and review rules.

This split directly addresses the pack-visibility problem. Deterministic inspection can establish what files and technical assets a pack contains. Multimodal and language models add value for human-facing descriptions, visual taxonomy, search synonyms, and likely-use suggestions, but they cannot establish rights, exact dimensions, dependency completeness, compatibility, or functional correctness.

## Established findings

### 1. glTF exposes a substantial deterministic technical inventory

The glTF 2.0.1 specification defines arrays and references for scenes, nodes, meshes, primitives, accessors, materials, textures, images, samplers, skins, animations, and cameras. It also defines meters as the linear unit, a right-handed coordinate system, accessor bounds, typed vertex attributes, and explicit internal references. This makes the following deterministically extractable:

- scene and object hierarchy;
- mesh, primitive, vertex, and index counts;
- topology modes and attribute sets;
- local and transformed bounds, if buffer data and node transforms are evaluated;
- material parameters and texture roles;
- external and embedded resource dependencies;
- animation channel, duration, skin, joint, and morph-target counts;
- cameras, punctual lights, used/required extensions, and author-provided names;
- generator and copyright strings when present.

Names are explicitly optional and not guaranteed unique, so they are labels, not identities. The specification also says glTF is a runtime delivery format and deliberately does not preserve all authoring information. [Khronos glTF 2.0.1 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)

The official validator checks schema properties and types, reference compatibility, buffer values, accessor bounds, animation data, images, and supported extensions, and emits JSON issues and asset statistics. Validation results are deterministic evidence of conformance, not proof of semantic usefulness or visual correctness. [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator)

`KHR_materials_variants` defines named, finite material variants and their primitive-to-material mappings. Those variant names and mappings should be preserved rather than guessed from screenshots. [KHR_materials_variants](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_variants/README.md)

`KHR_xmp_json_ld` is ratified and can attach XMP packets containing attribution, licensing, creation date, title, description, subject, source, and related fields to the whole asset or to scenes, nodes, meshes, materials, images, and animations. The specification says the metadata has no normative effect on rendering. Therefore it is an embedded source assertion, not independently verified truth. [KHR_xmp_json_ld](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_xmp_json_ld/README.md)

As of 2026-08-12, `KHR_xmp_json_ld` and `KHR_materials_variants` are in the Khronos ratified extension list. [Current glTF extension registry](https://github.com/KhronosGroup/glTF/blob/main/extensions/README.md)

### 2. Image and texture facts are inspectable without a vision model

The PNG Third Edition Recommendation, dated 2025-06-24, defines deterministic fields for dimensions, bit depth, color type, alpha support, color-space chunks, physical pixel dimensions, textual metadata, Exif, and animation frames. It also defines CRCs for chunk-corruption detection. [W3C PNG Third Edition](https://www.w3.org/TR/png-3/)

OpenEXR exposes channels, channel types and sampling, data and display windows, parts, views, levels, compression, and arbitrary typed header attributes. This can distinguish RGB(A), depth, motion-vector, multipart, tiled, and environment-map-like files without inferring from filenames. [OpenEXR technical introduction](https://openexr.com/en/latest/TechnicalIntroduction.html)

KTX 2.0.4, dated 2025-02-20, defines pixel dimensions, depth, layers, faces, mip levels, compression/supercompression, a Data Format Descriptor, and key/value metadata. These fields support deterministic identification of cubemaps, arrays, mip availability, pixel representation, and texture orientation. Arbitrary KTX key/value entries remain claims by their writer. [KTX 2.0.4 specification](https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html)

OpenImageIO 3.2 documentation shows that `oiiotool` can report format, resolution, type, full metadata, subimages and mip levels, per-channel statistics, non-finite values, constant/black images, and a pixel hash. These outputs can support texture inventory and anomaly checks. A pixel hash is useful for decoded-pixel equivalence; a separate cryptographic file hash is still needed for artifact identity. [OpenImageIO `oiiotool`](https://openimageio.readthedocs.io/en/latest/oiiotool.html)

**Important glTF distinction:** the glTF specification says embedded PNG/JPEG color-space metadata is ignored for glTF rendering and the effective encoding comes from the glTF use site. Record both native image metadata and effective glTF texture usage rather than collapsing them.

### 3. Source files can be inspected deterministically, but require isolation

Blender’s Python API exposes mesh vertices, polygons, loops, UV layers, attributes, materials, and other datablocks. Blender can run headlessly and has a `--disable-autoexec` option for drivers and startup scripts. This supports controlled inspection of `.blend` contents and deterministic preview generation. [Blender Mesh API](https://docs.blender.org/api/5.0/bpy.types.Mesh.html), [Blender command-line options](https://docs.blender.org/manual/en/3.6/advanced/command_line/arguments.html)

**Inference:** treat all downloaded source files as hostile inputs. Parse or render them in a resource-limited worker with networking disabled, scripts/auto-execution disabled, extraction limits, and no access to the project workspace. A preview renderer is evidence of what a specified renderer produced; it is not proof that the asset will work in Antiky.

### 4. Pack/container inventory is strong evidence, but filenames are weak semantics

The ZIP specification defines central-directory records containing member names, compression method, CRC-32, compressed size, and uncompressed size. ZIP CRC-32 supplies corruption detection, not durable cryptographic identity. [PKWARE ZIP 6.3.10 specification, 2022-11-01](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

A safe deterministic package pass can therefore record:

- package SHA-256 and per-member SHA-256;
- normalized member path, media type/signature, size, and compression;
- duplicate content and duplicate normalized paths;
- encrypted, unreadable, truncated, nested, or suspicious members;
- manifests, readmes, licenses, previews, source files, models, textures, audio, and unsupported files;
- dependency edges discovered from glTF, material/source files, or provider manifests.

Media type should be identified from signatures and parsers and then mapped to registered IANA types where possible, not accepted from extensions alone. IANA registers `model/gltf+json` and `model/gltf-binary`. [IANA media-type registry, updated 2026-07-22](https://www.iana.org/assignments/media-types/media-types.xhtml)

**Inference:** directory layout and filename tokens can deterministically produce a *rule result*, but not a fact about semantic identity. For example, `oak_tree_LOD2.fbx` supports a filename-derived candidate role; it does not prove that the model is an oak, that `LOD2` belongs to a complete LOD family, or that a neighboring texture is its normal map.

### 5. Provider metadata is valuable, but its authority is scoped

As of 2026-08-12, the official Poly Haven API contract exposes names, descriptions, hierarchical categories, tags, structured attributes, authors, dimensions, polycount, texture resolution, LOD availability, file URLs, hashes, sizes, and dependencies. Its API page was materially updated on 2026-07-18 and says the live service may change. [Poly Haven API](https://polyhaven.com/our-api), [official API repository](https://github.com/Poly-Haven/Public-API)

The Sketchfab Data API exposes provider records such as name, description, tags, categories, license, creator, vertex/face/material/texture/animation counts, thumbnails, and archive variants. [Sketchfab Data API v3](https://docs.sketchfab.com/data-api/v3/index.html)

Store these as `provider_asserted` fields with provider, endpoint, provider ID, retrieval time, raw-response hash, and contract/version information. Do not silently convert them into locally observed facts. Compare provider hashes and counts with downloaded contents and preserve contradictions.

### 6. Signed provenance authenticates attribution, not semantic correctness

C2PA 2.4, released April 2026, defines signed claims, assertions, ingredient relationships, content bindings, and validation results. It explicitly says validation should establish that assertions are associated with the asset, correctly formed, and untampered—not judge them “good” or “bad.” [C2PA 2.4 specification](https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html)

Therefore:

- a verified signature strengthens provenance and integrity;
- it does not prove a title, license assertion, model-generated description, or category is factually correct;
- absent or unknown provenance must remain a recorded state, not be replaced with a model guess.

### 7. Generative output requires explicit evaluation and review

NIST defines generative-AI confabulation as confidently presented false or erroneous content and notes that indirect prompt injection can arrive through retrieved data. It recommends documented test plans, empirically validated capability claims, provenance tracking, production monitoring, and additional human review where warranted. [NIST AI 600-1, July 2024](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)

The NIST AI RMF calls for documented test sets, metrics, tools, uncertainty, operating limits, independent/domain review, and monitoring under deployment-like conditions. [NIST AI RMF Measure guidance](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

Model cards recommend documenting intended use, out-of-scope use, evaluation procedures, conditions, and performance breakdowns. [Google Research: Model Cards for Model Reporting, 2019](https://research.google/pubs/model-cards-for-model-reporting/)

## Deterministic and model-assisted stages

| Stage | Output | Authority |
| --- | --- | --- |
| Package admission | Source URL/ID, retrieval time, raw provider response, package hash, license evidence | Provider claim plus locally observed bytes |
| Safe container scan | Exact member inventory, sizes, hashes, signatures, suspicious paths, extraction errors | Deterministic observation |
| Format inspection | Geometry/material/animation/image/texture counts, bounds, channels, variants, dependencies, embedded metadata | Deterministic observation or embedded claim, separately typed |
| Validation | Parser/validator version, errors, warnings, unsupported features | Deterministic tool result |
| Canonical preview | Fixed renderer/camera/light outputs with render config and hashes | Reproducible visual evidence |
| Candidate grouping | Filename/path-derived asset groups and file roles | Deterministic heuristic; must retain rule and evidence |
| Model enrichment | Description, subject/style/theme tags, search aliases, likely use, visible condition, suggested group corrections | Model suggestion only |
| Review/promotion | Accepted/rejected/corrected claims with reviewer and rationale | Human-curated catalog assertion |
| Publication | Pack summary computed from accepted item records; unresolved members remain visible | Derived catalog view |

Models add the most value for:

- concise visual descriptions;
- semantic tags that pixels and headers do not contain;
- style, era, mood, condition, color, and subject vocabulary;
- synonym expansion and user-query alignment;
- pack summaries derived from item-level records;
- detecting candidate anomalies for human review.

Models must not be authoritative for:

- license, author, attribution, or source;
- exact pack membership or file identity;
- dimensions, scale, polycount, channel semantics, rigging, or animation presence;
- dependency completeness;
- security or malware status;
- engine compatibility, render correctness, or “production ready” claims;
- whether visually similar files are legally or technically interchangeable.

## Confidence, provenance, and review controls

**Inference/recommendation:**

- Store provenance per claim, not once per asset: source class, evidence references, file/package hashes, extractor or model ID, tool/model version, configuration or prompt version, timestamp, and transformation rule.
- Separate `observed`, `provider_asserted`, `embedded_asserted`, `rule_inferred`, `model_suggested`, and `human_verified`.
- Do not assign probabilistic “confidence” to exact parsed facts. Record parser coverage, validation status, and errors.
- Treat model self-reported confidence as non-evidence. Any numerical model confidence should come from measured, field-specific performance on Antiky’s evaluation set.
- Require positive evidence for negative claims. “No animation” is valid only when the relevant files were fully readable and the extractor supports their format.
- Preserve conflicting claims instead of applying silent precedence.
- Never let generated text overwrite provider, license, or deterministic fields.
- Model outputs should cite evidence IDs, use a controlled tag vocabulary where possible, and be able to abstain.
- Quarantine malformed, encrypted, unsupported, externally dependent, or contradictory packs.
- Treat filenames, embedded descriptions, and text in images/models as untrusted data, not instructions to the enrichment model.
- Keep cryptographic hashes for identity. Use perceptual or embedding similarity only for candidate duplicate/search grouping.
- Record reviewer overrides and feed adjudicated examples into evaluation, not directly into model training or catalog truth.

## Evaluation outline

Create a frozen, versioned gold set stratified by provider, pack size, format, asset class, rendering style, language, and known failure mode. Have two reviewers independently annotate item boundaries, technical roles, semantic tags, and claim support; adjudicate disagreements and retain “ambiguous” and “not answerable” labels.

Measure each layer separately:

- **Inventory:** member precision/recall, exact hashes/sizes, asset-group accuracy, dependency-edge accuracy, unsupported/error rate, and reproducibility across repeated runs.
- **Technical metadata:** exact-match counts and categorical fields; numeric error for bounds/dimensions; false negative rate for animation, alpha, LOD, and dependency detection.
- **Tags:** per-tag precision/recall/F1, macro scores for rare tags, precision at the published cutoff, and abstention coverage.
- **Descriptions:** claim-level supported-fact precision, unsupported-claim rate, contradiction rate against deterministic evidence, omission rate, and reviewer usefulness.
- **Retrieval value:** compare names-only, provider metadata, deterministic enrichment, and deterministic-plus-model enrichment using Recall@k, nDCG/MRR, and task completion for representative queries.
- **Operations:** cost per accepted item, review time, failure/quarantine rate, and result drift after model/parser changes.

Include adversarial cases: misleading filenames, instructions embedded in text or images, archive traversal and expansion bombs, corrupted/truncated files, mismatched extensions, unresolved external URIs, duplicate names, multiple assets in one source file, hidden objects, non-English metadata, visually blank/constant textures, and previews that omit pack members.

Version each enrichment model’s intended use, prompt, input construction, model/provider version, gold-set results, known limitations, and retirement criteria. Run candidate model changes in shadow mode against the same frozen set before updating catalog annotations.

## Explicit gaps and claims

- **Gap:** No Antiky pack sample was evaluated in this external research. Field availability and failure rates must be measured against the real catalog.
- **Gap:** No candidate model has been shown to meet Antiky’s quality, latency, or cost requirements. Vendor/model choice remains unverified until the gold-set evaluation exists.
- **Gap:** Acceptance thresholds and which model-derived fields, if any, may be published without per-item human review require owner risk decisions.
- **Gap:** Tool coverage for proprietary source formats and whether headless inspection is permitted by each provider’s license/terms require format- and provider-specific review.
- **Gap:** Canonical renderer, camera policy, lighting policy, and preview count are not established. Without them, visual evaluation is not reproducible.
- **Gap:** The 3D Tiles specification describes `EXT_structural_metadata`, but it is not listed in the current Khronos glTF ratified, in-progress, or multi-vendor extension registry as of 2026-08-12. Its appropriate status for ordinary asset packs is therefore unresolved and should not be assumed. [3D Tiles metadata reference](https://github.com/CesiumGS/3d-tiles/blob/main/specification/Metadata/Semantics/README.adoc), [Khronos glTF extension registry](https://github.com/KhronosGroup/glTF/blob/main/extensions/README.md)
- **Claim, unverified:** Fast multimodal models will materially improve pack search at acceptable cost. This is plausible but requires the retrieval and claim-precision evaluation above.
- **Inference:** The smallest safe first slice is item-level deterministic manifests plus clearly labeled model-suggested descriptions and tags; bulk automatic promotion of semantic output is not justified by current evidence.
