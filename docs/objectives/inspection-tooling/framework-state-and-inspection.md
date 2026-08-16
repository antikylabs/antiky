# Framework state and inspection contracts for agent-driven game work

Research snapshot: 2026-08-09. Scope is the current Antiky Framework, its Antiky game consumers,
the CLI/MCP bridge, and BroMetal only where it sits below Antiky's renderer boundary. Unity,
Unreal, Godot, and their object models are not proposed dependencies.

## Status labels

- **Verified** means the behavior exists in the inspected source or tests.
- **Documented direction** means an Antiky architecture or skill-research document describes the
  intended model, but the corresponding general framework contract does not necessarily exist.
- **Proposal** means this report recommends a new framework-owned contract. Proposed TypeScript is
  illustrative and should be reduced to the smallest contract that passes implementation and
  performance tests.

Seed skills are non-authoritative scaffolds, not accepted architecture or proof. External-engine and
community-tool research is comparative input only; it cannot define Antiky's model, API, or roadmap.

## Executive finding

The current framework has good boundary primitives but not yet a general game-state model that an
agent can inspect and control. Its strongest implemented properties are strict validation, immutable
read models, UUIDv7 world/entity/command/session identity, a bounded fixed-step session, stale-safe
single stepping, and one deep point-light authoring example. Those properties are worth preserving.

The main limitation is structural: `EngineSession` owns an ordered list of callbacks and counters,
not an implemented `World`, ECS, schema registry, command bus, replay, snapshot store, or subsystem
registry. `WorldInspection` is a bounded full-view publication format, not a query API or the source
of truth. Current Antiky games manually create a second semantic mirror of their private simulation.
The only general mutation callback, `executeCommand`, has no command identity, expected revision,
authority, schema, event outcome, or atomic state boundary. The point-light service implements many
of those ideas, but only for one property of one feature.

For production-scale agent work, the first priority is not a larger MCP tool list. It is a typed,
headless framework layer for:

1. a real world/schema/query contract;
2. coherent state fences, snapshots, diffs, and digests;
3. a general command/fact/correction boundary with trusted authority;
4. deterministic input recording and replay;
5. source-revision-safe worker results and explicit commit boundaries; and
6. typed physics, navigation, AI, gameplay, and render-projection inspection adapters.

MCP, Studio, tests, and CLI project those services. BroMetal consumes render state, never gameplay truth.

## Verified current model

### Public package boundary

