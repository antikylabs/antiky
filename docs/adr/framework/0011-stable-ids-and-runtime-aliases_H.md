# 0011: Use stable IDs and temporary numeric aliases

## Status

Accepted

## Context

An entity or asset must keep the same identity across:

- Saved data
- Commands
- Events
- Tools
- Servers
- Name changes.

Simulation, network, and render code must find objects many times per second. Long text IDs are not
efficient for these frequent operations.

## Decision

Antiky will use UUIDv7 strings for stable IDs. These IDs will identify entities, worlds, assets,
commands, events, and sessions. The ID text does not contain information about the object.

Names and paths are labels. A name or path can change, but the stable ID stays the same.

A numeric alias is a temporary integer that maps to a stable ID. Runtime worlds, network
connections, and render batches can create their own numeric aliases.

Each alias belongs to one state copy and one lifetime. Antiky will not save an alias or use it as a
global ID.

## Consequences

- References keep the same ID across sessions, name changes, creation on different computers, and
  event history.
- UUIDv7 values support time-based sorting. Callers must not infer any other meaning from their
  bytes.
- Maps between stable IDs and numeric aliases use memory and need lifecycle management.
- Frequent operations can use compact numeric aliases after they resolve the stable ID.
- Tests must prevent an alias from entering a different state copy or durable data.

## Revision history

- `6facfccaf4614340a4181b4361f77117e59a5e76`: Prior version before the plain-language rewrite.
- `d59e241c5dc6948743a5f70db1e41ae65c183b44`: Replaced em dash punctuation with standard punctuation.
