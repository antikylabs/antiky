# Commands, Events, and Persistence

**In Progress**

## Purpose

This guide defines Antiky's mutation language, accepted facts, transient signals, durable history,
undo behavior, and projection guarantees. It expands framework ADRs
[0002](../../adr/framework/0002-event-sourcing_H.md),
[0007](../../adr/framework/0007-commands-as-mutation-boundary_H.md), and
[0010](../../adr/framework/0010-serialize-at-boundaries_H.md).

## Vocabulary

| Term | Meaning |
| --- | --- |
| Command | A request to change authoritative state. It can be accepted, rejected, or treated as a no-op. |
| Trusted command context | Identity, connection, capabilities, receipt time, and server tick derived by the authority rather than trusted from the payload. |
| Durable domain event | An immutable, ordered fact retained as part of authoritative history. |
| Transient signal | A live notification used by simulation or presentation without permanent retention. |
| Telemetry | Operational evidence such as timing, rejection, fault, and capacity data. |
| Projection | A representation built incrementally from accepted events or deltas. |
| Read model | A query-oriented view exposed to Studio, agents, clients, or operations. |
| Snapshot | A rebuildable checkpoint that shortens recovery or replay. |
| Compensation | A later command and event that reverses the effect of an earlier fact without deleting it. |

An event is not automatically durable. Event buses deliver notifications; event stores retain
ordered history. The event type and retention class must be explicit.

## Mutation boundary

Studio panels, MCP tools, gameplay clients, backend services, tests, and administrative tools do not
receive mutable world objects. They submit commands to the authority that owns the target world.

The end-to-end path is:

1. Decode at an external boundary when encoding was required.
2. Validate the envelope and payload schema.
3. Authenticate the principal and attach trusted context.
4. Authorize the command family, target, entity scope, and capability.
5. Deduplicate command identity or client sequence.
6. Check expected revision, tick window, rate, and payload budgets.
7. Run deterministic decision logic against current authoritative state.
8. Append durable events transactionally when durable history is required.
9. Apply accepted events and runtime deltas to projections.
10. Schedule bounded side effects and publish read-model changes.
11. Return a structured result.

Local callers use the same semantic path without encoding and decoding the command merely because
two modules are separate.

## Command contract

A command envelope needs enough information to be stable across local and remote transports:

- protocol and payload schema versions;
- command ID;
- target session and world IDs;
- command type;
- payload;
- expected authoring revision when applicable;
- requested or originating tick when applicable;
- client sequence for retry and ordering when applicable; and
- correlation metadata.

An untrusted command must not establish its own permissions, authenticated account, authoritative
actor entity, receipt time, or server tick. The gateway or local host attaches those values in a
trusted context.

### Results

A command returns one of three semantic outcomes:

- **Accepted:** the authority committed the decision and names its resulting events or revision.
- **Rejected:** the authority made no change and returns a stable rejection code, safe details, and
  whether retry can succeed.
- **No-op:** the request was valid but current state already satisfies it. The caller receives a
  successful outcome without inventing a misleading durable change.

Rejection codes are contracts. Examples include invalid schema, unauthorized capability, stale
revision, missing entity, invariant failure, tick outside the accepted window, duplicate request,
rate limit, and payload limit.

## Command families

One command language does not mean one privilege level.

| Family | Examples | Typical callers | Boundary |
| --- | --- | --- | --- |
| Authoring | Create entity, set component, set relationship, import asset, patch voxel region | Studio, trusted tools, sandboxed agents | Edit capability plus revision checks |
| Gameplay intent | Move intent, use ability, interact, equip, accept quest | Authenticated game clients | Authority derives actor and validates live game rules |
| Operations | Create session, publish world revision, hand off player, pause service | Trusted services and administrators | Strong service identity and audit |
| Internal | Apply worker result, install compiled asset, apply replication baseline | Session subsystems | Not addressable by untrusted transports |

Command types should express domain intent rather than expose storage operations when a deeper
operation is known. A generic property command is useful for editor-safe fields; gameplay commands
should still say `UseAbility` or `Interact` rather than let a client set arbitrary state.

## Accepted facts

Durable event envelopes identify:

- event ID;
- stream and ordered sequence;
- world and optional session;
- event type and schema version;
- authority-assigned occurrence time and optional tick;
- causating command;
- correlation chain;
- trusted actor when applicable; and
- event data.

Events state what was accepted, not what a caller hoped would happen. `ItemTransferred` is a fact;
`TransferItemRequested` is normally a command or operational message.

## Retention classes

### Durable domain events

Typical candidates include:

- authored entity, component, relationship, scene, material, and asset changes;
- approved sandbox promotions;
- inventory, equipment, currency, trade, ownership, and economy outcomes;
- progression, quests, achievements, and guild changes;
- important spawns, deaths, construction, and administrative actions; and
- published world revisions.

### Transient simulation signals

Typical signals include collision contacts, footstep cues, target-range changes, effect triggers,
animation transitions, and other live coordination that does not need permanent history.

### Session and presence state

Selection, cursor position, gizmo previews, panel layout, editor camera, and typing presence may be
retained for session restoration but do not alter project history by default.

### Telemetry and diagnostics

Rejected commands, tick overruns, shader failures, GPU validation errors, reconciliation counts, and
asset compile timing use a separate retention policy. They must not pollute domain streams.

### High-frequency state

Do not append every movement sample, physics contact, animation frame, camera update, particle,
uniform write, draw call, or replication delta to the durable event store. Runtime checkpoints and
bounded input windows cover the cases where detailed investigation or replay is worth the cost.

## Durable state and event streams

Durable state is reconstructed from compatible snapshots plus the ordered event tail. Stream
boundaries should align with concurrency and lifecycle, not with a desire to create many abstractions.

Reasonable early boundaries include project or world authoring, scenes, and versioned assets. A
separate stream for every entity is not required until concurrent writes or scaling demonstrate the
need.

An event append performs expected-sequence checking and commits the events atomically. Unknown
durable event types stop a projection with a clear compatibility error; silently skipping them could
produce plausible but incorrect state.

## Snapshots and checkpoints

A durable snapshot contains enough metadata to prove compatibility, including:

- world and revision;
- last applied event sequence;
- snapshot and schema-set versions;
- engine build and relevant subsystem versions;
- asset manifest identity; and
- creation time.

On recovery:

```text
load newest compatible snapshot
  -> rebuild disposable indexes and specialized services
  -> apply ordered event tail
  -> verify projection sequence and invariants
```

An incompatible snapshot can be discarded if the durable events remain readable. Runtime
checkpoints and client replication snapshots are separate products and must not become canonical
persistence accidentally.

## Schema evolution

Every durable command, event, component, and snapshot has an explicit schema version.

Evolution rules:

- prefer additive fields with defined defaults;
- distinguish missing from `null` deliberately;
- never persist TypeScript class names, import paths, enum ordinals, or renderer-generated types;
- use stable string type tags at durable boundaries;
- upcast older events into current in-memory forms when reading;
- keep old compatibility fixtures and full replay tests; and
- never reinterpret an old event payload silently.

Behavioral replay also records the engine build, content, physics version, tick model, and seeds when
those details affect the outcome.

## Undo, redo, and previews

Undo never deletes an accepted event. For an authored edit, the handler records or can recover the
prior value needed to issue an inverse command. That command is authorized and revision-checked like
any other request and creates a new accepted fact. Redo reissues the intended change against current
state rather than resurrecting a stale mutation blindly.

Continuous gestures do not need hundreds of durable facts. A gizmo drag or slider can update an
ephemeral preview overlay; releasing it sends one durable command. A voxel brush records a bounded
region patch per stroke or chunk, not one event per cell.

## Projection safety

Projections consume ordered events or explicit deltas. Each projection tracks the revision or
sequence it has applied. Normal updates are incremental; a deterministic rebuild path provides the
recovery and verification oracle.

Required protections include:

- sequence-gap detection;
- idempotent handling where delivery can repeat;
- stale-revision rejection;
- stable ordering of maps, sets, and relationships when hashing;
- no renderer or storage side effects inside pure decision logic; and
- metrics for projection lag and rebuild failures.

Side effects such as asset compilation or external messages occur after acceptance through explicit
adapters. Their success or failure cannot retroactively change an immutable fact; failures produce
new state, retry work, or diagnostics.

## Verification

The command and event layer needs tests at system cut points:

- every registered payload validates and round-trips through supported codecs;
- local and encoded transports produce the same result and events;
- stale revisions, duplicates, malformed IDs, oversized payloads, and unauthorized capabilities are
  rejected without mutation;
- snapshot plus tail yields the same durable projection as full replay;
- old schema fixtures upcast to the expected current state;
- compensation preserves truthful history and returns the intended state;
- incremental and rebuilt projections have the same digest; and
- high-frequency runtime activity does not grow durable domain streams.

## Open decisions

- Event-store adapter and database.
- Initial stream granularity.
- Snapshot cadence and compaction policy.
- Which gameplay outcomes require durable events in the first online slice.
- How long bounded input windows and runtime checkpoints are retained.
- Branching or collaborative history beyond compensating changes.
