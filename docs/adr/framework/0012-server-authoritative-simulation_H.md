# 0012: Make online simulation server-authoritative

## Status

Accepted

## Context

Emberwyrd has online and MMO ambitions. A client-controlled state model would allow clients to claim
positions, damage, inventory, ownership, or cooldown outcomes and would make later authority a
fundamental rewrite.

## Decision

We will run authoritative gameplay decisions and simulation in server-hosted `EngineSession`
instances. Clients send bounded input batches and gameplay intent. The authenticated gateway derives
the actor and policy context; the session validates rules, simulates outcomes, and publishes
interest-filtered replication.

Clients may predict presentation and local movement, then reconcile with server state. Replication
is a purpose-built projection of relevant current state and cues, not a broadcast of the durable
event log.

## Consequences

- Clients cannot directly establish authoritative position, damage, inventory, or ownership.
- Server and client must share compatible gameplay semantics, build metadata, and input contracts.
- Prediction and reconciliation improve responsiveness but add implementation and testing cost.
- Interest management, session placement, checkpoints, and cross-session handoff become server
  responsibilities.
- Durable event history remains selective; per-frame replication stays transient.
