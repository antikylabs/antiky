# Picking and selection coverage

## Findings

**Provenance.** `[Established — committed/current]` The implementation paths below match `HEAD 437a4b4`; none had working-tree changes during the final check. Only `docs/objectives/README.md` and the untracked `docs/objectives/brometal-request/` scaffold were in flight.

### End-to-end trace

| Link | Coverage | Finding |
|---|---|---|
| Pointer event → host coordinates | Implemented | The development host converts `pointermove` from CSS pixels to normalized canvas coordinates. `x` increases left-to-right and `y` increases bottom-to-top. |
| Coordinates → click sample | Partial | The contract supplies `clicked`, `down`, drag deltas, and activity. `clicked` lasts one animation frame. However, `pointerdown` does not update coordinates, does not filter buttons, and carries no pointer ID or immutable click-position sample. |
| Normalized coordinates → scene/world coordinates | Missing | No shared camera inverse, ray/plane conversion, or screen-space selectable projection exists. Current demos use pointer coordinates for aiming, camera drift, shaders, or a generic action. |
| Scene coordinates → hit test | Missing | No current Framework, host, Studio, demo, or BroMetal code implements semantic picking or hit testing. Gameplay collision/proximity checks are unrelated to pointer position. |
| Hit object → stable `EntityId` | Partial building blocks | Stable UUIDv7 entity identity exists. Point lights demonstrate an entity-to-temporary-render-slot mapping, but `DrawCall` has no entity/pick identity and demo render stores often map whole batches to group entities. |
| Stable `EntityId` → selection state | Missing | There is no selection record, selection service, selected-entity field, or selection lifecycle in Framework inspection, the game inspection port, Studio, or MCP. |
| Selection → inspection | Partial building blocks | A stable ID can identify an entity in the bounded world snapshot, and point lights have a feature-specific lookup by ID. There is no generic entity-by-ID operation or selected-target inspection projection. |
| Canvas ↔ hierarchy ↔ MCP synchronization | Missing | Studio only embeds the game iframe and renders the full hierarchy. MCP exposes whole-world and point-light reads, not pick/get/set/clear selection operations. |

`[Established]` The main Antiky game contract has all seven pointer fields, but five framework-free BroMetal/Three.js demos still copy only `{x, y}`. Those demos cannot observe `clicked`, `down`, or drag state without first changing their host-contract boundary.

`[Established]` Existing Antiky demo clicks are action buttons, not object selection:

- Combat converts pointer position to aim direction and camera drift.
- Traversal converts any click into jump/retry.
- Point-light expo converts click into interact, then resolves the interaction by CPU distance from the player to the forge.
- Pure BroMetal demos send pointer position to shaders.
- Three.js demos move cameras; no raycaster is used.

`[Established]` Current render contracts can express ordered passes, targets, pipelines, uniforms, instance arrays, and counts. They cannot express an owning entity, per-instance pick alias, selectable bounds, pick pass, target format, or readback result. The BroMetal driver is submit-only.

`[Established]` The installed BroMetal 0.17.2 runtime can draw to an RGBA16F offscreen target with optional depth. Internally, its WebGPU texture has `COPY_SRC`, and comments explicitly mention inspection/readback. Its public `Renderer` and `RenderTarget` APIs expose no readback method, and the package export map does not export the internal WebGPU module. GPU picking is therefore technically plausible but not supported through the installed public API.

`[Claimed — target architecture, not current implementation]` The in-progress rendering and Studio guides describe:

- Bounds, sort keys, stable batch slots, and render-item-to-owner mappings.
- One shared selection service for canvas, hierarchy, and MCP.
- Stable pick targets with optional surface/render metadata.
- CPU bounds, physics, voxel, and GPU object-ID methods as possibilities.

The same guide explicitly says the first canvas-selection method remains undecided. The guide itself warns that some described features do not exist and that open questions are not accepted decisions.

## Evidence

### Pointer and host adapter

