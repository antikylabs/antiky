# Findings

The Framework has reusable ingredients for lightweight tracking, but it does not have a reusable entity tracker.

- **Established:** Stable `EntityId` creation and validation are implemented, tested, root-exported, renderer-neutral UUIDv7 behavior.
- **Established:** A public immutable `Transform` record exists, but it contains only a three-number position. Its source module, documentation area, and validation error remain point-light-coupled.
- **Established:** The point-light vertical slice tracks up to 256 light entities by stable ID in a private map and exposes immutable list/get views. It does not create, delete, generically update, or query entities. Its only mutation is point-light power.
- **Established:** Point-light runtime and render projections contain identity, revision, power, and an optional render slot. They do not project transform position.
- **Established:** Generic world, component, relationship, and store types are implemented only as bounded, immutable inspection DTOs. They validate views; they do not own or mutate world state.
- **Established:** `EngineSession` implements fixed-step systems, command ordering, revisions, controls, faulting, and disposal. It holds a `worldId`, but no implemented `World`, entity store, component store, transform store, relationship service, or query service.
- **Established direction only:** ADRs require entities, versioned components, typed relationships, queries, state projections, and scoped numeric aliases. The architecture explicitly leaves component storage, query layout, and runtime schema selection open.
- **Inferred:** Antiky cannot currently claim it provides the issue requester’s “lightweight entity tracking.” It can truthfully claim stable entity identity, immutable position values, and optional read-only inspection infrastructure.

The requester’s minimum is a renderer-independent helper for positions/transforms across a few dozen objects. The current smallest reusable Framework boundary is:

```text
EntityId creation/parsing
+ immutable position-only Transform creation
+ optional WorldInspection/InspectionStore adapter
```

A caller still has to supply the collection, lifecycle, updates, and queries. No complete reusable tracking boundary exists.

## Requirement matrix

| Requirement | Classification | Current coverage | Status |
| --- | --- | --- | --- |
| Stable entity identity | Implemented reusable behavior | Branded UUIDv7 `EntityId`, factory, parser, and deterministic creation source | **Established** |
| Track a few dozen objects | Feature-specific behavior only | Point-light service has a private `Map<EntityId, PointLightAuthoringRecord>` and a 256-light bound | **Established**, but not generic |
| Create and remove tracked entities after startup | Absence | Point-light entities are supplied at service construction; its public interface has no entity add/remove operation | **Inferred from complete interface** |
| List and get entities | Feature-specific behavior only | `listPointLights` and `getPointLight` work only for point-light records | **Established** |
| Generic entity record | Inspection-only DTO | `WorldInspectionEntity` has ID, label, revision, and component summaries, but is a read-only view | **Established** |
| Position value | Implemented reusable behavior with API coupling | `Transform` contains immutable `position: readonly [number, number, number]`, defaults to origin, and enforces bounds | **Established** |
| Rotation, scale, parent/local/world transform distinctions | Absence | No such fields or operations exist in Framework transform code | **Established by shape; requester need remains unknown** |
| Update a transform | Absence | No `setTransform`, `updateTransform`, or generic writer exists; point-light commands change power only | **Inferred from API and command implementation** |
| Project transforms into runtime/render state | Absence | Point-light runtime/render records omit position entirely | **Established** |
| Versioned component metadata | Mixed | Transform and point-light records have schema versions; inspection accepts type ID/version/JSON data; a generic runtime component registry does not exist | **Established implementation plus architecture gap** |
| Generic component attach/remove/read | Absence | Only inspection DTOs carry arbitrary component summaries | **Inferred** |
| Parent-child relationships | Inspection-only DTO | World inspection validates real `ChildOf` links, retained endpoints, one parent, and acyclic hierarchy | **Established**, read-only |
| Other typed relationships | Architecture-only direction | ADR and architecture name typed relationships, but no runtime relationship service exists | **Established decision only** |
| Entity/component queries | Architecture-only direction | Public world queries are described, but no query API or storage implementation exists | **Established direction; implementation absent** |
| Stable ID to compact runtime/render alias | Feature-specific plus architecture-only | Point-light render bindings map an entity ID to a render slot; general runtime alias tables are only architectural | **Established narrow implementation** |
| Authoring/runtime/render separation | Feature-specific plus architecture-only | Point-light power implements all three projections and dirty render slots; generic state projection remains direction | **Established narrow implementation** |
| World ownership | Architecture-only direction | Architecture says `World` owns entities/components/relationships/queries; no `World` production type is exported | **Established direction; implementation absent** |
| Session orchestration | Implemented reusable behavior, not tracking | Session orders systems and commands and increments a scalar world revision; game-owned callbacks hold actual state | **Established** |
| Read-only world inspection | Implemented reusable behavior | Generic bounded DTO validation, sorting, copying, freezing, hierarchy validation, and store views | **Established** |
| Inspection publication | Implemented reusable behavior | Store retains the latest validated snapshot and notifies subscribers in order | **Established** |
| Renderer independence | Implemented at module boundaries | Framework core is tested against BroMetal/browser imports except the single render-driver file | **Established** |
| Public consumption | Public source API, not published package | Symbols are root-exported and documented, but `@antiky/framework` is currently `"private": true` and has no identity/transform subpath export | **Established** |

