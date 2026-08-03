# Protocols and Serialization

**In Progress**

## Purpose

This guide defines how Antiky moves data without confusing module mapping with wire encoding. It
expands framework ADR
[0010](../../adr/framework/0010-serialize-at-boundaries_H.md) and supports the command and projection
architecture described elsewhere.

## Four distinct operations

| Operation | Meaning | Example |
| --- | --- | --- |
| Projection or mapping | Convert one in-process representation into another with typed code | Apply an authored transform delta to the runtime transform store |
| Serialization | Encode a versioned value contract as text or bytes | Encode a command as JSON for a detached Studio connection |
| Deserialization | Decode and validate text or bytes into a trusted data-transfer value | Validate a gameplay input batch at the gateway |
| Marshalling | Move data across an ownership or memory boundary and adapt layout or handles | Transfer an `ArrayBuffer` to an asset worker |

Module separation does not require serialization. Interfaces, ownership, package dependencies, and
tests enforce in-process boundaries without paying encode/decode cost.

## Boundary rule

Serialize when the receiver cannot safely share the sender's memory, trust, or type system. This
normally includes:

- process and worker boundaries;
- network boundaries;
- untrusted tool and client ingress;
- durable storage;
- import and export formats; and
- independent services or languages.

Do not serialize merely because data moves from authoring to runtime, runtime to rendering, or the
render world to the local BroMetal driver.

## Boundary matrix

| Boundary | Default representation | Encoding |
| --- | --- | --- |
| Studio panel to local session | Validated typed command object | None |
| Detached Studio to engine host | Versioned DTO | JSON initially |
| MCP to sandbox | Capability-scoped tool input and command DTO | JSON |
| Browser main thread to worker | Structured DTO plus transferable buffers | Structured clone or transfer |
| Command handler to projections | Native events and typed deltas | None |
| Runtime to render extraction | Dense indexes, typed arrays, dirty lists | None |
| Render world to local driver | Typed frame and resource deltas | None |
| Gameplay client to gateway | Input or intent contract | JSON in prototypes; compact binary when measured |
| Server replication to client | Interest-filtered snapshot and delta contract | Compact binary when scale requires it |
| Durable event store | Versioned event envelope | Canonical JSON or binary behind the store interface |
| Asset storage or transfer | Manifest and content-addressed blob | Binary blob |

The table selects defaults, not permanent transport products. The semantic contract remains the same
when a codec changes.

## Contract layers

Antiky separates four concerns:

1. **Semantic schema:** field meaning, units, identity, invariants, and compatibility.
2. **Codec:** typed object, JSON, Protocol Buffers, structured clone, or another measured encoding.
3. **Transport:** direct call, IPC, worker message, WebSocket, HTTP, or durable adapter.
4. **Policy:** who may send the message, to which target, at what rate and size.

A transport or codec cannot change the meaning of a command. Local and remote clients should receive
equivalent accept/reject behavior for equivalent trusted contexts.

## One vocabulary, multiple codecs

Versioned command, event, component, snapshot, diagnostic, and replication definitions form the
shared vocabulary.

JSON is the default for:

- Studio and browser development;
- MCP and agent tools;
- diagnostics and inspectable logs;
- compatibility fixtures; and
- early external protocols where throughput is not yet a bottleneck.

Protocol Buffers are the preferred binary option when high-volume, cross-language MMO networking or
snapshots demonstrate the need. Adopting them does not require local TypeScript callers to encode a
message, and it does not make Protobuf field layout the internal world model.

Compression, quantization, and delta encoding are additional measured choices. They belong to the
specific high-volume path rather than every protocol.

## Local and strict transports

A direct local transport passes validated immutable values to the command handler. A strict test
transport should encode, decode, validate, and freeze the same payload before dispatch.

The strict path catches accidental boundary leaks such as:

