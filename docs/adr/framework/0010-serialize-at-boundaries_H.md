# 0010: Serialize only at real boundaries

## Status

Accepted

## Context

Antiky data crosses modules, processes, trust boundaries, networks, and durable storage. Encoding data
between ordinary in-process modules would add allocation and parsing without improving ownership.
Using one encoding for every workload would also make human-facing tools or high-volume replication
needlessly awkward.

## Decision

We will keep in-process communication as validated native TypeScript values and typed projections.
We will serialize at process, worker, network, trust, import/export, and persistence boundaries.

Antiky will define one versioned semantic schema vocabulary while keeping codecs and transports
replaceable. JSON is the default for Studio, MCP, diagnostics, and early external protocols.
Protocol Buffers are the preferred binary option for high-volume, cross-language networking when
measurements justify it. Large assets travel as referenced or transferable binary blobs rather than
inside command and event JSON.

## Consequences

- Fixed-tick and render loops avoid JSON parsing and whole-world marshalling.
- Local and encoded transports must have contract-parity tests.
- Every persistent or external payload needs validation and schema evolution rules.
- Callers cannot send functions, live class instances, GPU handles, or other process-local state.
- More than one codec may exist, but none may redefine the domain meaning of a message.
