# Capability diagnosis

This document establishes what is missing, what already exists, and what this objective must prove.
It separates the external BroMetal issue from the broader Antiky result that the owner selected. It
does not prescribe the implementation sequence; that is in
[`02-IMPLEMENTATION-STRATEGY.md`](02-IMPLEMENTATION-STRATEGY.md).

## The request and the Antiky objective are not identical

BroMetal issue #8 describes an optional companion for a small 2D scene. Its author proposes
lightweight position or transform tracking, click-to-entity picking, and a 2D pan, zoom, and follow
camera. The author says that they intend to build and share it. They did not commission Antiky, ask
Antiky to own their canal application, or define Studio behavior. The evidence is summarized in
`docs/objectives/brometal-request/research/01-request-and-current-coverage.md:23-50`.

The owner selected a broader internal result: a click on a displayed item must be traced through a
GPU value to the stable Framework entity and then shown as the current selection in Studio. Framework
ADR 0022 now makes GPU selection binding. CPU hit testing can be useful in other work, but it cannot
complete this objective (`docs/adr/framework/0022-use-gpu-ids-to-select-framework-entities_H.md:23-53`).

The planned deliverable is therefore an Antiky integration proof informed by the issue, not an
implementation contract with the issue author.

## Current capability

Antiky has several required ingredients, but it does not have the connected behavior.

| Area | Current evidence | Diagnosis |
| --- | --- | --- |
| Stable identity | `EntityId` is a branded UUIDv7 with creation and parsing in `packages/framework/src/identity/ids.ts:10-21,94-126`. | Present and reusable. Do not create a second object identity. |
| 2D position state | The only immutable position value is coupled to point-light records in `packages/framework/src/point-light/records.ts:1-27,113-126`. Generic entities and stores in `packages/framework/src/inspection/world.ts:21-117` are inspection data, not runtime storage. | A small reusable runtime position store is missing. A general `World` or ECS is not justified. |
| Pointer input | `GamePointerInput` supplies normalized position, button, drag, and a one-frame `clicked` flag in `packages/framework/src/game/contract.ts:20-29`. The development host converts pointer movement to bottom-origin normalized values in `packages/cli/src/host/game-server.ts:419-430`. | Useful input exists, but `pointerdown` sets `clicked` without taking a fresh immutable click sample (`packages/cli/src/host/game-server.ts:431-438`). |
| Render description | Draws can carry numeric instance data, and frames can draw ordered off-screen passes in `packages/framework/src/render/render-contract.ts:50-138`. | The shape can describe pick geometry, but it has no stable draw owner, selection pass contract, or result contract. |
| BroMetal driver | The driver owns BroMetal targets and submits frames synchronously in `packages/framework/src/render/brometal-driver.ts:130-137,208-305`. The base `RenderDriver` deliberately exposes only configure, submit, and dispose in `packages/framework/src/render/render-contract.ts:140-153`. | No target readback, pick request, retained alias map, or asynchronous stable-ID result exists. |
| BroMetal readback | The checked dependency is BroMetal `0.17.2`. Its target texture has internal `COPY_SRC` use, but its public `RenderTarget` surface exposes only size, texture, depth, and disposal (`node_modules/brometal/dist/runtime/render-target.d.ts:3-50`). | A current-release check and probably a general BroMetal readback contribution are hard prerequisites. Internal WebGPU fields are not an acceptable Antiky API. |
| 2D camera | BroMetal supplies a perspective camera. Antiky demos contain private follow and damping behavior, but Framework exports no renderer-neutral 2D camera (`docs/objectives/brometal-request/research/01-request-and-current-coverage.md:123-135`). | Orthographic conversion, pan, zoom, follow, resize, and their shared coordinate contract are missing. |
| Framework selection | `InspectionSnapshot` can carry runtime, diagnostics, measurements, session, point-light, world, and event data in `packages/framework/src/inspection/snapshot.ts:62-119`. | There is no validated temporary entity-selection record or latest-request fencing. |
| Development transport | The game host publishes a semantic snapshot every 250 milliseconds through the existing inspection service (`packages/cli/src/host/game-server.ts:144-177,343-371`). The CLI development snapshot already carries Framework inspection (`packages/cli/src/development/types.ts:46-99`). | The path is reusable. A second selection endpoint or iframe bridge is unnecessary. |
| Studio | Studio polls the complete development snapshot in `packages/studio/app/src/development/coordinator.ts:170-207`. Its hierarchy shows stable IDs and components, but has no selected state (`packages/studio/app/src/components/InspectionPanel.tsx:26-103,137-175`). | Selection highlight, reveal, and selected-entity details are missing. |

