# World authoring and Studio inspection audit

Research snapshot: 2026-08-09

## Scope

This report audits the current Antiky Framework, CLI, Studio, Antiky demos, architecture, and
game-development skill research for world and level authoring. It focuses on what an agent needs to
create and revise production-scale worlds without corrupting authoring state, losing identity, or
claiming success without readback.

The report uses these evidence labels:

- **Current:** Implemented in source and supported by current tests or a working demo path.
- **Accepted direction:** Described in accepted ADRs or maintained architecture. It is not proof of
  implementation.
- **Gap:** Required for the stated workflow but not present in the current evidence.
- **Recommendation:** An Antiky-native service or contract that still needs a complete slice.

Seed and public skills are non-authoritative workflow scaffolding. They do not define Antiky
behavior or prove capability. External editors contribute comparative patterns only. Unreal, Unity,
and Godot object models and editor APIs are not implementation targets.

## Executive finding

Antiky has a credible control-plane foundation, but it does not yet have a general world-authoring
system.

The current foundation includes:

- UUIDv7 world, entity, command, and session IDs;
- immutable and size-bounded semantic world inspection;
- stable entity labels, component summaries, entity revisions, and validated `ChildOf` trees;
- separate named authoring, runtime, and render views;
- a fixed-step `EngineSession` with one command boundary, command order, a world revision, pause,
  retry-safe single-step, and state digests;
- one complete point-light mutation path with a permission, expected entity revision, duplicate
  command detection, accepted fact, correction command, projection updates, and readback;
- a shared CLI, HTTP, MCP, and Studio development connection;
- scoped game-canvas capture with build, runtime, session, hash, and file metadata;
- a read-only Studio hierarchy, component/store records, event history, diagnostics, MCP call
  history, live game frame, and simulation controls;
- a catalog asset installer that records provider, upstream hashes, local hashes, license, and
  attribution in a project registry.

The current authoring proof is deliberately narrow. Only point-light power has a semantic edit
command. Studio does not select world objects or edit them. The game iframe is a live game surface,
not an editor viewport. The world view is one bounded snapshot, not a queryable production outliner.
Component `data` is opaque JSON without field metadata. Scenes, zones, streaming, prefabs,
archetypes, asset references, terrain editing, navigation authoring, editor cameras, multi-selection,
atomic command batches, durable undo history, world sandboxes, change-set promotion, and conflict
review are not implemented.

Most demo content is authored directly in TypeScript. Antiky Town constructs geometry, props,
vegetation, water, paths, and colliders through large game-specific functions. Combat Arena and
Traversal Study publish useful semantic hierarchy views, but their world and many entity revisions
advance with simulation. Those are runtime observation revisions, not durable authoring concurrency
tokens. A live edit cannot yet be saved back to a stable world artifact.

The next step should not be a large Studio UI or hundreds of MCP tools. It should be one deep
`WorldAuthoringService` proven with a small durable scene slice. That service must own schema
discovery, revision-aware queries, selection targets, validated commands, atomic change sets,
correction, projection readback, and persistence. Studio, CLI, MCP, tests, and agents should adapt
the same service.

## Authority boundary that must remain

The accepted architecture has the correct ownership direction:

```text
Studio UI ───────┐
CLI / MCP ───────┼─> shared queries and commands -> EngineSession -> authoring world
Tests ───────────┘                                      |               |
                                                       v               v
                                                  runtime world -> render world -> BroMetal
```

The following invariants should remain non-negotiable:

1. Framework services own semantic world rules. Studio owns presentation, selection session state,
   previews, and editor-camera intent.
2. A panel, MCP handler, or agent never receives mutable world, renderer, or GPU objects.
3. BroMetal remains below the Antiky render boundary. Render slots and GPU handles do not become
   durable world identities.
4. One authoritative writer orders mutations for each world. Parallel agents can prepare change
   packets, but they cannot concurrently drive one live world.
5. A command identifies its stable target and expected revision. Trusted identity, permissions,
   receipt time, and authoritative step come from the host.
6. Authoring, runtime, and render state remain distinct. Readback must state which projection has
   applied a change.
7. A sandbox proposal is reapplied through primary-world commands. Antiky never copies live sandbox
   objects, aliases, or event sequence numbers into the primary world.
8. Source-file edits and live world edits are different authorities. A workflow must state how an
   accepted authoring revision becomes a durable project artifact and a build.

These rules follow the [Framework overview](../../architecture/framework/overview_A.md),
[world and session model](../../architecture/framework/world-and-session-model_A.md),
[commands and persistence guide](../../architecture/framework/commands-events-and-persistence_A.md),
and [Studio architecture](../../architecture/studio/overview_A.md).

## Current implementation

### Stable identity

**Current:** [`identity/ids.ts`](../../../packages/framework/src/identity/ids.ts) creates and parses
canonical lowercase UUIDv7 values for `WorldId`, `EntityId`, `CommandId`, and `SessionId`. The world
inspection and point-light command paths validate these types at every encoded boundary. Demos also
use stable UUIDv7 constants for inspected entities.

**Current:** A point-light render slot is a temporary numeric binding associated with an entity ID.
It demonstrates the durable-ID-to-temporary-slot direction without persisting the slot as identity.

**Accepted direction:** [ADR 0011](../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md)
also calls for stable IDs for assets and events, with scoped numeric aliases in runtime, network, and
render state.

**Gap:** Current ID code does not define `AssetId`, `AssetRevisionId`, `SceneId`, `ZoneId`,
`PrefabId`, `TransactionId`, `ChangeSetId`, `SandboxId`, or `EventId`. Runtime alias types and alias
lifecycle services are also not implemented. Catalog IDs such as `poly-haven:forest-floor` are useful
source identities, but they are not project-stable Antiky asset IDs.