- **Verified:** `@antiky/framework` exports identity, inspection, point-light, and engine-session APIs
  from its root. The portable game host is a separate `./game` export
  ([`src/index.ts`](../../../packages/framework/src/index.ts#L1),
  [`package.json`](../../../packages/framework/package.json#L6)).
- **Verified:** framework runtime source is tested to exclude Node, React, Next, BroMetal, Studio,
  MCP, and browser globals
  ([`import-boundary.test.mjs`](../../../packages/framework/tests/import-boundary.test.mjs#L6)).
  This is the correct dependency direction for all proposals below.
- **Verified:** pure BroMetal demos do not depend on Framework. They implement only the small host
  contract, so they can publish lifecycle/render measurements and accept host actions, but they have
  no Framework-owned semantic world by default
  ([`packages/demos/brometal/README.md`](../../../packages/demos/brometal/README.md#L1)).

### Stable identities

- **Verified:** `WorldId`, `EntityId`, `CommandId`, and `SessionId` are branded canonical lowercase
  UUIDv7 strings. Creation requires secure randomness; parsing checks the UUID version/variant and
  exact text form ([`ids.ts`](../../../packages/framework/src/identity/ids.ts#L5)).
- **Verified:** world, session, entity, and command identities cross current inspection and action
  boundaries. Runtime instances instead use bounded strings and are scoped to a launched runtime.
- **Missing:** there are no framework-owned `ComponentTypeId`, `RelationshipTypeId`, `SystemId`,
  `EventId`, `EventStreamId`, `AssetId`, `SnapshotId`, `WorkerTaskId`, `MutationLeaseId`, or replay/run
  identities. System/component/store identifiers are validated strings with different local rules.

### Engine session and fixed-step simulation

- **Verified:** `EngineSession` has exactly one `worldId`, a stable system order, one fixed step of
  `1/60`, a `0.05` second accepted-frame cap, and at most three steps per frame
  ([`contract.ts`](../../../packages/framework/src/sessions/engine-session/contract.ts#L3)). It is not
  yet the multi-world owning session described by the architecture documents.
- **Verified:** each frame captures one immutable input. All simulation steps planned for that frame
  receive the same input sequence and frozen value. Input object graphs are bounded to depth 32 and
  4,096 visited values; cycles, custom prototypes, and unfrozen objects are rejected or fault the
  session ([`runtime.ts`](../../../packages/framework/src/sessions/engine-session/runtime.ts#L46),
  [`runtime.ts`](../../../packages/framework/src/sessions/engine-session/runtime.ts#L197)).
- **Verified:** systems run synchronously in declared order. A system or digest exception faults the
  session permanently and publishes only a stable fault source/system ID, not the thrown message
  ([`runtime.ts`](../../../packages/framework/src/sessions/engine-session/runtime.ts#L236),
  [`engine-session.test.ts`](../../../packages/framework/tests/sessions/engine-session/engine-session.test.ts#L434)).
- **Verified:** pause reasons are independent (`user`, `tool`, `visibility`). A paused single step
  requires the caller's expected completed-step count; a retry is rejected as
  `STALE_COMPLETED_STEP` and one accepted step requests one render
  ([`runtime.ts`](../../../packages/framework/src/sessions/engine-session/runtime.ts#L348),
  [`engine-session.test.ts`](../../../packages/framework/tests/sessions/engine-session/engine-session.test.ts#L153)).
- **Verified limitation:** systems mutate caller-owned closure state directly. If a system mutates
  state and then throws, that failed step does not increment `completedStepCount`, but the framework
  has no rollback mechanism for the mutation. Earlier systems or earlier steps in the same frame may
  also have committed. The failure test deliberately observes the mutation
  ([`engine-session.test.ts`](../../../packages/framework/tests/sessions/engine-session/engine-session.test.ts#L434)).
  Therefore a completed-step counter is not currently an atomic state-commit proof.
- **Verified limitation:** the session exposes only the latest completed step. There is no input
  history, seed/random source, environment capture, checkpoint, rewind, replay, branch, or
  step-until predicate.

### Commands, authority, revisions, facts, and corrections

- **Verified:** generic `EngineSession.executeCommand` serializes one synchronous callback with the
  frame/step writer. It increments `commandSequence` for a successful callback and increments
  `worldRevision` only when that callback returns `authoringChanged: true`
  ([`contract.ts`](../../../packages/framework/src/sessions/engine-session/contract.ts#L135),
  [`runtime.ts`](../../../packages/framework/src/sessions/engine-session/runtime.ts#L421)).
- **Verified limitation:** the generic callback has no command ID/type/payload, target entity,
  expected revision, principal, permission, duplicate detection, receipt step, result schema,
  transaction, or emitted facts. It may mutate external state and incorrectly return
  `authoringChanged: false`; the framework cannot detect that. Runtime system changes never advance
  `worldRevision`. The three counters named `commandSequence`, `controlRevision`, and
  `worldRevision` therefore describe session bookkeeping, not a coherent authoring/runtime/render
  revision vector.
- **Verified:** the point-light path is substantially stronger. `SetPointLightPowerCommand` carries
  protocol and command versions, command/world/entity IDs, an expected entity revision, bounded
  data, and an optional correction link. The host supplies principal, permissions, receipt time,
  and runtime identity separately
  ([`commands.ts`](../../../packages/framework/src/point-light/commands.ts#L11),
  [`commands.ts`](../../../packages/framework/src/point-light/commands.ts#L22)).
- **Verified:** the point-light service enforces `world.light.edit`, runtime identity, duplicate
  command IDs, expected entity revision, range limits, bounded command/result/fact histories, and a
  reject-new capacity policy. An accepted change creates one immutable fact and atomically swaps the
  prepared state reference after validating the next projection
  ([`service.ts`](../../../packages/framework/src/point-light/service.ts#L372),
  [`service.ts`](../../../packages/framework/src/point-light/service.ts#L391)).
- **Verified:** correction is compensation, not deletion. A new command refers to an earlier
  command, restores its prior value only when the current revision matches, and appends a new fact
  ([`service.ts`](../../../packages/framework/src/point-light/service.ts#L505)).
- **Verified:** point-light replay starts from immutable initial authoring records and requires
  contiguous facts, matching world/entity/current value/revision, unique command IDs, and valid
  correction ancestry ([`service.ts`](../../../packages/framework/src/point-light/service.ts#L549)).
- **Missing:** these command/fact/correction guarantees are not a general registry or bus. Other
  current games have no agent mutation commands.

### Authoring, runtime, and render state

- **Verified:** the point-light service is the only implemented feature with explicit authoring,
  runtime, and render projections. All carry the same `eventSequence`; runtime/render values must
  match authoring entity revisions and power. Render bindings have unique stable entity IDs and
  temporary slots, and dirty slots can be acknowledged only at the current sequence
  ([`projections.ts`](../../../packages/framework/src/point-light/projections.ts#L28),
  [`inspection.ts`](../../../packages/framework/src/point-light/inspection.ts#L219),
  [`service.ts`](../../../packages/framework/src/point-light/service.ts#L606)).
- **Verified:** point-light runtime state can be rebuilt from initial authoring plus accepted facts.
  Render changes are a small dirty-slot projection, not a serialized GPU object.
- **Verified:** the generic world inspection can label stores as `authoring`, `runtime`, or `render`,
  but a store is only a sorted list of JSON entries. No generic state owner, projection lifecycle,
  changed-range, rebuild, or consistency contract exists
  ([`world.ts`](../../../packages/framework/src/inspection/world.ts#L39)).
- **Verified:** Combat Arena and Traversal Study keep their real simulations in game-owned mutable
  objects, then hand-author separate entities, components, stores, and event histories for
  publication ([`combat-arena/inspection.ts`](../../../packages/demos/antiky/combat-arena/src/inspection.ts#L44),
  [`traversal-study/inspection.ts`](../../../packages/demos/antiky/traversal-study/src/inspection.ts#L44)).
  These views are useful, but Framework cannot prove that omitted fields agree with the simulation.
- **Verified BroMetal boundary:** Antiky game code manually maps simulation views into BroMetal
  batches and uploads them. Framework has no implemented `RenderDriver` interface. Pure BroMetal
  studies own their own scene/simulation and can publish only host-level facts unless wrapped by an
  Antiky world.

### World, component, relationship, and store inspection

- **Verified:** `WorldInspection` is an immutable, strict schema with one world/runtime identity,
  one revision, explicit retained/available counts, up to 512 entities, 2,048 components, 1,024
  relationships, 64 stores, and 2,048 store entries
  ([`world.ts`](../../../packages/framework/src/inspection/world.ts#L14),
  [`world.ts`](../../../packages/framework/src/inspection/world.ts#L52)).
- **Verified:** components carry a stable string `typeId`, positive schema version, short summary,
  and bounded JSON data. Entity revisions are non-negative integers; component type IDs are unique
  per retained entity. Output ordering is stable and deeply frozen
  ([`world.ts`](../../../packages/framework/src/inspection/world.ts#L210),
  [`world.test.ts`](../../../packages/framework/tests/inspection/world.test.ts#L93)).
- **Verified:** `ChildOf` is the only relationship variant. Both endpoints must be present in the
  retained entity view, a child may have one parent, and cycles are rejected
  ([`world.ts`](../../../packages/framework/src/inspection/world.ts#L245),
  [`world.ts`](../../../packages/framework/src/inspection/world.ts#L305)).
- **Verified:** bounded views cannot falsely claim completeness. Available/retained counts and each
  store's `incomplete` flag must agree with the actual retained view
  ([`world.ts`](../../../packages/framework/src/inspection/world.ts#L386)).
- **Verified limitation:** there is no world CRUD/storage API, component schema registry, field
  metadata, typed non-hierarchy relationship, index/query plan, selection, spatial query, access
  scope, pagination cursor, snapshot identity, or diff. `WorldInspection` validates a publication;
  it cannot answer a selective query without rebuilding and transporting the full retained view.
- **Scale mismatch:** each component/store JSON value may be up to 8 KiB
  ([`json-value.ts`](../../../packages/framework/src/inspection/json-value.ts#L1)), while the browser
  inspection transport caps a complete message at 256 KiB
  ([`inspection-server.ts`](../../../packages/cli/src/host/inspection-server.ts#L70)). A legal
  framework view can therefore be much larger than the current transport. Increasing the transport
  cap would not solve query cost, update frequency, or memory pressure.

### Events, facts, and causal history

- **Verified:** `EventHistory` holds at most 512 retained events. It records source/world/runtime
  identity, retention lifetime/storage/overflow/capacity/drop count, explicit available/retained
  counts, and contiguous source sequence numbers
  ([`events.ts`](../../../packages/framework/src/inspection/events.ts#L17),
  [`events.ts`](../../../packages/framework/src/inspection/events.ts#L32)).
- **Verified:** each event has a type/schema version, sequence, command ID, world ID, up to 16 entity
  IDs, one revision, an ISO UTC wall time, and bounded JSON data. Current point-light facts are
  adapted into this generic history
  ([`events.ts`](../../../packages/framework/src/inspection/events.ts#L21),
  [`world-inspection.ts`](../../../packages/framework/src/point-light/world-inspection.ts#L132)).
- **Verified limitation:** Combat and Traversal synthesize command IDs from event sequence and stamp
  events with `new Date()` inside the game-owned inspection mirror, not with an authoritative
  simulation step ([`combat-arena/inspection.ts`](../../../packages/demos/antiky/combat-arena/src/inspection.ts#L48),
  [`traversal-study/inspection.ts`](../../../packages/demos/antiky/traversal-study/src/inspection.ts#L48)).
- **Missing:** event ID/stream ID, accepted simulation step and time, actor/authority, correlation and
  causation, parent facts, before/after digests, category (`durable fact` versus transient trace),
  payload registry, query cursor, and explicit links from command result to all emitted facts.

### Inspection snapshot and agent-visible controls

- **Verified:** `InspectionSnapshot` combines runtime lifecycle, runtime/render diagnostics and
  measurements, and optional session, point lights, world, and event views. It strictly validates
  cross-view runtime/world identities and deeply freezes the result
  ([`snapshot.ts`](../../../packages/framework/src/inspection/snapshot.ts#L62),
  [`snapshot.ts`](../../../packages/framework/src/inspection/snapshot.ts#L349)).
- **Verified:** `InspectionStore` increments a local publication sequence and synchronously invokes
  all subscribers ([`snapshot.ts`](../../../packages/framework/src/inspection/snapshot.ts#L398)).
  It has no replay, backpressure, exception isolation, base snapshot, timestamp, or content digest.
- **Verified:** `GameInspectionPort` exposes a full snapshot plus optional point-light set/correct and
  pause/resume/single-step methods. It is feature-specific rather than capability-discovered
  ([`host.ts`](../../../packages/framework/src/game/host.ts#L67)).
- **Verified:** current MCP reads development/build/runtime/render/diagnostic/session status, full
  world inspection, the retained event log, and point lights. Actions reload, capture only the game
  canvas, pause/resume/step, and mutate/correct point-light power
  ([`tools.ts`](../../../packages/cli/src/mcp/tools.ts#L3),
  [`tools.ts`](../../../packages/cli/src/mcp/tools.ts#L107)).
- **Verified:** the CLI accepts runtime publications only in increasing publication order, requires a
  replacement runtime to start at sequence 1, and retires old runtime IDs
  ([`runtime-connection.ts`](../../../packages/cli/src/host/runtime-connection.ts#L97)).
- **Verified:** the action broker allows one pending action, associates it with development session,
  runtime instance, build revision, and action ID, and rejects mismatched results. Session control
  results are reparsed and checked against returned session status
  ([`actions.ts`](../../../packages/cli/src/host/actions.ts#L237),
  [`actions.ts`](../../../packages/cli/src/host/actions.ts#L401)).
- **Missing:** entity/component/system query parameters, input injection, replay, snapshots/diffs,
  causal trace, break/watch controls, scoped generic mutation, subsystem tools, and a state fence
  relating a canvas capture to the exact authoring/runtime/render revisions it depicts.

### Digests and determinism

- **Verified:** `getStateDigest` is optional and returns an arbitrary non-empty string of at most 256
  characters after each successful step. Framework records only the latest digest
  ([`runtime.ts`](../../../packages/framework/src/sessions/engine-session/runtime.ts#L216)).
- **Verified:** tests prove equal callbacks, inputs, and elapsed-frame sequence produce equal current
  demo step records/digests in one JS environment
  ([`engine-session.test.ts`](../../../packages/framework/tests/sessions/engine-session/engine-session.test.ts#L219)).
- **Verified limitation:** the framework does not define digest algorithm, canonical bytes, included
  state, build/schema version, per-subsystem digests, or cross-platform promise. Combat and Traversal
  round a handful of fields and omit most state from their digest
  ([`combat-arena/simulation.ts`](../../../packages/demos/antiky/combat-arena/src/simulation.ts#L344),
  [`traversal-study/simulation.ts`](../../../packages/demos/antiky/traversal-study/src/simulation.ts#L288)).
  A matching current digest is a useful smoke signal, not state equivalence proof.

### Worker-result safety

- **Verified:** no general worker task/result contract exists in `packages/framework`.
- **Verified adjacent safety:** browser action results are matched to one pending action ID and
  runtime instance, and parsed according to their result kind. This prevents a stale browser action
  from completing another active action, but it does not carry a source world revision, snapshot
  digest, subsystem revision, input digest, or safe application phase
  ([`browser-envelope.ts`](../../../packages/cli/src/host/browser-envelope.ts#L77),
  [`actions.ts`](../../../packages/cli/src/host/actions.ts#L401)).
- **Documented direction:** Antiky intends one command/tick writer per world and requires expensive
  worker results to carry their source revision and apply only at a safe boundary
  ([`world-and-session-model_A.md`](../../architecture/framework/world-and-session-model_A.md#L60)).
  The required stale-worker test is listed, but the implementation is open
  ([`world-and-session-model_A.md`](../../architecture/framework/world-and-session-model_A.md#L293)).

## Priority gap register

| Priority | Missing framework contract | Why agents and large games need it | Current evidence |
| --- | --- | --- | --- |
| **P0** | Real `World` plus runtime schema/component/relationship/system registries | Agents cannot discover fields, units, limits, edit rules, ownership, or system dependencies; games cannot share query/mutation semantics | `WorldInspection` is output-only; architecture lists storage/query/schema as open decisions |
| **P0** | Coherent `StateFence` and atomic read transaction | Current session/world/event/render/publication revisions have different meanings; reads and captures cannot prove they describe one state | Snapshot validates identity, not an authoring/runtime/render revision vector |
| **P0** | General command bus, trusted authority, fact envelope, and compensation | Only point-light power has expected revision, permission, duplicate safety, history, and correction | `executeCommand` is an untyped callback |
| **P0** | Deterministic input trace, seed/environment services, checkpoint and replay | Pause/step cannot inject a declared trace or reproduce a defect; latest digest alone is insufficient | MCP step uses current live semantic input; only latest step is retained |
| **P0** | Explicit step/command commit semantics | A failed system can leave unrevisioned partial state | Systems mutate arbitrary closures before failure is known |
| **P0** | Revision-fenced worker tasks/results | Mesh, nav, asset, AI, snapshot, and path workers can otherwise apply results to changed worlds | Documented but unimplemented |
| **P0** | Query/pagination/diff transport | A full legal inspection can exceed the 256 KiB transport and repeated full snapshots will not scale | Full no-argument `get_world_inspection`; no cursor or diff |
| **P1** | Debug trace, watchpoints, per-system timings, changed-state attribution | Agents need to explain *why* state changed, not only observe the latest value | Diagnostics have only runtime/render sources and coarse measurements |
| **P1** | Physics inspection/query contract | Collision shapes, bodies, contacts, broadphase state, casts, sleep, layers, and deterministic query evidence are invisible | Physics exists only in game-owned math today |
| **P1** | Navigation inspection/query and rebuild contract | Path failures and stale async nav builds need versioned mesh/path evidence | No navigation API; worker safety is absent |
| **P1** | AI decision-state and gameplay subsystem adapters | Complex behavior requires bounded views of state machines/behavior trees, blackboards, abilities, effects, cooldowns, inventory, quests, and ownership | Components can contain arbitrary JSON summaries only |
| **P1** | Render-world and `RenderDriver` contract | Agents need stable mapping from semantic entities to prepared draw data and changed ranges without inspecting GPU handles | Only point-light slots/dirty changes are modeled; all BroMetal integration is manual |
| **P1** | Mutation lease/sandbox/proposed-change contract | Multiple agents need explicit scope, one-writer control, validation, readback, conflict, and promotion semantics | CLI serializes one action, but Framework has no lease or sandbox |
| **P2** | Durable snapshot/event adapters and migrations | Long sessions, saves, branches, and recoveries cannot replay from in-memory runtime histories alone | Point-light history is bounded in-memory and reject-new |
| **P2** | Zone/streaming/interest and network correction contracts | Large worlds and multiplayer need scoped state, baselines, authority handoff, and prediction correction | Architecture direction only; not required for the first local gameplay cell |

## Proposed foundation contracts

### 1. Identity and state fences

Do not use one `number` called revision for every lifetime. Brand identities and counters at compile
time and publish one immutable fence whenever state crosses a boundary.

```ts
type Brand<Value, Name extends string> = Value & { readonly __brand: Name };
type ComponentTypeId = Brand<string, 'ComponentTypeId'>;
type RelationshipTypeId = Brand<string, 'RelationshipTypeId'>;
type SystemId = Brand<string, 'SystemId'>;
type EventId = Brand<string, 'EventId'>;
type EventStreamId = Brand<string, 'EventStreamId'>;
type SnapshotId = Brand<string, 'SnapshotId'>;
type WorkerTaskId = Brand<string, 'WorkerTaskId'>;
type MutationLeaseId = Brand<string, 'MutationLeaseId'>;
type StateDigest = Readonly<{
  algorithm: 'sha256'; canonicalSchemaVersion: 1; value: string;
}>;
type StateFence = Readonly<{
  sessionId: SessionId; worldId: WorldId; runtimeInstanceId: string;
  buildDigest: StateDigest; schemaDigest: StateDigest;
  authoringRevision: number; runtimeStep: number; runtimeRevision: number;
  renderRevision: number; commandSequence: number; eventSequence: number;
  stateDigest: StateDigest;
}>;
```

Rules:

- A fence describes one committed read point. It is not assembled from independently sampled
  counters.
- Every query page, diff, snapshot, event page, worker request/result, mutation result, diagnostic
  trace, and capture includes the applicable fence.
- The digest contract declares canonical ordering, numeric encoding, included state classes, and
  build/schema identity. Optional subsystem digests help localize divergence.
- A render revision can lag a runtime revision, but the mapping is explicit. A capture reports the
  render fence actually presented.
- Runtime aliases/slots never appear as durable IDs without their scope and persistent-owner mapping.

### 2. Runtime component and system schema registry

The registry is executable metadata, not TypeScript reflection and not a Studio-only object model.

```ts
type ComponentFieldSchema = Readonly<{
  path: string;
  valueType: 'boolean' | 'integer' | 'number' | 'string' | 'vec2' | 'vec3' |
    'quat' | 'color-linear' | 'entity-ref' | 'asset-ref' | 'enum' | 'record' | 'array';
  units?: string; minimum?: number; maximum?: number; enumValues?: readonly string[];
  visibility: 'public' | 'developer' | 'restricted'; editable: boolean; persisted: boolean;
}>;
type ComponentDefinition<T> = Readonly<{
  typeId: ComponentTypeId; schemaVersion: number;
  stateClass: 'authoring' | 'runtime' | 'render';
  fields: readonly ComponentFieldSchema[];
  defaults(): Readonly<T>; parse(input: unknown): Readonly<T>;
  migrate?(fromVersion: number, input: unknown): Readonly<T>;
  digest(value: Readonly<T>): StateDigest; editPermission?: string;
}>;
type SystemDefinition = Readonly<{
  id: SystemId;
  phase: 'command' | 'pre-physics' | 'physics' | 'post-physics' | 'gameplay' |
    'ai' | 'projection';
  after: readonly SystemId[]; reads: readonly ComponentTypeId[]; writes: readonly ComponentTypeId[];
  determinism: 'required' | 'build-local' | 'nondeterministic-isolated';
  commitPolicy: 'staged' | 'checkpoint-rollback' | 'declared-partial';
}>;
```

The first implementation can use simple maps. Storage can later move to compact arrays without
changing public query meaning. The registry must expose field units/limits/edit rules to CLI/MCP and
Studio while keeping restricted fields and implementation objects out of inspection.

### 3. World read and query port

Replace full-view-only access with a consistent, budgeted read transaction. Keep a convenience
bounded overview for humans, but build tools on queries.

```ts
type EntityQuery = Readonly<{
  worldId: WorldId;
  all?: readonly ComponentTypeId[]; any?: readonly ComponentTypeId[];
  none?: readonly ComponentTypeId[]; entityIds?: readonly EntityId[];
  relatedTo?: Readonly<{ typeId: RelationshipTypeId; entityId: EntityId; direction: 'in' | 'out' }>;
  spatial?: Readonly<{ regionId?: string; aabb?: readonly [number, number, number, number, number, number] }>;
  projection: 'authoring' | 'runtime' | 'render'; fields?: readonly string[];
  order: 'entity-id' | 'distance' | 'changed-revision'; limit: number; cursor?: string;
}>;
type QueryPage<T> = Readonly<{
  fence: StateFence; values: readonly T[]; nextCursor: string | null; availableCount: number | null;
  incompleteReason: 'none' | 'page-limit' | 'visibility' | 'cost-budget';
}>;
interface WorldReadTransaction {
  readonly fence: StateFence;
  queryEntities(query: EntityQuery): QueryPage<Readonly<{
    entityId: EntityId; label: string; entityRevision: number;
    components: readonly Readonly<{
      typeId: ComponentTypeId; schemaVersion: number;
      value: InspectionJsonValue; componentRevision: number;
    }>[];
  }>>;
  queryRelationships(query: RelationshipQuery): QueryPage<RelationshipView>;
  queryStore(query: StoreQuery): QueryPage<StoreEntryView>; close(): void;
}
interface WorldReadPort { beginRead(expected?: Partial<StateFence>): WorldReadTransaction }
```

Cursor tokens must be opaque, short-lived, bound to the caller's visibility scope and one fence,
and rejected after their read snapshot expires. Query cost/rows/bytes/time require explicit budgets.
Never expose a predicate callback or arbitrary code execution through MCP.

### 4. Snapshots and diffs

Inspection snapshots are views; recovery snapshots are compatible state checkpoints. Name and type
them separately.

```ts
type WorldSnapshotManifest = Readonly<{
  snapshotId: SnapshotId; fence: StateFence;
  kind: 'authoring' | 'runtime-checkpoint' | 'replay-checkpoint';
  contentDigest: StateDigest;
  chunks: readonly Readonly<{
    chunkId: string; byteLength: number; sha256: string;
    entityRange?: readonly [EntityId, EntityId];
  }>[];
}>;
type WorldDiff = Readonly<{
  base: StateFence; target: StateFence;
  changes: readonly (
    | Readonly<{ kind: 'entity-created' | 'entity-removed'; entityId: EntityId }>
    | Readonly<{ kind: 'component-set' | 'component-removed'; entityId: EntityId;
        typeId: ComponentTypeId; beforeRevision: number | null; afterRevision: number | null;
        value?: InspectionJsonValue }>
    | Readonly<{ kind: 'relationship-set' | 'relationship-removed'; value: RelationshipView }>
  )[];
  nextCursor: string | null; digest: StateDigest;
}>;
```

Diff application requires exact base-fence agreement and produces the declared target digest.
Unknown component/event schema versions stop application. Large/binary assets are referenced by
stable asset ID/content hash and transported separately. Publish small coalesced diffs between
occasional full overviews instead of serializing the world every 250 ms.

### 5. General command, result, fact, and correction contracts

Preserve the point-light split between untrusted request data and host-supplied authority.

```ts
type CommandEnvelope<Data> = Readonly<{
  protocolVersion: 1; commandVersion: number; commandId: CommandId; type: string;
  sessionId: SessionId; worldId: WorldId;
  targets: readonly EntityId[];
  expected: Readonly<{ authoringRevision?: number;
    entityRevisions?: Readonly<Record<string, number>>;
    runtimeStepWindow?: readonly [number, number] }>;
  correlationId?: string; causationId?: CommandId | EventId;
  data: Readonly<Data>;
}>;

type TrustedCommandContext = Readonly<{
  principalId: string; permissions: ReadonlySet<string>; visibilityScope: string;
  receivedAt: string; acceptedAtStep: number; runtimeInstanceId: string;
  mutationLeaseId?: MutationLeaseId;
}>;

type CommandResult<Result> = Readonly<{
  commandId: CommandId | null;
  code: 'ACCEPTED' | 'NO_OP' | 'INVALID' | 'DENIED' | 'STALE_REVISION' |
    'DUPLICATE' | 'RULE_REJECTED' | 'CAPACITY_REACHED' | 'BUSY';
  retry: 'never' | 'same-command' | 'new-command-after-read';
  before: StateFence | null; after: StateFence | null; emittedEventIds: readonly EventId[];
  result?: Readonly<Result>;
}>;

type DomainFact<Data> = Readonly<{
  eventId: EventId; streamId: EventStreamId; streamSequence: number;
  type: string; schemaVersion: number; sessionId: SessionId; worldId: WorldId;
  entityIds: readonly EntityId[]; sourceCommandId: CommandId;
  correlationId?: string; causationId?: CommandId | EventId;
  acceptedAtStep: number; occurredAt: string;
  authority: Readonly<{ principalId: string; class: 'user' | 'agent' | 'gameplay' | 'service' }>;
  before: StateFence; after: StateFence; data: Readonly<Data>;
}>;
```

Required semantics:

- Register command parsers, byte/cost limits, permissions, target-scope checks, and handlers by
  stable type/version.
- Decide and commit at the single world writer. The handler returns staged updates/facts; it does
  not mutate arbitrary external closure state before acceptance.
- Cache final results by command ID for retry. A duplicate returns the original safe decision.
- `NO_OP` is successful without a false revision/fact. Rejection never advances authoritative
  state.
- A generic correction command references the prior command/facts, but domain code defines a valid
  compensation. Never implement history deletion or arbitrary "undo last command."
- Durable facts, transient simulation signals, diagnostics, and telemetry use different stores and
  retention rules.

### 6. Deterministic time, input, random, and replay

Fixed delta is necessary but insufficient. Every authoritative system should receive services in
its step context rather than read wall time, random globals, device state, network, or environment
implicitly.

```ts
type SimulationInputFrame<Input> = Readonly<{
  inputSequence: number; firstStep: number; lastStep: number;
  input: Readonly<Input>; digest: StateDigest;
}>;

type ReplayManifest<Input> = Readonly<{
  replayId: string; frameworkVersion: string; buildDigest: StateDigest;
  schemaDigest: StateDigest; initialSnapshot: WorldSnapshotManifest; fixedDeltaSeconds: number;
  randomStreams: readonly Readonly<{ streamId: string; algorithm: string; seed: string }>[];
  environment: InspectionJsonValue; inputs: readonly SimulationInputFrame<Input>[];
  externalResults: readonly Readonly<{ type: string; step: number; digest: StateDigest;
    data: InspectionJsonValue }>[];
  checkpoints: readonly Readonly<{ step: number; fence: StateFence;
    subsystemDigests: Readonly<Record<string, StateDigest>> }>[];
}>;

interface ReplayControl<Input> {
  start(manifest: ReplayManifest<Input>): ReplayRun;
  inject(frame: SimulationInputFrame<Input>, expected: StateFence): CommandResult<never>;
  step(expected: StateFence, count: number): StepBatchResult;
  stepUntil(expected: StateFence, watch: RegisteredWatchPredicate, max: number): StepBatchResult;
  checkpoint(expected: StateFence): WorldSnapshotManifest;
}
```

Input should be action/axis based and include source-device metadata only when gameplay semantics
need it. A live MCP `step_simulation` must accept either a named recorded input frame or an explicit
validated input payload; silently sampling the current keyboard/pointer state is not reproducible.
Replay results report the first divergent subsystem/step and both expected/actual digests.

Cross-platform equality should be promised only for named, tested system groups and compatible
builds. Physics engines, floating-point modes, worker scheduling, and GPU behavior require explicit
determinism classifications rather than a universal claim.

### 7. Step transactions and system execution evidence

The world writer needs an explicit state-commit model. A practical first design is copy-on-write or
staged component updates for authoritative data, with rebuildable runtime services allowed to use a
checkpoint/restore hook. A system that cannot roll back must declare a partial-commit policy and may
not participate in a replay-certified authoritative phase.

```ts
type SystemStepResult = Readonly<{
  systemId: SystemId; step: number;
  status: 'COMMITTED' | 'NO_OP' | 'ROLLED_BACK' | 'FAULTED_PARTIAL';
  beforeDigest: StateDigest; afterDigest: StateDigest;
  changed: readonly Readonly<{ entityId: EntityId; componentTypeId: ComponentTypeId }>[];
  emittedSignals: number; durationMicroseconds?: number; // diagnostic only
}>;
```

The session advances `completedStepCount` only after the declared authoritative commit. If a step
faults after an unrecoverable partial mutation, publish a distinct `FAULTED_PARTIAL` state with the
last known-good checkpoint; do not let the unchanged step counter imply unchanged state.

### 8. Worker task/result application

Workers compute candidates. They never possess world mutation authority and never return live
objects, GPU handles, runtime aliases, or callbacks.

```ts
type WorkerTask<Request> = Readonly<{
  taskId: WorkerTaskId; taskType: string; taskVersion: number; worldId: WorldId;
  source: StateFence; inputDigest: StateDigest;
  limits: Readonly<{ maximumBytes: number; deadlineMilliseconds: number }>;
  request: Readonly<Request>;
}>;

type WorkerResult<Result> = Readonly<{
  taskId: WorkerTaskId; taskType: string; taskVersion: number; worldId: WorldId;
  source: StateFence; inputDigest: StateDigest;
  producer: Readonly<{ implementationId: string; implementationVersion: string }>;
  resultDigest: StateDigest; diagnostics: readonly DiagnosticRecord[]; result: Readonly<Result>;
}>;

type WorkerApplyResult = Readonly<{
  code: 'APPLIED' | 'STALE_SOURCE' | 'INVALID_RESULT' | 'DIGEST_MISMATCH' |
    'UNAUTHORIZED_TASK' | 'RECALCULATION_REQUIRED';
  taskId: WorkerTaskId; before: StateFence; after: StateFence;
}>;
```

Application rules:

1. Parse, size-limit, schema-validate, and digest the result as untrusted boundary data; match task
   ID/type/version/world/input digest and producer policy.
2. At the one world writer, compare every relevant source revision, revalidate changed assumptions,
   and apply only through a registered internal command at a named safe phase.
3. Otherwise return `STALE_SOURCE` or schedule recalculation without mutation. Navigation, for
   example, checks navmesh, obstacle, agent-profile, and target revisions.
4. Link task, source fence, internal command, and resulting fence in an audit fact or bounded trace.

Binary mesh/texture/audio/nav data uses transferable buffers or content-addressed assets outside
normal JSON commands. The result envelope carries hashes and references.

### 9. Mutation leases, sandboxes, and proposed change sets

CLI's one-pending-action rule is useful transport serialization, but framework authority needs a
world-scoped lease and conflict model.

```ts
type MutationLease = Readonly<{
  leaseId: MutationLeaseId; principalId: string; worldId: WorldId;
  scope: Readonly<{ entityIds?: readonly EntityId[]; componentTypes?: readonly ComponentTypeId[];
    commandTypes: readonly string[] }>;
  base: StateFence; expiresAt: string;
}>;

type ProposedChangeSet = Readonly<{
  changeSetId: string; sandboxWorldId: WorldId; primaryBase: StateFence;
  commands: readonly CommandEnvelope<unknown>[];
  evidenceDigests: readonly StateDigest[];
}>;
```

A lease grants only registered commands in scope. It does not expose mutable world references. A
sandbox has separate identity/history. Promotion redispatches commands against the current primary
world, reauthorizes them, and reports conflicts; it never imports live sandbox objects or event
sequence numbers.

## Proposed subsystem inspection adapters

Do not add arbitrary `eval`, raw engine-object reflection, or one enormous JSON dump. Register small
typed adapters behind the common query/fence/authority layer. Each adapter declares capabilities,
schemas, costs, visibility, determinism class, and whether operations are read-only, replay-only, or
mutating.

```ts
type CapabilityDescriptor = Readonly<{
  capabilityId: string; version: number;
  operations: readonly Readonly<{
    name: string; effect: 'read' | 'simulate' | 'mutate'; permission?: string;
    inputSchemaId: string; outputSchemaId: string; maximumResultBytes: number;
  }>[];
}>;

interface SubsystemInspectionAdapter<Query, Result> {
  readonly descriptor: CapabilityDescriptor;
  query(fence: StateFence, query: Query): QueryPage<Result>;
}
```

### Physics

Required read models:

- Bodies/colliders: stable owner entity, shape asset/version, transform, velocity, mass/mode, sleep,
  layer/mask, material, broadphase region, and physics-world revision.
- Evidence/queries: bounded step-linked contact/manifold history; registered ray, shape, sweep, and
  overlap queries with units, space, filter, hit cap, deterministic ordering, and source fence.
- Diagnostics: per-step counts/timings, divergence evidence, and checkpoint/rebuild support—or an
  explicit platform/build-local determinism classification.

Mutation should occur through gameplay/authoring commands such as changing a collider definition,
never private handles. Runtime forces/impulses are typed commands scheduled for a step.

### Navigation

Required read models:

- World data: profile/mesh/tile/link/obstacle revisions and content digests.
- Agents: owner, dimensions/capabilities, path request/status, corridor/waypoints, avoidance, failure
  code, and accepted step; plus bounded path/nearest/reachability queries.
- Rebuild evidence: task identity, source fence, dirty regions, result digest, application result,
  and affected agents.

Navigation rebuild/path worker results must compare all relevant source revisions. A path computed
against an old navmesh cannot be applied merely because the entity revision is unchanged.

### AI

Required read models:

- Stable agent/controller IDs; state/goal/task and transition reason/step.
- Typed, visibility-classified blackboards; behavior/planner asset and revision, active nodes,
  bounded decisions, scores/conditions, cooldowns, targets, and random stream.
- Perception facts with source, confidence, step age, visibility, and owner; planner worker evidence
  tied to world/navigation/knowledge revisions.

Never expose arbitrary AI code execution or hidden player/private service data through inspection.
Decision traces are bounded diagnostic windows, not durable histories by default.

### Gameplay

Games should register domain adapters for abilities, attributes, effects/statuses, inventory,
equipment, quests/objectives, interactions, teams/factions, spawns, checkpoints, and encounter state.
Each public type needs stable IDs, schema, units, ownership, authority, revision, source command/fact,
and retention. Agent mutations use intent commands (`UseAbility`, `EquipItem`, `SetEncounterTuning`),
not arbitrary component memory writes.

### Render world and BroMetal

Framework should own renderer-neutral prepared render state:

- Versioned camera/entity/material/mesh/light identities and stable draw-item-to-owner mapping.
- Visibility/culling/LOD decisions, pipeline/material keys, pass graph, changed ranges, and revision.
- Declared-availability upload/draw/instance/triangle/texture/memory/timing measurements and
  structured shader/layout/resource diagnostics linked to asset/build/render revisions.

An Antiky-owned `RenderDriver` consumes render diffs and returns acknowledgements/measurements.
BroMetal owns typed shaders, WebGPU programs, buffers, textures, targets, passes, and disposal behind
that interface. GPU handles never enter world inspection, commands, facts, or durable snapshots.
Pure BroMetal projects may remain host-only; they must adopt an Antiky world explicitly if agents
need semantic game inspection.

## Debugging and causal observability proposal

Agents need bounded evidence that answers “what changed this value?” without recording every frame
forever.

Add registered, schema-known watch expressions and breakpoints—never arbitrary JS—and bounded trace
windows filterable by step, entity/component/system/event/command/task, and severity. Record system
phase/order/status, read/write and changed sets, emitted signals, stable decision/rejection codes, and
optional performance measurements. Preserve the causal chain `command -> facts/signals -> systems ->
component diffs -> render diff -> capture`. Ring buffers report drops and support cursor reads;
exported defect evidence carries build/session/runtime/world/fence/replay IDs and redacts restricted
fields.

Timing, memory, and platform counters are observations, not deterministic state. They remain outside
state digests and durable gameplay facts.

## Contract and transport safety requirements

All boundaries retain strict schema type/version checks and finite numeric/unit, byte, depth,
collection, cost, and time limits. Return immutable clones without callbacks, prototypes, shared
mutable views, GPU/DOM objects, paths, credentials, terminal text, or private error messages. Trusted
hosts supply identity/permissions; filtering precedes paging/digesting. Separate read/mutation
authority; use one writer, leases, fences, idempotent command IDs, correlation, and typed conflicts.
Transport adapters—not Framework core—own loopback/authentication policy.
Isolate subscriber exceptions; bound queues; support cancellation, disposal, and resync after drops.
Capture only the canvas/offscreen target with hash, dimensions, encoding, and render fence—never the
desktop or terminal as fallback.

Skill research likewise recommends read-before-write, one live writer, complete provenance,
correction history, and canvas-only evidence ([orchestration research](../skill-research/orchestration-and-library-design.md#L187)).
Its Godot comparison offers structured state, real input, deterministic freeze/step, and read/write
separation as comparative patterns—not an integration target ([Godot research](../skill-research/godot.md#L111)).

## Recommended implementation sequence

### Milestone 0 — define invariants before expanding tools

Add branded IDs/counters, `StateFence`, and canonical digest fixtures. Define atomic step/command
commit semantics and prove faults cannot masquerade as unchanged state. Separate `InspectionView`,
`RecoverySnapshot`, and `ReplayCheckpoint`; publish versioned capability descriptors.

Exit gate: one small world can produce the same canonical fence/digest from different map insertion
orders, and every existing snapshot/action can be related to a committed fence.

### Milestone 1 — real world/query/command core

Implement simple-map component/relationship/system registries, read transactions, bounded queries,
visibility, paging, and diffs. Generalize point-light semantics into the command/fact core without
weakening its tests; project `WorldInspection` as a bounded overview of that world API.

Exit gate: Point Light Expo, Combat Arena, and Traversal Study use the shared world/query contract;
their public views are not hand-authored second models of omitted runtime state.

### Milestone 2 — replay and worker safety

Add explicit clock/random/environment services, action-based input, checkpoints, manifests,
injection, step batches/step-until, and divergence localization. Add worker envelopes plus one safe
apply command, first tested with navigation or mesh preparation. Chunk snapshots/diffs and resync
after loss instead of publishing the full world every 250 ms.

Exit gate: a clean headless run and an interactive run consume the same trace and reach declared
state/event/subsystem digests; a stale worker result is rejected without mutation.

### Milestone 3 — subsystem adapters and debugging

Add physics/navigation/AI/gameplay/render adapters only when real features require them, plus
watchpoints, causal traces, system diagnostics, and fence-linked canvas captures. Project those
capabilities through CLI/MCP and later Studio; do not create a second Studio-owned state model.

Exit gate: an independent QA agent can reproduce a non-trivial combat/traversal defect from a trace,
identify the causing system/command and first divergent step, inspect physics/navigation/AI/gameplay
state, and produce privacy-safe motion evidence without raw engine reflection.

### Milestone 4 — persistence, sandboxes, and scale

Add compatible durable snapshots/event adapters, sandbox/proposed-change promotion, zones/streaming,
and online baselines/corrections only after the local contracts above are stable and measured.

## Explicit non-goals

Do not copy external-engine schemas or make MCP, Studio, browser hosts, or BroMetal authoritative.
Do not expose eval, raw WebGPU objects, or mutable world references. A full JSON mirror is not an
ECS, replay, or atomic snapshot; fixed time and short digests do not prove universal determinism.
Never derive generic mutation from component schemas without domain authority/invariants, treat
larger transport limits as scalability, or cite pure BroMetal studies as semantic inspection.

## Decision summary

Preserve strict immutable parsing, UUIDv7 identity, stale-safe stepping, point-light authority/facts,
projection rebuilds, and runtime/action identity checks. Generalize those semantics before bespoke
tools. Decide the state fence and commit model first: every query, command, fact, diff, replay,
worker result, diagnostic, and capture depends on the exact committed state it describes.