## The actual defect is a missing end-to-end contract

This is not primarily a missing rectangle helper or a missing camera matrix. The boundary stops at
several points:

```text
pointer activation
  -> immutable click position                 missing
  -> displayed-frame pick description         missing
  -> GPU ID target and asynchronous readback  missing
  -> request-frame GPU ID map                 missing
  -> stable EntityId result                   missing
  -> temporary Framework selection            missing
  -> existing inspection transport            present
  -> Studio selection and details             missing
```

The dangerous part is the asynchronous lifetime. A click captures the last displayed pick
description, the driver replays that immutable state, and the GPU result arrives later. The driver
must retain the ID map created for that replay until readback finishes or the result is rejected.
Calling this a “same-frame lookup” would hide that delay. A current world revision can advance while
a valid readback is pending, so request order, presentation identity, runtime identity, world
identity, driver generation, entity existence, and disposal are the useful fences.

## Interpretations considered

### Treat the issue as an external communication task

This would correct or expand the GitHub reply without delivering the missing behavior. It would also
make an external author appear to be the acceptance authority for an internal Studio feature. It does
not satisfy the owner's selected result.

### Build a separate companion package first

This resembles the requester's proposal, but it forces package ownership, generic caller keys,
versioning, build output, installation, and support policy before Antiky has proved the behavior in
its own runtime. It is premature.

### Build one Antiky-owned complete slice

This is the selected interpretation. Add the narrow reusable Framework behavior, the required
BroMetal-driver capability, Studio observation, and one dedicated integration fixture. This follows
the proof-before-abstraction direction in `docs/VISION_DIRECTION_H.md` and the specialized-store rule
in Framework ADR 0001.

The cost is real cross-package work. It changes host input, Framework runtime and inspection code,
the BroMetal driver, likely the BroMetal dependency patch set, the CLI validation path, Studio, and a
real WebGPU test surface. That cost is preferable to claiming coverage that does not exist.

## Completion diagnosis

The objective is complete only when all of these statements are true:

1. A runnable 2D Antiky fixture owns stable Framework entities and publishes them in world
   inspection.
2. The fixture exercises reusable position tracking and a renderer-neutral camera with pan, anchored
   zoom, follow, resize, and world/viewport round trips.
3. A pointer activation uses its own captured coordinate, not a later mutable pointer value.
4. The BroMetal driver renders temporary IDs, reads the selected pixel asynchronously, retains the
   submitted frame's map, and resolves the value to `EntityId | null` before crossing its boundary.
5. A valid latest no-hit clears Framework selection. A stale, failed, disposed, or unmapped result
   cannot replace or clear a newer valid selection.
6. The existing inspection transport carries the stable selection to Studio.
7. Studio highlights and examines the exact selected entity, including explicit stale and missing
   states.
8. A real GPU and browser-to-Studio proof demonstrates the complete trace. Headless mocks alone do
   not complete it.

The fixture should contain roughly 32 opaque selectable items, including overlap and empty space.
That number is test data. It is not a Framework capacity, release version, scale claim, or support
promise.

## Historical research caution

Raw reports `research/subagent_outputs/00-issue-brometal-surface.md` and
`02-picking-selection-coverage.md` predate ADR 0022 and still describe CPU-versus-GPU selection as an
open choice. Raw report `04-external-product-fit.md` also contains repository observations that later
work changed. They remain useful evidence, but their old recommendations are not plan authority.
Current source, compiled research, and accepted ADR 0022 control this plan.

## Not covered by this diagnosis

This document does not claim that Antiky is npm-installable. Antiky Framework is MIT-licensed open
source and available from the repository; package publication is a separate question. It also does
not diagnose the requester's canal application, promise BroMetal ecosystem acceptance, or decide a
public release or support policy.