# Evidence

## Identity

- **Established:** `EntityId` is a branded string; all supported IDs and factories/parsers are in `packages/framework/src/identity/ids.ts:5-21, 90-133`.
- **Established:** Tests assert deterministic UUIDv7 creation and rejection of other UUID forms in `packages/framework/tests/identity/ids.test.ts:23-79`.
- **Claimed and corroborated:** Generated API docs describe `EntityId` as stable and expose `createEntityId`/`parseEntityId` from the package root in `docs/user-facing-docs/api/identity.md:6-23, 39-47, 131-137, 171-177`.
- **Established decision:** Stable UUIDv7 public identity and lifetime-scoped numeric aliases are required by `docs/adr/framework/0011-stable-ids-and-runtime-aliases_H.md:21-42`.

## Transform records

- **Established:** The only Framework transform shape is schema version plus optional/defaulted three-number position in `packages/framework/src/point-light/records.ts:1-15, 24-27, 97-126`.
- **Established:** Tests cover origin defaults, immutable arrays, finite coordinates, dimensionality, and bounds in `packages/framework/tests/point-light/records.test.ts:13-65`.
- **Claimed and corroborated:** The public docs call it an immutable validated transform, but place it under “Point-light core API,” in `docs/user-facing-docs/api/point-light-core.md:6-16, 38-48, 98-108, 122-155, 170-187`.
- **Established coupling:** Invalid transforms throw `PointLightValidationError`, not a neutral transform error, in `packages/framework/src/point-light/records.ts:36-46, 113-126`.

## Point-light tracking and projections

- **Established:** The authored record combines `worldId`, `entityId`, label, revision, transform, and point light; the complete service interface exposes point-light-specific reads and power mutations in `packages/framework/src/point-light/service.ts:53-93`.
- **Established:** Service construction validates initial records into a private entity-keyed map, then exposes list/get reads in `packages/framework/src/point-light/service.ts:259-319`.
- **Established:** The returned public surface contains only point-light operations in `packages/framework/src/point-light/service.ts:606-641`.
- **Established:** A test explicitly asserts that the service exposes “no mutable map or generic writer” in `packages/framework/tests/point-light/service.test.ts:80-115`.
- **Established:** The service can independently read two initial lights by stable ID in `packages/framework/tests/point-light/service.test.ts:27-50`.
- **Established:** Runtime and render point-light shapes contain ID, revision, power, and render slot, but no transform, in `packages/framework/src/point-light/projections.ts:10-46`.
- **Established:** Projection construction copies power only in `packages/framework/src/point-light/projections.ts:138-184`.
- **Established:** Accepted power changes reach the three state copies and one dirty slot exactly once in `packages/framework/tests/point-light/command-flow.test.ts:98-119`; headless lights use the authoring/runtime path without a render binding in `packages/framework/tests/point-light/command-flow.test.ts:205-217`.
- **Established:** The inspection adapter exposes transform only in authoring entities/store entries; runtime/render stores contain revision and power in `packages/framework/src/point-light/world-inspection.ts:41-87`.
- **Established:** The adapter’s three point-light stores and component summaries are tested in `packages/framework/tests/point-light/world-inspection.test.ts:52-86`.

## Generic inspection

- **Established:** Generic inspection types model entity headers, versioned component summaries, `ChildOf`, and named authoring/runtime/render stores in `packages/framework/src/inspection/world.ts:14-117`.
- **Established:** `createWorldInspection` validates and freezes input rather than acting as a mutable world in `packages/framework/src/inspection/world.ts:210-265, 267-415`.
- **Established:** Tests verify stable ordering, cloning/freezing, hierarchy integrity, duplicate rejection, bounded incomplete views, and input limits in `packages/framework/tests/inspection/world.test.ts:93-275`.
- **Claimed and corroborated:** The docs explicitly call inspection a “read-only adapter boundary” and say world views do not expose mutable engine state in `docs/user-facing-docs/api/inspection.md:6-12, 287-290`.
- **Claimed and corroborated:** The generated API describes `WorldInspectionEntity` as an immutable entity/component summary and `createWorldInspection` as a validating/copying/freezing operation in `docs/user-facing-docs/api/inspection.md:450-555`.
- **Established:** `InspectionStore` supports only read, subscribe, and publish of complete snapshots in `packages/framework/src/inspection/snapshot.ts:121-135, 398-420`.
- **Established:** Cross-view world/runtime identity consistency is checked when composing snapshots in `packages/framework/src/inspection/snapshot.ts:297-395`.

## Engine session