### World and hierarchy inspection

**Current:** [`inspection/world.ts`](../../../packages/framework/src/inspection/world.ts) publishes:

- one stable world and runtime identity;
- a world revision and explicit incomplete status;
- up to 512 entities and 2,048 component summaries;
- an entity label, revision, and unique component type IDs;
- up to 1,024 validated `ChildOf` relationships;
- at most one parent for each child, with self-parenting and cycles rejected;
- up to 64 named semantic stores and 2,048 total store entries;
- authoring, runtime, and render store kinds;
- stable sorting, cloned bounded JSON, strict keys, and immutable results;
- available and retained counts for honest truncation.

This is a strong inspection envelope. It prevents Studio and agents from reading private Maps,
classes, renderer objects, and GPU resources.

**Current:** The Studio [inspection panel](../../../packages/studio/app/src/components/InspectionPanel.tsx)
constructs a visible tree from the retained `ChildOf` relationships. It keeps unparented entities as
roots and shows stable IDs, revisions, component summaries, JSON data, and named stores.

**Gap:** `get_world_inspection` takes no query arguments. It cannot return an entity by ID, a subtree,
ancestors, children, related entities, entities with a component, entities in a spatial scope, or a
page tied to a stable snapshot revision. The validation contract requires each retained relationship
to reference retained entities. As a result, an incomplete 512-entity view cannot describe a child
whose parent is outside the retained page. It reports truncation but gives no path to the omitted
entities.

**Gap:** Only `ChildOf` has a typed public relationship. The architecture names `Targets`, `Owns`,
`UsesAsset`, and `GeneratedBy`, but current inspection cannot represent them as relationships.

**Gap:** `ChildOf` has no relationship ID, revision, or sibling order. World inspection sorts
relationships by child ID, and Studio therefore inherits UUID order for siblings. A production
outliner needs an explicit stable order or order key plus a revision-checked move operation. It must
not treat a label, array index, or current UUID sort as authored hierarchy order.

### Entities, components, and properties

**Current:** A world inspection entity has a stable ID, a label, an integer revision, and component
summaries. Each summary has a stable text type ID, schema version, text summary, and opaque bounded
JSON data.

**Current:** The point-light vertical slice defines real validators for a position-only `Transform`
and a `PointLight` with linear RGB color, radius, and power. It uses defaults and finite limits. The
authoring record has an entity revision.

**Gap:** There is no generic entity store, component registry, component query API, or component
mutation API. The Framework architecture explicitly leaves the physical ECS and runtime schema
library open. A summary's JSON shape does not tell Studio or an agent:

- which fields are authoring fields instead of runtime observations;
- field types, units, coordinate space, defaults, ranges, enum options, null rules, or step size;
- which fields are editable, previewable, persistent, computed, sensitive, or read-only;
- which permission and command family changes a field;
- how an older schema migrates;
- whether a value is inherited from a prefab or is an instance override.

**Gap:** The current transform has position only. There is no shared rotation, scale, local/world
space, parent-relative transform, transform hierarchy propagation, or batch transform command.

**Gap:** There are no generic commands to create, clone, delete, rename, enable, reparent, add or
remove a component, or patch a permitted component property.

### Engine session and command ordering

**Current:** [`EngineSession`](../../../packages/framework/src/sessions/engine-session/contract.ts)
owns a fixed clock and one `worldId`. It exposes ordered system execution, pause reasons, a retry-safe
single step, command sequence, control revision, world revision, and an optional state digest.
`executeCommand` rejects a concurrent call as `SESSION_BUSY`. It increments the world revision only
when the command callback reports `authoringChanged: true`.

**Current:** The development action broker also allows only one pending browser action. It rejects a
second action as busy and correlates each result with the active runtime and action ID. A runtime
replacement or stale response cannot silently complete an old action.

**Gap:** `executeCommand` is an ordering boundary, not an authoring transaction. It accepts an opaque
callback. It does not stage writes, validate a command batch, record a rollback image, atomically
commit multiple events and files, or undo partial state mutations if the callback changes state and
then throws. A callback failure faults the session, but a session fault is not proof that no state
changed.

**Gap:** The implemented session owns one exposed `worldId`; it does not create, enumerate, compare,
or dispose multiple primary, preview, prefab, or sandbox worlds as described by the architecture.

### Point-light authoring proof

**Current:** The point-light service is the only complete semantic authoring slice. It provides:

- a versioned command and result schema;
- a stable command, world, and entity ID;
- a trusted principal, permission list, receipt time, and runtime identity;
- a `world.light.edit` permission;
- a 4 KiB command limit;
- duplicate-command detection;
- expected entity revision and `STALE_REVISION`;
- finite value limits and `NO_OP` behavior;
- one accepted fact with the old and new power;
- an event sequence and resulting entity revision;
- authoring, runtime, and render projections;
- dirty render-slot readback;
- correction by a new command and fact;
- ordered replay and full projection rebuild checks.

This is the correct model for future authoring families.

**Gap:** It edits only `PointLight.power`. It cannot change transform, color, radius, entity structure,
or another component. Its command and fact history is in memory, limited to 256 entries, and rejects
new history at capacity. A runtime replacement loses it. A correction is an undo proof for one field;
there is no generic undo group or redo.

**Gap:** The current host supplies the same broad local-development principal and point-light edit
permission for this action family. It does not yet enforce project, world, zone, entity, component,
or property scopes.

### CLI and MCP automation

**Current:** The MCP adapter exposes 17 static tools:

- ten reads for development, build, runtime, render, diagnostics, session, world, events, and point
  lights;
