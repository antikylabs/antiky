# Authoritative Online Runtime

**In Progress**

## Purpose

This guide explains how the framework architecture extends from a local game to authoritative online
and MMO workloads. It records direction, not a claim that the networking stack exists today. It
expands framework ADRs
[0008](../../adr/framework/0008-engine-session-owns-worlds_H.md),
[0012](../../adr/framework/0012-server-authoritative-simulation_H.md), and
[0013](../../adr/framework/0013-explicit-simulation-inputs_H.md).

## Core authority rule

The server runs the engine; it is not a validator placed beside a client-owned simulation. A
server-hosted `EngineSession` runs command handlers, fixed-tick gameplay systems, physics queries,
world rules, and authoritative outcomes.

Clients send input and gameplay intent. They do not send final position, damage, inventory balance,
cooldown, spawn, or ownership state as truth.

## Topology

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

An `EngineSession` is one ordered simulation timeline. It does not have to represent the entire
planet. A `WorldHost` places sessions and coordinates explicit handoffs. Shared services own data
whose consistency or lifetime spans those sessions.

The eventual deployment may group several logical sessions in one process or distribute them. The
authority and message contracts stay the same.

## Ingress path

```text
client input or intent
  -> gateway
  -> schema, size, sequence, rate, and authentication checks
  -> trusted actor and capability context
  -> session command queue
  -> fixed-tick validation and simulation
  -> accepted outcome
  -> persistence, replication, and telemetry projections
```

The gateway never trusts an actor ID or permission asserted by the client. It derives both from the
authenticated connection and server state.

## Client-to-server contracts

| Message | Meaning | Server treatment |
| --- | --- | --- |
| Handshake | Protocol range, build, content manifest, authentication | Authenticate and negotiate compatibility |
| Join intent | Requested world and character | Resolve authorized character and session placement |
| Input batch | Sequence, ticks, directional input, buttons | Validate order and timing, then schedule for the derived actor |
| Gameplay intent | Ability, interaction, target hint, inventory or quest action | Validate ownership, state, range, resources, and rules |
| Replication acknowledgement | Last applied server tick and baseline | Select later deltas and detect loss or lag |

Gameplay commands are semantic. A target ID can be a hint; the server still checks visibility,
range, ownership, and current existence.

## Server-to-client contracts

| Message | Meaning | Client treatment |
| --- | --- | --- |
| Join accepted | Session, authoritative tick, content versions, initial relevant state | Build client projection and alias table |
| Replication frame | Baseline, tick, entity membership, component deltas, transient cues | Apply, interpolate, and acknowledge |
| Reconcile | Prior authoritative actor state and accepted input sequence | Rewind prediction and replay remaining local input |
| Command outcome | Accepted or rejected intent with safe details | Update UI and predicted expectations |
| Asset manifest delta | Required asset hashes and versions | Fetch and cache outside gameplay messages |

Exact wire encoding is separate from these semantics.

## Fixed tick and command scheduling

The authority samples admitted input at explicit tick boundaries. System order, clocks, random
streams, and external inputs are controlled. Requests arriving concurrently enter one ordered queue
for the target world.

Tick validation rejects input that is too old, unreasonably far ahead, duplicated, too large, or too
frequent. Server receipt and accepted tick are authoritative; client timestamps are evidence, not
truth.

## Client prediction and reconciliation

A client may run compatible movement or presentation logic immediately for responsiveness. It keeps
the unacknowledged input window needed to correct prediction.

On reconciliation:

1. restore the authoritative actor state at the named server tick;
2. remove inputs the server has accepted;
3. replay the remaining valid local inputs;
4. correct presentation according to bounded smoothing rules; and
5. record reconciliation diagnostics.

Bit-for-bit cross-platform simulation is not required for useful prediction when the server remains
authoritative and correction is tested. Exact historical replay has stricter build, content,
physics, clock, and input requirements.

## Replication is a projection

Replication is not a broadcast of the event store or the complete server world. For each connection,
it projects the relevant current state based on:

- session and zone;
- distance and visibility;
- party, ownership, and permissions;
- gameplay-specific interest rules;
- acknowledged baseline; and
- bandwidth and update budgets.

Persistent entity IDs map to compact connection- or session-scoped aliases. The server sends entity
membership changes, component deltas, and transient cues against an acknowledged baseline. Static
assets travel by manifest and content hash rather than repeated payloads.

