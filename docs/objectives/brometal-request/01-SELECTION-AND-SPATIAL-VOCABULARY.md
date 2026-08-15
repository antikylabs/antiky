# Selection and spatial vocabulary

This document fixes the terms and coordinate meanings used by the rest of the plan. These definitions
prevent a temporary GPU number, a durable entity identity, a click event, and a later selection from
being described as if they were the same value or moment.

## Identity and state terms

| Term | Meaning in this objective | Owner and lifetime |
| --- | --- | --- |
| **Entity** | A game-owned semantic item with a stable Framework `EntityId`. | The game or its world owns membership. Framework supplies and validates the ID. |
| **`EntityId`** | The canonical UUIDv7 identity used by runtime state, inspection, and Studio. | Stable across render frames. It is the only item identity allowed across the driver boundary. |
| **`Position2D`** | A finite XY position associated with an existing `EntityId`. It is not a complete transform. | Copied into a small Framework runtime store. The caller remains the entity and durable-data authority. |
| **Runtime position store** | A private map with deterministic `get`, `list`, position replacement, complete rebuild, sequence, and disposal behavior. | Framework runtime state. It owns no entity creation, hierarchy, arbitrary components, persistence, or render resources. |
| **Presentation position** | The interpolated or otherwise displayed position used to prepare visible draws, pick draws, and camera follow for one frame. | Produced by the game presentation step. It can differ from the last fixed simulation position. |
| **Camera state** | Center, visible world height, optional follow identity and offset, optional bounds, and follow smoothing state. | Renderer-neutral Framework behavior. It has no DOM or BroMetal object. |

The plan uses `Position2D`, not `Transform2D`. Rotation, scale, local-to-world hierarchy, and transform
composition are not established requirements
(`docs/objectives/brometal-request/research/01-request-and-current-coverage.md:48-50`).
The fixture can own any size, rotation, colour, or shape values that it needs to render. Naming a
position-only API “transform” would promise semantics this objective has not earned.

## Selection terms

| Term | Meaning in this objective | Important distinction |
| --- | --- | --- |
| **Click sample** | An immutable normalized XY position captured from the activation event that set the one-frame click signal. | It is not the latest mutable pointer position. |
| **Displayed frame** | The last successfully submitted visible presentation plus its immutable pick description, drawing-buffer size, and presentation sequence. | A later simulation tick does not rewrite the retained description or a request-frame map made from it. |
| **GPU ID** | A positive temporary integer encoded into the selection target for one selectable item in one submitted pick frame. | It is not an `EntityId`, database ID, authoring ID, or Studio ID. |
| **No-hit value** | GPU ID `0`, written to cleared selection-target pixels. | A valid latest read of `0` clears selection. |
| **Selection target** | A one-sample, nearest-sampled off-screen colour target used for temporary GPU IDs. | It is a driver-owned GPU resource, never inspection data. |
| **Request-frame map** | The exact map from GPU IDs to stable `EntityId` values created when one retained displayed-frame description is replayed as a pick frame. | It is retained until asynchronous readback completes or is rejected. It is not global or durable. |
| **Pick request** | A monotonic request sequence, immutable click sample, captured presentation sequence, and active runtime/world/driver generation. | It records user intent and the frame that was clicked independently of GPU completion order. |
| **Resolved pick result** | `EntityId | null` plus the non-GPU request fences needed by Framework. | The driver resolves the GPU number before it sends the result. |
| **No-hit result** | A successful read of GPU ID `0`. | It clears the current selection. It is not a technical failure. |
| **Readback failure** | A device, mapping, validation, or decoding failure. | It preserves the prior selection and publishes a bounded render diagnostic. |
| **Stale result** | A result for an older user request, retired runtime/world, old driver generation, disposed driver, or removed entity. | It has no selection effect. Ordinary world revision progress alone does not make it stale. |
| **Entity selection** | Framework's current runtime-scoped `EntityId | null` selection with a monotonic selection revision. | It is temporary observation state, not durable authoring state, an event log, or gameplay input. |
| **Unsupported selection** | The inspection snapshot has no selection section. | Different from supported selection whose current `entityId` is `null`. |

ADR 0011 permits temporary numeric aliases but prohibits treating them as durable identities.
ADR 0022 assigns the request-frame map and asynchronous GPU work to the driver and requires a stable
`EntityId` result (`docs/adr/framework/0011-stable-ids-and-runtime-aliases_H.md` and
`docs/adr/framework/0022-use-gpu-ids-to-select-framework-entities_H.md:25-41`).

## Coordinate spaces

The implementation must name a coordinate space at every boundary.

| Space | Representation and origin | Use |
| --- | --- | --- |
| **CSS event space** | Browser `clientX/clientY`, top-left origin, CSS pixels. | Raw host input only. It never enters camera or driver APIs. |
| **Normalized viewport space** | `[0,1] x [0,1]`, bottom-left origin, positive Y upward. | Host/game boundary, click samples, camera anchors, and world/viewport conversion. Active samples are clamped before use. |
| **Drawing-buffer space** | Integer texel coordinates in the actual selection target, including device-pixel ratio. | Driver-only readback coordinates. The driver performs the bottom-left to target-row conversion and clamps edges. |
| **World space** | Orthographic XY plane, positive X right, positive Y up. Origin and unit size are game-defined. | Position storage, camera state, presentation, and fixture geometry. |
| **Clip space** | Plain numeric column-major projection/view output. | Render extraction supplies it to the renderer without a BroMetal camera object. |

