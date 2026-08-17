# Libraries research plan

Research date: 2026-08-12

This objective is ready for research. The owner supplied substantive intent in the legacy
[`idea.md`](../idea.md) file, and the folder did not contain prior research or plan documents when
this work started. This phase will produce findings only. It will not select an implementation plan
or create executable goals.

## Questions

1. What semantic information is missing from the shipped asset catalog, especially inside
   pack-level records, and which missing information would materially improve discovery or use?
2. Where can deterministic extraction supply that information, where can model-assisted analysis
   help, and what evidence, confidence, review, and evaluation controls would make enrichment safe?
3. What is the smallest useful reusable shader artifact in the BroMetal and Antiky stack: source,
   typed module, material, recipe, example, render feature, or a combination of these?
4. Which parts of a shader library belong to BroMetal, Antiky Framework, Antiky Studio, the asset
   catalog, a game module, or an agent skill under the accepted ownership boundaries?
5. What metadata and evidence would let a human or agent find, understand, adapt, validate, and
   correctly attribute a shader without treating screenshots or prose as proof that it works?
6. Which delivery surface should lead for each library use case: static JSON and documentation,
   local package APIs, project-local installation, Studio inspection, MCP tools, or skills?
7. What can Antiky reuse from current asset metadata systems, shader/example libraries, and
   agent-retrieval practices without importing their engine assumptions or premature abstraction?
8. Which decisions need the owner before a later plan can be responsible and well bounded?

## Why each question matters

1. It distinguishes a useful enrichment objective from a broad recataloging exercise and defines a
   measurable user problem.
2. It determines whether a fast model is a viable pipeline stage instead of an unreviewable source
   of catalog facts.
3. It prevents a shallow collection of code snippets whose dependencies and integration contract
   remain hidden.
4. It prevents the library from bypassing the RenderDriver or moving game meaning into BroMetal.
5. It defines the semantic contract that makes the library usable by agents and maintainable by
   people.
6. It keeps the common path simple and prevents an MCP service from existing only because agents
   are expected to use the data.
7. It supplies concrete alternative designs and exposes assumptions already tested elsewhere.
8. It keeps product choices with the owner and makes the next planning phase executable without
   guesswork.

## Lines of inquiry

### A. Current asset catalog and pack visibility

- Scope: Inspect the current catalog schema, generated records, source clients, documentation, and
  archived objective summary. Quantify present metadata, pack granularity, and representative gaps.
- Sources: `packages/asset-catalog/`, `docs/user-facing-docs/assets/`, relevant tests, generated
  snapshots, and `docs/project-planning/objectives/_archives/2026-08-10-asset-catalog-summary.md`.
- Return: Findings with file or command evidence, a gap matrix, representative examples, and
  explicit unknowns. Do not change files.

### B. Current BroMetal shader and Antiky render path

- Scope: Trace how source shaders become typed BroMetal programs and how Town code binds and uses
  them. Identify reusable seams, project-local assumptions, and ownership constraints.
- Sources: installed BroMetal source and documentation, Town shader modules and generation scripts,
  render-related ADRs and architecture, shader tests, and the existing shader-authoring skill.
- Return: Findings with exact code evidence, an artifact/dependency map, at least two possible
  library boundaries, risks, and explicit unknowns. Do not change files.

### C. Semantic asset enrichment methods

- Scope: Research primary-source schemas and tooling for model, texture, and pack metadata; inspect
  file formats and deterministic analysis capabilities; evaluate where multimodal or language
  models add value and where they should not be authoritative.
- Sources: official specifications and documentation such as glTF/KHR extensions, image or model
  inspection tools, model-card/evaluation guidance, and relevant provider metadata contracts.
- Return: Established findings linked to primary sources, proposed deterministic and model-assisted
  stages, confidence/provenance controls, an evaluation outline, and gaps. Date fast-moving claims.

### D. Shader library precedents and portable semantics

