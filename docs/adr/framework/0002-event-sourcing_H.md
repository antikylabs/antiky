# 0002: Record only events that need durable history

## Status

Accepted

## Context

Antiky needs stored history for authoring, undo, replay, audits, and authoritative online games.

If Antiky stores every simulation update, the event log will become very large. Serialization will
also slow the simulation loop.

If Antiky treats all events as temporary notifications, Antiky will lose important history.

## Decision

Antiky will record important authoring changes and durable gameplay results as ordered, versioned
domain events. Antiky records an event only after it accepts the related change.

Antiky will use these events and compatible snapshots to rebuild durable authoring and gameplay
state.

This data will stay temporary by default:

- Frequent movement updates
- Physics contacts
- Animation state
- Camera state
- Render state
- Network updates
- User presence
- Diagnostics
- Telemetry.

Antiky will store this data only when a specific replay or audit needs it. That replay or audit must
have a clear limit.

Snapshots make state recovery faster. They do not replace the event history as the source of truth.

Undo and redo will send commands that record a correction. They will not rewrite history.

## Consequences

- Antiky can rebuild, audit, and replay important state.
- Undo history will show what changed and how Antiky corrected it.
- Event schemas need versions, migrations, a defined order, and replay tests.
- Runtime checkpoints and limited input logs can support the durable event store.
- Domain events cannot rebuild all live state.
- Antiky can select event and snapshot storage after real features prove the event model.

## Revision history

- `d5512a91c2c6719a7488b03feebe01bd24eaf93b`: Formalized selective durable event sourcing.
- `cb8ecc4b54e5607130c94fc64d568b58c9937e96`: Prior version before the plain-language rewrite.
- `d59e241c5dc6948743a5f70db1e41ae65c183b44`: Replaced em dash punctuation with standard punctuation.
