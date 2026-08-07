# 0010: Serialize data only when it crosses a real boundary

## Status

Accepted

## Context

Serialization converts live data to a format for storage or transfer.

Antiky data crosses modules, processes, security boundaries, networks, and durable storage. If two
modules are in one process, serialization adds memory use and parsing work. It does not clarify data
ownership.

One data format cannot serve every need well. Human-readable tools and large network updates have
different needs.

## Decision

Code in one process will exchange validated TypeScript values and typed state updates. Antiky will
serialize data at these boundaries:

- Processes
- Workers
- Networks
- Trust boundaries between different permission levels
- Import and export
- Durable storage.

Antiky will define one versioned schema that describes the meaning of its data. Antiky can replace
the data format and transport without changing that meaning.

JSON is the default format for Studio, MCP, diagnostics, and early external protocols.

Protocol Buffers are the preferred binary format for large network workloads that use more than one
programming language. Antiky will use them only when measurements show a need.

Commands and events will refer to large assets. They will not contain those assets in JSON. Antiky
will transfer large assets by reference or as transferable binary data.

## Consequences

- Fixed-tick and render loops do not parse JSON or copy the complete world.
- Local and serialized transports must pass the same contract tests.
- Each stored or external message needs validation and rules for schema changes.
- Callers cannot send functions, live class objects, GPU handles, or other state that belongs to one
  process.
- Antiky can use more than one data format. Each format must keep the same message meaning.

## Revision history

- `4c35b270f3da017454b12dd75e104b0c50355818` — Prior version before the plain-language rewrite.
