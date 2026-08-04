# Rendering and Assets

**In Progress**

## Purpose

This guide explains how Antiky prepares world and simulation data for BroMetal. It also explains
assets, dependencies, render passes, resource replacement, selection, and performance rules.

It expands these framework ADRs:

- [0004: Give equal support to 2D, 3D, and 2.3D games](../../adr/framework/0004-23d_H.md)
- [0006: Keep BroMetal inside the Antiky render driver](../../adr/framework/0006-brometal-render-driver_H.md)
- [0009: Keep authoring, runtime, and render state separate](../../adr/framework/0009-separate-state-projections_H.md).

## BroMetal's role

BroMetal compiles shaders and runs typed GPU operations. It owns shader programs, buffers, textures,
render targets, render passes, and WebGPU execution.

Antiky controls:

- Entities and world meaning
- Simulation and gameplay
- Asset IDs and dependencies
- Preparation and order of render work
- Studio and agent inspection
- Networking and saved data
- Safe resource replacement during development.

BroMetal is a driver below the framework. It is not the world model. A headless server runs without
a renderer. It does not create BroMetal, a canvas, or GPU resources.

## Render flow

```text
authoring components and assets
        -> runtime simulation and presentation state
        -> prepare render data
        -> RenderWorld
        -> render graph and draw lists
        -> Antiky RenderDriver
        -> BroMetal programs and resources
        -> WebGPU
```

Simulation systems do not call BroMetal. Render preparation reads stable runtime views. It updates
only render data that changed.

## RenderDriver responsibilities

The `RenderDriver` interface must stay small and independent from one renderer. The driver must:

- Install, update, and release compiled render assets.
- Resize display surfaces.
- Accept a frame description or stable `RenderWorld` view that callers cannot change.
- Update changed buffer ranges and frame values.
- Run render passes and draw operations in order.
- Supply renderer diagnostics and capabilities.
- Dispose each resource that it owns.

The BroMetal adapter maps stable Antiky keys to typed BroMetal resources. BroMetal renderer, program,
texture, target, and GPU types stay inside the adapter.

Callers describe what to render and what changed. The driver hides resource allocation, resource
connections, BroMetal details, upload methods, and disposal.

## RenderWorld

`RenderWorld` is a temporary state copy for drawing. It can contain:

- Active cameras and view data
- Visible lights
- Render items with runtime entity references
- Stable pipeline, geometry, and material keys
- Visibility and layer masks
- Bounds and sort keys
- Instance batches and stable batch slots
- A draw list for each pass
- Changed entities, materials, and data ranges
- Selection and debug-display data
- Current frame values.

Antiky resolves persistent UUIDs before frequent draw loops. Compact render indexes and batch slots
are temporary. They belong only to one render state copy.

## Prepare render state

Render preparation converts runtime state into the smallest necessary render update. It must:

1. Read runtime changes and estimated display state.
2. Update visibility and render membership.
3. Map meaningful assets to compiled render keys.
4. Keep stable batch slots when possible.
5. Mark the exact changed data ranges.
6. Build an ordered draw list for each pass.
7. Publish mappings from render data to owner entities.

Render preparation must not change authoritative world state. If rendering fails, Antiky can report
diagnostics or keep the last good resource. It cannot change gameplay to match failed render state.

## How often render data changes

| Data class | Examples | Default update strategy |
| --- | --- | --- |
| Static assets | Compiled mesh, texture atlas, material table, static voxel surface | Compile and upload once per asset version |
| Dynamic instances | Characters, foliage, props, moving lights | Stable batch slots and dirty range uploads |
| Frame constants | Camera, time, lighting, fog, pass transforms | Small reused uniform data once per frame or pass |
| Temporary effects | Footsteps, hits, particles, water cues | Temporary render or effect signals |

The normal frame path does not create an object for each entity. It does not scan or copy the
complete world, parse JSON, or replay event history. Draw operations do not repeatedly find
persistent text IDs.

## Render graph

A render pass is one stage of drawing. Antiky defines the order of passes and the resources that
move between them. This graph shows an example:

```text
shadow pass -> shadow map ----+
                             v
                        scene pass -> scene color/depth -> post process -> canvas
                             |
                             +-> selection/debug overlays when enabled
```

A pass has a stable ID. It declares its input resources, output resources, order rules, and
operation. Studio and agents can use the graph to answer:

- Which pass drew this entity?
- Which program, material, and geometry did it use?
- Which resources did the pass read and write?
- What changed after an asset reload?
- Which pass failed or exceeded its budget?

The existing shadow, scene, and post-processing passes in the town must guide the first graph API.
Do not build a general graph framework before these real passes show what it needs.