- `packages/framework/src/game/contract.ts:20-29` — normalized pointer shape with seven required fields.
- `packages/framework/src/game/contract.ts:47-55` — pointer supplied to each game through `GameHostContext`.
- `packages/framework/src/game/contract.ts:9-17` — documented drift in copied demo contracts.
- `packages/cli/src/host/game-server.ts:398-404` — DPR-aware canvas backing-store resize.
- `packages/cli/src/host/game-server.ts:419-430` — CSS-coordinate normalization and bottom-origin `y`.
- `packages/cli/src/host/game-server.ts:431-438` — pointer capture and click/down state; no button filter or coordinate update on down.
- `packages/cli/src/host/game-server.ts:462-474` — mutable pointer passed to the game.
- `packages/cli/src/host/game-server.ts:481-506` — click and drag deltas reset after presentation.
- `packages/framework/src/game/contract.test.ts:91-109` — tests the pointer’s required fields.
- `packages/framework/src/game/contract.test.ts:125-152` — proves five surviving copied contracts expose only `x` and `y`.
- `packages/cli/tests/development-session.test.ts:245-271` — host test checks canvas/script availability and syntax, not pointer conversion.
- `packages/cli/tests/managed-capture-runtime.test.ts:63-81` — automation can move/press/release and observe changed pixels, but no picked identity is asserted.

### Current demo use

- `packages/demos/antiky/combat-arena/src/game.ts:44-77` — normalized pointer converted to aim direction.
- `packages/demos/antiky/combat-arena/src/game.ts:117-124` — pointer passed to presentation.
- `packages/demos/antiky/combat-arena/src/presentation.ts:181-196` — pointer drives camera drift.
- `packages/demos/antiky/traversal-study/src/game.ts:43-57` — click becomes jump/retry.
- `packages/demos/antiky/point-light-expo/src/game.ts:84-88` — click becomes generic interaction input.
- `packages/demos/antiky/point-light-expo/src/simulation.ts:336-367` — interaction target resolved by player-to-forge distance.
- `packages/demos/brometal/luminous-reef/src/game.ts:5-24` — pointer used only as shader uniform.
- `packages/demos/threejs/glass-garden/src/game.ts:253-275` — pointer moves the camera.
- A repository search for semantic `pick`, `picking`, `hit test`, `selectedEntity`, `readPixel`, and `copyTextureToBuffer` found no production picking implementation; apparent `Pick` results were TypeScript’s utility type or prose.

### Render and stable identity

- `packages/framework/src/render/render-contract.ts:50-69` — `DrawCall` contains pipeline, uniforms, instance arrays, and count only.
- `packages/framework/src/render/render-contract.ts:78-93` — targets expose size, depth, and samples only.
- `packages/framework/src/render/render-contract.ts:115-127` — driver exposes configure, synchronous submit, and dispose only.
- `packages/framework/src/render/brometal-driver.ts:122-128` — BroMetal-specific extensions only register/load resources.
- `packages/framework/src/render/brometal-driver.ts:203-234` — target creation; no format/readback and filtering is fixed to linear.
- `packages/framework/src/render/brometal-driver.ts:236-264` — draw submission has no semantic identity or result.
- `packages/framework/src/render/render-contract.test.ts:93-118` — alternate driver and backend-handle-free contract.
- `packages/framework/src/render/render-contract.test.ts:121-145` — sprite and mesh are deliberately indistinguishable pipeline/instance descriptions.
- `packages/framework/src/render/frame-shape.test.ts:12-24` — the tested full frame is a contract proof, not a migrated demo.
- `packages/framework/src/render/brometal-driver.test.ts:108-129,228-245` — tests pass order and instance upload, not selection/readback.
- `packages/framework/src/identity/ids.ts:1-21,83-100,120-126` — branded canonical UUIDv7 `EntityId`.
- `packages/framework/src/point-light/projections.ts:10-26,95-135` — feature-specific stable entity ↔ temporary render-slot mapping.
- `packages/framework/src/point-light/world-inspection.ts:41-87` — point-light authoring/runtime/render projections retain the stable ID.
- `packages/demos/antiky/antiky-town/src/render/point-light-adapter.ts:14-39` — Town verifies one stable lamp ID against render slot zero.
- `packages/demos/antiky/combat-arena/src/inspection.ts:187-235` — enemies have individual runtime IDs, but the render store maps the complete enemy batch to the squad ID.
- `packages/demos/antiky/traversal-study/src/inspection.ts:237-278` — runtime objects have IDs while render entries group course, hazards, and checkpoints.

### Inspection, Studio, and MCP

