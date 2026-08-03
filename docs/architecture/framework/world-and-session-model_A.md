# World and Session Model

**In Progress**

## Purpose

This guide defines Antiky's runtime hierarchy, semantic world model, state representations, stable
identity, simulation timing, and sandbox boundary. It expands the decisions in framework ADRs
[0001](../../adr/framework/0001-entity-component-system_H.md),
[0008](../../adr/framework/0008-engine-session-owns-worlds_H.md),
[0009](../../adr/framework/0009-separate-state-projections_H.md),
[0011](../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md),
[0013](../../adr/framework/0013-explicit-simulation-inputs_H.md), and
[0014](../../adr/framework/0014-promote-sandbox-commands_H.md).

## Runtime hierarchy

```text
WorldHost                         online placement and shared services
└── EngineSession                 one authoritative timeline and lifecycle
    ├── World                     independent simulation state
    │   ├── Zone / Region         loading, streaming, and spatial organization
    │   ├── Entity                stable semantic identity
    │   ├── Components            structured data
    │   ├── Relationships         typed graph edges
    │   ├── Systems               ordered behavior
    │   └── Specialized stores    dense or subsystem-owned data
    ├── World                     preview, test, or sandbox state
    ├── AssetRegistry
    ├── CommandBus / EventBus
    ├── SimulationClock
    ├── Diagnostics
    └── optional RenderDriver
```

`WorldHost` is only needed when multiple authoritative sessions must be placed or coordinated. A
local game or Studio session can start at `EngineSession`.

## EngineSession

An `EngineSession` owns everything required to start, run, inspect, fork, and dispose one or more
worlds. Its conceptual responsibilities are:

- assign and expose session identity;
- admit commands in a defined order;
- own the fixed simulation clock;
- run systems in a stable phase order;
- maintain authoring, runtime, and render projections;
- own shared asset and diagnostic services;
- create, compare, and dispose sandbox worlds;
- render when a driver is present; and
- release all owned resources on disposal.

It is not a global service locator. A service belongs on the session only when its lifecycle or
consistency genuinely spans the session's worlds.

### Single-writer rule

Each authoritative world has one mutation loop. Network requests, Studio actions, agents, and worker
results may arrive concurrently, but they join an ordered queue. The session admits work at command
or tick boundaries.

Workers can perform expensive pure or isolated work such as asset compilation, mesh generation,
path batches, or snapshot compression. Their results include the source revision. A stale result is
discarded or recomputed rather than applied to a different state.

## World

A `World` owns one coherent simulation state. It provides semantic operations over:

- entities;
- component values;
- typed relationships;
- resources scoped to the world;
- systems and their ordering;
- queries;
- revisions; and
- projection deltas.

A world is not synonymous with a map file. It can contain multiple zones or regions, and a session
can host multiple worlds. Examples include a primary authored world, a material preview, a prefab
preview, an automated test world, and an agent sandbox.

## Zones and regions

Zones or regions organize part of a world for loading, streaming, interest management, or gameplay.
They do not create a new authority model by themselves. A large online game may choose either:

- several zones inside one session when they share one practical simulation timeline; or
- separate sessions when placement, scaling, failure isolation, or tick independence requires it.

Moving an entity across session boundaries is an explicit handoff. It is not achieved by sharing a
mutable entity object between processes.

The exact zone representation and handoff protocol remain open.

## Semantic world data

### Entities

An entity is stable identity for something meaningful to tools, gameplay, or history. Typical
entities include a hero, camera, light, building, selectable tree, water surface, or world root.

Names, paths, and hierarchy positions are mutable labels. The `EntityId` remains stable when they
change.

### Components

Components are structured data attached to entities. Behavior belongs in systems. Each externally
visible component definition needs runtime metadata because TypeScript types do not exist at
runtime. The metadata provides:

- a stable component type ID;
- a schema version;
- field types and units;
- defaults and constraints;
- editability and visibility metadata;
- persistence classification; and
- migration or validation hooks.

This metadata drives command validation, Studio inspectors, MCP descriptions, snapshots, and
documentation. The library or schema representation used to implement it is not yet chosen.

### Relationships

Relationships are typed edges between stable identities. Examples include `ChildOf`, `Targets`,
`Owns`, `Follows`, `UsesAsset`, and `GeneratedBy`.

The scene hierarchy is the `ChildOf` projection:

```text
Town
├── Environment
│   ├── Terrain
│   ├── Water
│   └── Sun
├── Characters
│   ├── Hero
│   └── NPCs
└── Cameras
    └── Main Camera
```

Other relationships remain graph-shaped. A camera following the hero or a material using a shader
does not belong in the parent-child tree.

### Queries

Queries are a first-class semantic interface. They answer questions such as:

- Which entities have `Transform` and `Camera`?
- Which renderable entities use this material?
- What is related to the current selection?
- Which entities fall within this zone or capability scope?

