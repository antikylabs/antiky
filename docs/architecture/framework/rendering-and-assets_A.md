# Rendering and Assets

**In Progress**

## Purpose

This guide defines the boundary between Antiky's semantic and simulation state, its render
projection, and BroMetal. It also describes assets, dependencies, render passes, resource reload,
selection support, and performance expectations. It expands framework ADRs
[0004](../../adr/framework/0004-23d_H.md),
[0006](../../adr/framework/0006-brometal-render-driver_H.md), and
[0009](../../adr/framework/0009-separate-state-projections_H.md).

## BroMetal's role

BroMetal is Antiky's shader compiler and GPU runtime. It owns typed shader programs, buffers,
textures, render targets, passes, and WebGPU execution. Antiky owns:

- entities and world semantics;
- simulation and gameplay;
- asset identity and dependencies;
- render extraction and orchestration;
- Studio and agent inspection;
- networking and persistence; and
- safe development-time replacement policy.

BroMetal is therefore a driver beneath the framework, not the world model. A headless server can
run Antiky without constructing BroMetal, a canvas, or GPU resources.

## Render flow

```text
authoring components and assets
        -> runtime simulation and presentation state
        -> render extraction
        -> RenderWorld
        -> render graph and draw lists
        -> Antiky RenderDriver
        -> BroMetal programs and resources
        -> WebGPU
```

Simulation systems do not call BroMetal. Render extraction reads stable runtime views and updates
only changed render data.

## RenderDriver boundary

The framework-facing driver contract should remain small and renderer-neutral. Its conceptual
responsibilities are:

- install, update, and release compiled render assets;
- resize presentation surfaces;
- accept an immutable frame description or stable render-world view;
- update dirty buffer ranges and frame constants;
- execute ordered passes and draws;
- expose renderer diagnostics and capabilities; and
- dispose every owned resource.

The BroMetal implementation maps stable Antiky keys to typed BroMetal resources. BroMetal renderer,
program, texture, target, and GPU types stay inside that implementation.

This is a deep boundary: callers describe what to render and what changed; the driver hides resource
allocation, binding, backend details, upload strategy, and disposal.

## RenderWorld

`RenderWorld` is a transient projection optimized for drawing. It may contain:

- active cameras and view data;
- visible lights;
- render items with runtime entity references;
- stable pipeline, geometry, and material keys;
- visibility and layer masks;
- bounds and sort keys;
- instance batches and stable batch slots;
- pass-specific draw lists;
- dirty entity, material, and range sets;
- selection and debug-overlay data; and
- current frame constants.

Persistent UUIDs are resolved before inner draw loops. Dense render indexes and batch slots are
disposable and scoped to the render projection.

## Render extraction

Extraction converts runtime state into the minimum renderer-facing delta. It should:

1. consume runtime changes and presentation interpolation;
2. update visibility and render membership;
3. map semantic assets to compiled render keys;
4. retain stable batch slots where possible;
5. mark precise dirty ranges;
6. build ordered pass draw lists; and
7. publish inspectable mappings back to semantic entities.

It must not mutate authoritative world state. A render failure can produce diagnostics or preserve
the last good resource; it cannot rewrite gameplay to match the failed projection.

## Static, dynamic, and frame data

| Data class | Examples | Default update strategy |
| --- | --- | --- |
| Static assets | Compiled mesh, texture atlas, material table, static voxel surface | Compile and upload once per asset version |
| Dynamic instances | Characters, foliage, props, moving lights | Stable batch slots and dirty range uploads |
| Frame constants | Camera, time, lighting, fog, pass transforms | Small reused uniform data once per frame or pass |
| Transient effects | Footsteps, hits, particles, water cues | Ephemeral render/effect signals |

The normal frame path does not allocate an object per entity, scan or clone the entire world, parse
JSON, replay the event log, or look up persistent string IDs inside every draw.

## Render graph

Antiky makes pass and resource flow explicit. A representative graph is:

```text
shadow pass -> shadow map ----+
                             v
                        scene pass -> scene color/depth -> post process -> canvas
                             |
                             +-> selection/debug overlays when enabled
```

A pass declares stable identity, read resources, written resources, ordering constraints, and
execution. The graph allows Studio and agents to answer:

- Which pass drew this entity?
- Which program, material, and geometry did it use?
- Which resources did the pass read and write?
- What changed after an asset reload?
- Which pass failed or exceeded its budget?

The exact graph API should emerge from the town's existing shadow, scene, and post-processing passes
rather than from a generic graph framework built in isolation.

## Asset model

An asset is reusable source or compiled content with stable identity. Likely asset kinds include
shader, material, texture, mesh, model, animation, audio, scene, prefab, voxel volume, render target
description, and compiled collision data.

An asset record needs:

