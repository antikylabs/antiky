# 0007: Use commands as the mutation boundary

## Status

Accepted

## Context

Studio, agents, gameplay clients, services, tests, and future administrative tools all need to
request changes. Direct access to shared mutable world objects would bypass validation, authority,
revision checks, audit history, and consistent notifications.

## Decision

We will route every meaningful mutation from outside an authoritative session through a versioned
command. Command ingress will validate the schema, derive trusted identity, authorize capabilities,
deduplicate requests, enforce revisions or tick windows, and schedule accepted work. Handlers will
return a structured acceptance or rejection and emit durable events or transient deltas as required.

Internal fixed-tick systems may update runtime state through session-owned APIs; they are not forced
to encode each frame change as a command.

## Consequences

- All callers share one validated path without receiving equal permissions.
- Undo, audit, conflict detection, sandbox promotion, and authoritative networking have a common
  foundation.
- Commands and rejection codes become versioned public contracts.
- Simple local edits incur validation and dispatch work, but not serialization when they stay in
  process.
- Bypassing command ingress is limited to private, session-owned runtime implementation.