- reload and exact game-canvas capture;
- pause, resume, and retry-safe single-step;
- set and correct point-light power.

MCP `tools/list` supplies strict JSON schemas and useful read/action/idempotency annotations. CLI and
Studio use the same typed development client and local host. See
[`mcp/tools.ts`](../../../packages/cli/src/mcp/tools.ts) and the
[CLI development guide](../../user-facing-docs/cli/development.md).

**Current:** Runtime publications have a monotonically increasing publication sequence. The host
rejects retired runtime IDs and stale or skipped publications. Builds expose an accepted revision,
and actions include the active build and runtime identity.

**Gap:** Tool discovery is static protocol discovery. It does not discover registered worlds,
component schemas, editable fields, command families, permissions, limits, undoability, preview
support, batch support, job barriers, projection readback, or host capabilities.

**Gap:** There is no generic `query_world`, `get_entity`, `get_component_schema`, `set_selection`,
`pick_viewport`, `preview_change`, `apply_change_set`, `get_change_receipt`, `create_sandbox`,
`compare_sandbox`, `promote_change_set`, `place_asset`, or spatial authoring tool.

### Studio today

**Current:** Studio Slice 00 explicitly shipped a read-only workspace. It includes the live game,
native terminal, session controls, hierarchy, stores, raw snapshot, event history, MCP call history,
and diagnostics. The [archived objective summary](../_archives/2026-08-10-studio-summary.md) records the
delivered scope and explicitly excludes component or world editing, canvas selection, feedback,
assets, undo, and authoring controls.

**Current:** The hierarchy uses HTML disclosure records. It has no selection model. Component data is
rendered as JSON. Studio actions are limited to pause, resume, step, refresh, restart, and stop. The
live game is a sandboxed iframe whose game receives its normal pointer and keyboard input.

**Gap:** Studio has no outliner selection, multi-selection, generated property inspector, gizmos,
editor camera, canvas pick, focus action, preview layer, change tray, save state, dirty state, undo or
redo, asset browser, prefab mode, scene/zone browser, sandbox compare, or conflict resolver.

**Gap:** An iframe around the game is not a detached editor viewport. The accepted Studio design
separates game and editor cameras and input ownership, but current code implements neither detached
mode nor an editor camera.

### Demo authoring evidence

**Current:** Antiky Town is a substantial game-specific content implementation. Its
[`town.ts`](../../../packages/demos/antiky/antiky-town/src/town/art/town.ts) programmatically builds a
voxel surface, materials, props, awnings, sprite props, vegetation, walkers, paths, water features,
colliders, and walk-surface queries. The main file alone is more than 2,000 lines. Related renderer
modules build specialized batches and upload them directly through the game-owned render path.

**Current:** Combat Arena and Traversal Study publish stable semantic entities, `ChildOf` trees,
component summaries, runtime stores, render stores, and bounded event histories. This proves that
the inspection vocabulary works beyond point lights.

**Gap:** These demos do not use a shared authoring world. Their content is TypeScript constants,
arrays, procedural functions, or mutable simulation structures. There is no common scene artifact
that Studio can load, edit, save, diff, merge, or replay.

**Gap:** Combat Arena and Traversal Study increment their top-level snapshot revision during
simulation. Many inspected entity revisions follow that runtime revision. A property editor cannot
use such a value as an authoring precondition. Antiky must distinguish durable authoring revision,
runtime state revision, render projection sequence, simulation step, and inspection publication
sequence.

**Gap:** Town has game-specific collision and walk-surface queries, but no general terrain,
navigation mesh, navigation graph, agent profile, bake job, or path-debug inspection contract.

### Asset acquisition and placement

**Current:** The asset catalog can search typed source metadata. The CLI can install only
`install-verified` assets. It validates paths, byte counts, upstream hashes, and a 64 MiB per-file
limit. It stages downloaded bytes in a temporary directory and records provider, upstream source,
license, attribution, local SHA-256, file size, and installation time in `assets/antiky-assets.json`.

**Gap:** Catalog installation is not Framework asset import. There is no project `AssetId`, asset
revision, import recipe, compiled artifact, dependency or dependent query, load state, world asset
reference, placement command, reimport command, replacement barrier, or selected-entity-to-asset
mapping. Studio does not expose the catalog or registry.

**Gap:** The current installer does not commit asset bytes and the registry as one recoverable
operation. It replaces the destination directory before it reads, validates, and writes the registry.
A registry read or validation failure can therefore leave new bytes installed without the matching
record. This must be corrected before a world transaction can safely depend on an installed asset.

**Gap:** World transactions and filesystem asset installation have no common change receipt. A safe
production workflow must not create an entity that references an uncommitted asset or replace asset
bytes without a recoverable registry update.

## Capability matrix