- functions;
- class instances;
- `Map` and `Set` values without a declared representation;
- `undefined`, `NaN`, or infinity;
- ambient filesystem or process handles;
- GPU resources; and
- runtime or render aliases used as persistent identity.

Protocol tests use the strict path. Production local calls avoid its parsing cost after equivalent
validation has been established.

## Schema identity and evolution

The protocol version describes connection-level compatibility. Each payload type has its own schema
version. Builds and snapshots additionally identify engine, physics, schema set, and asset manifest
when behavior depends on them.

Rules:

- use stable string tags for durable and external types;
- brand IDs internally and validate their external string form;
- define units and coordinate conventions in the contract;
- use additive evolution with defaults where practical;
- reject unknown commands;
- stop durable projection on unknown event types;
- retain golden fixtures for supported old versions; and
- sort unordered collections before canonical hashing.

The runtime schema implementation may generate JSON-compatible descriptions for tools, but no
specific validation library is yet architectural authority.

## Large and binary data

Commands and events carry semantic edits and asset references, not megabytes of mesh, texture,
audio, animation, or voxel data.

Large artifacts use:

- an `AssetId` and content hash;
- a versioned manifest;
- compiler identity and settings;
- an independent binary blob; and
- validation diagnostics.

Workers receive transferable buffers where possible. Networks and stores cache or stream blobs
separately. An accepted event points to the asset version that became authoritative.

## Hot-path representations

External clarity and internal performance use different representations:

| Semantic value | Hot representation |
| --- | --- |
| Persistent UUIDv7 entity ID | Dense runtime, connection, or render alias |
| Transform in named world units | Numeric component arrays and origin-relative `Float32` render data |
| Component string type and schema | Registry code scoped to a compatible build or negotiated protocol |
| Voxel region edit | Chunk-local compact patch and deterministic compile job |
| Compiled geometry asset | Transferable typed arrays and GPU buffers |
| Replication meaning | Interest-filtered, quantized delta against an acknowledged baseline |

Mappings are explicit. A hot representation is never persisted as though it had the semantic value's
lifetime or scope.

## Trust and safety

Deserialization creates untrusted data, not trusted authority. At ingress Antiky must:

- cap message, collection, string, and blob-reference sizes;
- validate schemas and finite numeric ranges;
- derive identity and capabilities outside the payload;
- enforce rate, sequence, revision, and tick windows;
- reject unknown message types;
- avoid leaking secrets or sensitive internals in diagnostics; and
- log safe correlation identifiers for traceability.

Studio IPC and local MCP still cross trust boundaries. Local does not mean trusted by default.

## Performance rules

- No JSON encode/decode in fixed-tick or render inner loops.
- No whole-world clone for Studio, AI, persistence, networking, or rendering updates.
- No persistent UUID comparison inside a hot loop after resolution.
- No per-entity per-frame allocation where a reusable buffer or stable slot works.
- No large blob embedded in routine command or event payloads.
- No synchronous durable write or asset compile on the render-submission path.
- No binary codec introduced without measurements from the path it improves.

Diagnostics should measure payload bytes, decode and validation time, queue depth, persistence append
latency, replication bytes, snapshot size, transfer copies, and render upload bytes.

## Verification

- Golden fixtures cover every supported payload and previous schema version.
- Local, strict local, and external transports produce equivalent semantic outcomes.
- Fuzz and property tests reject malformed IDs, non-finite numbers, oversized collections, and
  unsupported values.
- Cross-language fixtures are required before a Protobuf contract is relied on by another runtime.
- Canonical manifests and snapshots hash identically regardless of map insertion order.
- Import rules prevent GPU and UI types from entering protocol definitions.
- Performance tests confirm that no encoder is invoked by fixed-tick systems or render extraction.

## Open decisions

- Exact schema and validation tooling.
- Studio-to-engine transport and process placement.
- The first path that warrants Protocol Buffers.
- Network quantization and compression rules.
- Durable event encoding and database adapter.
- Worker transfer versus shared-memory strategy for large buffers.
