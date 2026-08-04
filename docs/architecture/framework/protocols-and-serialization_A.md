# Protocols and Serialization

**In Progress**

## Purpose

This guide explains how Antiky moves data inside one process and across system boundaries. It keeps
in-process state mapping separate from data encoding.

It expands framework ADR
[0010: Serialize data only when it crosses a real boundary](../../adr/framework/0010-serialize-at-boundaries_H.md).
It also supports the command and state-copy architecture in the other guides.

## Four ways to move data

| Operation | Meaning | Example |
| --- | --- | --- |
| Projection or mapping | Copy data from one in-process form to another with typed code | Apply an authoring transform update to runtime transform storage |
| Serialization | Encode versioned data as text or bytes | Encode a command as JSON for a separate Studio process |
| Deserialization | Decode and validate text or bytes as a data-transfer value | Validate a group of gameplay inputs at the gateway |
| Marshalling | Move data across a memory or ownership boundary and change its layout or handles | Transfer an `ArrayBuffer` to an asset worker |

Separate modules do not require serialization. Interfaces, ownership, package dependencies, and
tests enforce boundaries in one process. They do not add encoding and decoding work.

## When to serialize

Serialize data when the receiver cannot safely share the memory, trust level, or type system of the
sender. This rule usually applies at:

- Process and worker boundaries
- Network boundaries
- Entry points for untrusted tools and clients
- Durable storage
- Import and export formats
- Independent services or programming languages.

Do not serialize data only because it moves between authoring, runtime, and render state. Do not
serialize data between the local render state and BroMetal driver.

## Default format at each boundary

| Boundary | Default representation | Encoding |
| --- | --- | --- |
| Studio panel to local session | Validated typed command object | None |
| Separate Studio process to engine host | Versioned data-transfer object | JSON at first |
| MCP to sandbox | Permission-limited tool input and command object | JSON |
| Browser main thread to worker | Structured data object and transferable buffers | Structured clone or transfer |
| Command handler to state copies | Native events and typed updates | None |
| Runtime state to render preparation | Compact indexes, typed arrays, and changed-item lists | None |
| Render state to local driver | Typed frame and resource updates | None |
| Gameplay client to gateway | Input or intended-action contract | JSON for prototypes, then measured compact binary |
| Server updates to client | Relevant snapshot and update contract | Compact binary when scale requires it |
| Durable event store | Versioned event envelope | Standard JSON or binary behind the storage interface |
| Asset storage or transfer | Manifest and content-addressed data | Binary data |

The table gives default choices, not permanent products. A data-format change must not change the
meaning of the data.

## Parts of a data contract

Antiky separates four parts of a data contract:

1. **Schema.** This defines field meanings, units, IDs, rules, and compatibility.
2. **Data format.** Examples include typed objects, JSON, Protocol Buffers, and structured clones.
3. **Connection method.** Examples include direct calls, process messages, WebSockets, HTTP, and
   storage adapters.
4. **Permission rules.** These define who can send a message, its target, its rate, and its size.

A connection method or data format cannot change the meaning of a command. Local and remote clients
must get the same result when their trusted context is the same.

## One vocabulary, multiple data formats

Versioned definitions for commands, events, components, snapshots, diagnostics, and client updates
form one shared vocabulary.

JSON is the default for:

- Studio and browser development
- MCP and agent tools
- Diagnostics and readable logs
- Compatibility test examples
- Early external protocols that do not have a measured speed problem.

Protocol Buffers are the preferred binary format for large network workloads that use different
programming languages. Measurements from online games or snapshots must first show the need.

Local TypeScript callers do not need to encode messages because Antiky uses Protocol Buffers
elsewhere. Protocol Buffer fields also do not become the internal world model.

Compression, lower-precision numbers, and change-only encoding are separate choices. Use them only
on a high-volume path that measurements identify.

## Local and strict test connections

A direct local connection sends validated values to the command handler. Callers cannot change these
values. A strict test connection encodes, decodes, validates, and freezes the same data before use.