## Asset model

An asset is reusable source data or compiled data with a stable ID. Asset types can include shaders,
materials, textures, meshes, models, animation, audio, scenes, prefabs, and voxel volumes.

Render-target descriptions and compiled collision data can also be assets.

An asset record needs:

- Stable `AssetId` and type
- Source location or origin, when applicable
- Revision and content hash
- Schema and compiler versions
- Information about source and compiled data
- Load or compile state
- Dependencies and dependent assets
- Validation diagnostics
- Replacement or installation state.

Source assets, compiled CPU data, and live GPU resources have different owners. A world stores an
asset reference. It does not store a BroMetal texture or buffer.

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

After a change, the graph identifies the smallest set of assets that need updates. Studio and agents
can also inspect the graph. Antiky must reject dependency cycles or define their behavior.

## Source, compiled, and live data

Commands and events do not contain large assets. Antiky imports or generates a source asset and gives
it a stable ID and source record. It compiles the asset with explicit settings.

Antiky then validates the compiled data and stores it by content hash. An accepted command links
authoring state to that asset version.

Examples:

- A `.vox` file stays editable source data. A build step creates chunked cells, a greedy mesh,
  collision data, and palette data for the runtime.
- A model source becomes validated geometry and material assets.
- A shader source becomes a generated, typed BroMetal shader file and registered pipeline.

Antiky can rebuild compiled data when the source, compiler, or settings change. It can always create
GPU resources again from compatible compiled assets.

## Replace programs during development

A stable Antiky `ProgramSlot` maps a `PipelineKey` to the current valid BroMetal program and its
resource connections. Materials and passes refer to the slot. They do not refer to a temporary
program object.

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

- **Compatible.** Code changed, but attributes, GPU values, textures, and pipeline state still match.
  Keep resource connections and replace the program.
- **Rebind-compatible.** Known mesh or material data can satisfy the new layout. Rebuild only the
  affected resource connections before replacement.
- **Incompatible.** Required data is not available. Reject the new program and explain the missing
  or changed contract.

A compile or replacement failure keeps the last valid program active. Normal recovery does not
rebuild the world or refresh the page.

A new shader layout or code-defined render pipeline requires a development build. A published build
can create entities or change values in registered schemas when its policy permits these changes.

## 2D, 3D, and 2.3D

Shared render contracts must support sprites, meshes, voxels, and mixed scenes. These data types can
have different batch and depth requirements.

In 2.3D, 2D characters and objects use the camera, depth, lighting, selection, physics, and render
passes of a 3D world.

An entity supplies the stable object ID. Specialized sprite, mesh, voxel, foliage, water, or particle
storage supplies efficient render data.

Voxel content is an important test case. It is not the data model for the complete framework.

## Canvas selection

The canvas, Studio hierarchy, and MCP use the same selection service. A pick is a selection operation
on the game canvas.

A pick result must identify a stable target. It can also include position, surface direction,
distance, geometry, material, render pass, and specialized coordinates.

Possible methods include physics rays, CPU bounds or mesh tests, voxel traversal, and GPU object-ID
rendering. The project has not selected the first method.

Each method must return the same target and inspection data. It must also map specialized data to its
owner entity.

## Diagnostics

Rendering diagnostics should expose:

- Render-pass and draw counts
- Visible-item and batch counts
- CPU-to-GPU upload bytes and changed ranges
- Render-preparation and driver time
- Resource counts and disposal failures
- Shader compile and layout diagnostics
- Current and last-good asset revisions
- GPU validation errors
- Dependencies from a selected entity to its draw operation.

Diagnostics show how the renderer operates. They are not durable game events.

## Verification

- Framework core and headless tests compile without DOM or BroMetal imports.
- Import rules allow BroMetal only in its adapter.
- Known render input produces stable pipeline keys, draw order, and dirty ranges.
- Small render updates produce the same `RenderWorld` as a complete rebuild.
- Static assets upload one time for each version.
- A change to one instance marks only its limited data range.
- Resource replacement disposes the old resource exactly once after a safe swap.
- Failed compile or replacement preserves the last valid output.
- Town visual and performance baselines stay within their defined limits during render preparation.
- Each selectable draw maps to the intended stable target.

## Open decisions

- Final `RenderDriver` and render-graph interfaces
- BroMetal features that Antiky should contribute to BroMetal
- Program-layout compatibility checks and retained CPU resource connections
- Initial game-canvas selection method
- Asset-manifest format and compiler coordination
- Batch and buffer layouts for measured 2D, 3D, and 2.3D use cases
- The need for a separate renderer package after the first adapter becomes stable.
