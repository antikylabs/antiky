# World and Session Model

**In Progress**

## Purpose

This guide explains the main runtime objects and how they fit together. It also explains world data,
state copies, stable IDs, simulation time, and sandboxes.

It expands these framework ADRs:

- [0001: Represent world data with entities and components](../../adr/framework/0001-entity-component-system_H.md)
- [0008: Let EngineSession own worlds](../../adr/framework/0008-engine-session-owns-worlds_H.md)
- [0009: Keep authoring, runtime, and render state separate](../../adr/framework/0009-separate-state-projections_H.md)
- [0011: Use stable IDs and temporary numeric aliases](../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md)
- [0013: Give the simulation all inputs explicitly](../../adr/framework/0013-explicit-simulation-inputs_H.md)
- [0014: Apply approved sandbox changes through commands](../../adr/framework/0014-promote-sandbox-commands_H.md).

## Runtime hierarchy

```text
WorldHost                         online session placement and shared services
└── EngineSession                 one true timeline and lifecycle
    ├── World                     independent simulation state
    │   ├── Zone / Region         loading and spatial organization
    │   ├── Entity                stable identity
    │   ├── Components            structured data
    │   ├── Relationships         typed links
    │   ├── Systems               ordered behavior
    │   └── Specialized stores    compact or system-owned data
    ├── World                     preview, test, or sandbox state
    ├── AssetRegistry
    ├── CommandBus / EventBus
    ├── SimulationClock
    ├── Diagnostics
    └── optional RenderDriver
```

A `WorldHost` places and coordinates multiple authoritative sessions. A local game or Studio does
not need a `WorldHost`. It can start with an `EngineSession`.

## EngineSession

An `EngineSession` owns everything necessary to start, run, inspect, copy, and dispose its worlds.
The session must:

- Supply a stable session ID.
- Accept commands in a defined order.
- Own the fixed simulation clock.
- Run systems in a stable phase order.
- Maintain authoring, runtime, and render state.
- Own shared asset and diagnostic services.
- Create, compare, and dispose sandbox worlds.
- Render when a render driver is present.
- Release all owned resources when it stops.

The session is not a container for every service. A service belongs to the session only when it must
stay consistent across the session's worlds. Its lifecycle must also match the session lifecycle.

### Single-writer rule

Only one change loop writes to each authoritative world. Network requests, Studio actions, agent
actions, and worker results can arrive at the same time. They enter one ordered queue.

The session accepts work only at a command boundary or simulation-step boundary.

Workers can do expensive isolated work. Examples include asset compilation, mesh generation, path
calculations, and snapshot compression.

Each worker result includes its source revision. If the source revision changed, the session must
discard or recalculate the result. It must not apply the result to different state.

## World

A `World` owns one consistent simulation state. It supplies operations for:

- Entities
- Component values
- Typed relationships
- Resources that belong to the world
- Systems and their order
- Queries
- Revisions
- State-copy updates.

A world is not the same as a map file. It can contain multiple zones or regions. A session can also
contain multiple worlds.

Examples include a primary authoring world, a material preview, a prefab preview, a test world, and
an agent sandbox.

## Zones and regions

Zones or regions organize parts of a world. They can support loading, streaming, client visibility,
or gameplay. A zone does not create new authority rules by itself.

A large online game can use one of these arrangements:

- Put several zones in one session when they share one simulation timeline.
- Use separate sessions when they need different placement, scale, failure isolation, or simulation
  timing.

Movement between sessions requires a defined handoff. The sessions must not share an entity object
that both sessions can change.

The exact zone representation and handoff protocol remain open.

## World data with stable meaning

### Entities

An entity gives stable identity to something that matters to tools, gameplay, or history. Examples
include a hero, camera, light, building, selectable tree, water surface, or world root.

Names, paths, and hierarchy positions are labels that can change. The `EntityId` does not change
with them.

### Components

Components are structured data that belong to entities. Systems contain behavior.

TypeScript type information does not exist while the game runs. Each public component definition
must supply runtime information for:

- A stable component type ID
- A schema version
- Field types and units
- Default values and limits
- Rules for editing and visibility
- Rules that state if Antiky saves the component
- Migration and validation operations.

This runtime information supports command validation, Studio inspectors, MCP descriptions,
snapshots, and documentation. The project has not selected the library or schema format yet.

### Relationships

A relationship is a typed link between two stable IDs. Examples include `ChildOf`, `Targets`,
`Owns`, `Follows`, `UsesAsset`, and `GeneratedBy`.

`ChildOf` relationships create the scene hierarchy:

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

Other relationships do not need a place in this tree. For example, the tree does not show that a
camera follows the hero. It also does not show that a material uses a shader.

### Queries

Queries are part of the public world API. They answer questions such as:

- Which entities have `Transform` and `Camera`?
- Which renderable entities use this material?
- What is related to the current selection?
- Which entities fall within this zone or permission scope?

