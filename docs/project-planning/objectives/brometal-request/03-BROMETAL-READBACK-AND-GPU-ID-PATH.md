# BroMetal readback and GPU ID path

This document selects the GPU selection mechanism and its asynchronous lifetime. BroMetal supplies a
general one-pixel target read, while `BroMetalRenderDriver` owns pick submission, temporary ID
encoding, the retained request-frame map, and stable `EntityId` resolution. The base frame loop stays
synchronous and no GPU value crosses the driver boundary.

## Current boundary

The Framework dependency pins BroMetal `0.17.2` (`packages/framework/package.json:23`). BroMetal's
WebGPU target already includes `COPY_SRC` (`node_modules/brometal/dist/runtime/webgpu.js:816-826`), but
the public `RenderTarget` exposes no read operation
(`node_modules/brometal/dist/runtime/render-target.d.ts:42-50`). Antiky's driver keeps targets private
and exposes only synchronous frame submission
(`packages/framework/src/render/brometal-driver.ts:130-137,274-305`).

The base `RenderDriver` intentionally has only `configureTargets`, `submit`, and `dispose`
(`packages/framework/src/render/render-contract.ts:140-153`). Widening every renderer for the first
BroMetal-specific proof would create a promise no second driver has earned.

## Mechanisms considered

### CPU shape picking

CPU picking can scan a few dozen rectangles quickly, but it introduces CPU hit shapes and overlap
rules and cannot prove which Framework entity produced the displayed GPU pixel. Reject it as this
objective's path.

### Public unrestricted target reads from Framework

Exposing `readTargetPixel(key)` beside normal submission makes it easy to read a target after a newer
frame or resize replaced the contents and map. It also exposes a lower-level operation than the stable
entity result Framework needs. Reject it at the Framework boundary.

### Widen the generic `RenderDriver`

An asynchronous selection method on every driver looks renderer-neutral, but only the BroMetal driver
has a proved implementation and target semantics. Reject for now. A second driver can justify a shared
capability later.

### BroMetal pixel read plus retained displayed-frame replay

Select this option. BroMetal gains a renderer-general readback primitive. The Framework BroMetal
driver exposes a separate selection capability. A successful visible submission retains an immutable
pick description for that exact presentation. A later click replays that retained description into a
private ID target and queues the read before its first asynchronous suspension. An active request owns
the exact target and alias map; a queued request owns only its copied displayed-frame data until it
starts.

This shape costs an additional driver API and careful resource lifetime tests. It prevents a caller
from accidentally picking the next simulation state or pairing one frame's pixels with another
frame's aliases.

## BroMetal readback API

After checking the latest release and current upstream source, use an existing equivalent if present.
If absent, the focused contribution should add semantics equivalent to:

```ts
interface RenderTarget {
  readPixel(x: number, y: number): Promise<readonly [number, number, number, number]>;
}
```

The exact spelling can adapt to current upstream conventions. The required behavior cannot change:

- integer in-bounds `(x, y)` input;
- `(0, 0)` is the top-left target texel;
- read the resolved single-sample texture, not a multisample attachment;
- queue a one-pixel copy synchronously before the method's first `await`;
- return four decoded numeric channels only after GPU completion;
- reject invalid coordinates, a read while that same target is an active render attachment, disposed
  targets, mapping failure, and device loss. An open canvas pass or a pass for another target is not
  by itself an error;
- keep concurrent reads independent; and
- release staging resources on success or failure.

For the current `rgba16float` target, one texel is eight bytes. The implementation must:

1. allocate a per-read staging buffer with `MAP_READ | COPY_DST`;
2. use the WebGPU-required 256-byte `bytesPerRow` alignment;
3. copy an extent of exactly one pixel;
4. submit the copy after the target draw submission;
5. use mapping of the destination buffer as the completion barrier rather than waiting for the whole
   queue;
6. decode four little-endian IEEE-754 binary16 values explicitly;
7. unmap after a successful map; and
8. destroy the staging buffer in `finally`.

A mapping or device error must reject. Returning transparent black on technical failure would convert
an error into a false no-hit.

BroMetal's current `drawTo` ends and submits its encoder before returning, then restores any outer
canvas pass (`node_modules/brometal/dist/runtime/webgpu.js:215-272`). A copy queued immediately after
it therefore uses queue order rather than a broad `queue.onSubmittedWorkDone()` barrier.

The local patch and upstream contribution follow the complete sequence in
[`07-UPSTREAM-DELIVERY-AND-DECISIONS.md`](07-UPSTREAM-DELIVERY-AND-DECISIONS.md).

## Temporary GPU ID encoding

GPU ID `0` is reserved for the target clear and means no hit. Positive IDs are dense aliases for
unique stable entities in one submitted pick frame. If one entity contributes several primitives, all
of those primitives use the same alias.

Do not write the full alias into one half-float channel. Binary16 stops representing every consecutive
integer after 2,048; that would turn a renderer detail into a hidden capacity limit.

The selected first encoding packs a 24-bit unsigned alias into three normalized byte channels:

