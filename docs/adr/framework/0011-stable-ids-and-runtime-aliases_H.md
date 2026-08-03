# 0011: Use stable IDs and disposable runtime aliases

## Status

Accepted

## Context

Entities and assets must remain identifiable across saves, commands, events, tools, servers, and
renames. Persistent strings are not appropriate for repeated lookup inside simulation, networking,
or rendering hot paths.

## Decision

We will use opaque UUIDv7 strings for persistent entity, world, asset, command, event, and session
identity. Names and paths are labels, not identity.

Runtime worlds, network connections, and render batches may map persistent IDs to their own dense
integer aliases. Each alias is scoped to one representation and will never be persisted or treated
as globally meaningful.

## Consequences

- References remain stable across sessions, renames, distributed creation, and event history.
- UUIDv7 values are time-sortable but callers must not infer domain meaning from their bytes.
- Explicit index maps add memory and lifecycle work.
- Hot loops can use dense numeric indexes after resolving identity at the boundary.
- Tests must prevent one representation's alias from leaking into another or into durable data.
