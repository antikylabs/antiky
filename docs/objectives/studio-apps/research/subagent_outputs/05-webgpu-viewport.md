# 05 — Reusable WebGPU viewport and render ownership

**Research date:** 2026-08-14
**Scope:** Current Antiky code and accepted ADRs, current WebGPU/HTML documentation, official MagicaVoxel sources, and source inspection of WebGPU-.vox. No external project was installed or executed.

## Evidence labels

- **Established** — verified in repository code, an accepted ADR, or a primary specification/source.
- **Claimed** — stated by project documentation or a third party but not independently verified.
- **Inferred** — conclusion drawn from established evidence.
- **Unverifiable** — the required implementation or runtime evidence was unavailable.

## Findings

- **Established:** Studio does not currently own a game canvas, WebGPU device, renderer, or render loop. It owns a panel and an iframe pointing at the CLI development host. Studio reads snapshots and sends controls through the development client.
- **Established:** The CLI development host owns the DOM canvas, backing-store resize, raw input listeners, visibility behavior, presentation `requestAnimationFrame`, final-canvas capture, and the call into the game module.
- **Established:** The game module creates and destroys the root BroMetal renderer. Antiky Town’s `EngineSession` owns simulation and disposable services; the Town runtime is one such service and owns the `BroMetalRenderDriver`.
- **Established:** `BroMetalRenderDriver` receives an already-created renderer. It owns programs, textures, render targets, and their disposal, but does not destroy the renderer itself.
- **Inferred:** A reusable Studio viewport should be treated first as a canvas-host/lifecycle seam, not as a renderer abstraction. Device and renderer ownership still require an explicit policy for each mounted app.
- **Established:** WebGPU permits one device to serve zero or more canvases. Sharing therefore is technically possible in one realm, but all shared resources, the queue, error handling, and device-loss fate remain tied to that one device.
- **Established:** GPU objects cannot be mixed between devices. Across a worker, iframe messaging, process, network, or other serialized boundary, Antiky’s accepted ADRs prohibit live class objects and GPU handles.
- **Inferred:** The voxel case requires far more than a reusable canvas: bounded `.vox` parsing, scene/material interpretation, CPU asset state, asynchronous upload/rebuild, progressive-render invalidation, export, memory limits, and recovery. Those concerns should remain app/render-owner responsibilities.

## Current ownership diagram

```text
StudioShell
  owns:
    - game panel placement/fullscreen state
    - iframe mount/unmount
    - development coordinator lifecycle
  does not receive:
    - canvas, renderer, GPUDevice, GPU resources
  |
  +-- LiveGameFrame iframe, src = project.gameUrl
  |     |
  |     +-- CLI development game-host document
  |           owns:
  |             - <canvas id="antiky-game">
  |             - CSS/backing-store sizing and DPR sampling
  |             - pointer and keyboard listeners
  |             - visibility/page lifecycle
  |             - requestAnimationFrame scheduling
  |             - canvas.toDataURL() capture
  |           |
  |           +-- imports GameModuleEntry(context.canvas, input, ...)
  |                 |
  |                 +-- Antiky Town game module
  |                       owns:
  |                         - createRenderer(canvas)
  |                         - renderer.destroy()
  |                       |
  |                       +-- composition
  |                             |
  |                             +-- EngineSession
  |                             |     owns:
  |                             |       - simulation/world authority
  |                             |       - fixed-step clock
  |                             |       - disposable services
  |                             |
  |                             +-- TownRuntime, session-owned service
  |                                   owns:
  |                                     - render preparation
  |                                     - BroMetalRenderDriver
  |                                   |
  |                                   +-- BroMetalRenderDriver
  |                                         owns:
  |                                           - programs
  |                                           - textures
  |                                           - render targets
  |                                           - backend resource disposal
  |
  +-- development coordinator
        polls snapshots/call log and sends commands;
        it does not cross into the iframe with renderer objects
```

### Current frame path

```text
CLI requestAnimationFrame(timestamp)
  -> GameInstance.frame(timestamp / 1000)
  -> temporary Antiky Town host
  -> EngineSession.advance(elapsed, semantic input)
  -> if ADVANCED:
       renderer.present(...)
         -> TownRuntime.render()
         -> driver.configureTargets(...)
         -> driver.submit(...)
```

Evidence:

- Studio mounts the live game as an iframe and grants an `allow` token containing `webgpu`: `packages/studio/app/src/components/LiveGameFrame.tsx:6-19`.
- `StudioShell` owns workspace/fullscreen state and supplies only the session ID and game URL to the iframe: `packages/studio/app/src/components/StudioShell.tsx:74-95`, `packages/studio/app/src/components/StudioShell.tsx:283-337`.
- The coordinator’s surface consists of snapshots, call logs, reload, and simulation controls: `packages/studio/app/src/development/coordinator.ts:19-46`, `packages/studio/app/src/development/coordinator.ts:170-195`, `packages/studio/app/src/development/coordinator.ts:224-260`.
- Project changes create and stop the coordinator/native development connection: `packages/studio/app/src/development/useStudioDevelopment.ts:56-97`.
- The CLI host creates the canvas: `packages/cli/src/host/game-server.ts:38-60`.
- It reports canvas dimensions and captures the final canvas with `toDataURL`: `packages/cli/src/host/game-server.ts:92-109`, `packages/cli/src/host/game-server.ts:254-280`.
- It samples DPR and updates `canvas.width`/`height`: `packages/cli/src/host/game-server.ts:398-404`.
- It owns raw input listeners: `packages/cli/src/host/game-server.ts:419-446`.
- It cancels RAF and disposes the game instance on `pagehide`: `packages/cli/src/host/game-server.ts:448-456`.
- It imports the game module and supplies the canvas: `packages/cli/src/host/game-server.ts:458-477`.
- It owns the RAF loop, resize check, visibility skip, and frame-failure stop: `packages/cli/src/host/game-server.ts:481-506`.
- The game-module contract explicitly says the host owns presentation timing and disposal: `packages/framework/src/game/contract.ts:47-71`.
- The game module creates the root renderer and destroys it after the game instance, including construction rollback: `packages/demos/antiky/antiky-town/src/game.ts:8-31`.
- Antiky Town puts its runtime into `EngineSession.services` and connects rendering through its temporary game host: `packages/demos/antiky/antiky-town/src/composition.ts:85-120`, `packages/demos/antiky/antiky-town/src/composition.ts:145-170`.
- The temporary host advances the session and renders only an advanced frame: `packages/demos/antiky/antiky-town/src/gameplay/game-host.ts:48-74`.
- A reusable Framework session-frame driver already exists, but Antiky Town has not adopted it: `packages/framework/src/sessions/session-frame-driver.ts:34-99`.
- `EngineSession` exposes simulation/control/status/disposal, not canvas or GPU operations: `packages/framework/src/sessions/engine-session/contract.ts:37-50`, `packages/framework/src/sessions/engine-session/contract.ts:165-179`.
- Session disposal releases services in reverse order and continues after failures: `packages/framework/src/sessions/engine-session/runtime.ts:508-523`; tests at `packages/framework/tests/sessions/engine-session/engine-session.test.ts:333-369`.
- The driver takes an existing `Renderer`: `packages/framework/src/render/brometal-driver.ts:83-105`.
- It owns programs/textures/targets through a disposal scope: `packages/framework/src/render/brometal-driver.ts:130-179`.
- It derives scaled targets from `renderer.canvas`, replaces changed targets, and leaves fixed-size targets alone: `packages/framework/src/render/brometal-driver.ts:208-243`; tests at `packages/framework/tests/render/brometal-driver.test.ts:158-178`, `packages/framework/tests/render/brometal-driver.test.ts:412-427`.
- Driver disposal releases its targets and adopted resources, not `options.renderer`: `packages/framework/src/render/brometal-driver.ts:274-305`.
- The Town runtime calls `driver.dispose()`: `packages/demos/antiky/antiky-town/src/town/index.ts:1179-1190`.

### Disposal order

```text
pagehide or host stop
  -> CLI host cancels RAF
  -> GameInstance.dispose()
  -> EngineSession.dispose()
  -> TownRuntime.dispose()
  -> BroMetalRenderDriver.dispose()
  -> programs/textures/targets disposed
  -> game-module finally block
  -> renderer.destroy()
```

**Established:** `createRendererResourceLifetime()` encodes the same “children first, renderer last” rule and aggregates release errors, although the canonical game module currently implements this order manually: `packages/framework/src/resources/disposal-scope.ts:131-181`.

## Accepted architecture evidence

