# Framework System Overview

**In Progress**

## Purpose

Antiky is a game framework and development runtime that uses BroMetal. Antiky Labs' 2D, 3D, and 2.3D
games are its primary use cases. Other games can also use its interfaces.

Studio is a visual client of the framework. A game can run and build without Studio.

An authoritative simulation contains the true world state and makes final game decisions. Humans,
agents, clients, tests, and services use the same commands and queries to work with this simulation.

This guide summarizes the target system. Current demos still control some features that will move to
the framework in small steps. This target does not permit a broad rewrite.

## System shape

```text
Studio          AI / MCP          Game client          Tests / services
   \               |                  |                       /
    +------- commands, queries, events, diagnostics --------+
                              |
                  command entry point and policy
                              |
                        EngineSession
               +--------------+--------------+
               |              |              |
         authoring world   runtime world   shared services
               |              |              |
               +------ incremental deltas ---+
                              |
                         render world
                              |
                         RenderDriver
                              |
                           BroMetal
                              |
                            WebGPU
```

Durable events record accepted history. Snapshots make recovery faster. The session does not process
the complete event history during each frame.

A headless session runs without a render world or render driver. It still uses the same commands,
systems, and authority rules.

## Responsibilities

| Area | Controls | Does not control |
| --- | --- | --- |
| Studio | Panels, selection, the editor camera, previews, the workspace, and user intent | True world state, game decisions, or GPU resources |
| Model Context Protocol (MCP) adapter | Translation between agent requests and the shared engine API | Engine rules or UI control |
| Command entry point | Decoding, validation, trusted identity, permissions, duplicate detection, and revision checks | Gameplay results or rendering |
| EngineSession | Lifecycle, command order, clocks, worlds, systems, state copies, assets, diagnostics, and sandboxes | Account services or UI state |
| Authoring world | Stable entities, authored components, relationships, asset references, and the durable revision | Compact runtime indexes or GPU handles |
| Runtime world | The current simulation, fixed-step systems, physics, navigation, AI, cooldowns, and specialized storage | External schemas or render resources |
| Render world | Visible items, cameras, lights, draw lists, batches, changed ranges, and frame data | Final gameplay decisions |
| RenderDriver | GPU resources, pipeline lookup, uploads, render passes, and resource disposal | True world state or persistent IDs |
| BroMetal | Shader compilation and the typed GPU runtime | Entities, gameplay, networking, stored data, Studio, or AI rules |
| WorldHost | Placement and coordination of sessions and shared online services | Direct rendering or results that clients decide |

## Core data flow

Normal state changes move in one direction:

```text
intent
  -> command
  -> validation and decision
  -> accepted durable event and/or runtime update
  -> authoring/runtime state updates
  -> prepared render state
  -> BroMetal resource updates and draws
```

Read-only views, diagnostics, measurements, and command results flow back to clients. These outputs
do not give clients direct write access to their source state.

## Authority model

An `EngineSession` controls the order of changes. Requests can arrive at the same time, but one
command-and-tick loop changes each world.

Workers can do expensive work and return versioned results. The session applies a result at a safe
point only if its source revision is still valid.

Authority depends on the caller:

- Studio authoring commands require edit permission and the expected revision.
- Agent commands usually target sandbox worlds with defined limits.
- Gameplay clients send inputs and intended actions. The server identifies the player and decides
  the result.
- Untrusted connections cannot call internal commands.
- Read permission is separate from change permission.

"Everything uses commands" means that all callers use one method to request changes. It does not
mean that all callers have the same permissions.

## State model

Antiky keeps three forms of state. Each form answers different questions:

- **Authoring state.** What did a creator intend? What can Antiky save, compare, inspect, and replay?
- **Runtime state.** What is occurring in the simulation now? How can systems process it quickly?
- **Render state.** What must Antiky draw in this frame? Which batches, passes, and changed ranges
  does it need?

Small typed updates connect the three forms. Antiky does not serialize these updates when the forms
are in one process. GPU resources are temporary implementation data, not world state.

## Identity model

Persistent objects use UUIDv7 IDs. The ID text does not contain information about the object.
Runtime, network, and render state can map these IDs to compact numeric aliases.

```text
persistent EntityId
      -> RuntimeEntityIndex
      -> connection-scoped NetworkEntityId
      -> batch-scoped RenderInstanceIndex
```

Only the persistent ID can enter saved data, durable history, tools, and servers. A name or hierarchy
path is a label. The label can change without a change to the ID.

## Event model

Antiky records only events that need durable history:

- Antiky can store authored changes, ownership, inventory, economy, quests, important gameplay
  results, and administration changes as durable events.
- Movement samples, physics contacts, animation frames, camera motion, particles, render batches,
  presence, and client updates stay temporary by default.
- Snapshots and runtime checkpoints make recovery faster. They do not replace durable facts.
- Undo sends a new command and records the correction.

This rule keeps history useful. It also keeps event storage out of the render and physics loops.

## Runtime forms

The same architecture supports several uses:

| Use | Session | Renderer | Connection |
| --- | --- | --- | --- |
| Browser development | Local | BroMetal is present | Local objects and a development-host boundary |
| Tauri Studio | Local or separate | BroMetal is present when necessary | Direct calls, process messages, or a local network |
| Headless server | Authoritative | None | Network commands and client updates |
| Game client | Predictive state copy | BroMetal is present | Inputs to the server and updates from the server |
| Automated test | Local and repeatable | Usually none | Direct strict test connection |
| Agent sandbox | Isolated and permission-limited | Optional | MCP through the shared session API |

Process locations and connection methods are deployment choices. They do not change game commands
or authority rules.

## Package direction

Code dependencies in the repository point in this direction:

```text
website -> demos -> framework
```

When a new boundary becomes necessary, dependencies must continue to point toward stable contracts:

```text
Studio / MCP / server / demos -> framework and protocol contracts
BroMetal driver              -> framework render interfaces + BroMetal
framework core               -X-> BroMetal, React, Tauri, Node filesystem, or website
```

These rules do not require the project to create all possible packages now. Create a package only
when it contains real complexity or needs its own version.

## Migration posture

Complete features in the working town must prove the architecture. Do not build broad platform
layers before a feature needs them.

The first complete feature must move one meaningful object through:

- A stable ID
- Command validation
- Accepted history
- Authoring, runtime, and render state
- A small render update
- Inspection
- Undo.

Each slice must:

- Keep the demo working and keep its validation evidence.
- Add only the boundary that the feature needs.
- Keep the repository runnable.
- Add tests at each new system boundary.
- Keep engine migration separate from unrelated dependency or desktop work.
- Keep implementation details private until another real use case needs them.

## Deliberately open

The accepted architecture does not yet choose:

- The final component storage or query implementation
- The runtime schema library
- The event database and snapshot schedule
- The process locations and connection method for Studio and the engine
- The Studio web UI framework
- The first selection method for the game canvas
- Sandbox asset sharing and copy behavior
- New packages beyond the current proven dependencies
- The need for a binary network format.

Measurements from complete working features must guide these decisions.