```text
R = low byte / 255
G = middle byte / 255
B = high byte / 255
A = 1
```

Readback decodes each byte with `round(channel * 255)` and reconstructs the positive integer. Zero in
all three ID channels remains no hit. This supports IDs `1` through `16,777,215` in one submitted pick
frame and stays compatible with a possible future `rgba8unorm` target.

This is a code choice, not an ADR or product capacity. It lands only after exhaustive numeric tests
for all 256 channel values and real GPU tests for zero, minimum, byte boundaries, and maximum. If the
complete shader -> RGBA16F store -> copy -> binary16 decode path is not exact, stop this phase. Record
the failed proof, amend this plan, and create a separate failing regression, local patch, and focused
upstream contribution for the smallest correct target-format capability. Do not widen the readback
contribution, lower correctness, or cap the API at the fixture's 32 entities.

An integer target would be exact, but current BroMetal fixes the target and pipeline format. Adding a
general configurable-format system before the regression proves it necessary is rejected as broader
renderer work.

## Pick-frame description

Each successful selectable presentation supplies plain Antiky data:

- visible frame description;
- pick-pass draws and numeric values derived from the same presentation list;
- an ordered stable `EntityId` list for every selectable draw, with exactly one ID per instance; and
- non-GPU caller context: runtime ID and world ID.

The driver adds its current generation, the drawing-buffer size, the viewport generation, and a
monotonic presentation sequence when it retains the description.

The first contract is deliberately instanced. Every pick draw declares a positive `instances` count
and an `entityIds` list of the same length. Its configured pick pipeline accepts the reserved
three-component per-instance attribute `aEntityPickId` and sends that value to the fragment output
without interpolation. The caller cannot provide that reserved attribute. The driver injects a
`Float32Array` with exactly three values per instance and fails loudly for a missing binding, a
caller-supplied reserved value, a missing instance count, or owner/count mismatch. Non-instanced
per-draw and per-primitive ownership are later API shapes, not ambiguous alternatives in this one.

Retained pick draws can use only numeric uniforms, numeric instance/vertex data, indices, and fixed
driver-lifetime pick-pipeline keys. They cannot contain `{ target: ... }` or `{ texture: ... }`
uniform references. Resolving such a key during a later replay could silently sample a replacement
resource instead of the clicked presentation. The first opaque fixture does not need resource
sampling. A later textured or alpha-aware pick contract must define retained resource generations
before it permits those references.

The game does not assign durable aliases. The driver prepares a validated deep copy before visible
submission and retains it only after that submission succeeds. On a pick request it assigns one dense
positive alias per unique stable entity, injects the encoded alias data, and copies the alias table
into the active request. Pick descriptions and result DTOs stay renderer-neutral and contain no
BroMetal class instances.

The first pick pass uses:

- a full drawing-buffer-size target;
- `samples: 1`;
- nearest filtering;
- clear `[0, 0, 0, 0]`;
- blending disabled;
- depth when the visible fixture uses depth; and
- the same presentation transforms, geometry, culling, and opaque coverage as the visible draw.

Transparent/blended and alpha-cutout policy are deliberately deferred. The first fixture uses opaque
geometry so depth fidelity is explicit.

## Selectable submission and last-presented pick

Add the selection capability only to `BroMetalRenderDriver`, with semantics approximately like:

```ts
submitSelectable(
  visibleFrame: RenderFrame,
  pickFrame: EntityPickFrame,
): void;

requestEntityPick(
  request: EntityPickRequest,
): Promise<
  | { kind: 'hit'; entityId: EntityId; context: PickContext }
  | { kind: 'no-hit'; context: PickContext }
  | {
      kind: 'canceled';
      reason: 'no-presented-frame' | 'superseded' | 'stale-viewport' | 'disposed';
      context: PickContext;
    }
>;
```

The final names can follow Framework conventions. `submitSelectable` must:

1. validate and copy all stable owners and numeric pick data before caller mutation can affect them;
2. submit the visible frame synchronously through the existing submission path;
3. commit the copied pick description as the last-presented state only after visible submission
   succeeds; and
4. retain the drawing-buffer size, viewport generation, runtime/world/driver context, and a monotonic
   presentation sequence with that state.

A normal `submit()` replaces the canvas without a selectable description and therefore invalidates
the last selectable state. Target reconfiguration invalidates a last-presented state whose viewport
generation no longer matches, but it does not mutate an already captured active or queued request.

`requestEntityPick` must:

1. capture the current last-presented description and add request sequence and immutable normalized
   click sample before simulation or presentation advances;
2. reject or cancel instead of borrowing a later frame when no selectable presentation exists or the
   viewport generation is stale;
3. when the request becomes active, allocate aliases and build the exact request-frame map for the
   captured description;
4. replay only that historical pick description into the private target at its captured size;
5. convert the captured normalized click to that target's integer texel;
6. call `readPixel` immediately so that active GPU operation queues its copy before its first `await`;
7. retain the exact map, presentation sequence, and request context until settlement;
8. decode the GPU ID and resolve it inside the driver; and
9. return only the stable hit, semantic no-hit, cancellation, or rejected technical error.