- `packages/framework/src/game/host.ts:58-74` — inspection port has snapshot, point-light, and simulation controls; no selection.
- `packages/framework/src/inspection/snapshot.ts:62-77,104-119` — snapshot has runtime, diagnostics, measurements, session, point lights, world, and events; no selection.
- `packages/framework/src/inspection/world.ts:14-19` — world view is bounded.
- `packages/framework/src/inspection/world.ts:28-68,77-117` — entities and store entries carry stable IDs.
- `packages/framework/src/inspection/world.ts:225-242,267-327` — IDs, uniqueness, and hierarchy are validated.
- `packages/studio/app/src/components/LiveGameFrame.tsx:1-20` — iframe only; no canvas-selection bridge.
- `packages/studio/app/src/components/InspectionPanel.tsx:26-69` — entity tree is expandable display, not selectable state.
- `packages/studio/app/src/components/InspectionPanel.tsx:137-174` — local state tracks only the active inspection tab.
- `packages/studio/app/src/components/StudioShell.tsx:290-337` — game controls are fullscreen/reconnection only.
- `packages/studio/app/src/development/coordinator.ts:31-46,62-72` — Studio client/coordinator has snapshots, captures, reload, pause/resume/step; no selection.
- `packages/cli/src/mcp/tools.ts:6-39` — complete current tool-name list has no pick/selection operation.
- `packages/cli/src/mcp/tools.ts:346-367` — whole-world inspection and feature-specific point-light lookup.
- `packages/cli/src/mcp/server.ts:390-444` — corresponding dispatch paths.
- `packages/cli/tests/mcp-server.test.ts:567-635` — exact MCP tool list enforced by tests.
- `packages/cli/tests/mcp-server.test.ts:675-693` — stable point-light lookup and whole-world read are covered.
- `packages/studio/app/src/components/StudioShell.test.tsx:342-378` — connected Studio test covers read-only semantic surfaces, not selection.

### Installed BroMetal

- `packages/framework/package.json:22-24` — pinned BroMetal 0.17.2.
- `node_modules/brometal/package.json:1-4,31-51` — installed version and public export map.
- `node_modules/brometal/dist/index.d.ts:4-20` — public runtime exports.
- `node_modules/brometal/dist/runtime/context.d.ts:32-45` — public renderer API; no readback/device operation.
- `node_modules/brometal/dist/runtime/render-target.d.ts:3-28,29-50` — target options and public target API.
- `node_modules/brometal/dist/runtime/webgpu.d.ts:7-39` — WebGPU internals are explicitly non-public.
- `node_modules/brometal/dist/runtime/webgpu.js:774-831` — RGBA16F target allocation, `COPY_SRC`, internal GPU texture, and no public read method.
- `node_modules/brometal/README.md:253-304` — documented targets are for drawing and GPU sampling.

### Governing and target documents

- `docs/adr/framework/0011-stable-ids-and-runtime-aliases_H.md:21-42` — accepted stable UUIDv7 identity and lifetime-bounded numeric aliases.
- `docs/adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md:24-55` — accepted host/game ownership and raw-to-semantic input conversion.
- `docs/adr/framework/0021-brometal-render-driver-ownership_H.md:29-66` — accepted driver ownership and general-purpose upstream-contribution rule.
- `docs/architecture/README.md:3-13,35-46` — guides describe a target system; missing features and open questions are not accepted decisions.
- `docs/architecture/framework/rendering-and-assets_A.md:68-100` — claimed future bounds, stable slots, and owner mappings.
- `docs/architecture/framework/rendering-and-assets_A.md:245-257` — claimed shared selection result and explicitly unselected method.
- `docs/architecture/framework/rendering-and-assets_A.md:275-295` — selectable-draw verification target and open method decision.
- `docs/architecture/studio/overview_A.md:149-183` — claimed future inspection/render/selection operations.
- `docs/architecture/studio/overview_A.md:185-225` — claimed editor-mode and input-ownership behavior.
- `docs/architecture/studio/overview_A.md:247-263` — claimed shared temporary selection record.
- `docs/architecture/studio/overview_A.md:404-423` — claimed cross-surface verification and open first-method decision.

## Established / claimed / inferred labels

- **Established** means verified in committed source, tests, installed package code, or an accepted ADR.
- **Claimed** means described in an in-progress architecture guide. It is direction, not proof of implementation or an accepted final interface.
- **Inferred** means a design or cost conclusion derived from those sources and still requiring implementation evidence.

### Bounded CPU hit testing versus GPU object-ID picking

