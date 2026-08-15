# Integration proof and verification

This document defines the runnable fixture, the four verification layers, and the evidence required
to close the objective. It prevents a collection of unit-tested pieces from being reported as the
GPU-to-Framework-to-Studio behavior before the real trace works.

## Fixture choice

Create a dedicated development fixture such as
`packages/demos/antiky/spatial-selection-lab/`. The final name can follow demo naming conventions, but
its role is fixed: it is a narrow, runnable 2D integration proof in the existing Antiky demo/dev-host
infrastructure.

The fixture choice follows current code evidence:

- Town already uses `createBroMetalRenderDriver` but owns a perspective 2.3D camera and interpolated
  follow behavior (`packages/demos/antiky/antiky-town/src/town/index.ts:452-465,878-990`).
- Point Light Expo already uses the Framework driver and publishes stable world inspection, but its
  renderer is a perspective 3D lighting scene
  (`packages/demos/antiky/point-light-expo/src/renderer.ts:175,239-276` and
  `packages/demos/antiky/point-light-expo/src/game.ts:58-70,135-145`).
- The development host already mounts any conforming game module on its canvas and presents it through
  the common frame loop (`packages/cli/src/host/game-server.ts:55-66,458-506`).

This evidence supports reusing the infrastructure while keeping 2D selection acceptance out of an
existing product-specific demo.

### Alternatives considered

- **Convert Town:** Town proves the Framework BroMetal driver, but it is a 2.3D perspective game with
  product-specific camera and actor behavior. Converting it would distort a working demo and hide
  whether the 2D slice is reusable. Reject.
- **Extend Point Light Expo:** It has stable entities and inspection, but its 3D lighting behavior
  would make a 2D camera and object-ID proof harder to read. Reject.
- **Use only a test page:** This can prove readback but cannot show a runnable Framework consumer or
  the existing Studio project path. Use a small page for driver-level GPU tests, not as the objective
  deliverable.
- **Dedicated 2D fixture:** Select. It isolates acceptance, can use deterministic generated geometry,
  and does not alter product behavior in an existing demo.

The cost is one more maintained demo package. Keep it dev-only, small, and behavior-focused. Do not
publish it on the marketing website in this objective.

## Fixture content

The fixture contains approximately 32 selectable opaque items. This number matches the issue's
example scale and keeps visual assertions understandable. It is not exported, documented as a
capacity, or used to size a Framework data structure.

Required scene behavior:

- every selectable item has a stable Framework `EntityId`, label, runtime `Position2D`, fixture-owned
  visual values, and a retained `WorldInspection` entity;
- positions can change through a small deterministic simulation or fixture control;
- presentation produces one immutable frame list used by visible draws, pick draws, and camera
  follow;
- click handling captures the last displayed description before simulation and the next presentation
  advance;
- at least two opaque items overlap at a known test coordinate with deterministic depth so the front
  displayed item must win;
- at least one region is empty so GPU ID `0` can prove selection clear;
- one known item moves and can be followed by stable ID;
- pointer drag pans, wheel intent zooms around the pointer, and manual pan detaches follow;
- resize and device-pixel-ratio changes exercise camera and pick coordinate conversion; and
- Studio can identify each item by stable ID and component/position inspection data.

The fixture does not need art, assets, a canal, an editor, or a website card. Generated rectangles or
other simple opaque geometry are preferred because the first selection contract is depth and coverage,
not asset transparency.

## Required trace

The completion trace is:

```text
known visible fixture item
  -> immutable normalized click sample
  -> immutable last-displayed pick description with stable owner IDs
  -> on-demand GPU replay of that displayed state
  -> driver-assigned positive GPU IDs
  -> one-sample nearest selection target, clear ID 0
  -> asynchronous pixel readback
  -> retained request-frame GPU ID map
  -> stable EntityId | null before driver boundary
  -> latest valid Framework selection
  -> validated inspection snapshot
  -> existing CLI development transport
  -> Studio selected hierarchy row and exact entity details
```

Every arrow needs executable evidence. A screenshot alone does not prove identity, and mocked driver
tests do not prove GPU readback.

## Verification level 1: pure and headless tests

These tests make the core contracts deterministic without a browser or GPU:

- position record/store validation, copying, ordering, update/remove/rebuild sequence, and disposal;
- camera projection, matrix agreement, round trips, aspect/resize, pan, anchored zoom, follow,
  smoothing, bounds, and reset;
- click-sample capture and semantic wheel normalization;
- GPU-ID allocation, no-hit reservation, exact encode/decode vectors, duplicate/overflow behavior,
  and request-frame map retention;
- latest-request selection acceptance, reversed completion order, entity removal, runtime/world/driver
  replacement, and disposal;
- selection DTO validation and JSON round trip; and
- Studio selected/clear/unsupported/missing/stale rendering.

These tests should use production validators and public boundaries. Do not create prose or frozen-word
tests.

## Verification level 2: driver contract tests

Driver tests can inject program, target, and readback seams while asserting ownership:

- pick target is one sample, nearest, correctly sized, and cleared to GPU ID `0`;
- visible and retained pick descriptions use the same presentation data;
- every pick draw has an explicit positive instance count, one stable owner per instance, and the
  reserved `aEntityPickId` three-component binding;