A storage change must not change the meaning of a public query. Performance measurements must guide
the query implementation and its performance rules.

## What becomes an entity

Use an entity when stable identity matters to authoring, gameplay, tools, permissions, history, or
relationships. Use specialized storage for compact, uniform, or high-volume data. Also use it for
data that matters to only one system.

| Concept | Default representation |
| --- | --- |
| Hero, NPC, camera, light, building | Entity with components |
| Shader, material, mesh, texture | Versioned asset |
| Voxel world or selectable structure | Entity referencing a voxel asset or volume |
| Individual voxel | Cell in a chunked voxel store |
| Individual vertex or triangle | Compiled geometry data |
| Grass or particle population | Specialized batch or buffer, with owner entities where needed |
| Physics broad phase | Rebuildable physics service state |
| Render pass | Render-graph node |
| GPU buffer | Render-driver resource |

A generated voxel face, render batch slot, or physics body can map to its owner entity. The generated
item does not become an authoritative entity.

## Three state representations

### Authoring world

Authoring state is designed for stable meaning, inspection, versions, saved data, and editing. It
contains entity headers, authored components, relationships, asset references, and a durable
revision.

Authoring state does not contain deep graphs of live class objects. It uses stable IDs for
references.

### Runtime world

Runtime state is designed for simulation. It can use compact integer indexes, arrays, specialized
component storage, physics handles, navigation indexes, cooldown tables, or AI state.

These structures are private to one session. Antiky can rebuild them from authoring state, assets,
checkpoints, and accepted inputs.

### Render world

Render state is designed for cameras, lights, visible items, pipeline keys, material keys, stable
batch slots, sorting, changed ranges, and render passes. It does not control gameplay.

### Projection rules

A projection copies necessary data from one form of state to the next. Normal data flow moves in one
direction:

```text
accepted change
  -> authoring update
  -> runtime update
  -> prepared render update
  -> driver upload
```

For a normal change, projection code must copy only the changed data. It must also support a complete
rebuild from a known source.

If state copies do not match, a lower state copy must not change its source through a shared
reference. A rebuild must correct the error.

## Identity translation

Persistent IDs use TypeScript-branded UUIDv7 strings. Compact numeric aliases make frequent
operations faster:

| Identity | Scope | Durable? |
| --- | --- | --- |
| `EntityId` | Games, tools, events, saves, servers | Yes |
| `RuntimeEntityIndex` | One runtime world | No |
| `NetworkEntityId` | One session or connection alias table | No |
| `RenderInstanceIndex` | One render batch or pipeline | No |

Antiky explicitly creates or agrees on each mapping. A numeric alias must not leave its state copy as
if it were a persistent ID.

## Simulation clock

The simulation advances in fixed steps. The renderer can use the current and previous display state.
It can run at a different rate from the simulation.

One frame conceptually performs:

1. The session limits real elapsed time and calculates the necessary simulation steps.
2. For each step, the session accepts scheduled commands and inputs.
3. The session decides commands and applies accepted updates.
4. The session runs repeatable systems in a stable order.
5. The session sends temporary signals and records changed state ranges.
6. The session estimates display state between simulation steps.
7. The session prepares render changes and renders one frame when a driver is present.
8. The session records diagnostics.

The session gives clocks, random streams, environment values, and external inputs to each system.
Authoritative systems do not read hidden time or random values.

A promise of identical results applies only to tested systems and known builds.

## Sandbox worlds

A sandbox starts at a specified revision of the primary world. It can contain the complete world, a
region, a selection, a prefab, or a test scene. Its scope must be clear.

A safe agent workflow is:

```text
create sandbox at base revision
  -> apply permitted commands
  -> run simulation and validation
  -> collect diagnostics, metrics, and captures
  -> prepare ProposedChangeSet
  -> human or policy approval
  -> re-dispatch against primary session
  -> re-authorize and revalidate
```

A `ProposedChangeSet` contains commands and validation evidence. It does not contain live
authoritative objects, runtime indexes, or sandbox event sequence numbers. The result must report a
conflict explicitly.

## Required tests

Add these boundary tests as each feature becomes available:

- A stable ID stays the same after a rename, snapshot, and replay.
- A runtime alias never occurs in durable data.
- The hierarchy output matches the `ChildOf` relationships.
- Specialized data maps to its owner entity when selection needs the owner.
- One accepted authoring update changes each state copy exactly one time.
- A complete state rebuild matches the result of small state updates.
- Fixed inputs, clock, seed, system order, and build produce the declared state digest.
- Pause and single-step operations do not rebuild the world.
- The session rejects stale worker results.
- Sandbox promotion detects a changed primary revision and does not import live sandbox state.

## Open decisions

- Component storage and query layout
- Runtime schema library and generated inspector-data format
- Zone and streaming model
- Snapshot content for runtime recovery
- Asset sharing and copy behavior for sandboxes
- The systems that promise identical results on different platforms
- The measurements that justify a change from simple maps to compact arrays or other storage.