- Scope: Research primary sources for reusable shader/material/example ecosystems relevant to
  WebGPU and typed shader authoring. Compare the artifact each system catalogs, metadata, parameter
  contracts, dependencies, portability, preview/validation evidence, and license treatment.
- Sources: official documentation or repositories for systems such as BroMetal, WebGPU/WGSL,
  MaterialX, Three.js examples/TSL, Bevy shader assets/examples, Godot shaders, and ShaderToy where
  directly relevant. Popularity is not quality evidence.
- Return: A comparison table, practices Antiky can reuse, practices it should avoid, licensing or
  portability cautions, source links, and explicit gaps. Do not change files.

### E. Agent discovery, retrieval, and proof

- Scope: Determine how agents could search, inspect, select, install, adapt, and verify assets and
  shaders without loading a large library into prompt context or claiming visual correctness from
  metadata alone.
- Sources: existing Antiky static catalog, MCP and inspection contracts, current agent-native ADRs,
  official structured-output/tool/resource documentation where useful, and repository skills.
- Return: Task-oriented retrieval flows, a minimal query/result contract, evidence and evaluation
  gates, delivery-surface tradeoffs, abuse/failure cases, and unknowns. Do not change files.

### F. Rights, provenance, and contribution lifecycle

- Scope: Identify how generated descriptions, extracted metadata, third-party shader source,
  previews, adaptations, notices, and contributions affect the two libraries' evidence model.
- Sources: the asset catalog's durable admission rules plus authoritative licenses, contribution
  policies, and terms for any external examples used in the comparison.
- Return: Established constraints, a provenance model, distinct ingestion lanes, risks that require
  owner or legal judgment, and explicit gaps. Do not give legal advice or change files.

Each inquiry must label unverifiable statements as claims or gaps rather than silently dropping or
asserting them.

## Out of scope

- Selecting models or vendors from benchmark reputation alone.
- Running a bulk model-enrichment job or changing catalog records.
- Adding catalog providers, dependencies, hosted services, MCP servers, or Studio features.
- Designing a universal material graph or cross-engine shader transpiler.
- Moving BroMetal types across Antiky's renderer-independent boundaries.
- Treating an external shader snippet as reusable before its rights and dependencies are known.
- Writing implementation plans or goals during this phase.

## Known constraints

- [`VISION_DIRECTION_H.md`](../../../VISION_DIRECTION_H.md) makes BroMetal the rendering foundation,
  keeps Antiky AI-native, and grows reusable systems from real game slices.
- [`GOOD_ENGINEERING_H.md`](../../../GOOD_ENGINEERING_H.md) requires simple, deep interfaces,
  alternative designs, evidence-led optimization, and resistance to premature abstraction.
- Framework ADR 0003 requires tools to expose semantic identity, state, provenance, dependencies,
  validation, and diagnostics rather than only files or screenshots.
- Framework ADRs 0006 and 0021 keep BroMetal behind the default RenderDriver path. Games can use
  BroMetal directly only as an exception and then own those resources themselves. Reusable
  renderer mechanics belong in BroMetal; Antiky-specific meaning and orchestration remain in
  Antiky.
- Framework ADR 0010 uses versioned semantic schemas and JSON at external or durable boundaries,
  while large assets move by reference.
- Framework ADR 0011 uses stable UUIDv7 asset identities; names and paths are labels.
- Framework ADR 0015 supports WebGPU only.
- Studio ADR 0005 makes the `.antiky` manifest and its project root the local trust boundary.
- The archived asset-catalog objective established a static-first catalog, item-scoped evidence,
  coherent pack-level records, deterministic snapshots, quarantine, and separate licensing lanes.
  It explicitly treated shaders, components, templates, and generators as a separate catalog class.
- The current rendering architecture describes shaders, materials, textures, and compiled outputs
  as assets with explicit dependency graphs, versions, hashes, diagnostics, and last-good
  replacement behavior. Several interfaces remain open decisions and cannot be assumed complete.