The public query meaning must survive a future storage optimization. Query implementation and
performance contracts should be chosen from measurements.

## What becomes an entity

Use an entity when stable identity matters to authoring, gameplay, tools, permissions, history, or
relationships. Keep data specialized when it is dense, uniform, high-volume, or meaningful only to
one subsystem.

| Concept | Default representation |
| --- | --- |
| Hero, NPC, camera, light, building | Entity with components |
| Shader, material, mesh, texture | Versioned asset |
| Voxel world or selectable structure | Entity referencing a voxel asset or volume |
| Individual voxel | Cell in a chunked voxel store |
| Individual vertex or triangle | Compiled geometry data |
| Grass or particle population | Specialized batch or buffer, with semantic owners where needed |
| Physics broad phase | Rebuildable physics service state |
| Render pass | Render-graph node |
| GPU buffer | Render-driver resource |

Semantic ownership can bridge the layers. A greedily meshed voxel face, batch slot, or physics body
may map back to the entity that owns it without becoming the authoritative entity itself.

## Three state representations

### Authoring world

Authoring state is optimized for stable semantics, inspection, versioning, persistence, and human or
agent editing. It includes entity headers, authored components, relationships, asset references, and
a durable revision.

It avoids deep graphs of live class instances. References use stable IDs.

### Runtime world

Runtime state is optimized for simulation. It can use dense integer indexes, structures of arrays,
specialized component stores, physics handles, navigation indexes, cooldown tables, or AI state.
These structures are private to one session and can be rebuilt from authored state, assets,
checkpoints, and accepted inputs.

### Render world

Render state is optimized for cameras, lights, visible items, pipeline and material keys, stable batch
slots, sorting, dirty ranges, and pass execution. It contains no gameplay authority.

### Projection rules

Normal data flow is one-way:

```text
accepted change
  -> authoring delta
  -> runtime delta
  -> render extraction delta
  -> driver upload
```

Projection code must be incremental for normal changes and able to rebuild from a known source when
drift or incompatibility is detected. A lower representation never fixes an upstream mismatch by
mutating the upstream object through a shared reference.

## Identity translation

Persistent identity uses branded UUIDv7 strings. Dense aliases improve hot paths:

| Identity | Scope | Durable? |
| --- | --- | --- |
| `EntityId` | Games, tools, events, saves, servers | Yes |
| `RuntimeEntityIndex` | One runtime world | No |
| `NetworkEntityId` | One session or connection alias table | No |
| `RenderInstanceIndex` | One render batch or pipeline | No |

Mappings are explicit and rebuilt or negotiated. No dense alias may cross its owning representation
as if it were persistent identity.

## Simulation clock

Simulation advances in fixed ticks. Rendering consumes current and previous presentation state and
may run at a different cadence.

One frame conceptually performs:

1. Bound real elapsed time and calculate due ticks.
2. For each tick, admit scheduled commands and inputs.
3. Run command decisions and apply accepted deltas.
4. Run deterministic systems in stable order.
5. Emit transient signals and projection dirtiness.
6. Interpolate presentation state.
7. Extract render changes and render once when a driver exists.
8. Record diagnostics.

Clocks, random streams, environmental values, and external inputs are injected. Authoritative systems
do not reach for ambient time or randomness. Exact determinism claims remain scoped to tested
subsystems and known builds.

## Sandbox worlds

A sandbox begins at an explicit primary-world revision. It can contain the entire world, a region, a
selection, a prefab, or a synthetic test scene, provided its scope is declared.

A safe agent workflow is:

```text
fork at base revision
  -> apply capability-bounded commands
  -> run simulation and validation
  -> collect diagnostics, metrics, and captures
  -> prepare ProposedChangeSet
  -> human or policy approval
  -> re-dispatch against primary session
  -> re-authorize and revalidate
```

The proposed change set carries commands and evidence. It does not carry authoritative live objects,
runtime indexes, or sandbox event sequence numbers. Conflict is an explicit outcome.

## Required tests

Implementation should establish these cut-point tests as each capability appears:

- stable identity survives rename, snapshot, and replay;
- runtime aliases never appear in durable payloads;
- hierarchy output matches `ChildOf` relationships;
- specialized data maps back to semantic owners where selection requires it;
- one accepted authoring delta updates each projection exactly once;
- full projection rebuild matches incremental projection state;
- fixed input, clock, seed, system order, and build produce the declared state digest;
- pause and stepping do not reconstruct the world;
- stale worker results are rejected; and
- sandbox promotion detects a changed primary revision and never imports live state.

## Open decisions

- Component storage and query layout.
- Runtime schema library and generated inspector metadata format.
- Zone and streaming model.
- Snapshot content for runtime recovery.
- Asset sharing, copy-on-write, and partial cloning for sandboxes.
- Which systems guarantee cross-platform determinism.
- The point at which simple maps should become dense arrays or another measured layout.