Client projections may contain predicted local state. They never become server authority.

## Persistence classes

| Persist as durable facts | Checkpoint or retain selectively | Keep transient |
| --- | --- | --- |
| Authored world revisions | Player movement checkpoints | Per-frame transforms |
| Inventory, equipment, currency, trades | Recent input windows | Collision contacts |
| Progression, quests, achievements | Zone runtime checkpoints | Animation state |
| Guilds, ownership, claims, market outcomes | Encounter summaries or investigation traces | Particles and audio cues |
| Important spawns, deaths, construction | Replication baselines while connected | Camera, UI, and presence |
| Administrative and approved agent changes | Performance and anti-cheat samples | Render batches and GPU state |

Selective persistence avoids both extremes: losing meaningful history and attempting to event-source
the render or physics loop.

## Anti-cheat boundary

The architecture removes classes of client authority but does not eliminate abuse. The server must
still validate:

- authenticated actor and ownership;
- command capability and target scope;
- sequence, rate, size, and tick window;
- impossible input combinations;
- movement against authoritative collision, speed, status, and transport state;
- ability ownership, cooldown, cost, range, line of sight, and target validity;
- inventory and economy invariants with durable concurrency; and
- asset and build compatibility.

Rejected commands and suspicious reconciliation patterns go to security telemetry. Sensitive server
state must not appear in rejection details.

## Session scaling and handoff

Scale begins by selecting a practical session boundary rather than distributing every system. One
session may represent a zone, shard, dungeon, raid, arena, match, or other coherent timeline.

A handoff between sessions is an explicit operation:

1. source session validates departure and creates a versioned transfer record;
2. shared services or the host authorize the destination;
3. destination session validates compatible identity, content, and state;
4. authority moves at a defined boundary;
5. client connection and replication aliases update; and
6. failure leaves one clear authority rather than two live owners.

The exact handoff transaction and recovery protocol remain open.

## Sandboxes and online authority

An AI or administrative sandbox is another session or world fork, not a bypass around the server.
It may simulate a proposed world edit, migration, encounter, or policy under bounded capabilities.
Promotion re-dispatches commands to the target authority with current revisions and permissions.

No sandbox can promote runtime memory, dense aliases, or its event sequence numbers as primary
truth.

## Failure and recovery

Recovery uses compatible runtime checkpoints, durable event tails, asset manifests, and explicit
build metadata. The system must know which representation can be rebuilt and which external side
effect needs reconciliation.

Important failure cases include:

- session process loss;
- partial persistence or outbox failure;
- incompatible snapshot or build;
- projection lag or sequence gap;
- stale worker result;
- client baseline loss;
- repeated reconciliation divergence; and
- cross-session handoff interruption.

Design must prefer one visible rejection or recovery state over two plausible authorities.

## Diagnostics and budgets

Online diagnostics should include:

- command decode, validation, admission, and apply latency;
- queue depth and tick budget;
- accepted, rejected, duplicate, and rate-limited counts;
- relevant entity count per connection;
- replication bytes, baseline age, packet loss, and acknowledgement lag;
- prediction error and reconciliation frequency;
- checkpoint and durable append latency;
- session population and handoff failures; and
- build, content, physics, and protocol versions.

Measure these before selecting binary encoding, compression, shard size, or checkpoint cadence.

## Verification

- A client cannot set authoritative position or actor identity.
- Identical admitted inputs reach the declared server state under a fixed build and seed.
- Duplicate or out-of-window input is rejected or ignored predictably.
- Client prediction converges after reconciliation without applying input twice.
- Interest changes create and remove only the intended connection aliases.
- Replication rebuilds the expected client projection from a snapshot and deltas.
- Durable state recovers from snapshot plus event tail.
- Handoff failure never leaves two sessions authoritative for one actor.
- Headless server packages compile without DOM or BroMetal.

## Open decisions

- Session and zone boundaries for the first online slice.
- Gateway and service deployment topology.
- Prototype and production network transports.
- The measured point for binary encoding, quantization, and compression.
- Prediction scope beyond character movement.
- Runtime checkpoint cadence and input-window retention.
- Cross-session handoff transaction and recovery.
- Shared service boundaries for economy, guilds, chat, and identity.
