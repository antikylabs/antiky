# Slice 04 Owner Input

## Status

`WAITING FOR OWNER`

## Purpose

Slice 04 introduces the first Framework asset boundary. It compiles Town source into one validated,
inspectable runtime asset without turning voxels, triangles, or GPU resources into entities.

The Slice 04 goal reads this file before it changes code. A `PENDING` answer stops the goal.

## How to answer

Replace each `PENDING` value with `APPROVE` or your preferred direction. Add a short note when you
change the recommendation. Change the status to `ANSWERED` after all answers are complete.

## Inherited direction

- Slices 02 and 03 must be complete, including their accepted lifecycle and physics ADRs.
- Keep source, compiled CPU data, prepared render data, and GPU resources separate.
- Use entities only for meaningful stable owners. Do not create one per voxel, vertex, or triangle.
- Keep `town-study` runnable as the reference and do not copy its Town builder.
- Humans and agents use the same development service through `antiky tool` and MCP Tools.

## Question 1: Should we accept the voxel authoring and runtime-asset ADR now?

### Context

[`UNDER_REVIEW_A.md` candidate 11](../../../../adr/UNDER_REVIEW_A.md#11-voxel-authoring-and-runtime-asset-boundary)
is necessary for this slice. The current TypeScript builder mixes authored rules, compiled arrays,
collision callbacks, validation, and renderer input in one `TownWorld` value.

### Recommendation

Accept a narrow ADR before implementation. Keep Town source game-owned. Let a deterministic,
versioned compiler produce explicit mesh, collision, instance, path, validation, dependency, hash,
and owner-mapping data. Let `EngineSession` own the installed compiled asset. Let the renderer derive
GPU resources from that asset.

Keep the first source and compiled schemas private to Town. Future VOX or editor providers must
normalize into the same source boundary instead of becoming the Framework contract.

### Owner answer

`PENDING`

## Question 2: What is the first public Framework asset API?

### Context

Framework has no `AssetId`, typed asset reference, record, or registry. A broad import pipeline,
worker protocol, cache, and bundle format would be based on one consumer.

### Recommendation

Add UUIDv7 `AssetId`, a typed `AssetRef<T>` or equivalent type token, an immutable `AssetRecord`,
and an `EngineSession`-owned `AssetRegistry` with atomic initial installation and typed lookup.
Records expose type, source and compiled revisions, compiler version, content hash, dependencies,
validation summary, stable owners, and install state.

Keep compilers, file loading, source formats, hot replacement, disk caches, bundles, and serialized
manifests out of the public API. Add those only when a later slice proves them.

### Owner answer

`PENDING`

## Question 3: Which Town objects receive stable owner entities?

### Context

Slice 06 needs a stable target for selection. One Town entity is too coarse, while entities for
every voxel, prop card, vegetation card, or collider would expose compiler detail.

### Recommendation

Create a Town root plus stable owners for terrain, canal, bridge, waterfall, fountain, each authored
building or tower, and each market stall. Group benches, cargo, plants, trees, and repeated clutter
under the nearest meaningful owner or the environment owner. Keep every already interactive item,
such as the market point light, as its own entity.

Map semantic owner keys from Town source to UUIDv7 entity IDs during compilation. Do not expose
compiler indexes as identity.

### Owner answer

`PENDING`

## Question 4: May owner boundaries change mesh packing?

### Context

The current greedy surface compiler can merge adjacent faces. Preserving an owner per render range
may split a visually identical quad at a semantic boundary. That can change indices, the old mesh
fingerprint, and triangle count without changing the surface.

### Recommendation

Allow owner boundaries to split greedy quads only where needed. Require equal occupied surfaces,
materials, silhouette, collision samples, paths, and approved captures. Keep the result within the
existing geometry budgets. Record a new full compiled-content hash and require identical rebuilds
to reproduce it.

Do not allow owner metadata to change visible geometry, collision, or gameplay.

### Owner answer

`PENDING`

## Work that does not need owner input

The implementation agent selects the canonical byte encoding, fixtures, source-owner keys, run
resources, and measurements. It confirms atlas hashes, exact GPU writes, and general documentation.
It must add a new owner question only if a finding changes visible behavior, public API, scope, or
an accepted decision.