- **Established:** The game host owns canvas selection, raw events, time, focus/visibility/window signals, presentation callbacks, and listener removal. `EngineSession` owns simulation, while the render driver owns graphics resources and work: `docs/adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md:38-55`.
- **Established:** The game module is mounted on one host-selected canvas and must expose instance lifecycle without starting development services: `docs/adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md:57-64`.
- **Established:** The Framework-owned BroMetal driver owns programs, textures, render targets, buffers, GPU state, and their disposal. Render data contains Antiky keys and typed updates, not BroMetal objects: `docs/adr/framework/0021-brometal-render-driver-ownership_H.md:29-45`.
- **Established:** Direct BroMetal use is an exception in which the game module owns its own BroMetal resources: `docs/adr/framework/0021-brometal-render-driver-ownership_H.md:50-61`.
- **Established:** Studio and CLI remain renderer-agnostic. The host supplies the canvas and input, while a renderer-owning game module initializes, resizes, and disposes its renderer: `docs/adr/studio/0007-framework-first-allow-others_H.md:20-47`.
- **Established:** Studio will not inspect renderer objects: `docs/adr/studio/0007-framework-first-allow-others_H.md:49-59`.
- **Established:** Authoring, runtime, and render state flow one way; GPU resources are temporary implementation data, not world state: `docs/adr/framework/0009-separate-state-projections_H.md:15-31`, `docs/adr/framework/0009-separate-state-projections_H.md:33-42`.
- **Established:** Processes, workers, networks, trust boundaries, import/export, and durable storage are serialization boundaries. Functions, live class instances, and GPU handles cannot be sent through them: `docs/adr/framework/0010-serialize-at-boundaries_H.md:18-39`, `docs/adr/framework/0010-serialize-at-boundaries_H.md:41-48`.
- **Established:** Antiky’s Framework renderer path is WebGPU-only: `docs/adr/framework/0015-webgpu-support-only_H.md:11-19`.
- **Claimed:** The in-progress rendering guide assigns display resize, capabilities, diagnostics, and owned-resource disposal to `RenderDriver`: `docs/architecture/framework/rendering-and-assets_A.md:3`, `docs/architecture/framework/rendering-and-assets_A.md:50-66`. This is direction, not an accepted interface, and current `RenderDriver` has only `configureTargets`, `submit`, and `dispose`: `packages/framework/src/render/render-contract.ts:140-153`.

## WebGPU and browser constraints

All browser claims below are dated **2026-08-14**. The cited WebGPU document is an Editor’s Draft dated **2026-07-27** and should be revalidated during implementation.

### Canvas and device configuration