- stable `AssetId` and kind;
- source location or provenance where applicable;
- revision and content hash;
- schema and compiler versions;
- source and compiled metadata;
- load or compile state;
- dependencies and dependents;
- validation diagnostics; and
- reload or installation state.

Source assets, compiled CPU artifacts, and live GPU resources have separate owners. A world persists
an asset reference; it does not persist a BroMetal texture or buffer.

## Dependency graph

Dependencies are explicit and queryable:

```text
shader source
  -> compiled shader
  -> pipeline slot
  -> material
  -> render item or batch
  -> entity
  -> render passes
```

The graph determines the smallest invalidation set after a change and supports inspection questions
from Studio or an agent. Cycles must be rejected or have defined semantics.

## Source, compiled, and runtime artifacts

Large assets do not live inside command or event payloads. A source asset is imported or generated,
assigned identity and provenance, compiled with explicit settings, validated, and stored by content
hash. An accepted command then points authored world state at that version.

Examples:

- A `.vox` file remains an editable source artifact; a build step emits chunked cells, greedy mesh,
  collision, and palette data suited to the runtime.
- A model source becomes validated geometry and material assets.
- A shader source becomes a generated, typed BroMetal shader artifact and registered pipeline.

Compiled output can be rebuilt when source, compiler, or settings change. GPU resources can always
be recreated from compatible compiled assets.

## Development-time program replacement

A stable Antiky `ProgramSlot` or equivalent maps a `PipelineKey` to the current valid BroMetal
program and its known bindings. Materials and passes refer to the slot, not to a disposable program
object.

Reload flow:

```text
source change
  -> compile only affected shader
  -> structured success or failure
  -> register candidate asset revision
  -> compare layout contract
  -> prepare and validate replacement
  -> swap at a safe frame boundary
  -> retire old resource
  -> publish diagnostics and dependency changes
```

Compatibility classes are:

- **Compatible:** code changed while attributes, uniforms, textures, and pipeline state remain
  compatible. Preserve bindings and swap.
- **Rebind-compatible:** the new layout can be satisfied from known mesh or material data. Rebuild
  only affected bindings before swapping.
- **Incompatible:** required data is unavailable. Reject the candidate and explain the missing or
  changed contract.

A compile or replacement failure keeps the last valid program active. Reload never reconstructs the
world or refreshes the page as normal recovery.

Adding a new shader layout or code-defined render pipeline is a development/build-time change.
Creating entities or changing values inside registered schemas is a data-time change that a running
published build can support according to policy.

## 2D, 3D, and 2.3D

Shared render contracts must support sprite, mesh, voxel, and mixed scenes without pretending their
batching and depth needs are identical.

For 2.3D, 2D characters and objects participate in a 3D world's camera, depth, lighting, selection,
physics mapping, and pass structure. The semantic entity model identifies an object; specialized
sprite, mesh, voxel, foliage, water, or particle stores render it efficiently.

Voxel content is an important testbed, not the framework's universal representation.

## Picking and selection support

Selection is a semantic service shared by the canvas, Studio hierarchy, and MCP. A pick result should
resolve to stable targets and useful evidence such as world position, normal, distance, geometry,
material, pass, and specialized coordinates.

Possible implementations include physics ray queries, CPU bounds or mesh tests, voxel traversal, and
GPU object-ID rendering. The first implementation remains open. Whichever strategy is selected must
feed the same target and inspection contract and map specialized data back to its semantic owner.

## Diagnostics

Rendering diagnostics should expose:

- pass and draw counts;
- visible and batched instance counts;
- CPU-to-GPU upload bytes and dirty ranges;
- extraction and driver time;
- resource counts and disposal failures;
- shader compile and layout diagnostics;
- current and last-good asset revisions;
- GPU validation errors; and
- selected entity-to-draw dependencies.

Diagnostics are operational evidence, not durable domain events.

## Verification

- Framework core and headless tests compile without DOM or BroMetal imports.
- Import rules allow BroMetal only in its adapter boundary.
- Known render input produces stable pipeline keys, draw order, and dirty ranges.
- Incremental extraction matches a full render-world rebuild.
- Static assets upload once per version; a one-instance change marks only its bounded range.
- Resource replacement disposes the old resource exactly once after a safe swap.
- Failed compile or replacement preserves the last valid output.
- Town visual and performance baselines remain within declared tolerances during extraction.
- Every selectable draw maps back to the intended semantic target.

## Open decisions

- Final `RenderDriver` and render-graph interfaces.
- BroMetal capabilities that should be proposed upstream.
- Program layout compatibility algorithm and retained CPU binding state.
- Initial picking implementation.
- Asset manifest format and compiler orchestration.
- Batching and buffer layouts for each measured 2D, 3D, and 2.3D workload.
- Whether renderer separation requires a new package after the first adapter stabilizes.