The camera stores a positive **visible world height** instead of an ambiguous zoom number. The
viewport aspect derives the visible width. `zoomBy(factor, anchor)` is the user operation: a factor
greater than one magnifies, and the world point under the normalized anchor remains fixed. If no
anchor is supplied, the viewport centre is used.

`worldToViewport` and `viewportToWorld` do not clamp. Off-screen conversion is useful. Input is
clamped before interaction, not inside pure conversion functions.

## Pan, zoom, follow, and resize semantics

- A content drag pans the camera in the opposite direction so that the world appears to follow the
  pointer.
- Manual pan ends follow. Follow resumes only after the caller explicitly supplies another follow
  request.
- Follow uses a stable `EntityId`, but the camera does not query the runtime store. The caller
  resolves the current presentation position for that identity and supplies it to the camera.
- Visible geometry, pick geometry, and follow consume the same presentation position. Following the
  last fixed-step position while drawing an interpolated position is a correctness defect.
- Follow uses frame-rate-independent exponential easing. First use, explicit reset, target change, or
  an abnormally long update gap snaps instead of easing from stale state.
- Optional world bounds are absent by default. When present, they clamp the visible rectangle. If a
  viewport is larger than a bounded axis, that axis is centred instead of oscillating between edges.
- Resize preserves camera centre and visible world height. Aspect changes visible width only.
- The camera consumes semantic pan and zoom intent. It does not attach browser listeners.
- The runnable fixture includes drag pan and cursor-anchored wheel zoom. The host owns wheel-event
  normalization and exposes a bounded one-frame semantic zoom value. Pinch and multipointer gestures
  are excluded.

The current host already owns raw input and resize under ADR 0020. Adding wheel intent means updating
the game contract, CLI host, website host, generated Studio project-service artifact, documentation,
and their contract tests. Hiding that work inside the camera would violate the host/game boundary.

## Selection observation contract

Framework will define a validated nested version-1 selection record with this semantic shape:

```ts
type EntitySelectionInspectionV1 = Readonly<{
  schemaVersion: 1;
  owner: 'framework';
  runtimeInstanceId: string;
  worldId: WorldId;
  revision: number;
  entityId: EntityId | null;
}>;
```

The record is optional in `InspectionSnapshot`:

- absent means that the runtime does not supply Framework entity selection;
- `entityId: null` means selection is supported and currently empty;
- a stable ID means that entity is selected;
- `revision` increments for each accepted hit or clear;
- runtime and world identities must agree with the containing inspection data;
- no GPU ID, target format, pixel, backend object, or resource appears in it.

The root inspection parser rejects unknown fields (`packages/framework/src/inspection/snapshot.ts:162-175,297-307`).
This is therefore an additive lockstep schema change across the Framework producer, CLI validation,
and Studio consumer. The implementation must test local and serialized forms together. A mixed-version
detached-client migration is not required because this objective does not publish a package or promise
cross-version support. If that assumption changes, the root protocol must be versioned deliberately
instead of silently accepting unknown data.

Selection does not belong inside `WorldInspection`. A bounded or stale world view can omit the
selected entity, and Studio must be able to report that exact state. Selection is also not a command,
event, point-light record, or Studio-local copy.

## Ownership boundary

| Owner | Responsibility | Must not own here |
| --- | --- | --- |
| Host | Raw pointer/wheel events, immutable click sample, normalized pan/zoom intent, canvas resize. | Camera policy, GPU IDs, entity lookup. |
| Game/presentation | Entity membership, labels, displayed positions, visible and pick geometry descriptions, world inspection projection. | BroMetal resources or durable GPU aliases. |
| Framework runtime | Position store, camera, latest-request selection acceptance, validated selection observation. | General ECS, durable editor selection, GPU readback. |
| BroMetal driver | Selection target, GPU ID allocation/encoding, request-frame map, pass execution, readback, stable-ID resolution, disposal. | Studio state, game policy, durable entity identity. |
| BroMetal | Renderer-general target readback if the current public API still lacks it. | `EntityId`, selection, Studio, alias policy. |
| CLI development service | Validate and transport the complete snapshot through the existing authenticated session path. | A second selection service. |
| Studio | Derive current selection from the snapshot, reveal and inspect the exact entity, show missing/stale states. | GPU objects, iframe DOM inspection, a duplicate authoritative selection. |

## Options rejected by these definitions

- A stable GPU ID is rejected because it violates the temporary-alias decision.
- Latest mutable pointer coordinates are rejected because movement can occur after activation.
- CSS-pixel camera math is rejected because device-pixel ratio and resize would leak into game state.
- A camera that owns DOM listeners is rejected because raw input belongs to the host.
- A general transform hierarchy is rejected because only 2D position tracking is proved.
- A world-store entry for selection is rejected because selection must remain meaningful when a
  bounded world view omits the selected entity.

The cost of these definitions is more explicit conversion and validation code. The benefit is that
each asynchronous and serialized boundary has one owner and one identity type.

## Not covered by this vocabulary

These terms do not define multi-select, hierarchy-to-canvas selection, transparent blended-surface
policy, gameplay targeting, durable selection history, an editor camera, touch gestures, or a general
3D/2.3D picking API. Those remain separate slices even though accepted direction eventually expects
selection across 2D, 3D, and 2.3D games.