A queued request has not started GPU work. When it is promoted, the driver starts a new internal GPU
operation that performs steps 3-8 synchronously through the `readPixel` call before it awaits the
result.

Share the draw/upload implementation used by `submit()`. The pick replay changes the pipeline and ID
output, but it must consume the captured transforms, geometry, culling, depth, and instance ordering.
Do not implement a second numeric-data interpretation that can drift from visible submission.

The fixture consumes a click and calls `requestEntityPick` before it updates simulation or submits the
next presentation. The ID pass and one-pixel read occur only for an activation. Replaying the retained
immutable description makes the pick describe what was visible when the click occurred, even if an
entity moves or the camera advances before readback completes. Rendering an ID target every frame is
a later measured optimization, not the first correctness mechanism.

## Coordinate conversion

The driver accepts normalized bottom-origin viewport coordinates because the target size is private.
For a clamped point and target size `width x height`, it maps:

```text
pixelX = clamp(floor(normalizedX * width), 0, width - 1)
pixelY = clamp(floor((1 - normalizedY) * height), 0, height - 1)
```

This converts the host's bottom-left convention to BroMetal readback's top-left texel convention and
uses the actual drawing-buffer target, so CSS size and device-pixel ratio do not leak into the game.
All four corners, exact 0/1 edges, resize, and non-unit device-pixel ratio require tests.

## Pending lifetime and freshness

The driver allows at most one active GPU read and one queued request. A request entering an idle
driver starts immediately. A request entering a busy driver copies the last-presented description and
occupies the single queued slot. A still newer request replaces that queued request and resolves the
replaced one as `superseded`. When the active request settles, the driver starts only the retained
latest queued request. This bounds GPU work and retained frame data while Framework's monotonic intent
revision prevents an active older result from replacing the latest click.

Required rules:

- Frame A can map alias `1` to entity A and Frame B can reuse `1` for entity B; delayed A still resolves
  through A's retained map.
- Movement, camera changes, and ordinary later frames do not rewrite an active or queued displayed
  snapshot.
- Target resize/replacement cannot make a pending request read the replacement, change its captured
  size, or use another frame's map.
- At most one active request, one queued request, and one current last-presented description are
  retained. Replacing the queued request releases its copied data exactly once.
- A newer click or explicit clear supersedes an older result at the Framework selection boundary.
- Runtime/world retirement, entity removal, driver generation change, or disposal rejects publication.
- Driver disposal marks pending results canceled even if GPU mapping later succeeds.
- Failed frame submission cannot leave target contents paired with new alias metadata.
- Unmapped nonzero IDs are integrity errors, not no-hit.
- Every owned resource is released exactly once, even when another cleanup step fails.

The driver resolves the ID before returning. Framework applies semantic freshness and current entity
existence as described in
[`05-FRAMEWORK-SELECTION-AND-STUDIO.md`](05-FRAMEWORK-SELECTION-AND-STUDIO.md).

## Required tests

### BroMetal contribution

- binary16 decoding vectors, including signs, zero, subnormal, normal, infinity, and NaN handling;
- integer coordinate validation, top-left origin, bounds, and disposed target;
- render submission before copy submission before mapping;
- resolved-texture read for a multisampled target;
- separate staging storage for concurrent reads;
- buffer cleanup on success, mapping failure, device loss, and decode failure; and
- exact real-GPU value written and read in the same submit/present sequence.

### Framework codec and driver

- zero means no hit;
- minimum, each byte boundary, and maximum 24-bit ID round-trip;
- all 256 normalized byte values survive the binary16 path;
- duplicate stable owners reuse one alias and overflow fails before GPU work;
- mutation of caller owner arrays after submission cannot change resolution;
- alias reuse across frames with each result resolved through its own retained map;
- movement or camera change between the click and the next presentation still selects from the
  clicked displayed state;
- caller mutation after `submitSelectable`, normal nonselectable submission, stale viewport
  generation, and ordinary later selectable frames;
- exact `aEntityPickId` binding, three values per instance, and loud failure for absent counts,
  owner/count mismatch, missing binding, or caller collision;
- rejection of target/texture uniform references in retained pick draws;
- one-active/one-queued bounds, queued replacement, and release of superseded data;
- active settlement before queued GPU work starts, with the older result rejected because newer
  Framework intent already exists;
- target replacement, failed submission, runtime/world retirement, entity removal, newer intent,
  driver generation, and disposal behavior;
- corner/edge/resize/device-pixel-ratio coordinate conversion;
- depth-overlapped opaque objects select the displayed front object; and
- no BroMetal object or raw GPU ID enters a result or serialized record.

A missing usable WebGPU environment must block the real proof visibly. The test must not silently skip
and report completion.

## Explicitly not covered

This path does not add CPU hit shapes, a global alias registry, persistent GPU IDs, selection gameplay
input, transparent/blended surface policy, MSAA picking, a generic render-target format API without a
failing need, a second renderer abstraction, or unrelated BroMetal math. It also does not expose raw
target readback as a general Framework game operation.