| Area | Current | Accepted direction | Exact production blocker |
| --- | --- | --- | --- |
| Hierarchy | Validated bounded `ChildOf` tree and read-only Studio view | Hierarchy is a view over typed relationships | No subtree query, paging, search, selection, authored sibling order, relationship revision, drag reparent, or omitted-parent reference |
| Selection | None for world objects | Shared hierarchy, canvas, and MCP selection service | No stable selection record, owner mapping, spatial hit, focus, or multi-selection |
| Stable IDs | World, entity, command, and session UUIDv7 | Stable IDs for all durable objects; temporary aliases are scoped | No asset, scene, zone, prefab, event, transaction, change-set, or sandbox ID types |
| Entities | Read-only semantic headers | Stable authoring entities | No create, clone, delete, rename, enable, or permission-scope command |
| Components | Opaque inspection summaries; typed point-light records | Runtime schema metadata drives validation, Studio, MCP, snapshots, and docs | No registry, field metadata, generic queries, migration, or safe edit command |
| Properties | Point-light power only | General property command for declared safe fields | No field paths, units, edit rules, previews, multi-edit intersection, or persistent result |
| Relationships | `ChildOf` only | Typed links such as target, ownership, asset use, and generation | No relationship schemas, queries, commands, referential policy, or delete behavior |
| Prefabs/archetypes | None | Assets can include prefabs | No local prefab keys, instances, nested references, overrides, variants, upgrade, apply, or revert |
| Scenes | The project manifest launches game code; demos build scenes in code | Events can include scene changes | No scene artifact, scene ID, load/save/open/close, dirty state, dependency set, or merge unit |
| Zones/streaming | Architecture terms only | Zones organize loading, visibility, and gameplay | No zone/cell model, scope query, load state, budgets, handoff, or streaming diagnostics |
| Terrain | Town-specific voxel construction | Voxel regions can use specialized stores and region commands | No terrain asset, chunk revision, brush command, sculpt/paint preview, erosion, or streaming |
| Navigation | Town-specific walk surface and collision adapter | Runtime world can own navigation indexes | No nav source schema, agent profile, bake job, stale-result rejection, path query, or debug overlay |
| Lighting | Point-light data; only power is editable | Render world contains visible lights | No transform/color/radius edit, directional/spot/environment lights, probes, bake state, or budgets |
| Cameras | Game cameras inside demos | Editor and game cameras are separate | No camera component contract, editor camera, detach/focus, camera ownership, or capture metadata |
| Asset placement | Verified catalog download and provenance registry | Stable assets and dependency graph | No AssetId, import/compile state, preview, placement, world reference, reimport, or replacement receipt |
| Multi-selection | None | Selection is editor session state | No ordered target set, shared editable-field intersection, pivot, or per-target precondition |
| Batch edits | None; action broker serializes one action | Commands can express bounded authoring actions | No atomic batch, dry run, per-operation result, limit, or correction group |
| Undo/redo | Point-light correction only | Undo is a new command and fact; redo reapplies intent | No durable authoring history, groups, conflict policy, generic compensation, or redo stack |
| Transactions | One ordered callback and one pending host action | Related events should store as one operation | No staging, all-or-none commit, rollback, transaction ID, save barrier, or projection receipt |
| History | In-memory bounded facts and Studio event view | Durable events plus snapshots | No durable event adapter, authoring snapshot schedule, branch history, or recovery across runtime replacement |
| Sandboxes | ADR and architecture workflow only | Isolated world at a base revision; promote by re-dispatch | No create, scope, quota, compare, discard, proposal, validation evidence, or promotion service |
| Conflict safety | Entity expected revision for point-light power | Single writer, source revisions, primary revalidation | No durable world head, per-field conflict, lease, file/base commit, three-way compare, or merge policy |
| Viewport feedback | Live game iframe and full game-canvas PNG capture | Pick, editor camera, selection/debug overlays, scoped captures | No editor view, structured pick, overlay, region/selection capture, depth/ID buffer, or visual diff |
| Discovery | MCP `tools/list` with static schemas | Shared API grouped by user task | No runtime component, command, permission, limit, projection, spatial, or asset capability discovery |
| Readback | Command result, point-light query, world snapshot, event log, game-canvas capture | Structured state and captures complement each other | No generic change receipt, diff, projection acknowledgments, save/build barrier, or intended-state assertion |

## The critical revision model

Safe authoring needs explicit names for different clocks. A single field called `revision` is not
enough.

| Revision or sequence | Meaning | Current evidence | Authoring use |
| --- | --- | --- | --- |
| `projectRevision` | SHA-256 of the `.antiky` manifest only | CLI and Studio project boundary | Detects manifest replacement, not world-content changes |
| `acceptedBuildRevision` | Development host's accepted build counter | CLI development snapshot and action receipts | Build/reload barrier |
| `runtimeInstanceId` | One mounted runtime lifetime | Inspection, actions, capture | Rejects old runtime responses |
| `publicationSequence` | Ordered runtime inspection publications | Development runtime connection | Rejects stale observation delivery |
| `commandSequence` | Ordered `EngineSession` command callbacks | Session status | Orders command execution inside one runtime |
| `worldRevision` | Count of command callbacks that report an authoring change | Session status | Candidate live authoring head only after durable-world semantics exist |
| `entityRevision` | Version of one entity or point-light record | World inspection and point-light command | Useful optimistic precondition when it is an authoring revision |
| `eventSequence` | Ordered facts in one event source | Point-light and demo histories | Replay and projection ordering |
| `completedStepCount` | Fixed simulation ticks | Session status | Deterministic simulation control, not authoring concurrency |
| demo `snapshot.revision` | Often increments every simulation update | Combat Arena and Traversal Study | Must not be used as an authoring expected revision |

**Recommendation:** Add a `WorldHead` query that names `authoringRevision`, `lastDurableEventSequence`,
`authoringSnapshotId`, `schemaSetRevision`, and `assetManifestRevision`. Keep runtime, render,
simulation, build, and publication counters separate. Every write and cursor should name the exact
counter that governs it.

## Proposed Antiky-native service boundaries

### Schema, query, and selection

Add a Framework-owned component schema registry. It describes semantic meaning, not physical ECS
storage. Each component descriptor needs a stable type ID, schema version, persistence class,
migrations, and fields. Each field needs a stable path, value type, unit, coordinate space, default,
limits or enum values, authoring access, preview support, and sensitivity. Start only with
`antiky.transform` and `antiky.point-light`.

Retain the bounded diagnostic snapshot, but add these revision-aware reads:

```text
get_world_head(world_id)
get_entity(world_id, entity_id, at_authoring_revision?)
query_entities(world_id, filter, fields, page_size, cursor?)
get_hierarchy(world_id, root_entity_id?, depth, page_size, cursor?)
get_relationships(world_id, entity_ids, relationship_types?)
diff_world(world_id, from_authoring_revision, to_authoring_revision, scope?)
```

A cursor must be opaque and bound to one world, query, schema set, and authoring revision. A stale
cursor fails. A hierarchy page can name an external parent or ancestor path without claiming it is a
complete retained entity. Filters use stable semantic IDs. Results identify authoring, runtime, or
render origin and return counts, limits, completeness, and observed revision.

Add one `EditorSession` selection record with a revision, world, primary target, and ordered bounded
target list. A target identifies its kind, stable ID, owner entity, component/property path,
observed authoring revision, and optional spatial hit: world position, normal, distance, and camera.
Hierarchy, canvas, and MCP selection must produce the same record. Render slots, screen coordinates,
voxel cells, and batch items are evidence; they resolve to a stable owner entity or asset.

Multi-edit exposes only the fields shared by every selected target. A batch command lists explicit
stable targets and expected revisions. It must not repeat a search at commit time and edit a changed
set.

### Commands, transactions, and readback

Define semantic commands behind one `WorldAuthoringService`:

- create, clone, delete, rename, enable, and reparent entities;
- add/remove registered components and set permitted fields;
- set transforms with explicit local or world space;
- use the current point-light behavior through the shared envelope;
- instantiate prefabs and place assets only after those contracts exist.

Every envelope needs protocol and command versions, command ID, session/world IDs, base authoring
revision, explicit targets with expected entity revisions, type, and bounded data. The host adds
principal, scoped permissions, receipt time, lease, and runtime identity. Results use stable
`ACCEPTED`, `NO_OP`, and rejection codes. Delete requires an explicit reference policy; silent
cascade is not acceptable.

Use an atomic change set as the edit and undo unit:

```text
begin at base revision -> preview -> validate -> inspect diff -> commit commands and events
  -> save authoring artifact -> publish projections -> read receipt
```

All authoring changes and required durable events commit, or none do. Asset compilation and GPU
upload are separate versioned jobs. A failed job preserves the last good runtime/render result. The
current `executeCommand` callback is not an atomic store and cannot prove rollback after partial
mutation.

A change receipt must include transaction/change-set IDs; base/resulting authoring revisions;
accepted command/event IDs; created, deleted, moved, and changed stable targets; old/new entity,
scene, and asset revisions; authoring-save result; runtime/render applied or pending sequences;
diagnostics and evidence IDs; correction eligibility; and build/reload requirement.

Continuous controls use a bounded ephemeral preview. Preview never advances durable revision or
event sequence, and capture metadata marks it. Commit creates one durable change. Cancel rebuilds the
projection from durable authoring state.

Undo creates a correction change set from a receipt and rechecks permission, references, and
revisions. A conflicting later edit rejects undo instead of overwriting it. Redo resubmits intent
against current state. Durable history is required before Studio promises either across restart.

### Sandboxes, leases, and conflicts

Implement the accepted sandbox workflow as a Framework service:

```text
create at base revision and scope -> apply the same commands -> simulate and validate
  -> compare -> prepare ProposedChangeSet -> review -> re-dispatch to primary -> discard
```

Scope can be a world, zone, hierarchy subtree, explicit selection, prefab, or test scene. A proposal
contains base world/schema/asset/build revisions, ordered commands, target and asset scope, semantic
diff, deterministic scenarios, diagnostics, metrics, scoped captures, consumed limits, required
promotion permission, and conflicts. Promotion reauthorizes and revalidates at the primary head. It
never imports runtime objects, aliases, mutable stores, or sandbox event sequences.

Add expiring mutation leases for long Studio and agent work. A lease identifies principal/session,
project/world/artifact scope, base authoring revision and optional repository commit, allowed command
families, expiry, and active change or sandbox. It makes collisions visible but never bypasses
permissions or revisions.

Start with one owner, field-level diffs, and explicit conflicts. Do not start with CRDTs or automatic
semantic merge. Git protects source artifacts; Antiky revisions protect semantic world state.

### Durable documents, prefabs, scenes, and streaming

Studio edits need a renderer-independent durable artifact. Begin with a small versioned
`SceneDocument` that contains stable world/scene/entity IDs, schema-set version, labels, registered
components, typed relationships, authored sibling order, asset references, membership, durable
authoring revision/event sequence, and deterministic serialization. Never serialize runtime indexes,
physics handles, render slots, GPU objects, previews, editor cameras, or simulation-only values. Keep
the strict `.antiky` manifest as the project/process boundary, not the world file.

A prefab is a versioned asset with a stable asset ID, prefab-local entity keys, root, parameters,
nested-reference cycle policy, instance entity mappings, explicit field overrides, source/instance
revisions, upgrade dry run, conflicts, apply, and revert. Paths and array indexes cannot identify
prefab children.

Keep three concepts distinct:

- scene: durable authoring and collaboration unit;
- zone: semantic/spatial organization inside a world;
- streaming cell: measured runtime loading unit.

Queries expose membership, bounds, dependencies, load/visibility state, authority, counts, memory
estimates, missing references, and residency. Commands move entities or set policy and publish a
scene revision. Streaming jobs name source authoring/asset revisions and reject stale installation.
Studio distinguishes unloaded, unavailable, hidden, and omitted data.

### Spatial systems, lights, cameras, and assets

Terrain and navigation use specialized stores and assets, not one entity per cell or polygon.

- Terrain: stable owner/asset, chunk coordinates and revisions, explicit units/layers, bounded brush
  commands and preview, one fact per stroke/region, old/new hashes, affected projections, rebuild
  jobs, budgets, and cell-to-owner selection.
