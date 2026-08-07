# Authoritative Online Runtime

**In Progress**

## Purpose

This guide explains how Antiky can support online games and large multiplayer worlds. The server
contains the true game state and makes final decisions.

This guide describes the intended direction. It does not claim that the network system exists today.

It expands these framework ADRs:

- [0008: Let EngineSession own worlds](../../adr/framework/0008-engine-session-owns-worlds_H.md)
- [0012: Let the server decide online game state](../../adr/framework/0012-server-authoritative-simulation_H.md)
- [0013: Give the simulation all inputs explicitly](../../adr/framework/0013-explicit-simulation-inputs_H.md).

## Core server rule

The server runs the engine. It does not only check a simulation that a client controls.

A server-hosted `EngineSession` runs command handlers, fixed-step gameplay systems, physics queries,
and world rules. It decides the true results.

Clients send inputs and intended gameplay actions. They do not set the true position, damage,
inventory balance, cooldown, spawn, or ownership state.

## System layout

```text
shared services
  accounts, identity, guilds, economy, chat, matchmaking, content
                              |
                          WorldHost
             +----------------+----------------+
             |                |                |
       EngineSession     EngineSession     EngineSession
        zone/shard        dungeon/raid        sandbox
             |
           World
        zones/regions
```

An `EngineSession` contains one ordered simulation timeline. It does not need to contain the complete
game world. A `WorldHost` places sessions and coordinates defined handoffs.

Shared services own data that must stay consistent across sessions. They also own data with a
lifetime that is longer than one session.

A deployment can put several sessions in one process or in different processes. The authority and
message rules stay the same.

## How client messages enter

```text
client input or intent
  -> gateway
  -> schema, size, sequence, rate, and identity checks
  -> trusted player and permission context
  -> session command queue
  -> fixed-step validation and simulation
  -> accepted outcome
  -> saved history, client updates, and measurements
```

The gateway does not trust a player ID or permission from the client message. It gets both from the
authenticated connection and server state.

## Messages from a client

| Message | Meaning | Server treatment |
| --- | --- | --- |
| Handshake | Protocol range, build, content manifest, and authentication | Authenticate the client and agree on compatible versions |
| Join intent | Requested world and character | Find the permitted character and session |
| Input batch | Sequence, simulation steps, direction, and buttons | Check order and time, then schedule inputs for the trusted player |
| Gameplay intent | Ability, interaction, target hint, inventory action, or quest action | Check ownership, state, range, resources, and rules |
| Client-update acknowledgement | Last applied server step and baseline | Select later updates and detect loss or delay |

Gameplay commands state an intended action. A target ID can be a hint. The server still checks
visibility, range, ownership, and current existence.

## Messages from the server

| Message | Meaning | Client treatment |
| --- | --- | --- |
| Join accepted | Session, authoritative step, content versions, and initial relevant state | Build the client state copy and alias table |
| Client-update frame | Baseline, step, entity membership, component changes, and temporary cues | Apply, estimate display state, and acknowledge |
| Correction | Prior authoritative player state and accepted input sequence | Restore server state and replay remaining local inputs |
| Command result | Accepted or rejected action with safe details | Update the UI and predicted state |
| Asset-manifest change | Required asset hashes and versions | Get and cache assets outside gameplay messages |

The selected network data format does not change these meanings.

## Simulation steps and command order

The server reads accepted inputs at defined simulation-step boundaries. It controls system order,
clocks, random streams, and external inputs.

Requests that arrive at the same time enter one ordered queue for the target world.

The server rejects inputs that are too old, too far ahead, duplicates, too large, or too frequent.
The server receipt time and accepted step are authoritative.

A client timestamp supplies evidence. It does not set the true time.

## Client prediction and correction

A client can immediately run compatible movement or display logic to make controls feel responsive.
It keeps unacknowledged inputs so that it can correct a prediction.

To correct a prediction:

1. The client restores the authoritative player state at the specified server step.
2. The client removes inputs that the server accepted.
3. The client applies the remaining valid local inputs again.
4. The client corrects the display with smoothing that has a defined limit.
5. The client records correction diagnostics.

Useful prediction does not require identical binary simulation results on all platforms. The server
stays authoritative, and tests must verify correction behavior.

Exact historical replay has stricter requirements for builds, content, physics, clocks, and inputs.

## Client updates are state copies

A client update is not a copy of the event store or complete server world. For each connection, the
server selects current state with these rules:

- Session and zone
- Distance and visibility
- Party, ownership, and permissions
- Gameplay rules for relevant state
- Acknowledged baseline
- Network and update limits.

Persistent entity IDs map to compact aliases for one connection or session. The server sends entity
membership, component changes, and temporary cues from an acknowledged baseline.

The server identifies static assets by manifest and content hash. It does not send the same asset in
each update.

A client state copy can contain predicted local state. It never becomes authoritative server state.

## What the server stores

| Store as durable facts | Store for a limited purpose | Keep temporary |
| --- | --- | --- |
| Authored world revisions | Player movement checkpoints | Per-frame transforms |
| Inventory, equipment, currency, trades | Recent input windows | Collision contacts |
| Progression, quests, achievements | Zone runtime checkpoints | Animation state |
| Guilds, ownership, claims, market outcomes | Encounter summaries or investigation traces | Particles and audio cues |
| Important spawns, deaths, construction | Client-update baselines while connected | Camera, UI, and presence |
| Administration and approved agent changes | Performance and anti-cheat samples | Render batches and GPU state |

These storage rules preserve important history without storing each update from the render or
physics loop.

## Prevent client cheating

Server authority prevents clients from making final decisions, but it does not stop all abuse. The
server must still check:

- Authenticated player and ownership
- Command permission and target scope
- Sequence, rate, size, and simulation-step limits
- Impossible input combinations
- Movement against server collision, speed, status, and transport state
- Ability ownership, cooldown, cost, range, line of sight, and target validity
- Inventory and economy rules during concurrent changes
- Asset and build compatibility.

Security measurements record rejected commands and suspicious correction patterns. Rejection
details must not contain sensitive server state.

## Scale sessions and move players

To scale the game, first select a practical session boundary. Do not distribute every system. One
session can represent a zone, shard, dungeon, raid, arena, match, or other consistent timeline.

A handoff between sessions is an explicit operation:

1. The source session checks departure and creates a versioned transfer record.
2. Shared services or the host permit the destination.
3. The destination session checks compatible identity, content, and state.
4. Authority moves at a defined boundary.
5. The client connection and client-update aliases change.
6. If the handoff fails, only one session stays authoritative.

The exact handoff operation and recovery rules remain open.

## Online sandboxes

An AI or administration sandbox is an isolated session or world. It does not bypass the server. It
can simulate a proposed world change, migration, encounter, or policy with defined limits.

To apply sandbox changes, the target session runs the commands again. It uses current revisions and
permissions.

A sandbox cannot apply runtime memory, compact aliases, or its event sequence numbers as primary
state.

## Failures and recovery

Recovery uses compatible runtime checkpoints, later durable events, asset manifests, and explicit
build information. The system must know which state it can rebuild.

It must also know which external action needs correction.

Important failure cases include:

- Session process loss
- Partial storage or outgoing-message failure
- Incompatible snapshot or build
- State-copy delay or missing sequence
- Stale worker result
- Client baseline loss
- Repeated prediction correction
- Interrupted handoff between sessions.

The design must show one clear rejection or recovery state. It must not leave two possible
authorities.

## Measurements and limits

Online diagnostics should include:

- Command decode, validation, acceptance, and application time
- Queue depth and simulation-step budget
- Accepted, rejected, duplicate, and rate-limited command counts
- Relevant entity count for each connection
- Client-update bytes, baseline age, packet loss, and acknowledgement delay
- Prediction error and correction frequency
- Checkpoint and durable-write time
- Session population and handoff failures
- Build, content, physics, and protocol versions.

Measure these values before you select a binary format, compression, shard size, or checkpoint
schedule.

## Verification

- A client cannot set authoritative position or player identity.
- Identical accepted inputs reach the declared server state under a fixed build and seed.
- The server rejects or ignores duplicate or out-of-window input in a predictable way.
- Client prediction matches server state after correction without applying an input two times.
- Relevant-state changes create and remove only the intended connection aliases.
- A snapshot and later updates rebuild the expected client state.
- A snapshot and later events rebuild durable state.
- A handoff failure never leaves two sessions authoritative for one player.
- Headless server packages compile without DOM or BroMetal.

## Open decisions

- Session and zone boundaries for the first online feature
- Gateway and service deployment layout
- Prototype and production network connections
- Measurements that justify binary formats, lower-precision numbers, and compression
- Prediction beyond character movement
- Runtime-checkpoint schedule and input-window retention
- Handoff operation and recovery between sessions
- Shared-service boundaries for economy, guilds, chat, and identity.
