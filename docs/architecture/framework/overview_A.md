# Framework System Overview

**In Progress**

## Purpose

Antiky is a game framework and development runtime built on BroMetal. Its primary workloads are
Antiky Labs' 2D, 3D, and 2.3D games, while its interfaces remain reusable by other games. Studio is
a visual client of the framework, not a requirement for running or building a game.

The architectural center is a structured, authoritative simulation that humans, agents, clients,
tests, and services can all inspect and influence through the same command and query surface.

This guide summarizes the target. The present demos still own several responsibilities that will be
extracted incrementally; the target is not permission for a broad rewrite.

## System shape

```text
Studio          AI / MCP          Game client          Tests / services
   \               |                  |                       /
    +------- commands, queries, events, diagnostics --------+
                              |
                   command ingress and policy
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

Durable events and snapshots sit beside the session. They preserve accepted history and accelerate
recovery; they are not traversed during each frame. A headless session omits the render world and
driver while retaining the same commands, systems, and authority.

## Responsibilities

| Area | Owns | Does not own |
| --- | --- | --- |
| Studio | Panels, selection, editor camera, previews, workspace, user intent | Live world mutation, game authority, GPU resources |
| MCP adapter | Translation between agent tools/resources and the shared engine surface | Independent engine rules or UI automation |
| Command ingress | Decode where needed, validation, trusted identity, authorization, deduplication, revision and tick checks | Gameplay outcomes or rendering |
| EngineSession | Lifecycle, ordered command admission, clocks, worlds, systems, projections, assets, diagnostics, sandbox forks | Account-wide services or UI state |
| Authoring world | Stable semantic entities, authored components, relationships, asset references, durable revision | Dense hot-loop indexes or GPU handles |
| Runtime world | Current simulation, fixed-tick systems, physics, navigation, AI, cooldowns, specialized stores | External schema promises or render resources |
| Render world | Visible items, cameras, lights, draw lists, batches, dirty ranges, frame data | Authoritative gameplay decisions |
| RenderDriver | Renderer resources, pipeline lookup, uploads, pass execution, disposal | World truth or persistent identity rules |
| BroMetal | Shader compilation and typed GPU runtime | Entities, gameplay, networking, persistence, Studio, AI policy |
| World host | Placement and coordination of authoritative sessions and shared online services | Direct rendering or client-trusted outcomes |

## Core data flow

Normal mutation flows in one direction:

```text
intent
  -> command
  -> validation and decision
  -> accepted durable event and/or runtime delta
  -> authoring/runtime projections
  -> render extraction
  -> BroMetal resource updates and draws
```

Read models, diagnostics, metrics, and command results flow back to clients. Those outward views do
not give a lower layer a mutable reference to its source.

## Authority model

An `EngineSession` is the unit of ordered authority. Requests may arrive concurrently, but each
world is changed by one command-and-tick loop. Heavy work may run in workers and return versioned
results; the session applies a result only at a safe boundary and only if its source revision remains
valid.

Authority depends on the caller:

- Studio authoring commands require edit capabilities and expected revisions.
- Agent commands normally target bounded sandbox worlds.
- Gameplay clients send input and intent; the server derives actor identity and decides outcomes.
- Internal commands are not addressable by untrusted transports.
- Read access is scoped separately from mutation access.

"Everything uses commands" means one mutation language, not universal permission.

## State model

Antiky maintains three representations because they optimize for different questions:

- **Authoring state:** What did a creator intend, and what can be saved, diffed, inspected, and
  replayed?
- **Runtime state:** What is happening in the simulation now, and how can systems process it
  efficiently?
- **Render state:** What must be drawn this frame, in which batches and passes, with which dirty
  ranges?

Typed incremental projections connect them. Serialization is unnecessary while the representations
share a process. GPU resources are disposable implementation state and never become the world model.

## Identity model

Persistent objects use opaque UUIDv7 identifiers. Runtime, network, and render representations map
those IDs to dense indexes scoped to their own lifetimes.

```text
persistent EntityId
      -> RuntimeEntityIndex
      -> connection-scoped NetworkEntityId
      -> batch-scoped RenderInstanceIndex
```

Only the persistent ID may cross saves, durable history, tools, and servers. A name or hierarchy path
is a human label and can change without changing identity.

## Event model

Antiky uses selective event sourcing:

- Authored changes, ownership, inventory, economy, quests, important gameplay outcomes, and
  administrative changes are candidates for durable events.
- Movement samples, physics contacts, animation frames, camera motion, particles, render batches,
  presence, and replication deltas remain transient by default.
- Snapshots and runtime checkpoints shorten recovery but do not silently replace durable facts.
- Undo issues another command and records the compensating fact.

This keeps history useful without turning the event store into the render or physics loop.

## Runtime forms

The same architecture supports several compositions:

| Composition | Session | Renderer | Transport |
| --- | --- | --- | --- |
| Browser development | Local | BroMetal present | Direct local objects plus development-host boundary |
| Tauri Studio | Local or detached | BroMetal where needed | Direct, IPC, or local network through one protocol |
| Headless server | Authoritative | Absent | Network commands and replication |
| Game client | Predictive projection | BroMetal present | Input upstream, replication downstream |
| Automated test | Local deterministic | Usually absent | Direct strict test transport |
| Agent sandbox | Forked and capability-bounded | Optional | MCP over the shared session surface |

The exact process placement and transport are deployment choices. They do not change domain
commands or authority.

## Package direction

The current monorepo direction remains:

```text
website -> demos -> framework
```

As new boundaries prove necessary, dependencies should continue to point toward stable contracts:

```text
Studio / MCP / server / demos -> framework and protocol contracts
BroMetal driver              -> framework render interfaces + BroMetal
framework core               -X-> BroMetal, React, Tauri, Node filesystem, or website
```

These are dependency constraints, not a requirement to create every possible package now. A package
should be extracted only when it traps real complexity or needs independent versioning.

## Migration posture

Architecture is proved through complete slices of the working town rather than horizontal platform
construction. The first useful path should demonstrate one semantic object moving through identity,
command validation, accepted history, projections, a dirty render update, inspection, and undo.

Each slice must:

- retain the working demo and its validation evidence;
- introduce only the boundary needed by its consumer;
- keep the repository runnable;
- add tests at the new system cut points;
- avoid coupling an engine migration to unrelated dependency or desktop-shell work; and
- leave implementation details private until another real use case needs them.

## Deliberately open

The accepted architecture does not yet choose:

- the final component-store or query implementation;
- the runtime schema library;
- the event-store database and snapshot cadence;
- exact process placement or transport for Studio and the engine;
- the web UI framework inside Studio;
- the first picking implementation;
- sandbox asset sharing and fork mechanics;
- the package split beyond currently proven dependencies; or
- when a binary network codec becomes necessary.

Those decisions should follow measured vertical slices rather than precede them.