- Navigation: source set and agent profile, source world/terrain/collider/asset revisions, cancellable
  bake job, output hash, stale install rejection, path cost/failure/debug queries, and runtime obstacle
  status separate from durable sources.

Town's walk-surface queries and collider list are useful first adapter inputs, not a general
navigation system.

Extend the point-light slice incrementally: shared transform with rotation/scale and local/world
rules; safe color/radius/enabled/channel/power fields; render influence diagnostics; and versioned
lightmap/probe/shadow jobs. Add other light types only for a real scene.

Authored game cameras and Studio's editor camera are separate. A camera component owns game
projection, clipping, exposure, and layers. Editor camera state remains temporary unless a user
explicitly creates or updates a game camera from it.

Connect the catalog to Framework assets through staged source/provenance, import recipe, validation,
compiled artifacts, project `AssetId`/revision, dependency graph, preview, accepted world reference,
and safe runtime/render installation. Placement creates semantic transform/renderable/collider/asset
components, never a renderer object. Import and placement may be separate transactions linked by
receipts; a failed import cannot create a world reference.

### Viewport and automation discovery

Keep `capture_frame` as an exact game-canvas capture. Add editor-camera get/set, focus, stable pick,
debug overlays, viewport/selection/debug capture, and explicit visual comparison. A pick receipt names
camera and world revisions, stable owner, hit position/normal/distance, and optional geometry,
material, and pass evidence.

Capture receipts include project, build, runtime, world, authoring revision, camera, viewport,
overlay, preview, hash, byte length, and explicit target. Capture only the game canvas, editor
viewport, selected object, or offscreen render. Never capture the desktop or terminal. Structured
readback remains mandatory.

Add a shared capability document. Each operation states stable schema/version, risk class,
permission/scope, input/result schema, retry/idempotency/batch/atomic/correction support, limits,
required mode/barriers, affected files/assets/jobs, stable result codes, approval policy, and current
Framework/tool/schema revisions.

Prefer a few deep MCP tools:

| Tool group | Purpose |
| --- | --- |
| `get_authoring_capabilities`, `get_world_head` | Discover exact services and durable head |
| `query_world`, `get_entity` | Page and inspect semantic state at one revision |
| `get_selection`, `set_selection`, `pick_viewport` | Share one stable EditorSession selection |
| `preview_change_set`, `commit_change_set`, `get_change_receipt`, `correct_change_set` | Safe authoring loop |
| `create_sandbox`, `compare_sandbox`, `discard_sandbox`, `promote_change_set` | Isolated agent workflow |
| `query_assets`, `import_asset`, `place_asset` | Provenance through placement |
| `capture_viewport` | Explicit visual evidence target |

These names are proposals. Framework contracts, not MCP names, are the architecture.

## Readback contract

An agent must not infer success from `200 OK`, a tool's prose, or a screenshot alone. Each committed
change should pass these gates:

1. **Command gate:** A structured result says `ACCEPTED` or `NO_OP` and names the command and change
   IDs.
2. **Authoring gate:** `get_world_head` reports the resulting authoring revision, and `get_entity` or
   `diff_world` contains the intended semantic values.
3. **Persistence gate:** The durable scene/world artifact and event sequence match the receipt.
4. **Projection gate:** Runtime and render projections report the applied authoring revision or an
   explicit pending/failed state.
5. **Build/resource gate:** When required, the accepted build or resource-install revision contains
   the change. The last-good runtime remains visible on failure.
6. **Behavior gate:** A bounded deterministic scenario or fixed-step inspection shows the expected
   behavior.
7. **Visual gate:** A scoped capture or moving-footage artifact shows the intended player-facing
   result when visual judgment matters.
8. **Regression gate:** Diagnostics, references, budgets, and relevant tests pass.

The receipt must remain useful when Studio disconnects. Temporary MCP call history is useful
observability, but it is not the durable change journal.

## Studio workflow proposal

Studio should expose the deep services through a small set of coordinated surfaces.

| Surface | Required workflow |
| --- | --- |
| Outliner | Virtualized, revision-bound hierarchy; stable-ID/component/relationship/scene/zone/asset filters; explicit incomplete, unloaded, and stale states; shared primary/multi-selection; previewed revision-checked reparent; prefab, lock, sandbox, dirty, runtime-only, and projection-failure badges |
| Inspector | Schema-generated fields; separate authoring/runtime/render values; visible units, spaces, defaults, limits, inheritance, and validation; continuous preview followed by one commit; common-field multi-edit and mixed values; receipt and projection state after commit |
| Viewport | Separate editor/game cameras and visible input ownership; stable pick/focus; preview-plus-commit gizmo; semantic overlays; scoped captures with metadata and no desktop/terminal capture; detached modes only after camera/input ownership exists |
| Assets and structure | Provenance/import/dependency/last-good asset state; semantic `PlaceAsset`; scene/zone and streaming state; prefab instances/overrides in an isolated preview world; terrain/navigation only after their specialized contracts exist |
| Change review | One preview/change tray; semantic and spatial pre-commit diff; durable history separate from MCP calls and diagnostics; correction/resubmission undo/redo; sandbox evidence; explicit base/target conflict resolution |

The existing Events, MCP calls, Diagnostics, Terminal, and live-game panels remain useful. They should
not become hidden authoring back doors. Studio must never parse terminal output to infer world state.

## Safety and failure rules

