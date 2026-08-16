# Re-audit: required GPU pick → Studio inspection path

## Current-tree provenance

`[Established]` Current `HEAD` is `08db502` on `wip/goal-12-driver-migration`. Relevant source is committed and clean. The only working-tree item at the final check was an untracked `docs/objectives/brometal-request/objective.md`, restored concurrently by another agent.

The compiled research predates the Town driver migration:

- Research handoff: `8f8585a`, 2026-08-14 21:43.
- Town driver migration: `75b0695`, 2026-08-14 21:45.

That explains one now-false research statement: a real demo does use and test the Framework BroMetal driver.

## Established current coverage and missing links

| Required link | Current coverage | Missing work |
|---|---|---|
| Render a GPU pick identity | **Partial mechanical support.** A frame can add an offscreen pass, depth, one sample, nearest filtering, numeric uniforms, and numeric per-instance attributes. Town now proves a real multi-pass frame through the Framework driver. | No pick target/pipelines exist. Draws have no semantic owner or first-class pick alias. Each selectable draw or instance still needs a stable-owner mapping and pick shader behavior matching geometry, depth, culling, and alpha discard. |
| Temporary numeric alias | **Pattern exists.** ADR 0011 permits lifetime-local numeric render aliases; point lights already validate `EntityId ↔ renderSlot`. | No generic pick-alias allocator, reverse map, “zero means no hit” rule, frame/revision fence, or retention until asynchronous readback finishes. |
| GPU pixel readback | **Underlying ingredient only.** BroMetal’s internal target texture is RGBA16F with `COPY_SRC`. | BroMetal 0.17.2 publicly exposes draw-to-target and sampling only. No public pixel/region readback exists. Framework’s target map is private and `submit()` returns `void`, so nothing can currently recover the alias. |
| Alias → Framework `EntityId` | **Stable identity exists.** UUIDv7 creation/parsing and inspection validation are implemented. | No generic rendered-item-to-entity mapping. Town’s actors and props are render batch rows, not published Framework entities. Its semantic world is currently derived from point lights only. |
| Stable ID → selection state | **Absent.** | Framework needs a validated temporary selection record/service, including runtime/world/render fencing sufficient to reject a stale GPU result. |
| Selection → runtime inspection transport | **Existing snapshot transport is usable.** | `InspectionSnapshot` and `GameInspectionPort` contain no selection. A pick result cannot enter the development snapshot consumed by Studio. |
| Studio selects and inspects the entity | **World hierarchy display exists.** | Studio has no selected ID, selectable hierarchy row, selected-entity inspector, or pick-result handling. The live game is an iframe only. |

### Important current-tree correction

The render contract is slightly closer to GPU picking than the earlier report says:

- Arbitrary numeric `instanceData` can mechanically carry an `iPickAlias`; a number uniform can carry a non-instanced alias.
- `TargetRequest` now exposes `filter`, so a pick target can request nearest sampling.
- Town now constructs the Framework driver and submits a real frame through it.

These are ingredients, not an implemented semantic picking path. The missing hard boundary remains supported readback plus lifetime-safe alias-to-entity resolution.

### Exact evidence

