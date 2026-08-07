# Slice 04: Compile Town Content as Framework Assets

> **Superseded on 2026-08-07.** Do not execute this plan. It depends on the retired Slice 03 plan
> and conflicts with the standalone-demo source boundary.

For a short review, answer the questions in [`owner-input_H.md`](owner-input_H.md).

## Control

| Field | Value |
| --- | --- |
| Status | `NOT READY` |
| Owner | Antiky Framework maintainers |
| Outcome | One deterministic Town compiler installs validated static content through an inspectable Framework asset registry |
| Owner input | [`owner-input_H.md`](owner-input_H.md) |
| Architecture decisions | Accepted ADRs below; [voxel asset-boundary candidate](../../../../adr/UNDER_REVIEW_A.md#11-voxel-authoring-and-runtime-asset-boundary) must become an accepted ADR |
| Depends on | [`../slice-03/plan.md`](../slice-03/plan.md) completed, including its authoritative-physics ADR |
| Alignment revision | `fb3fa24f5eb63555ee1a5ad37ff7388de3160e29` |
| Review date | `2026-08-05` |
| Complete check | `node --experimental-strip-types --experimental-transform-types docs/objectives/antiky-town/slice-04/verification/verify.mjs` |
| Evidence | `docs/objectives/antiky-town/slice-04/outputs/{run-id}/receipt.json` |

The goal runner must read the complete owner-input file. It must stop on a `PENDING` answer. It
must also stop until Slice 03 is complete, the required asset ADR is accepted, and BroMetal is
current.

Goal command:

```text
/goal implement docs/objectives/antiky-town/slice-04/plan.md until complete
```

## Review summary

- Add stable asset IDs, typed references, immutable records, and a session-owned asset registry.
- Compile Town source into explicit CPU data with one full content hash and stable owner mappings.
- Register current atlas dependencies and expose bounded asset inspection to humans and agents.
- Feed the compiled asset into the current renderer and upload static data once per asset version.
- Do not add a general importer, editor database, cache, bundle format, hot replacement, or entity per generated element.

## Outcome

Developers can build the same Town content twice, receive the same validated asset hash, inspect its
dependencies and owners, and render it without bypassing Framework asset ownership.

### Observable behavior

- Equal Town source, compiler version, and dependency hashes produce the same compiled hash.
- Geometry, collision, paths, instances, water, and approved captures preserve the reference result.
- `list_assets` and `get_asset` report the same bounded facts through direct, CLI, and MCP clients.
- Stable owner entity IDs map back from compiled ranges without low-level generated entities.
- Invalid source, dependency, or compiled data is rejected before it reaches BroMetal.

### Non-goals

- VOX import, drag-and-drop authoring, Studio asset UI, file watching, workers, or remote storage.
- Runtime hot replacement, disk cache, content bundles, shipping packages, or public manifest files.
- A general render adapter, partial GPU range updates, GPU compilation authority, or readback.
- Porting every remaining dynamic authored object or implementing selection. Later slices own these.

## Chosen shape

```text
Town TypeScript source plus atlas manifests
  -> private deterministic Town compiler
  -> versioned CompiledTownAsset plus validation, hash, dependencies, and owner ranges
  -> EngineSession-owned Framework AssetRegistry
  -> Town physics/actor adapters and current renderer
  -> BroMetal static buffers and textures -> WebGPU
```

| Owner | Owns in this slice | Does not own |
| --- | --- | --- |
| `@antiky/framework` | `AssetId`, typed references, immutable records, atomic registry installation, lookup, inspection, and disposal | Town schemas, file I/O, compiler plugins, DOM, or BroMetal |
| Antiky Town | Source adapter, compiler, compiled schema, validation, semantic owner keys, and stable owner IDs | A general asset pipeline or GPU resources |
| `EngineSession` | One registry, installation order, asset revisions, diagnostics, and lifecycle | Source authoring or render interpretation |
| CLI and MCP | Bounded metadata over the shared development client | Raw typed arrays, source files, mutation, or MCP Resources |
| BroMetal | Typed GPU resources, shader work, draw work, and WebGPU failures | Asset identity, dependency truth, hashes, collision, or owners |

Do not copy the current 2,194-line builder. Add a private Antiky Town compiler adapter that calls the
existing pure builder and converts its result. Let the Town renderer factory accept an injected
compiled value while `town-study` keeps its default standalone path. Source code emits semantic
owner keys and never imports Framework IDs.

## Required reading

- [`owner-input_H.md`](owner-input_H.md)
- [Objective agent guidance](../../AGENTS.md); [`CLAUDE.md`](../../CLAUDE.md) routes to it.
- [`../../SLICE_WORKFLOW_A.md`](../../SLICE_WORKFLOW_A.md)
- [`../../IMPLEMENTATION_PLAN_A.md`](../../IMPLEMENTATION_PLAN_A.md)
- [`../../SLICE_FEEDBACK_H.txt`](../../SLICE_FEEDBACK_H.txt)
- [General development-harness research](../../../general-stuff/DEV_HARNESS_RESEARCH_A.md)
- [General inspection direction](../../../general-stuff/INSPECTION_TOOLING_A.md)
- [General release and versioning direction](../../../general-stuff/RELEASE_VERSIONING_A.md)
- [ADR 0001: Keep generated geometry out of entities](../../../../adr/framework/0001-entity-component-system_H.md)
- [ADR 0003: Share services with humans and agents](../../../../adr/framework/0003-agent-native_H.md)
- [ADR 0006: Keep BroMetal inside the render driver](../../../../adr/framework/0006-brometal-render-driver_H.md)
- [ADR 0008: Let EngineSession own assets](../../../../adr/framework/0008-engine-session-owns-worlds_H.md)
- [ADR 0009: Keep state projections separate](../../../../adr/framework/0009-separate-state-projections_H.md)
- [ADR 0010: Serialize at boundaries](../../../../adr/framework/0010-serialize-at-boundaries_H.md)
- [ADR 0011: Use stable IDs](../../../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md)
- [ADR 0015: Support WebGPU only](../../../../adr/framework/0015-webgpu-support-only_H.md)
- [ADR 0001: Use MCP Tools for local development](../../../../adr/cli/0001-use-mcp-tools-for-development_H.md)
- [`rendering-and-assets_A.md`](../../../../architecture/framework/rendering-and-assets_A.md)
- [`world-and-session-model_A.md`](../../../../architecture/framework/world-and-session-model_A.md)
- [`protocols-and-serialization_A.md`](../../../../architecture/framework/protocols-and-serialization_A.md)
- [`GOOD_ENGINEERING_H.md`](../../../../GOOD_ENGINEERING_H.md)

## Research and decision review

The research used current primary sources on `2026-08-05`.

| Source | Relevant approach | Antiky result |
| --- | --- | --- |
| [Phaser Loader](https://docs.phaser.io/phaser/concepts/loader) and [Cache](https://docs.phaser.io/phaser/concepts/loader/cache) | Scene loaders queue keyed files into game-global type caches; JSON packs group requests. | Keep useful batch/dependency ideas. Use stable IDs and session ownership instead of Scene or string-key authority. |
| [Godot import process](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/import_process.html) and [`ResourceUID`](https://docs.godotengine.org/en/stable/classes/class_resourceuid.html) | Source files produce disposable imported data; UIDs preserve references across path changes. | Separate source and compiled data, use stable IDs, and make derived output reproducible. Do not add an editor cache yet. |
| [Bevy 0.19 assets](https://docs.rs/bevy/latest/bevy/asset/) | Typed handles reference assets; loaders produce runtime values; dependency load state is explicit. Runtime `AssetId` is not durable. | Use typed references and explicit dependencies, but keep Antiky UUIDv7 IDs stable across runs. |
| [Unity 6 Asset Database](https://docs.unity3d.com/6000.0/Documentation/Manual/asset-database-contents.html) and [Addressables](https://docs.unity3d.com/6000.0/Documentation/Manual/com.unity.addressables.html) | GUIDs identify source assets; importers produce runtime artifacts; Addressables locate assets and dependencies. | Keep stable identity and deterministic artifacts. Defer a global editor database, bundles, and async location system. |
| [Unreal Engine 5.8 Asset Manager](https://dev.epicgames.com/documentation/en-us/unreal-engine/asset-management-in-unreal-engine), [Registry](https://dev.epicgames.com/documentation/unreal-engine/asset-registry-in-unreal-engine), and [DDC](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-derived-data-cache-in-unreal-engine) | Metadata is inspectable before payload load; primary assets own dependencies; derived data is disposable and regenerated. | Make metadata bounded and derived data reproducible. Defer cooking, a singleton catalog, and persistent caches. |
| [PlayCanvas assets](https://developer.playcanvas.com/user-manual/assets/) | The registry separates metadata records from loaded runtime resources and tracks lifecycle. | Keep this useful split in a smaller session-owned API. Do not use mutable names or URLs as identity. |

BroMetal is pinned and installed at `0.15.0`; `npm ls brometal --all` confirms it. That version
matched the [published package](https://registry.npmjs.org/brometal/latest) on the review date. Its
[README](https://github.com/ericdrowell/brometal) and
[changelog](https://github.com/ericdrowell/brometal/blob/main/CHANGELOG.md) confirm a typed shader
DSL and thin WebGPU runtime. No upgrade is needed.

Compile, validate, hash, inspect, and query collision data on the CPU. Give BroMetal the resulting
typed render arrays and textures once per asset version. Keep water, foliage, lighting, and other
per-vertex or per-fragment work on the GPU. BroMetal `set` replaces whole buffers, so do not promise
partial updates. Future GPU culling or derived render data belongs behind Slice 05 and cannot become
authoritative or require readback.

The complete [`UNDER_REVIEW_A.md`](../../../../adr/UNDER_REVIEW_A.md) was reviewed. Candidate 11 needs
the narrow ADR in owner question 1. ADR 0018 is inherited from Slice 03. Candidates 2, 3, 15,
and 16 do not block this slice because Town schemas stay private and this adds no ECS, extension API,
or shipped package.

## Current state and reference

- `brometal-town/art/town.ts` deterministically builds mesh, materials, colliders, props, awnings,
  vegetation, walkers, paths, water, validation, and callable ground queries in one `TownWorld`.
- Current validation hashes mesh arrays and compares selected lists. It does not hash every compiled
  output, dependency, owner mapping, or compiler version.
- The renderer builds Town internally, derives more render arrays, loads four atlas image/JSON pairs,
  and uploads static geometry during construction.
- Atlas manifests have schema and image hashes. Three have no stable asset ID; the actor manifest
  uses a non-UUID string ID.
- Antiky Town has a content placeholder and point-light records. Framework has no `AssetId`, asset
  record, registry, typed reference, or compiler API at this alignment revision.

| Capability | Decision | Source or required result |
| --- | --- | --- |
| Deterministic Town builder and validation | `EXTEND` | Keep `brometal-town/art/town.ts` as the reference source; add semantic owners and an injected result seam. |
| Compiled Town schema and full hash | `CREATE` | Normalize arrays and callable collision rules into explicit versioned data. |
| Stable asset identity and registry | `CREATE` | Add the approved minimal Framework API and EngineSession ownership. |
| Atlas records and dependency graph | `CREATE` | Register current material, prop, vegetation, and actor atlas pairs with verified hashes. |
| Static renderer inputs | `EXTEND` | Consume the installed compiled asset and avoid repeated static uploads. |
| Import plugins, hot replacement, cache, bundles | `DEFER` | Later consumers and Slice 09 must prove these contracts. |

## Deliverables

### Framework

- Add UUIDv7 `AssetId` creation and parsing, the approved typed asset reference, immutable metadata,
  and a session-owned registry with atomic batch validation, lookup, inspection, and disposal.
- Validate unique IDs, types, revisions, lowercase content hashes, missing dependencies, cycles,
  and stable owner IDs before installation. A failed batch changes no installed state.
- Transfer large typed payloads in process without JSON copies. Never include raw payload arrays in
  inspection, HTTP, CLI, or MCP responses.

### Integration and tools

- Add a private, versioned `CompiledTownAsset` with explicit mesh/material arrays, collision height
  data and colliders, props, awnings, vegetation, water, paths, owner ranges, and validation facts.
- Add canonical byte encoding and one full SHA-256 content hash over schema/compiler versions,
  compiled data, owner mapping, and dependency hashes. Equal builds must be byte-stable.
- Add stable logical asset and owner IDs. Extend `antiky generate id` with `asset` through the
  Framework factory. Do not duplicate Slice 02's ownership of the original feedback item.
- Let the current renderer accept the installed compiled Town value. Keep `town-study` standalone,
  preserve its default behavior, and add no duplicated builder.
- Add `list_assets` and `get_asset` to the development client, HTTP bridge, MCP Tools, and
  `antiky tool`. Return metadata and counts only. Add no mutation Tool or MCP Resource.

### User-facing documentation

- Add `docs/user-facing-docs/framework/assets.md` as a general explanation and API reference.
- Add `docs/user-facing-docs/framework/compile-assets.md` as a general deterministic-compiler how-to.
- Update general inspection, CLI development, and MCP Tool references with asset IDs and queries.
- Do not write user documentation about Slice 04. Use Town only as a small example.
- Record Studio documentation as `N/A`; this slice adds no Studio asset UI.

## Data and authority path

```text
versioned Town source and verified dependency hashes
  -> private deterministic compiler and validation
  -> atomic AssetRegistry installation in EngineSession
  -> authoritative immutable compiled CPU payload and metadata
  -> bounded inspection plus Town collision/render adapters
  -> BroMetal resources derived once for the installed version
```

`AssetId` and owner `EntityId` values remain stable across reloads. Session and runtime IDs change.
The registry installs a dependency-complete batch in deterministic ID order. Compiled CPU data and
its hash are authoritative. Source data, inspection DTOs, prepared render data, and GPU resources
are distinct copies. Runtime buffer handles never enter records or durable IDs.

## Safe behavior

| Event | Required result |
| --- | --- |
| Invalid source, non-finite value, malformed hash, or failed validation | Stable rejection before installation or GPU creation |
| Duplicate ID, type mismatch, missing dependency, or dependency cycle | Reject the whole batch and keep the last installed state |
| Unknown asset in `get_asset` | Stable not-found result and no state change |
| Hash or atlas-byte mismatch | Reject the asset, name the failed dependency, and publish a bounded diagnostic |
| BroMetal creation or upload failure | Preserve inspectable CPU assets, stop drawing safely, and report the typed error |
| Reload, reconnect, disposal, or later request | Unchanged content keeps IDs and hashes; reload gets new session/runtime IDs; dispose once; reject later work |

Asset Tools remain local, read-only, production-excluded operations behind current credential,
origin, and payload limits. Responses expose project-relative source labels and bounded metadata,
not source contents, absolute paths, image bytes, or typed arrays.

## CPU-to-GPU path

- Authoritative CPU state: installed compiled Town payload, record, hash, dependencies, and owners.
- Changed Antiky range: the complete static Town asset at session construction.
- Actual BroMetal update unit: whole static attribute, index, instance, and texture inputs.
- Normal GPU readback: zero.
- Stable resources: programs, static buffers, textures, samplers, bind groups, and passes stay alive.
- Failure and disposal: do not publish partial resources; release each created resource once.
- Measurements: record compile/hash time, payload bytes by section, GPU writes and bytes, resource
  creation, draw count, per-frame static upload count, and disposal against the reference.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Confirm dependencies and capture source, hash, geometry, collision, visual, and upload baselines | Current validation, atlas, and reference facts | `Record Slice 04 baseline` |
| `CP-01` | Add `AssetId`, typed records, registry, inspection, and lifecycle | Framework unit, dependency, atomicity, and import-boundary tests | `Add Framework asset registry` |
| `CP-02` | Add Town compiler, explicit collision data, full hash, owner mapping, and injected renderer input | Determinism, parity, ownership, and static-upload tests | `Compile Town assets` |
| `CP-03` | Add asset queries, asset ID generation, and general user documentation | Direct, HTTP, CLI, and MCP contract tests; manual docs review | `Add asset development tools` |
| `CP-04` | Run the temporary complete verifier and save the receipt and summary | One clean complete run | `Verify Slice 04 assets` |

Each checkpoint includes its tests and leaves the repository in a working state.

## Test plan

- Test every asset ID and reference type, immutable record values, duplicate IDs, type mismatch,
  dependency order, missing dependency, cycles, atomic rejection, lookup, and exactly-once disposal.
- Build Town twice and compare canonical bytes, full hashes, validation, owner ranges, collision
  height samples, colliders, paths, instance lists, and dependency hashes.
- Change one value in each compiled section and confirm the hash changes. Test non-finite values,
  malformed atlas data, image-hash mismatch, unsupported schema/compiler version, and size bounds.
- Confirm owner IDs are stable, mappings are complete, and no voxel, vertex, triangle, collider,
  GPU resource, prop card, or vegetation card becomes an entity.
- Compare occupied surfaces, materials, silhouette, captures, collision, geometry budgets, draw count,
  static writes and bytes, zero per-frame static uploads, and zero readback with `town-study`.
- Test direct, development-client, HTTP, MCP, and human `antiky tool` query parity. Confirm Tools-only
  discovery and bounded responses without raw payload data.
- Check changed user-facing links, commands, and examples manually. Do not add tests that only test prose.
- Run affected package tests, `npm run check`, and the temporary complete check from one clean start.

For a reported error, add a failing regression test before the fix. Keep all temporary complete
verification under this slice's `verification/` folder. Do not add it to a package manifest or
shared script folder. Delete it after the final outputs pass.

## Completion checks

- [ ] Owner input is `ANSWERED`, Slice 03 is complete, and the required asset ADR is accepted.
- [ ] Framework owns stable asset identity, typed lookup, immutable records, and registry lifecycle.
- [ ] Equal Town builds produce equal full hashes and preserve approved visual/collision behavior.
- [ ] Meaningful stable owners map to compiled ranges without low-level generated entities.
- [ ] Direct, CLI, MCP, and Studio-compatible asset inspection agree and remain bounded.
- [ ] Invalid input, dependencies, hashes, failures, reload, security, and disposal stay safe.
- [ ] Compile, payload, GPU upload, draw, geometry-budget, and zero-readback checks pass.
- [ ] General user-facing documentation matches the shipped behavior.
- [ ] Package tests, `npm run check`, and the complete check pass.
- [ ] The evidence receipt validates and links all required proof.

## Run and evidence rule

Use the shared workflow for isolation, permissions, retries, rollback, and receipt content.

- Isolation: Use one worktree, browser runtime, output folder, and strict port set for the run.
- Retry: Retry one classified transient browser or GPU start. Do not retry deterministic failures.
- Rollback: Return to the latest passing checkpoint if a regression cannot be fixed forward.
- Special authority: Use the existing local development credential. Add no production authority.
- After completion: Framework and demo maintainers own asset/compiler checks; feedback returns to
  `SLICE_FEEDBACK_H.txt`.

The temporary verifier writes and validates `receipt.json`, `confirmation-checks.md`, `facts.json`,
and `measurements.json` in one new `outputs/{run-id}/` folder. Record actual revisions, ports, IDs,
hashes, versions, dependencies, owners, diagnostics, commands, measurements, captures, and changed
user-facing pages.

Update `../slice-list.md` from the run facts. Write `slice-summary.md` with the simple owner handoff:
what changed in Framework, CLI, Studio, the demo, and BroMetal; how to test it; and any ADR made.