| Failure or risk | Required behavior |
| --- | --- |
| Unknown component or schema version | Reject the edit. Keep the last compatible authoring and projection state. |
| Stale world, entity, prefab, scene, asset, cursor, or job revision | Return a stable conflict with current revisions and no mutation. |
| Duplicate command or retry | Return the prior result or a structured duplicate result. Do not create a second fact. |
| One invalid command in an atomic change set | Reject the complete set. Report the failing command and field path. |
| Callback, save, or event commit failure | Do not advance the world head. Recover staged state and report the durable failure. |
| Projection failure after durable acceptance | Keep accepted authoring state and last-good projection. Report pending/failed projection and recovery action. |
| Referenced entity or asset deletion | Require an explicit referential policy and show affected stable references before commit. |
| Concurrent writer or expired lease | Reject before mutation. Return the active scope and safe retry guidance when permitted. |
| Sandbox base changed | Mark the proposal stale. Recompare and revalidate; never overwrite primary changes. |
| Streaming or partial view | Mark unavailable and omitted records. Never present a bounded page as the complete world. |
| Asset import, compilation, or replacement failure | Keep prior bytes/registry and last-good runtime resource. Do not create a dangling world reference. |
| Terrain/nav/light bake finishes against old input | Reject installation as stale and retain the current compiled result. |
| Studio disconnects during preview | Expire or cancel the preview. Durable state remains unchanged. |
| Studio disconnects after commit | The durable receipt and world head remain queryable after reconnect. |
| Capture request lacks an explicit game/editor target | Reject it. Never fall back to desktop or terminal capture. |
| Project data contains prompt-like text | Treat it as untrusted data. It cannot expand permissions or execute commands. |

## Comparative lessons to transfer

The local [Unreal and VibeUE research](../skill-research/unreal-vibeue.md),
[Unity research](../skill-research/unity.md), and [Godot research](../skill-research/godot.md) support a
small number of transferable patterns:

| Comparative pattern | Antiky translation | Do not copy |
| --- | --- | --- |
| Unreal toolsets use discovery and serialize editor-thread mutation | Discover Antiky schemas and operations; keep one live-world writer | Unreal actors, UAssets, reflection, Python, or game-thread architecture |
| VibeUE batches ordered operations and uses transactions/checkpoints plus readback | Submit bounded ordered change sets; checkpoint non-undoable asset work; always re-query | Arbitrary editor Python, hosted terrain services, broad unauthenticated authority, or marketing claims |
| Unity preserves stable asset references, prefab overrides, serialized-object semantics, and undo | Give Antiky assets/prefabs stable IDs, explicit overrides, change receipts, and corrections | Unity GUID/meta files, GameObjects, SerializedObject, or domain reload behavior |
| Unity bridges expose dry run, batch results, locks, and audit logs | Add preview, atomic batches, leases, and durable receipts | A huge method-per-field tool surface or arbitrary C# execution |
| Godot keeps many scenes/resources text-inspectable and supports headless validation | Make Antiky authoring artifacts stable, diffable, rebuildable, and headless-testable | Godot node/resource syntax or scene inheritance semantics |
| All mature editor workflows separate authored state, running state, and viewport evidence | Keep Antiky authoring/runtime/render projections and pair structured readback with scoped captures | Pixel-only automation or direct renderer-object editing |

The research also warns that transactions do not cover every asset import, compilation, deletion, or
external filesystem operation. Source control, staged assets, clean ownership, and recovery points
remain necessary.

## Phased priorities

| Phase | Goal and deliverables | Exit evidence |
| --- | --- | --- |
| **P0 - Authoring head and read model** | Add explicit revision vocabulary and `WorldHead`; slice-required stable IDs; Transform/PointLight schema registry; entity, paginated query, revision-bound hierarchy, and diff reads; value origins/projection sequences; capability limits/errors | A fixture beyond 512 entities is navigable without missing-parent or mixed-revision claims; schema drives both validation and clients; demo authoring/simulation/publication revisions are distinct; CLI, MCP, Studio, and tests agree |
| **P1 - Durable Studio loop** | Add a small scene document, hierarchy and canvas selection, editor camera/input ownership, preview plus atomic transform/light commit, save/event/diff/projection/capture receipt, correction undo/current-state redo, generated inspector, and MCP parity | IDs survive open through restart, inspect, capture, undo, and redo; invalid/stale edits change nothing; accepted edits survive runtime/Studio restart; projection rebuild equals incremental application; Framework alone validates |
| **P2 - Structural editing and sandboxes** | Add entity/component/reparent/batch commands, multi-selection, leases, sandbox create/simulate/validate/compare/discard/promote, field diffs, correction conflicts, durable history/recovery, and source-artifact change manifests | Writers cannot silently overwrite; promotion reauthorizes and rejects stale bases without copying sandbox state; delete policy is explicit; batches are atomic/retry-safe; agent and Studio receipts match |
| **P3 - Assets, prefabs, scenes, and scale** | In separate complete slices add AssetId/import/reimport/dependency/provenance and `PlaceAsset`; prefab mappings/overrides/upgrades; scene units; zones/streaming; terrain regions; navigation bake/query/debug; only scene-required light/camera schemas | Provenance survives release review; prefab reorder/upgrade preserves identity and overrides; spatial queries distinguish unloaded content; stale terrain/nav/streaming results are rejected and last-good outputs remain |
| **P4 - Production Studio and review** | Add virtualized authoring surfaces, durable target/revision feedback, sandbox evidence and approvals, contextual budgets, branch/change-set conflicts, and target-device moving gameplay evidence | A representative scene is authored, reviewed, merged, rebuilt, and validated without raw renderer access or manual action reconstruction; people and agents share services; captures/footage contain no terminal, desktop, username, machine name, or unrelated app data |

## Do not build yet