The strict path catches accidental boundary leaks such as:

- Functions
- Class objects
- `Map` and `Set` values without a defined data form
- `undefined`, `NaN`, or infinity
- File-system or process handles
- GPU resources
- Runtime or render aliases used as persistent IDs.

Protocol tests use the strict connection. Production local calls do not parse encoded data after
tests prove equivalent validation.

## Schema versions and changes

The protocol version describes compatibility for a connection. Each message type has its own schema
version.

Builds and snapshots also identify the engine, physics version, schema set, and asset manifest when
these items affect behavior.

Rules:

- Use stable text tags for durable and external types.
- Use branded IDs internally and validate their external text form.
- Define units and coordinate rules in the contract.
- Add optional fields with defaults when practical.
- Reject unknown commands.
- Stop durable state updates when an event type is unknown.
- Keep test examples for supported old versions.
- Sort unordered collections before Antiky calculates a repeatable hash.

The runtime schema code can generate JSON-compatible descriptions for tools. The project has not
selected a required validation library yet.

## Large and binary data

Commands and events contain meaningful changes and asset references. They do not contain large mesh,
texture, audio, animation, or voxel data.

Large artifacts use:

- An `AssetId` and content hash
- A versioned manifest
- Compiler ID and settings
- Independent binary data
- Validation diagnostics.

Workers receive transferable buffers when possible. Networks and storage systems cache or stream
binary data separately. An accepted event identifies the asset version that became authoritative.

## Data for frequent operations

External contracts and frequent internal operations use different data forms:

| Semantic value | Hot representation |
| --- | --- |
| Persistent UUIDv7 entity ID | Compact runtime, connection, or render alias |
| Transform in defined world units | Numeric component arrays and origin-relative `Float32` render data |
| Component text type and schema | Registry code for a compatible build or agreed protocol |
| Voxel region change | Compact chunk change and repeatable compile job |
| Compiled geometry asset | Transferable typed arrays and GPU buffers |
| Client-update meaning | Relevant, lower-precision change from an acknowledged baseline |

Each mapping is explicit. Antiky does not store an internal data form as if it had the lifetime or
scope of the public value.

## Trust and safety

Decoded data is still untrusted. At each external entry point, Antiky must:

- Limit message, collection, text, and binary-reference sizes.
- Validate schemas and finite number ranges.
- Get identity and permissions from outside the message.
- Enforce rate, sequence, revision, and simulation-step limits.
- Reject unknown message types.
- Keep secrets and sensitive internal data out of diagnostics.
- Log safe IDs that link related operations.

Studio process messages and local MCP still cross trust boundaries. Local data is not trusted by
default.

## Performance rules

- Fixed-step and render loops must not encode or decode JSON.
- Do not copy the complete world for Studio, AI, storage, networking, or render updates.
- After ID resolution, a frequent loop must not compare persistent UUIDs.
- Reuse a buffer or stable slot instead of allocating data for each entity in each frame.
- Do not put large binary data in a normal command or event.
- Render submission must not wait for a durable write or asset compilation.
- Do not add a binary data format without measurements from the path that needs it.

Diagnostics should measure payload bytes, decode and validation time, queue depth, persistence append
time, client-update bytes, snapshot size, transfer copies, and render-upload bytes.

## Verification

- Standard test examples cover each supported message and previous schema version.
- Local, strict local, and external connections produce the same results.
- Generated-input tests reject malformed IDs, nonfinite numbers, large collections, and unsupported
  values.
- Cross-language test examples are necessary before another runtime depends on a Protocol Buffer
  contract.
- Standard manifests and snapshots have the same hash for every map insertion order.
- Import rules prevent GPU and UI types from entering protocol definitions.
- Performance tests confirm that fixed-step systems and render preparation do not call an encoder.

## Open decisions

- Exact schema and validation tools
- Studio-to-engine connection and process locations
- The first path that needs Protocol Buffers
- Network precision and compression rules
- Durable event format and database adapter
- Worker transfer or shared-memory design for large buffers.