- **Established:** Session construction receives a `worldId`, systems, input capture, optional digest, and disposable services—not a `World` or entity/component store—in `packages/framework/src/sessions/engine-session/contract.ts:37-50`.
- **Established:** Its public interface contains frame/control/command/status/disposal methods only in `packages/framework/src/sessions/engine-session/contract.ts:165-179`.
- **Established:** `executeCommand` supplies command sequence and scalar world revision to caller-owned work; it does not mutate a Framework world in `packages/framework/src/sessions/engine-session/runtime.ts:421-475`.
- **Established:** Tests implement simulation state as a local object captured by system callbacks in `packages/framework/tests/sessions/engine-session/engine-session.test.ts:30-68`.
- **Established:** Tests cover command ordering and world-revision increments, not entity behavior, in `packages/framework/tests/sessions/engine-session/engine-session.test.ts:266-311`.
- **Claimed and corroborated:** The API docs describe the session as fixed-step orchestration and show game-owned `move(input)` logic in `docs/user-facing-docs/api/engine-session.md:6-30, 81-95, 216-230, 378-395`.

## Architecture versus implementation

- **Established decision:** ADR 0001 requires stable entities, versioned components, typed relationships, systems, queries, and private storage while rejecting a premature general ECS in `docs/adr/framework/0001-entity-component-system_H.md:18-45`.
- **Established decision:** ADR 0009 requires separate authoring, runtime, and render copies and one-way updates in `docs/adr/framework/0009-separate-state-projections_H.md:15-41`.
- **Established direction only:** The architecture says `World` supplies entity, component, relationship, resource, system, query, revision, and projection operations in `docs/architecture/framework/world-and-session-model_A.md:73-90`.
- **Established direction only:** Component runtime metadata is described, but the schema format is explicitly unselected in `docs/architecture/framework/world-and-session-model_A.md:118-135`.
- **Established direction only:** Public world queries are described at `docs/architecture/framework/world-and-session-model_A.md:159-169`; component storage and query layout remain open at `docs/architecture/framework/world-and-session-model_A.md:308-316`.
- **Established scope rule:** The overview says current demos still own features that will move incrementally and forbids a broad rewrite in `docs/architecture/framework/overview_A.md:13-17`.
- **Established scope rule:** It requires adding only boundaries proven by complete features and keeping details private until another real use case needs them in `docs/architecture/framework/overview_A.md:191-213`.

## Exports and renderer independence

- **Established:** Identity, inspection, point-light records/services, and sessions are all root-exported in `packages/framework/src/index.ts:1-18`.
- **Established:** The package is currently private, and its only explicit subpaths are game, contract, and render driver in `packages/framework/package.json:2-10`.
- **Claimed and corroborated:** The generated reference calls itself the complete public API and directs users to package-root or declared public entries in `docs/user-facing-docs/api/reference.md:6-18`.
- **Established:** Boundary tests forbid BroMetal and browser-global imports from Framework runtime code except the single BroMetal driver in `packages/framework/tests/import-boundary.test.mjs:5-13, 27-65, 79-90`.
- **Inferred absence:** An exhaustive production-source search for entity/world exports and entity CRUD found only ID types/factories, inspection DTOs, and point-light world-view adapters—no `World`, entity store, transform store, `createEntity`, `addEntity`, `removeEntity`, `setTransform`, or query implementation.

# Gaps

- The issue says “positions/transforms,” but does not define whether position alone is sufficient or whether rotation, scale, parent-relative transforms, matrices, or interpolation are required.
- It does not say whether entities are fixed at startup or created and removed while running.
- It does not establish whether IDs must survive reloads or only remain stable during one runtime.
- Update frequency, iteration/query needs, collision behavior, and mutation semantics are unspecified.
- Existing point-light evidence demonstrates a simple private map at a bound of 256, but there is no benchmark proving a generic tracker’s performance. Inspection limits are transport bounds, not performance results.
- No current test proves entity identity survives rename, snapshot, and replay as required by the architecture.
- No generic numeric alias lifecycle or leakage test exists.
- The architecture/API mismatch is material: documentation says sessions own worlds, while the implemented session owns only a world identity, orchestration, revisions, and disposable services.
- Whether a neutral transform API should retain the current three-dimensional position shape and UUIDv7 policy is an owner decision.
- External publication and dependency cost require the separate product-fit research line.

# Planning implications

1. Do not describe the point-light service, inspection DTOs, or `EngineSession` as an existing lightweight entity tracker.
2. Reuse stable identity directly. Reuse the transform value semantics only with an explicit decision about its point-light naming/error coupling and position-only contract.
3. Keep inspection as an optional adapter. Its required world/runtime IDs, revisions, counts, stores, and component summaries are too broad to define the requester’s minimal tracking API.
4. Do not require `EngineSession`, commands, event history, or three state projections for a standalone few-dozen-object helper unless another requirement proves their value.
5. Treat the point-light private-map implementation as evidence that a small map-backed boundary is viable, not as a generic abstraction ready for export.
6. If implementation is planned, the narrowest missing capability is a renderer-neutral, session-optional owner for entity-to-transform state with explicit lifecycle, replacement/update, and list/get behavior. This is **inferred scope**, not an implemented design.
7. Compare at least two later designs: lightweight caller-owned records/helpers versus a tiny Framework-owned tracker with a separate inspection adapter. A general `World`/ECS implementation is not supported by this request.
8. The owner must decide whether an Antiky companion should enforce Antiky’s stable UUIDv7 policy or remain less opinionated for the wider BroMetal ecosystem.

Read-only research only; no files were modified and no tests were executed.