- A universal ECS implementation before two or more complete features need the same storage cut.
- A separate Studio world model or mutation path.
- One MCP tool for every component field.
- Arbitrary TypeScript, JavaScript, shell, Python, or renderer execution as the normal authoring API.
- A CRDT or automatic world merge before explicit revision conflicts and field diffs are proven.
- A terrain suite, visual scripting system, animation editor, or marketplace before a complete game
  slice proves its contract.
- Desktop or terminal capture as game evidence.
- A pixel-only selection or validation workflow.
- External-editor compatibility layers inside Framework core.

## Recommended first slice

The highest-value next slice is **Select and author one durable light**:

1. Load two point-light entities from a small versioned scene document.
2. Publish a `WorldHead`, registered Transform and PointLight schemas, and queryable hierarchy.
3. Select one light from the hierarchy and from one stable canvas-pick method.
4. Move it with an editor-camera gizmo preview and set power through the generated inspector.
5. Commit both changes as one atomic change set at an expected world and entity revision.
6. Save the scene document and accepted facts.
7. Apply runtime and render projections and report their sequence.
8. Read the changed entity and semantic diff through Studio and MCP.
9. Capture only the editor/game viewport with selection overlay and complete receipt metadata.
10. Restart the runtime and Studio and prove the same stable ID and values.
11. Undo with a correction change set, then redo against current state.
12. Run stale, duplicate, invalid, disconnect, save-failure, and projection-failure cases.

This slice extends the one command path that already works. It proves persistence, selection,
transactions, readback, Studio, and agent parity without committing Antiky to a full terrain,
prefab, or general ECS design.

## Evidence index

### Current source

- [Framework IDs](../../../packages/framework/src/identity/ids.ts)
- [World inspection](../../../packages/framework/src/inspection/world.ts)
- [Inspection snapshot](../../../packages/framework/src/inspection/snapshot.ts)
- [Event-history inspection](../../../packages/framework/src/inspection/events.ts)
- [EngineSession contract](../../../packages/framework/src/sessions/engine-session/contract.ts)
- [EngineSession runtime](../../../packages/framework/src/sessions/engine-session/runtime.ts)
- [Point-light commands](../../../packages/framework/src/point-light/commands.ts)
- [Point-light service](../../../packages/framework/src/point-light/service.ts)
- [Point-light projections](../../../packages/framework/src/point-light/projections.ts)
- [Point-light world adapter](../../../packages/framework/src/point-light/world-inspection.ts)
- [Game inspection port](../../../packages/framework/src/game/host.ts)
- [MCP tool definitions](../../../packages/cli/src/mcp/tools.ts)
- [Development action broker](../../../packages/cli/src/host/actions.ts)
- [Runtime connection](../../../packages/cli/src/host/runtime-connection.ts)
- [Project manifest](../../../packages/cli/src/project.ts)
- [Studio hierarchy](../../../packages/studio/app/src/components/InspectionPanel.tsx)
- [Studio shell and controls](../../../packages/studio/app/src/components/StudioShell.tsx)
- [Studio game frame](../../../packages/studio/app/src/components/LiveGameFrame.tsx)
- [Studio coordinator](../../../packages/studio/app/src/development/coordinator.ts)
- [Town world construction](../../../packages/demos/antiky/antiky-town/src/town/art/town.ts)
- [Combat semantic inspection](../../../packages/demos/antiky/combat-arena/src/inspection.ts)
- [Traversal semantic inspection](../../../packages/demos/antiky/traversal-study/src/inspection.ts)
- [Asset catalog schema](../../../packages/asset-catalog/src/index.ts)
- [Asset installer and provenance registry](../../../packages/asset-catalog/src/node/install.ts)

### Accepted design

- [Framework overview](../../architecture/framework/overview_A.md)
- [World and session model](../../architecture/framework/world-and-session-model_A.md)
- [Commands, events, and persistence](../../architecture/framework/commands-events-and-persistence_A.md)
- [Rendering and assets](../../architecture/framework/rendering-and-assets_A.md)
- [Studio and agent workflows](../../architecture/studio/overview_A.md)
- [Contextual feedback](../../architecture/studio/contextual-feedback_A.md)
- [Entity/component ADR](../../adr/framework/0001-entity-component-system_H.md)
- [Command-boundary ADR](../../adr/framework/0007-commands-as-mutation-boundary_H.md)
- [Separate-state ADR](../../adr/framework/0009-separate-state-projections_H.md)
- [Stable-ID ADR](../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md)
- [Sandbox-promotion ADR](../../adr/framework/0014-promote-sandbox-commands_H.md)
- [Studio shared-services ADR](../../adr/studio/0006-use-cli-project-services-directly_H.md)
- [Archived Studio objective summary](../_archives/2026-08-10-studio-summary.md)

### Skill and comparative research

- [Recommended Antiky skill library](../skill-research/recommended-library.md)
- [Orchestration and library design](../skill-research/orchestration-and-library-design.md)
- [Art and content pipeline](../skill-research/art-content-pipeline.md)
- [Production and QA](../skill-research/production-qa.md)
- [Unreal and VibeUE](../skill-research/unreal-vibeue.md)
- [Unity](../skill-research/unity.md)
- [Godot](../skill-research/godot.md)

## Bottom line

Antiky does not need to imitate Unreal, Unity, or Godot to become agent-authorable. It needs to finish
the architecture it has already selected: stable semantic identity, one authority, typed runtime
schemas, durable authoring revisions, commands and corrections, separate projections, bounded
inspection, and isolated sandboxes.

The existing point-light slice proves the direction. The missing bridge is a durable,
revision-aware `WorldAuthoringService` with selection, atomic change sets, persistence, and readback.
Build that bridge with one light-and-transform scene. Then extend it through structural editing,
sandboxes, assets, prefabs, and spatial systems only as representative game slices require them.
