# 0002: Selectively event-source durable state

## Status

Accepted

## Context

Antiky needs durable authoring history, undo, replay, auditability, and authoritative online-game
state. Persisting every simulation update would create an enormous log and put serialization in hot
paths. Treating all events as transient notifications would lose the history those workflows need.

## Decision

We will record meaningful accepted authoring changes and durable gameplay outcomes as ordered,
versioned domain events. Durable authoring and gameplay state will be projections of those events and
compatible snapshots.

High-frequency movement, physics contacts, animation, camera state, rendering, replication deltas,
presence, diagnostics, and telemetry will remain transient unless a specific bounded replay or audit
requirement justifies retaining them. Snapshots are rebuildable accelerators, not replacement truth.
Undo and redo will issue inverse or compensating commands rather than rewrite history.

## Consequences

- Important state can be rebuilt, audited, replayed, and changed through truthful undo history.
- Event schemas require explicit versions, migrations, ordering, and replay tests.
- Runtime checkpoints and bounded input logs may complement the durable event store.
- Not every live state can be reconstructed from domain events alone.
- Event-store and snapshot implementations can be selected after the domain vocabulary is proven.

## Revision history

- `d5512a91c2c6719a7488b03feebe01bd24eaf93b` — Formalized selective durable event sourcing.