- Numeric uniforms and instance rows: `packages/framework/src/render/render-contract.ts:41-45,50-86`.
- Depth/sample/filter target description: `packages/framework/src/render/render-contract.ts:95-119`.
- Ordered offscreen passes and submit-only driver: `packages/framework/src/render/render-contract.ts:121-153`.
- Driver-owned private targets and target options: `packages/framework/src/render/brometal-driver.ts:130-137,208-243`.
- Driver uploads arbitrary instance data and submits synchronously: `packages/framework/src/render/brometal-driver.ts:245-296`.
- Town uses the Framework driver: `packages/demos/antiky/antiky-town/src/town/index.ts:1-16,443-457`.
- Town’s actual frame and actor instances: `packages/demos/antiky/antiky-town/src/town/index.ts:1041-1147`.
- Town’s driver integration regression test: `packages/demos/antiky/antiky-town/tests/renderer-construction.test.ts:7-19,115-157`.
- Town inspection currently publishes session and point lights only: `packages/demos/antiky/antiky-town/src/composition.ts:121-144`.
- Stable IDs: `packages/framework/src/identity/ids.ts:10-21,83-100,120-126`.
- Existing point-light alias pattern: `packages/framework/src/point-light/projections.ts:8-26,95-135`.
- Alias lifetime rule: `docs/adr/framework/0011-stable-ids-and-runtime-aliases_H.md:21-42`.
- BroMetal public renderer has no readback: `node_modules/brometal/dist/runtime/context.d.ts:32-45`.
- BroMetal public target has no readback: `node_modules/brometal/dist/runtime/render-target.d.ts:29-50`.
- BroMetal internal target has `COPY_SRC`: `node_modules/brometal/dist/runtime/webgpu.js:774-831`.
- Internal WebGPU handles are explicitly non-public: `node_modules/brometal/dist/runtime/webgpu.d.ts:7-39`; the export map omits that module at `node_modules/brometal/package.json:31-51`.
- Current five local patches do not include readback: `scripts/patch-brometal.mjs:14-39`.
- Selection absent from snapshot: `packages/framework/src/inspection/snapshot.ts:62-77,104-119`.
- Selection absent from game inspection port: `packages/framework/src/game/host.ts:58-74`.
- Stable inspected entities exist: `packages/framework/src/inspection/world.ts:70-117,225-242`.
- Studio iframe has no selection bridge: `packages/studio/app/src/components/LiveGameFrame.tsx:1-20`.
- Studio hierarchy has no selection state/callback: `packages/studio/app/src/components/InspectionPanel.tsx:26-69,137-175`.
- Studio coordinator has no selection operation: `packages/studio/app/src/development/coordinator.ts:31-46,62-72`.

## Likely ownership

`[Inferred, bounded by accepted ADRs]`

### BroMetal

Own only the renderer-general primitive:

- Public asynchronous render-target pixel or bounded-region readback.
- WebGPU copy-to-buffer details, row alignment, mapping, cleanup, device-loss/error behavior, and a documented coordinate/format result.
- Any target-format capability genuinely required for exact ID values.

BroMetal should not know `EntityId`, selection, Studio, game objects, or alias lifetime policy.

Before patching, the `team-brometal` workflow requires checking the latest published version. If still missing, the change must be a temporary local patch with a focused upstream PR and explicit retirement path.

### Framework and its BroMetal driver

Own the semantic bridge:

- Pick-pass request and result boundary.
- Temporary numeric alias allocation and frozen reverse map.
- Per-draw/per-instance alias transport.
- Retaining the exact alias table until its asynchronous readback resolves.
- Rejecting stale results after render-state, runtime-instance, or world changes.
- Resolving the alias to canonical `EntityId`.
- Keeping BroMetal targets/device objects inside the driver.
- Publishing a validated temporary selection record through inspection.

This follows ADR 0021: new Antiky render behavior belongs in the Framework-owned driver, while BroMetal receives only the general renderer primitive.

### Game/render preparation

Own which objects are selectable and how rendered instances map to Framework entities. A first proof must ensure every selected actor/object has:

- A stable Framework `EntityId`.
- One alias in that pick-frame lifetime.
- A corresponding retained world-inspection entity.
- Pick geometry/order matching the visible result closely enough for the owner’s acceptance criteria.

Town does not currently meet this for actors or props.

### CLI/host transport

Own moving semantic selection observations from the browser runtime into the development snapshot. The CLI should transport the stable selection DTO, not renderer objects or raw GPU values.

A click inside the iframe can be handled by the game runtime and returned through inspection; a parent-window GPU bridge is not inherently necessary for the one-way canvas-to-Studio path.

### Studio

Own presentation and editor behavior:

- Store/read the current selected stable ID.
- Highlight the matching hierarchy entity.
- Show that entity’s components and relevant render/inspection records.
- Show explicit stale/missing states when the selected ID is absent from the retained snapshot.
- Keep Studio selection from silently becoming gameplay action in attached mode.

Hierarchy-to-canvas set/clear/focus operations are additional work if bidirectional shared selection is required. MCP need not be added merely because this one-way GPU-to-Studio proof is required, though the selection DTO should not block the documented future shared service.

## Required compiled-research corrections

Do not edit the raw subagent reports; they are retained evidence. Correct the compiled interpretation.

### `research/README.md`

- `:28-33` currently says Framework can handle clicks without BroMetal and that GPU picking can wait. Replace with:  
  **“The owner requires a GPU-rendered identity path. Current Framework rendering can describe the pick pass, but BroMetal readback, lifetime-safe alias mapping, and Studio selection are missing and must be planned.”**
- `:74-81` recommends CPU picking and excludes Studio/GPU. Replace those defaults with the exact required chain.
- `:84-85` says the owner only needs to speak about packaging or a GitHub reply. That is obsolete; the owner has now supplied a material implementation decision.
- Keep the CPU comparison only as a rejected/deferred alternative, not the recommended path.

### `01-request-and-current-coverage.md`

- `:34-38` can remain as an **issue-only** interpretation, but must immediately distinguish it from the broader owner requirement: the requester did not demand GPU/Studio, while Antiky’s owner now does.
- `:78` must change from “not required for the issue minimum” to:  
  **“Not requested by the external issue, but required by the owner for this Antiky objective; currently missing.”**
- `:101-110` accurately describes missing current behavior and should remain.

### `02-minimum-slice-and-technical-options.md`

- `:11-30` must replace the CPU-helper diagram with:

  ```text
  selectable Framework EntityId
          ↓
  lifetime-local numeric render alias
          ↓
  BroMetal GPU object-ID pass
          ↓
  asynchronous pixel readback
          ↓
  fenced alias → stable EntityId resolution
          ↓
  Framework temporary selection
          ↓
  development inspection transport
          ↓
  Studio hierarchy selection + entity inspection
  ```

- `:37-40` says the BroMetal driver has no role. This is now both scope-wrong and factually stale.
- `:71-96` should state that GPU object-ID picking is selected by the owner for this objective. CPU bounds remain comparative evidence, not the default.
- `:121` must change from “No action for the minimum CPU path” to “Required renderer-general prerequisite; verify current BroMetal and plan patch/upstream contribution if absent.”
- `:143-158` must split verification into:

  - Headless alias/lifetime/selection DTO tests.
  - Driver contract tests for the pick pass and decoded alias.
  - Real GPU readback integration.
  - Browser/runtime-to-Studio end-to-end proof.

  The current “no GPU or Studio dependency” acceptance fixture cannot prove the owner-required result.

### `03-delivery-ownership-and-decisions.md`

- `:35-45` is stale: Town now uses and tests the Framework driver. Reframe it as the necessary Antiky integration boundary, while noting it is not an externally released API.
- `:52` must replace “CPU picking” with the GPU-to-Studio vertical slice.
- `:74,76,80-81` must assign GPU ID integration to Framework/driver, general readback to BroMetal, and selection/inspection UI to Framework transport plus Studio.
- `:91-99` must stop calling the driver or full inspection stack “bad-sized” for this owner-selected path.
- `:103-112` must remove the instruction to exclude Studio and GPU picking.
- `:129-130` should say scene/entity policy stays in Framework, while general target readback is an appropriate BroMetal contribution candidate.

### Objective handoff README

`docs/objectives/brometal-request/README.md:3,17-21` currently says research is complete, ready for planning, and should avoid GPU picking and Studio. It should return to research correction until the compiled documents reflect the owner’s requirement.

Also, `research/README.md:5,50` and the objective handoff link to `research/00-research-plan.md`, but that file is absent from current `HEAD`. The working tree now has `objective.md`, but it is untracked. Those lifecycle records need reconciliation before declaring research complete.
