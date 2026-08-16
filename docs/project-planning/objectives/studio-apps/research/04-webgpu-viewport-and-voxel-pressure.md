# Reusable WebGPU viewport and voxel pressure

This document compiles the renderer-ownership and browser-platform research. It defines the
questions a reusable viewport must answer; it does not choose a device policy or establish a VOX
asset contract.

Evidence labels are **Established**, **Claimed**, **Inferred**, and **Gap** as defined in
[`01-current-state-and-proving-cases.md`](01-current-state-and-proving-cases.md). Full repository
evidence, WebGPU references, MagicaVoxel format links, and WebGPU-.vox source inspection are in
[`05-webgpu-viewport.md`](subagent_outputs/05-webgpu-viewport.md).

## Current ownership

```text
StudioShell
  owns panel placement and iframe lifetime
  |
  +-- CLI game-host document
        owns canvas, resize, raw input, visibility, RAF, and final-canvas capture
        |
        +-- game module
              owns root renderer creation and destruction
              |
              +-- EngineSession and game runtime
                    own simulation and disposable services
                    |
                    +-- BroMetalRenderDriver
                          owns programs, textures, targets, GPU work, and child disposal
```

**Established:** Studio currently receives no canvas, renderer, `GPUDevice`, GPU resource, or game
camera. The live game is an iframe connected through session identity, snapshots, commands, call
logs, and capture operations.

**Established:** Accepted ADRs place platform work—canvas selection, raw events, focus/visibility,
time, presentation callbacks, and listener cleanup—in the game host. Renderer selection remains in
the game module. The Framework driver owns BroMetal/GPU resources on the default path, while Studio
and CLI remain renderer-agnostic.

**Inferred:** An in-process Studio viewport is a new canvas-host/lifecycle capability. It is not a
general renderer abstraction and is not implemented by handing `LiveGameFrame` to another app.

## Responsibility boundary under investigation

One explicit owner is required for each concern, even if one implementation combines several.

| Concern | Viewport/host responsibility | Renderer or app responsibility |
| --- | --- | --- |
| Canvas | Create/select, mount, focus, unmount, expose stable size | Use the supplied presentation surface |
| Context/device | Declare configuration and root ownership; prevent competing owners | Request required features/limits and create backend state when assigned |
| Resize/DPR | Observe physical/CSS size, deduplicate, apply render-scale and bounds policy | Replace size-dependent targets and reset accumulation |
| Scheduling | Request/cancel frames, visibility/activity policy, timestamp, stale-generation guard | Render one requested frame and declare continuous or invalidated work |
| Input | Own raw DOM listeners, focus, pointer capture, and cleanup | Convert input into app-specific camera/tool actions |
| Resources | Orchestrate lifetime and root teardown order | Own programs, buffers, textures, targets, uploads, and replacement |
| Device loss | Route structured state and retry intent | Rebuild device-bound state or terminate clearly |
| Capture | Capture the final presentation canvas | Own HDR, depth, object-ID, volume, or high-resolution export |
| Diagnostics | Publish bounded mount, size, frame, failure, and lifecycle state | Publish renderer measurements without exposing handles |

**Inferred:** Exactly one owner must configure/unconfigure a canvas context. A shared-device
viewport must not let an app destroy the root device; a dedicated-device viewport may destroy it
only after all child resources are released.

## WebGPU constraints that affect the contract

- **Established:** One `GPUDevice` can serve multiple canvases in one realm, but every child object,
  queue operation, error scope, and loss event belongs to that device.
- **Established:** GPU objects from different devices cannot be combined.
- **Established:** Live devices, queues, buffers, textures, contexts, and renderer instances are not
  structured-clone data and must not cross worker, iframe, process, network, or trust boundaries.
- **Established:** Canvas resize/reconfiguration invalidates the prior current texture.
- **Established:** device-pixel size can change with zoom and display movement; exact physical-pixel
  observation is not uniformly available, so a CSS-size × DPR fallback is required.
- **Established:** `requestAnimationFrame` is one-shot and is commonly paused in hidden documents or
  iframes. Visibility and resumption cannot be left implicit.
- **Established:** Device loss invalidates every child GPU object; recovery needs a new device and
  complete resource reconstruction.
- **Established:** WebGPU errors are asynchronous and require device-owned error scopes or
  `uncapturederror` handling.
- **Established:** Predictable release uses explicit resource destruction and canvas
  unconfiguration rather than garbage collection alone.
- **Inferred:** The device owner must retain enough CPU-side descriptions/assets to rebuild or must
  publish a terminal unavailable state.

## Device and hosting options

No option is selected.

