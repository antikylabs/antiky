# Commands, Events, and Persistence

**In Progress**

## Purpose

This guide explains how Antiky requests, accepts, records, and reverses changes. It also explains
temporary signals, durable history, and safe state copies.

It expands these framework ADRs:

- [0002: Record only events that need durable history](../../adr/framework/0002-event-sourcing_H.md)
- [0007: Use commands to change world state](../../adr/framework/0007-commands-as-mutation-boundary_H.md)
- [0010: Serialize data only when it crosses a real boundary](../../adr/framework/0010-serialize-at-boundaries_H.md).

## Vocabulary

| Term | Meaning |
| --- | --- |
| Command | A request to change authoritative state. The system can accept it, reject it, or make no change. |
| Trusted command context | Caller identity, permissions, receipt time, and server step that the authority supplies. The command data does not supply these values. |
| Durable domain event | An ordered fact that Antiky stores in authoritative history. Antiky does not change the fact after storage. |
| Transient signal | A temporary notification for simulation or display work. Antiky does not keep it in permanent history. |
| Telemetry | Measurements about time, rejections, errors, and capacity. |
| Projection | A state copy that Antiky builds from accepted events or updates. |
| Read model | A read-only view for Studio, agents, clients, or operations. |
| Snapshot | A checkpoint that makes recovery or replay faster. Antiky can rebuild it. |
| Compensation | A later command and event that correct an earlier fact without deleting it. |

An event is not always durable. An event bus sends notifications. An event store keeps ordered
history. Each event type must state how long Antiky keeps it.

## How commands enter

Studio panels, MCP tools, game clients, services, tests, and administration tools do not receive
world objects that they can change. They send commands to the session that owns the target world.

The end-to-end path is:

1. Decode the command if it crossed an encoded boundary.
2. Validate the command envelope and data schema.
3. Identify the caller and attach trusted context.
4. Check permissions for the command type, target, and entity scope.
5. Detect a duplicate command ID or client sequence.
6. Check the revision, simulation-step window, rate limit, and data-size limit.
7. Use current authoritative state to decide the command result.
8. If durable history is necessary, store all related events as one operation.
9. Apply accepted events and runtime updates to the state copies.
10. Schedule limited side effects and publish changes to read-only views.
11. Return a structured result.

Local callers use the same command path. They do not encode and decode a command only because the
caller and handler are different modules.

## Command data

A command envelope contains the information that all local and remote connections need:

- Protocol and data-schema versions
- Command ID
- Target session and world IDs
- Command type
- Command data
- Expected authoring revision, when applicable
- Requested or source simulation step, when applicable
- Client sequence for retry and order, when applicable
- Data that links related operations.

An untrusted command must not set its own permissions, authenticated account, authoritative player
entity, receipt time, or server step. The gateway or local host supplies these trusted values.

### Results

A command has one of three results:

- **Accepted.** The authority committed the decision. The result names the new events or revision.
- **Rejected.** The authority made no change. The result contains a stable rejection code, safe
  details, and retry information.
- **No-op.** The request was valid, but the current state already satisfies it. The result reports
  success without a false durable change.

External clients can depend on rejection codes. Codes include:

- Invalid schema
- Missing permission
- Stale revision
- Missing entity
- Failed world rule
- Simulation step outside the permitted window
- Duplicate request
- Rate limit
- Data-size limit.

## Command groups

All callers use one command language. They do not have the same permissions.

| Family | Examples | Usual callers | Required checks |
| --- | --- | --- | --- |
| Authoring | Create an entity, set a component, set a relationship, import an asset, or change a voxel region | Studio, trusted tools, and sandboxed agents | Edit permission and revision checks |
| Gameplay intent | Move, use an ability, interact, equip an item, or accept a quest | Authenticated game clients | The server identifies the player and checks live game rules |
| Operations | Create a session, publish a world revision, hand off a player, or pause a service | Trusted services and administrators | Strong service identity and an audit record |
| Internal | Apply a worker result, install a compiled asset, or apply a client-update baseline | Session systems | Untrusted connections cannot use these commands |

A command must state the intended game action when Antiky knows that action. It must not expose a
storage operation instead.

The editor can use a general property command for fields that are safe to edit. A game client must
use commands such as `UseAbility` or `Interact`. It cannot set arbitrary state.

## Accepted facts

A durable event envelope contains:

- Event ID
- Event stream and sequence number
- World ID and optional session ID
- Event type and schema version
- Time and optional simulation step from the authority
- Source command
- IDs that link related operations
- Trusted player or service, when applicable
- Event data.

An event states what the authority accepted. It does not state what a caller wanted. For example,
`ItemTransferred` is a fact. `TransferItemRequested` is usually a command or service message.

## What Antiky stores