- aliases start at 1 and are generated by the driver, not the game;
- the chosen encoding is injected as exactly three numeric values per instance without leaking GPU
  objects or accepting caller data for the reserved binding;
- retained pick draws reject texture/target uniform references so replay cannot resolve a newer
  resource generation;
- depth/order for the first opaque contract matches the displayed frame description;
- caller mutation, entity movement, camera movement, and a later submitted frame cannot change a
  captured request's displayed state;
- normalized bottom-left clicks convert to correct drawing-buffer texels at edges, resize, and device
  pixel ratios;
- normal `submit()` remains synchronous and no simulation frame awaits readback;
- a request map remains until its read settles or is rejected;
- scheduling retains at most one active request and one replaceable latest queued request, and releases
  each superseded copy;
- newer intent wins, no-hit is distinct from failure, unmapped nonzero is an error, and disposal/device
  generation invalidates results; and
- the driver result contains stable `EntityId | null`, never a GPU ID or BroMetal resource.

Framework-level resolved-result promises force reversed stable-result delivery in level 1. At this
level, an injected readback promise holds the one active driver request while tests replace the queued
request or reload/dispose the runtime. The queued GPU read starts only after the active read settles,
so the driver test does not claim that serialized GPU completions reverse. These deterministic seam
tests prove the race rules; browser timing must not be manipulated to imitate them.

Existing import-boundary tests must continue to permit BroMetal only in the driver module
(`packages/framework/src/render/brometal-driver.ts:1-12`).

## Verification level 3: real BroMetal/WebGPU tests

A real GPU test is mandatory. It must run the supported BroMetal path and prove:

1. a known pixel written earlier in the same submit/present sequence can be read asynchronously;
2. clear/no-hit and several positive IDs survive the complete shader -> RGBA16F target -> GPU copy ->
   CPU decode path exactly;
3. the highest ID supported by the chosen encoding's documented contract round-trips, not only IDs
   near the 32-item fixture;
4. top-left/bottom-left conversion selects all four target corners correctly;
5. depth-overlapped opaque geometry returns the displayed front item;
6. target resize and device-pixel ratio do not shift selection; and
7. readback failure and device/driver disposal cannot publish a valid result.

If multichannel byte encoding in the existing RGBA16F target fails exact proof, stop and preserve the
failure as evidence. Amend this plan, then create a separate target-format regression, versioned local
patch, and focused upstream PR. The readback contribution remains readback-only. Do not cap the
public behavior at the fixture count or silently accept approximate IDs.

The BroMetal regression belongs in its upstream-compatible harness. The Framework GPU integration
belongs in Antiky's real browser/GPU harness. Both are required because either cut point can fail.

## Verification level 4: browser-to-Studio end to end

Automate at least one full development-session path:

1. start the dedicated fixture through the real project/dev-host flow;
2. open it through the Studio project service or the closest production-equivalent Studio harness;
3. click the known visible front item in the live game iframe;
4. wait for real GPU completion, runtime snapshot publication, CLI acceptance, and Studio polling;
5. assert the exact known stable `EntityId` is highlighted and its details are shown;
6. click known empty space and assert supported selection clears;
7. issue rapid selections and assert the final observable selection is the latest known click; and
8. reload or retire the runtime and assert selection clears and no identity from the prior runtime
   appears in the new runtime.

This test must not set `snapshot.inspection.selection` directly. Component-level Studio tests can do
that for UI states, but they do not replace the complete trace.

Real GPU and desktop/browser automation can be flaky. The harness should wait on semantic conditions
such as runtime identity, selection revision, and stable entity ID rather than fixed sleeps. Capture
bounded diagnostics and evidence on failure.

## Acceptance matrix

| Behavior | Headless | Driver seam | Real GPU | End to end |
| --- | --- | --- | --- | --- |
| Position tracking and camera math | Required | Not needed | Visual agreement | Exercised in fixture |
| Click coordinate and DPR conversion | Required | Required | Required | Required |
| Exact GPU ID encoding/readback | Vectors | Contract | Required | Exercised |
| Displayed-frame capture, request map, and stale fencing | Reversed stable results | Bounded queue and pending reload | Disposal case | Observable rapid-click and reload clear |
| Stable Framework selection | Required | Stable result | Exercised | Required |
| Inspection serialization | Required | Not needed | Not needed | Required |
| Studio highlight/details | Component tests | Not needed | Not needed | Required |

No single column completes the objective. The end-to-end column is the outcome; the earlier columns
make failures attributable.

## Observability and closeout evidence

Record enough information to diagnose without exposing backend objects:

- monotonic pick request and selection revisions;
- runtime/world/driver generation identifiers in internal diagnostics;
- bounded codes for readback failure, decode failure, unmapped ID, stale rejection, and missing entity;
- measured selection-pass draw count, readback completion latency, and Studio observation latency for
  the fixture; and
- test or evidence references for hit, no-hit, overlap, resize, rapid click, and reload.

Measurements describe the fixture and environment. They are not scale or performance promises.

## Explicitly not covered

The proof does not require transparent or blended surface policy, alpha-perfect sprites, MSAA picking,
touch/pinch, multi-select, CPU hit testing, 3D/2.3D generalization, a production art demo, website
publication, npm packaging, or a release announcement. Manual evidence can supplement automation but
cannot replace the required real GPU and browser-to-Studio tests.