| Option | Fit | Main tradeoff |
| --- | --- | --- |
| Keep iframe plus game-owned renderer | Exactly preserves the current game-module boundary | Heavy for many tool panels; no live GPU-object sharing |
| Dedicated device/renderer per in-process viewport | Clear ownership and local loss/destruction | Duplicated devices, caches, resources, and memory; no GPU-object sharing |
| One Studio-owned device shared by same-realm viewports | Enables same-device resource reuse | Shared queue, limits, errors, memory budget, and device-loss blast radius; BroMetal support is unverified |
| Worker-owned `OffscreenCanvas` | Terminable realm and serialized controller boundary | Canvas ownership transfer, input/capture protocols, and no GPU handles back to Studio |
| Renderer-owned device behind a narrow canvas attachment | Closest to current `createRenderer(canvas)` shape | Device sharing requires an explicit renderer seam that is not established |

**Gap:** The exact pinned BroMetal root implementation was unavailable in this research. Whether it
can accept a shared device, how it configures contexts, and how it handles loss and root destruction
must be established before selecting a shared-device design.

## What must not become viewport responsibility

- authoritative world changes or simulation ownership;
- BroMetal programs, textures, targets, buffers, or raw WebGPU objects in app contribution data;
- workspace layout or persistence;
- app camera/tool semantics;
- `.vox` parsing, scene semantics, asset compilation, or shader authoring;
- renderer-specific HDR, depth, object-ID, or voxel-volume export; or
- one universal renderer interface for unrelated backends.

## Voxel pressure test

**Established:** The official base `.vox` format is a chunked `VOX ` file with models and an
optional palette. The official extension adds scene nodes, transforms, groups, shapes, materials,
layers, camera/render data, frame attributes, and other dictionaries. A useful importer must state
which of those semantics it supports; it cannot treat every file as one flat voxel array.

**Established:** WebGPU-.vox provides valuable concrete prior art for one-canvas progressive voxel
path tracing. Its source owns its device/context, a dense CPU scene, 3D textures, compute-built
acceleration data, progressive accumulation textures, a project RAF loop, resize resets, and
renderer-specific readback/export.

**Established:** The inspected WebGPU-.vox public object has no disposal or device-loss operation,
and its resize observer is not retained for cleanup. Its parser warns that it needs a rewrite and
does not visibly bound all chunk sizes before recursive processing and GPU allocation.

**Inferred:** The useful lesson is not to adopt its object model. The case pressure is:

- validate and bound source before large CPU/GPU allocations;
- keep `.vox` parsing and semantic normalization outside the viewport;
- cancel or fence asynchronous import/upload when the app or project changes;
- reset progressive state on resize, camera, material, or scene changes;
- distinguish continuous animation from invalidate-and-accumulate scheduling;
- separate presentation capture from renderer-specific export; and
- release observers, callbacks, temporary buffers, targets, child resources, context, and root
  device in ownership order.

**Inferred arithmetic from the inspected source:** Its fixed `512³` configuration alone implies a
128 MiB dense CPU scene, about 128 MiB for one `rg32uint` scene texture, about 32 MiB for one octree
texture, roughly 63 MiB for two 1080p `rgba32float` accumulation textures, and roughly 192 MiB of
temporary acceleration buffers. These are allocation estimates, not measured browser memory.

**Gap:** Official format documents, current MagicaVoxel exporters, and community parsers do not yet
form a conformance corpus. Materials, rotations, layers, animation, unknown chunks, malformed
sizes, and newer metadata require representative files and explicit expected behavior.

## Required failure evidence

A later proof must make these failures visible and bounded:

- WebGPU unavailable or device request rejected;
- competing context configuration;
- device loss and failed recovery;
- one shared-device consumer faulting without corrupting others;
- zero, oversized, or rapidly changing panel dimensions;
- zoom/DPR changes and hidden/resumed panels;
- app replacement during asynchronous setup or upload;
- frame callback failure without stopping unrelated viewports;
- malformed or adversarial `.vox` data;
- readback usage/alignment errors; and
- disposal continuing after one release throws.

## Owner decisions before planning

1. Is the first GPU app the voxel idea, and what is its minimum user-visible workflow?
2. Must the reusable viewport support only trusted same-realm apps initially, or also isolated
   workers/frames?
3. Should the first proof use dedicated devices, investigate a shared root device, or preserve
   renderer-owned devices behind a host canvas?
4. Does version 1 need both continuous real-time and invalidated/progressive scheduling?
5. What presentation-scale, maximum-pixel, memory, and resize-churn policy should later prototypes
   measure rather than guess?
6. Is final-canvas PNG capture sufficient for the generic host, leaving all data/HDR export to
   apps?

## Planning implications

- Preserve the existing iframe game path as the compatibility lane unless an owner/ADR decision
  changes it.
- Define viewport reuse as explicit ownership assignments for canvas, configuration, device,
  scheduling, resize, input, capture, loss, child resources, and teardown.
- Keep raw GPU and renderer objects private even between trusted same-realm modules; expose bounded
  services and structured status instead.
- Use the voxel case to prove lifecycle and pressure, not to turn VOX or a path tracer into the
  Framework's universal asset/render model.
- Any choice that changes renderer ownership, exposes renderer objects to Studio, or establishes a
  VOX runtime contract needs owner and ADR review.