### Durable domain events

Antiky can store these facts as durable events:

- Changes to authored entities, components, relationships, scenes, materials, and assets
- Approved sandbox changes
- Inventory, equipment, currency, trade, ownership, and economy results
- Progress, quests, achievements, and guild changes
- Important spawns, deaths, construction, and administration actions
- Published world revisions.

### Transient simulation signals

Temporary signals include collision contacts, footstep cues, target-range changes, effect triggers,
and animation transitions. These live updates do not need permanent history.

### Session and presence state

Antiky can keep selection, cursor position, edit previews, panel layout, editor camera, and typing
presence to restore a session. This data does not change project history by default.

### Telemetry and diagnostics

Rejected commands, slow simulation steps, shader failures, GPU errors, correction counts, and asset
compile times use separate storage rules. They must not enter game-event streams.

### High-frequency state

Do not store every movement sample, physics contact, animation frame, camera update, particle, GPU
value change, draw call, or client update as a durable event.

For a limited investigation or replay, use runtime checkpoints and input windows with clear limits.

## Durable state and event streams

Antiky rebuilds durable state from a compatible snapshot and later events in sequence. Event-stream
boundaries must match concurrent work and object lifecycles. Do not create many streams without a
measured need.

Early streams can contain project or world authoring, scenes, and versioned assets. Do not create a
stream for each entity until concurrent writes or scale show a need.

Before it stores an event, Antiky checks the expected sequence number. Antiky stores all related
events as one operation.

An unknown durable event type must stop a state-copy update with a clear compatibility error. Antiky
must not skip it and produce state that appears correct.

## Snapshots and checkpoints

A durable snapshot contains information that proves compatibility:

- World ID and revision
- Last applied event sequence
- Snapshot and schema-set versions
- Engine build and relevant system versions
- Asset-manifest ID
- Creation time.

On recovery:

```text
load newest compatible snapshot
  -> rebuild disposable indexes and specialized services
  -> apply ordered event tail
  -> verify projection sequence and invariants
```

Antiky can discard an incompatible snapshot if it can still read the durable events. Runtime
checkpoints and client snapshots have different purposes. They must not become the source of truth
for durable state.

## Schema changes

Each durable command, event, component, and snapshot has an explicit schema version.

Evolution rules:

- Prefer new optional fields with defined default values.
- Give different meanings to a missing value and `null` only when necessary.
- Do not store TypeScript class names, import paths, enum numbers, or renderer-generated types.
- Use stable text tags for types at durable boundaries.
- Convert older events to current in-memory forms when Antiky reads them.
- Keep old compatibility examples and complete replay tests.
- Do not silently change the meaning of old event data.

A replay must record the engine build, content, physics version, simulation-step model, and random
seeds when these values affect the result.

## Undo, redo, and previews

Undo never deletes an accepted event. For an authoring change, the handler records or can recover the
previous value. Undo uses that value in a correction command.

Antiky checks the permissions and revision for this command. If Antiky accepts it, the command
creates a new fact. Redo sends the intended change again against current state.

A continuous edit does not need hundreds of durable facts. A drag control or slider can change a
temporary preview. When the user releases the control, Studio sends one durable command.

A voxel brush records one limited region change for each stroke or chunk. It does not record one
event for each cell.

## Keep state copies correct

A projection applies ordered events or explicit updates to a state copy. Each projection records the
revision or sequence that it applied.

Normal projections copy only changed data. A complete, repeatable rebuild supplies recovery and a
known result for tests.

Required protections include:

- Detect missing sequence numbers.
- Make repeated delivery safe when it can occur.
- Reject stale revisions.
- Sort maps, sets, and relationships before Antiky calculates a hash.
- Keep renderer and storage actions out of decision code.
- Measure state-copy delay and rebuild failures.

Actions such as asset compilation or external messages occur after acceptance through defined
adapters. A later success or failure cannot change a stored fact.

A failure produces new state, retry work, or diagnostics.

## Verification

The command and event layer needs these boundary tests:

- Each registered message validates and returns unchanged through each supported data format.
- Local and encoded connections produce the same result and events.
- Invalid requests do not change state. Tests include stale revisions, duplicates, malformed IDs,
  large messages, and missing permissions.
- A snapshot with later events produces the same durable state as a complete replay.
- Old schema examples convert to the expected current state.
- A correction preserves true history and returns the intended state.
- Small state updates and a complete rebuild produce the same state digest.
- Frequent runtime activity does not add data to durable game-event streams.

## Open decisions

- Event-store adapter and database
- Initial event-stream size and scope
- Snapshot schedule and storage cleanup rules
- The gameplay results that need durable events in the first online feature
- Retention time for limited input windows and runtime checkpoints
- Branching or collaborative history beyond correction commands.