| Concern | Bounded CPU hit testing | GPU object-ID picking |
|---|---|---|
| Mechanism | `[Inferred]` Transform the click into world or projected screen space, test a bounded list of selectable shapes, resolve overlap, return the record’s stable ID. | `[Inferred]` Render a temporary numeric alias per selectable draw/instance, read the clicked pixel, then resolve that lifetime-local alias to a stable ID. |
| Cost for a few dozen 2D objects | `[Inferred]` An `O(n)` scan only on click is small and avoids GPU synchronization; measure rather than assuming a general threshold. | `[Inferred]` Adds a pass, pick pipelines/data, and asynchronous GPU→CPU transfer even though object count is small. |
| Fidelity | `[Inferred]` Exact for declared rectangles/circles/polygons; can diverge from sprite alpha, irregular geometry, render culling, and depth unless those semantics are duplicated. | `[Inferred]` Can follow actual rasterized geometry, culling, and depth if the pick shaders reproduce alpha/discard and ordering rules. |
| Current Antiky fit | `[Established]` Can be built without changing BroMetal, but selectable bounds, camera conversion, overlap order, and stable-ID records do not exist. | `[Established]` Current render contracts lack IDs/readback; BroMetal’s public runtime lacks target readback, despite having internal `COPY_SRC`. |
| Determinism/testing | `[Inferred]` Straightforward headless unit tests and deterministic tie-break tests. | `[Inferred]` Needs GPU integration tests, asynchronous completion handling, format/precision validation, and stale-frame handling. |
| Identity lifetime | `[Inferred]` The selectable record can carry `EntityId` directly. | `[Established + inferred]` ADR 0011 requires a numeric pixel value to remain a temporary alias; it must be mapped back to `EntityId` within the render-state lifetime. |
| Main semantic risks | Camera-transform drift, incorrect bounds, render-order drift, transparent pixels. | Readback latency, stale alias maps, MSAA/blended IDs, transparency, target format, device loss, and readback API ownership. |

Neither method is selected by this research. The target architecture explicitly leaves that decision open.

## Gaps

1. **Requirement scope:** It is unknown whether the requested need is only game-side click-to-object interaction or the larger shared Studio/hierarchy/MCP selection workflow.
2. **Pick semantics:** No accepted rule defines topmost versus nearest, transparent sprite pixels, blended objects, hidden objects, overlays, drag selection, or mixed 2D/3D depth.
3. **Coordinate contract:** Normalized bottom-origin coordinates exist, but no authoritative camera inverse or pick-time coordinate snapshot exists. Touch-first clicks can use stale coordinates because only `pointermove` updates them.
4. **Selectable data:** No bounded registry relates object bounds, visibility/order, temporary render slots, and stable owner IDs.
5. **Render ownership mapping:** Point lights demonstrate the pattern, but current generic draws and many demo batches cannot resolve one rendered instance to one entity.
6. **Selection lifecycle:** There is no selection record, revision/frame fence, clear/focus behavior, or attached-mode separation from gameplay.
7. **Generic inspection:** Whole-world data can be filtered client-side, but there is no generic entity lookup or selected-target projection with render dependencies.
8. **GPU capability:** A supported BroMetal readback API, target format choice, row alignment, coordinate conversion, and async error behavior remain unverified because 0.17.2 exposes none publicly.
9. **End-to-end proof:** No test covers DOM pointer input → coordinate conversion → hit → stable ID → Studio/MCP inspection.

## Planning implications

1. **Owner decision before implementation planning:** Choose the intended product boundary:

   - A narrow game-side 2D object pick, or
   - Shared temporary selection across canvas, hierarchy, Studio inspection, and MCP.

   The second is a substantially larger editor-session feature.

2. **Owner decision before choosing a technique:** Define required fidelity and overlap behavior. Bounds-only picking and pixel-accurate rendered picking solve different requirements.

3. Plan one renderer-neutral acceptance path first: a pointer action identifies the expected stable `EntityId`, records the relevant runtime/render revision, and allows inspection of that same entity. Use the same acceptance fixture to evaluate both methods.

4. If CPU bounds are evaluated, keep the first slice bounded to a few dozen 2D objects and include camera conversion, explicit selectable shapes, visibility, and a deterministic topmost tie-break. It should not require a generalized render graph.

5. If GPU IDs are evaluated, plan:

   - Per-instance temporary pick aliases and stable reverse mapping.
   - A non-blended, appropriate-format pick target and coordinate conversion.
   - Asynchronous readback with stale-frame/lifetime fencing.
   - A public BroMetal render-target readback capability or an Antiky driver implementation that stays inside accepted ownership boundaries.

   A BroMetal contribution is appropriate only if the readback primitive is general-purpose; ADR 0021 requires a focused upstream contribution and temporary local patch.

6. If shared Studio selection is in scope, separately plan the selection record/service, iframe/runtime transport, selectable hierarchy state, generic entity inspection, and MCP get/set/clear operations. Attached Studio selection must not silently become gameplay input.

7. Add proof at each missing link: host coordinate/click tests, headless hit/tie-break tests, alias-lifetime tests, pointer-to-`EntityId` integration, Studio hierarchy/canvas convergence, MCP convergence, and GPU readback tests only if that method advances.