- **Established:** WebGPU device creation is decoupled from canvas creation. A device may render to zero or more canvases, and a canvas context may be configured with a device dynamically. [WebGPU canvas-output explainer](https://gpuweb.github.io/gpuweb/explainer/#canvas-output).
- **Established:** `GPUCanvasContext.configure()` attaches the selected device and configuration. Reconfiguration and canvas resize invalidate the previous current texture; `unconfigure()` removes the configuration and destroys textures produced by it. [GPUCanvasContext reference](https://gpuweb.github.io/types/interfaces/GPUCanvasContext).
- **Established:** The configured device determines which device’s objects are compatible with the canvas texture. [GPUCanvasConfiguration reference](https://gpuweb.github.io/types/interfaces/GPUCanvasConfiguration.html).
- **Established:** Canvas textures default to `RENDER_ATTACHMENT`. Direct GPU copies require `COPY_SRC`; explicitly setting a custom usage does not retain `RENDER_ATTACHMENT` automatically. [MDN `configure()`](https://developer.mozilla.org/en-US/docs/Web/API/GPUCanvasContext/configure).
- **Inferred:** Exactly one owner must configure and unconfigure a canvas context. A viewport and renderer both configuring the same context would create stale current textures and ambiguous disposal.

### Device and resource sharing

- **Established:** A `GPUDevice` is the exclusive owner of all objects created from it. Device loss or destruction makes every child object unusable. Objects from different devices cannot be used together. [WebGPU devices](https://gpuweb.github.io/gpuweb/#devices).
- **Established:** The current draft consumes a `GPUAdapter` object after one successful `requestDevice()` call; a replacement device requires obtaining another adapter object. This is a fast-moving draft rule. [WebGPU adapter/device initialization](https://gpuweb.github.io/gpuweb/#adapter-creation).
- **Established:** Multiple components on one page may each own a separate device. [WebGPU explainer](https://gpuweb.github.io/gpuweb/explainer/#adapters-and-devices).
- **Inferred:** A shared device enables same-device resource reuse and reduces root-device duplication. It also creates a shared queue, feature/limit negotiation point, error-scope discipline, memory budget, and device-loss blast radius.
- **Inferred:** A dedicated device makes an app’s `device.destroy()` and recovery local, but prevents GPU-object sharing and duplicates caches/resources.

### Resize and DPR

- **Established:** `devicePixelRatio` relates physical pixels to CSS pixels and changes with page zoom. [MDN `devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio).
- **Established:** `ResizeObserverEntry.devicePixelContentBoxSize` can report the element’s content box in device pixels, but MDN currently marks it as limited availability. [MDN `devicePixelContentBoxSize`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/devicePixelContentBoxSize).
- **Established:** The current CLI checks `clientWidth × devicePixelRatio` every presentation callback and only writes changed dimensions: `packages/cli/src/host/game-server.ts:398-404`.
- **Inferred:** A reusable viewport needs both an exact-device-pixel path where supported and a defined CSS-size × DPR fallback. It also needs a render-scale/limit policy; blindly allocating every panel at full DPR can multiply GPU memory sharply.
- **Inferred:** Resize notification belongs to the canvas host. Which render targets are recreated, retained, fixed-size, or reset belongs to the renderer/driver.

### Frame scheduling

- **Established:** `requestAnimationFrame` is one-shot, generally follows display refresh, and is commonly paused in background tabs and hidden iframes. Multiple callbacks in one frame receive the same timestamp even though their work executes sequentially. [MDN `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).
- **Established:** The CLI owns one loop, skips the game call when `document.hidden`, and stops scheduling after a frame exception: `packages/cli/src/host/game-server.ts:481-506`.
- **Inferred:** Multiple in-process viewports can use one Studio scheduler or separate RAF registrations; the platform permits both. The ownership contract still needs to define visibility, invalidation, cancellation, and whether an app may return asynchronous work.
- **Inferred:** Hidden/resumed presentation must not make simulation depend on unbounded wall-clock gaps. `EngineSession` currently clamps accepted elapsed time to 0.05 seconds and at most three fixed steps: `packages/framework/src/sessions/engine-session/runtime.ts:268-345`.

### Device loss and asynchronous errors

- **Established:** `GPUDevice.lost` always resolves when the device is lost. Recovery uses a new device, and every old resource must be recreated. [MDN `GPUDevice.lost`](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost).
- **Established:** Device loss may occur because of browser resource management, driver changes, hardware removal, crashes, or explicit destruction; operations on a lost device do not produce ordinary validation errors. [WebGPU device-loss rules](https://gpuweb.github.io/gpuweb/#devices).
- **Established:** WebGPU validation and out-of-memory errors are asynchronous and use per-device error scopes or `uncapturederror`. [WebGPU errors and debugging](https://gpuweb.github.io/gpuweb/#errors-and-debugging).
- **Inferred:** The device owner must retain enough CPU-side descriptions/assets to rebuild or must publish a terminal unavailable state. An app boundary should receive structured loss/recovery status, not the lost device object.
- **Inferred:** Shared-device apps need coordinated error-scope use because the scope stack and uncaptured-error event belong to the device, not to a canvas.

### Readback and capture

- **Established:** GPU readback normally copies into a `COPY_DST | MAP_READ` buffer and maps it asynchronously. Texture-to-buffer copies require source `COPY_SRC`; multi-row copies use a `bytesPerRow` aligned to 256 bytes. [MDN `copyTextureToBuffer()`](https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder/copyTextureToBuffer).
- **Established:** The CLI’s current evidence capture reads the final canvas through `canvas.toDataURL('image/png')`, avoiding renderer-specific texture access: `packages/cli/src/host/game-server.ts:254-280`.
- **Inferred:** “Capture what the user sees” can remain a host/canvas operation. Raw HDR, depth, object-ID, voxel-volume, or high-resolution export is renderer/app work and should not be forced through a generic viewport API.

### Explicit release

- **Established:** Predictable GPU-memory release should use available `destroy()` operations instead of relying only on JavaScript garbage collection. Destroying the device invalidates all its children. [WebGPU object validity and destruction](https://gpuweb.github.io/gpuweb/#programming-model).
- **Established:** `GPUCanvasContext.unconfigure()` destroys its produced canvas textures. [GPUCanvasContext reference](https://gpuweb.github.io/types/interfaces/GPUCanvasContext).
- **Inferred:** A viewport using a shared device must release only its child resource scope and context attachment. It must not destroy the shared device. A dedicated-device viewport may destroy the root after all children are released.

## Reusable viewport responsibility boundary

A reusable viewport does not imply that one object must perform every item. It does require one explicit owner for each item.

| Concern | Reusable viewport/host responsibility | Renderer or app responsibility |
| --- | --- | --- |
| Canvas | Create/select, mount, focus, unmount, expose stable dimensions | Use the supplied surface |
| Context/device | Declare who configures and owns them; prevent two owners | Select required features/limits and create backend state when assigned |
| Resize | Observe CSS/device-pixel size, deduplicate changes, apply DPR/render-scale policy | Recreate size-dependent targets and reset accumulation when needed |
| Frame loop | Request/cancel callbacks, visibility/activity policy, timestamp, stale-generation guard | Render one requested frame and declare continuous versus invalidated work |
| Input | Own raw DOM listeners, focus, pointer capture, cleanup | Convert raw input into app-specific camera/tool/semantic actions |
| Resources | Orchestrate lifetime and final teardown order | Own programs, buffers, textures, targets, uploads, and replacement |
| Device loss | Route structured status and retry intent | Recreate device-bound state if this layer owns the device |
| Capture | Capture final presentation canvas and publish dimensions/format | Implement renderer-specific attachments and data export |
| Diagnostics | Publish bounded mount, size, frame, failure, and lifecycle status | Publish renderer measurements without exposing handles |

### Explicit non-responsibilities

- **Established:** Authoritative world mutations remain commands/session APIs, not viewport callbacks: `docs/adr/framework/0007-commands-as-mutation-boundary_H.md:27-47`.
- **Established:** Simulation ownership remains with `EngineSession`.
- **Established:** BroMetal programs, textures, targets, buffers, and GPU state remain inside `BroMetalRenderDriver` on the default path.
- **Inferred:** Workspace layout, panel persistence, `.vox` parsing, voxel scene semantics, camera state, shader authoring, render pipelines, asset compilation, and GPU export formats are not generic viewport responsibilities.

## Device and resource lifetime options

No option is selected here.

| Option | Established fit | Tradeoffs |
| --- | --- | --- |
| Existing iframe plus game-owned renderer | Matches the current game-module contract and keeps Studio renderer-agnostic. Each iframe has its own document, host loop, canvas, and game instance. | Strong lifecycle boundary and preserves the shipped game editor, but is heavy for many tool panels and cannot directly share live GPU resources or in-process UI state. |
| Dedicated device/renderer per in-process viewport | WebGPU supports multiple components with separate devices. Root destruction is local to the app. | Clear ownership and loss isolation; duplicates devices, pipeline/resource caches, and memory. GPU objects cannot be shared. Each device needs its own adapter request under the current draft. |
| One Studio-owned device shared by same-realm viewports | WebGPU permits one device to render to multiple canvases. Same-device assets could be reused. | Requires a long-lived root owner, per-app resource scopes, feature/limit negotiation, queue/error coordination, quotas, and all-app device-loss recovery. One app must never destroy the root. BroMetal support for injected/shared devices is unverified. |
| Worker-owned viewport through `OffscreenCanvas` | WebGPU and RAF are exposed in dedicated workers. `OffscreenCanvas` can be transferred. | Canvas ownership transfer is irreversible for the sender, and communication becomes serialized. Input, capture, inspection, device loss, asset transfer, and disposal need message protocols. It does not allow GPU handles to cross back to Studio. |
| Renderer-owned device behind a narrow viewport attachment | Closest to the current `createRenderer(canvas)` shape while allowing the host to own canvas/loop. | Keeps renderer internals hidden but prevents device sharing unless the renderer gains an explicit device-service seam. Exact BroMetal behavior is currently unavailable. |

Worker ownership evidence: [HTML structured transfer rules](https://html.spec.whatwg.org/multipage/structured-data.html), [MDN `transferControlToOffscreen()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen).

## What must not cross an app boundary

### Serialized or isolated boundary

- **Established:** Functions and DOM nodes fail structured cloning. The current supported WebGPU-related clone types are compilation information/messages and pipeline errors, not `GPUDevice`, `GPUQueue`, `GPUBuffer`, `GPUTexture`, `GPUCanvasContext`, or a renderer instance. [MDN structured clone](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).
- **Established:** `OffscreenCanvas` may cross as a transferable ownership move; transfer is not shared access and is irreversible for the sender. [HTML transferable objects](https://html.spec.whatwg.org/multipage/structured-data.html#transferable-objects).
- **Established:** Antiky ADR 0010 independently prohibits functions, live class objects, and GPU handles across process-like boundaries.
- **Inferred:** Cross-boundary contracts may carry versioned descriptors, stable IDs, typed arrays/transferable binary assets, input events, dimensions, commands, diagnostics, capture results, and retry requests.

### Trusted same-realm boundary

- **Established:** JavaScript technically permits modules in one realm to share object references.
- **Established:** Antiky’s accepted render boundary nevertheless requires frame data to contain keys and typed updates rather than BroMetal objects: `packages/framework/src/render/render-contract.ts:1-19`, `packages/framework/src/render/render-contract.ts:155-171`.
- **Inferred:** Raw devices, queues, contexts, textures, buffers, programs, and renderer objects should remain private to the device/resource owner even for a first-party app. A narrow service may internally use them without making them app contribution data.

## Voxel-app pressure test

### Official MagicaVoxel and `.vox`

- **Established:** As of 2026-08-14, the official page identifies MagicaVoxel 0.99.7.2, dated 2025-07-12, as a GPU voxel editor and interactive path-tracing renderer. [Official MagicaVoxel page](https://ephtracy.github.io/mv_main.html).
- **Established:** The base `.vox` document defines a RIFF-style `VOX ` file with version, `MAIN`, optional `PACK`, paired `SIZE`/`XYZI` chunks, and an optional 256-entry `RGBA` palette. [Official base `.vox` format](https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt).
- **Established:** The extension adds multiple models, dictionary/string values, rotations, transform/group/shape scene nodes, material properties, layers, camera/render data, and frame attributes. [Official `.vox` extension](https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox-extension.txt).
- **Inferred:** Importing `.vox` is not equivalent to loading one voxel array. A useful app must decide which scene graph, animation, material, layer, palette, camera, and newer metadata semantics it supports.
- **Unverifiable:** The 2016 base document and unversioned extension do not appear to describe every chunk used by the 2025 application; the official update log mentions a `META` animation chunk. A representative file corpus and current exporter samples are required for conformance.

### WebGPU-.vox source inspection

- **Claimed:** The project describes itself as a work-in-progress path tracer, warns that it may not import every `.vox` file, fixes its world to `512³`, and reports roughly five seconds for 512 samples on one laptop RTX 2060. This is maintainer-reported, not independently benchmarked. [WebGPU-.vox README](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/README.md#L1-L7).
- **Established:** It creates one renderer service for one canvas: [`main.js:24-25`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/main.js#L24-L25).
- **Established:** File import parses buffers, flattens models, uploads palette/scene data, and resets progressive rendering: [`main.js:135-182`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/main.js#L135-L182).
- **Established:** Camera/UI changes and rendering run in a project-owned asynchronous RAF loop: [`main.js:240-295`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/main.js#L240-L295).
- **Established:** The renderer requests its own adapter/device, configures its canvas, and installs a `ResizeObserver`: [`voxels.js:1-15`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/voxels.js#L1-L15).
- **Established:** Its scene representation includes a dense CPU voxel array, 3D scene and octree textures, and a material buffer: [`voxels.js:581-605`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/voxels.js#L581-L605).
- **Established:** Scene upload creates temporary acceleration-structure buffers, submits several compute stages, waits for completion, and destroys two temporary buffers: [`voxels.js:710-789`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/voxels.js#L710-L789).
- **Established:** Resize resets accumulation and recreates two `rgba32float` textures plus dependent bind groups: [`voxels.js:909-980`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/voxels.js#L909-L980).
- **Established:** Rendering progressively accumulates up to 512 samples and presents through `context.getCurrentTexture()`: [`voxels.js:1006-1104`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/voxels.js#L1006-L1104).
- **Established:** Image export renders into an `rgba8unorm` `COPY_SRC` texture, pads rows to 256 bytes, maps a readback buffer, and destroys the temporary resources: [`voxels.js:1107-1173`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/voxels.js#L1107-L1173).
- **Established:** The returned public object has no `dispose` or device-loss operation, and the `ResizeObserver` is not retained for disconnection: [`voxels.js:1206`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/voxels.js#L1206).
- **Inferred:** The code intends to expose queue completion from `frame()`, but assigns the `onSubmittedWorkDone` function itself and the caller awaits that value without invoking it. This appears not to apply actual backpressure; it was not runtime-tested: [`voxels.js:1100`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/voxels.js#L1100), [`main.js:285-290`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/main.js#L285-L290).

### Parser pressure

- **Established:** The parser labels itself as needing a rewrite, checks only the first three `VOX` bytes, and recursively trusts chunk sizes without visible bounds validation: [`web.vox.js:1-54`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/web.vox.js#L1-L54).
- **Established:** It reads `MATL` data but the upload path installs palette colors with default material values: [`web.vox.js:56-65`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/web.vox.js#L56-L65), [`main.js:173-179`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/main.js#L173-L179).
- **Established:** Its transform flattening uses translation from the first frame, hard-codes traversal from node `1`, and has a recursion cap of 60; rotation, visibility/layers, and full animation semantics are not applied in this path: [`web.vox.js:113-190`](https://github.com/AddisonPrairie/WebGPU-.vox/blob/main/js/web.vox.js#L113-L190).
- **Inferred:** Malformed or semantically complex files must be validated before large GPU allocations. A viewport should surface import progress/errors but should not own parsing.

### Memory pressure

For the project’s fixed `512³` configuration:

- **Inferred arithmetic:** Dense CPU scene: `512³ × 1 byte = 128 MiB`.
- **Inferred arithmetic:** `rg32uint` scene texture at `256³`: `128 MiB`.
- **Inferred arithmetic:** `r8uint` octree texture at `256 × 256 × 512`: `32 MiB`.
- **Inferred arithmetic:** Two `rgba32float` accumulation textures: `32 bytes × rendered pixel count`, about `63.3 MiB` combined at 1920×1080.
- **Inferred arithmetic:** Acceleration rebuild temporarily adds approximately `128 MiB` and `64 MiB` buffers.

These are source-derived allocation sizes, not measured browser memory. They span CPU and implementation-managed GPU memory and exclude pipelines, bind groups, driver padding, and other allocations.

### Shader-authoring pressure

- **Claimed:** The community MagicaVoxel shader documentation describes GLSL 1.10 authoring shaders whose `map(vec3)` function runs once per voxel and returns a palette index. [Shaders in MagicaVoxel](https://github.com/lachlanmcdonald/magicavoxel-shaders/wiki/Shaders-in-MagicaVoxel#writing-shaders).
- **Claimed:** The same documentation records platform-dependent shader behavior and array limits. [Shader observations](https://github.com/lachlanmcdonald/magicavoxel-shaders/wiki/Shaders-in-MagicaVoxel#observations).
- **Inferred:** Shader compilation, parameters, preview invalidation, progress/cancellation, and compiler diagnostics belong to a voxel-authoring service/app. The reusable viewport only needs to present the result and route bounded status/input.

### Antiky asset-boundary status

- **Claimed:** The in-progress rendering guide suggests keeping `.vox` as editable source and compiling cells, a mesh, collision, and palette data: `docs/architecture/framework/rendering-and-assets_A.md:179-195`.
- **Established:** The architecture review register still marks the voxel authoring/runtime boundary open and only suggests VOX as interchange followed by normalization and compilation: `docs/adr/UNDER_REVIEW_A.md:100-108`.
- **Inferred:** This objective must not silently turn either suggestion into an accepted asset contract.

## Observable failure modes

| Failure | Observable effect | Ownership implication |
| --- | --- | --- |
| WebGPU unavailable or adapter/device request fails | Viewport never reaches ready state | Mount must fail visibly without starting RAF |
| Context configured twice or by competing owners | Old current texture invalidated; validation errors or blank output | One configuration owner per canvas |
| Shared device destroyed by one app | Every viewport using that device fails | Only root device owner may destroy it |
| Device loss | All child resources become unusable | Device owner publishes loss and recreates all resources or terminates clearly |
| Async validation/out-of-memory error | Failure may arrive after the initiating call | Error scopes/events and resource labels must feed diagnostics |
| Zero, oversized, or rapidly changing panel | Reallocation churn, blank targets, memory spikes | Host supplies stable bounded dimensions; renderer owns target replacement |
| DPR or zoom change | Blurry output or unexpected memory increase | Physical-size policy must be explicit and observable |
| Hidden panel/iframe | RAF pauses or becomes irregular | Activity policy and clock reset/clamping must be explicit |
| App replacement during async init/upload | Late completion writes into disposed state | Mount generation/cancellation guard required |
| Frame callback throws | Current CLI stops its loop and reports an error | A failing app must not stop unrelated viewport loops |
| Progressive renderer receives resize/camera change | Accumulation becomes invalid | Renderer resets its state; host only reports the change |
| Readback without correct usage/alignment | Validation error or corrupt output | Renderer-specific export owns copy layout and mapping |
| Malformed `.vox` sizes/chunks | Parser exception, runaway recursion, or large allocation | Validate/bound source before GPU allocation |
| Disposal throws midway | Later resources can leak | Release all owned resources and aggregate failures |
| Listeners/observers survive unmount | Duplicate input/resize and retained app state | Host must remove every listener/observer explicitly |

**Established gap:** ADR 0020 requires host listener removal (`:38-46`, `:75`), but the generated CLI host relies on page-realm destruction and does not explicitly remove its pointer, keyboard, blur, visibility, or pagehide listeners. This is acceptable only while the whole document is the lifecycle boundary; it is not reusable as an in-page viewport cleanup model.

## Gaps

1. **Unverifiable — BroMetal root internals.** The repository pins BroMetal 0.17.2 (`package-lock.json:1502-1505`) but has no installed/source copy available. It is unknown at this layer whether `createRenderer()` owns a device per renderer, can accept a shared device, reconfigures on resize, calls `unconfigure()`, handles device loss, or destroys the device. Inspecting the exact pinned source would answer this without running it.
2. **Unverifiable — iframe `webgpu` permission token.** The attribute is present and snapshot-tested, but this research found no authoritative WebGPU Permissions Policy definition confirming the token’s current effect. A target-browser test is required.
3. **Gap — no app viewport implementation exists.** The only established viewport is the CLI game-host document. Same-realm Studio apps, bundled apps, and isolated apps may need different ownership shapes.
4. **Gap — device policy.** There is no owner decision between a shared device, dedicated per-app devices, or continued isolated host documents.
5. **Gap — target runtime capabilities.** WebGPU and `devicePixelContentBoxSize` remain fast-moving/limited-availability surfaces. The actual Tauri WebView and managed capture browser need a focused capability proof.
6. **Gap — physical-pixel budget.** No maximum DPR, render scale, per-panel pixel count, GPU-memory quota, or resize-churn budget exists.
7. **Gap — loss/recovery diagnostics.** The current Antiky layer has no visible device-loss or uncaptured-WebGPU-error path.
8. **Gap — capture semantics.** Final-canvas PNG capture exists, but HDR, alpha, color-space, depth/object-ID, and oversized export behavior are unspecified.
9. **Gap — asynchronous rendering contract.** `GameInstance.frame()` is synchronous. Progressive or upload-heavy Studio apps may need invalidation and asynchronous completion without changing the existing game-module compatibility boundary.
10. **Gap — `.vox` conformance.** Official format documents, the current exporter, and community parsers do not constitute a tested corpus. Animation, materials, rotations, layers, unknown chunks, malformed sizes, and newer metadata need explicit coverage.
11. **Gap — session ownership wording.** ADR 0008 permits an `EngineSession` to own an optional render driver, while the current implementation owns the Town runtime as a generic disposable service and calls rendering outside the session. A future viewport must not assume a direct session render API that does not exist.

## Planning implications

- Preserve the current iframe/CLI game-host path as the established game-editor compatibility lane unless a separate owner decision changes ADR 0020 or Studio ADR 0007.
- Define the reusable seam as explicit ownership assignments for canvas, configuration, device, scheduling, resize, input, capture, child GPU resources, device loss, and teardown. Do not use “viewport owns rendering” as an undivided statement.
- Keep the viewport host, renderer adapter/driver, app-specific render state, and authoritative engine state as separate concerns.
- Decide the app trust/execution boundary before deciding device sharing. Same-realm sharing, worker transfer, and iframe hosting have different possible contracts.
- If a device is shared, the contract needs one root owner, per-app disposal scopes, resource/size budgets, feature negotiation, coordinated errors, and all-consumer loss notification. If devices are dedicated, the contract needs per-app capability/init/failure reporting.
- Keep raw WebGPU and BroMetal objects private. App-facing data should use IDs, descriptors, typed updates, transferable binary assets where appropriate, structured status, and capture/export results.
- Include one continuous real-time renderer and one invalidate/progressive renderer in a later proof. This tests scheduling breadth without automatically widening the existing synchronous game-module contract.
- Use the voxel case to prove resize-triggered resource replacement, large asynchronous upload cancellation, malformed-source rejection, progressive reset, capture/export separation, and complete disposal—not to make voxel data the viewport or framework model.
- Treat device loss, frame failure, app replacement during initialization, resize churn, hidden panels, and disposal failure as required lifecycle evidence.
- Any choice that changes renderer selection, exposes renderer objects to Studio, moves platform work out of the host, or establishes the VOX runtime contract requires owner/ADR review rather than being buried in implementation.
