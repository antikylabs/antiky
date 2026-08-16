# ACP and selection vocabulary

This document defines the identities, states, and bounded data records used throughout the plan. It
prevents an ACP session, Antiky development session, render selection, and chat turn from being
treated as the same lifecycle.

## ACP-side terms

### Agent profile

`AgentProfileV1` is user-local launch configuration for one already installed ACP agent:

- stable Studio-local profile ID and display label;
- absolute executable or a host-resolved trusted executable identifier;
- argument array;
- documented environment pass-through names and non-secret overrides;
- ACP protocol preference fixed to stable v1 for this objective.

The profile is not part of `.antiky`, does not contain a provider API token, and is not an ACP
Registry installation record. The host resolves and validates it before every launch.

### ACP host instance

One native in-memory owner of ACP processes. It has its own generation so late async messages from a
retired process cannot enter a new Studio session.

### ACP connection

One initialized client-to-agent protocol connection over the child process's stdio. Connection
identity and process identity are temporary. They do not identify a conversation after restart.

### ACP session

One agent-owned conversation/session created for the active Antiky project. Its agent-supplied
session ID is opaque. The first product slice has at most one active ACP session and process.

### Turn

One prompt submitted through the ACP session and its ordered updates until a terminal stop reason.
Only one turn is active in the first slice. A cancellation targets that turn and is idempotent from
the Studio user's perspective.

### Agent update

A native-host-normalized, strictly sequenced view model derived from standard ACP notifications and
requests. React never receives raw JSON-RPC or SDK objects. Unknown or unsupported updates are either
represented as a bounded unsupported item or rejected with a safe diagnostic; they are not silently
reinterpreted.

## Antiky-side terms

### Development session

The CLI-owned local project-service session identified by `developmentSessionId`. It owns the game,
inspection, and MCP services. It is not an ACP session.

### Observation

The `ObservationRefV1` carried by `DevelopmentSnapshotV2`. It fences one accepted build and runtime
observation. Selected context is captured from exactly one snapshot and never combines values from
multiple observations.

### Selected target

The stable target recorded by Framework selection. The first implemented variant is an `EntityId`
resolved by the BroMetal selection path. A render item, voxel, sprite, or batch can provide evidence,
but the stable owner entity remains the primary target unless an inspectable stable asset target is
available.

### GPU-to-ECS trace

The semantic trace from a displayed selection to its stable owner and available render/world data.
It does **not** mean a tree of live WebGPU or BroMetal objects. Temporary GPU IDs are resolved inside
the driver and do not cross that boundary.

### Complete ancestor path

Every retained `ChildOf` parent from the selected entity through a world root, in root-to-target
order. It is not a copy of every entity. It is complete only if every link and entity is present and
the relevant world relationship view is not truncated in a way that could hide a parent.

### Semantic resource entry

A bounded authoring, runtime, or render store entry explicitly associated with the selected entity by
Framework inspection. Its data may name stable asset, material, geometry, pipeline, or pass keys.
Opaque JSON is evidence supplied by that store; Studio does not infer a dependency graph from field
names.

## Context contracts

### `SelectionContextInspectionV1`

Framework owns the semantic context derived from one validated `InspectionSnapshot`:

```text
schemaVersion: 1
owner: "framework"
contextId: deterministic identity from runtime/world/selection/world revision
selection: the current stable Framework selection record
world: world ID, runtime instance ID, world revision
target: entity ID, label, revision, component summaries and values
ancestors: root-to-parent entity summaries
relatedStores: store identity/kind/completeness plus matching entries
completeness: complete flag plus stable reason codes and source counts
```

The actual implementation may refine field names before code depends on them, but it must preserve
these meanings, exact validation, deterministic ordering, and bounded collections. It must not add
project paths or process data because Framework does not own those values.

### `DevelopmentSelectionContextV1`

CLI wraps the Framework context with the development boundary:

```text
schemaVersion: 1
owner: "cli"
contextId: stable hash or canonical key of all dispatch-relevant identities
developmentSessionId
acceptedBuildRevision
project: name and revision; no unrestricted path in agent content
observation: ObservationRefV1
context: SelectionContextInspectionV1
```

The full project working directory remains ACP session setup data owned by the native host. It is not
repeated in every context turn.

### Completeness reasons

At minimum the projection distinguishes:

- `world-view-incomplete`;
- `relationship-view-incomplete`;
- `ancestor-not-retained`;
- `target-not-retained`;
- `store-view-incomplete`;
- `resource-trace-unavailable`;
- `selection-observation-mismatch`.

Stable machine codes drive UI and tests. Human messages may improve without becoming protocol
authority. A context can be useful and incomplete; it cannot describe itself as full.

## Selection-follow mode

Selection-follow is an explicit property of the active Studio ACP session. When enabled, Studio
submits one generated selection turn for each new eligible `DevelopmentSelectionContextV1`.

An eligible context is current, belongs to the active project/development/ACP session, resolves its
selected target, and has not already been submitted. A partial context remains eligible only when its
reasons are visible in the attached content. A stale snapshot, missing target, incompatible context,
or selection clear is not eligible.

The generated turn contains a visible short instruction such as “Inspect the current Studio
selection; use Antiky MCP for fresh or deeper state,” followed by the versioned context. This is not a
hidden system instruction.

## Dispatch identity and ordering

`contextId` plus the ACP session ID forms the deduplication key. It covers at least the development
session, accepted build/observation, runtime instance, world, world revision, and selection revision
or request identity. It must not depend on polling time or React render count.

The first slice permits:

- one active ACP turn;
- zero or one pending selection context;
- replacement of the pending context by a newer eligible context;
- dispatch of that latest context after the active turn terminates;
- user cancellation without silently discarding the visible pending state.

It does not queue every click. Coalescing preserves the user's latest inspection intent and prevents
an unbounded paid prompt backlog.

## ACP content projection

The native/Studio adapter maps the context to standard ACP v1 prompt content based on negotiated
capabilities. The baseline is bounded UTF-8 text containing canonical JSON. If the agent advertises
compatible embedded context, the adapter may use the standard resource content form while retaining a
visible textual label. Studio defines no custom ACP method and does not depend on draft v2.

## Lifecycle state

The public Studio projection uses an explicit state machine:

```text
unconfigured -> stopped -> starting -> ready -> prompting
                         \-> failed      |       |
                              ^          v       v
                              +------ stopping <-+
```

`ready` means initialization and an ACP project session both succeeded. Process alive is not enough.
Every state carries the current host generation and safe identity fields needed to reject late
events.

## Options and cost

Keeping contexts as untyped prompt strings would avoid two schemas, but it would erase validation,
completeness, and reuse. A single large cross-package DTO would blur Framework world meaning with CLI
project/process meaning. The selected nested contracts cost additional parsers and test fixtures, but
each owner remains clear and future adapters can reuse the same value.

## Explicit exclusions

This vocabulary does not define durable transcript IDs, multiple concurrent ACP sessions, ACP proxy
chains, registry package IDs, Studio-owned model/authentication settings, durable selection history,
feedback comments, arbitrary asset targets, or live GPU resource identity.
