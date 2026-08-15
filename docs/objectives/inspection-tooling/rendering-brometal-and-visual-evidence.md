# Rendering, BroMetal, and visual-evidence inspection

Research snapshot: 2026-08-09. Scope is the current Antiky Framework, CLI/MCP host, Studio,
Antiky and pure BroMetal demos, BroMetal 0.15.0, and the rendering-skill research. Antiky and
BroMetal are the implementation targets. External engines and GPU tools are comparative evidence,
not proposed runtime dependencies.

## Evidence labels

- **Verified** means the behavior exists in inspected source, tests, the installed BroMetal package,
  or an accepted Antiky architecture record.
- **Documented direction** means an Antiky architecture document describes the intended boundary,
  but the general implementation does not yet exist.
- **Gap** means an agent cannot currently obtain or control the fact through a shared, typed Antiky
  contract.
- **Proposal** means this report recommends a contract. Proposed types are illustrative and should
  be reduced to the smallest interface proven by a real vertical slice.

## Executive finding

Antiky can currently show that a game runtime exists, report a few aggregate render counters, and
save a PNG of the game canvas. It cannot explain why a particular pixel, draw, material, pass, or
resource exists. The current demos contain capable BroMetal work—multipass shadows and post,
instancing, compute/storage use, translucent effects, and full-screen shaders—but each game owns
its renderer privately and self-reports coarse totals. The Framework has no implemented general
`RenderDriver`, render graph, resource registry, material inspection, object-to-draw trace, measured
GPU timing, or deterministic visual-evidence contract.

The right seam is a renderer-neutral Antiky `RenderInspectionService` fed by the first real
Antiky `RenderDriver` and a generic, opt-in BroMetal instrumentation adapter. Framework contracts
remain strict, immutable, bounded, and free of BroMetal/WebGPU types. Antiky owns semantic pass and
resource identities, entity-to-render mapping, material meaning, revision fences, permissions,
evidence, and safe replacement. BroMetal may expose generic compiler receipts, reflection, debug
labels, capabilities, low-level counters, timing, readback, and device errors. It must not acquire
world, ECS, scene-graph, game-rule, authoring, evidence, or MCP authority.

The immediate priority is truthfulness and privacy, not a large catalog of tools: qualify every
measurement, wire asynchronous renderer failures into diagnostics, make canvas captures
deterministic and path-safe, and publish one small render overview on a focused internal fixture.
Then prove stable graph, resource, material, and entity mappings through a new art-directed moving
showcase. Existing demos remain regression inputs, not the visual-quality bar. Add profiling,
visual comparison, motion evidence, and hot reload only after that causal path is trustworthy.

Rendering seed skills are non-authoritative scaffolding. They may supply reviewed compiler commands,
checklists, shader idioms, and debugging workflows, but they cannot choose or approve art direction,
change Antiky/BroMetal ownership, accept evidence, or run bundled code without normal version,
license, and security review.

## Current renderer boundary

### Accepted target boundary

- **Documented direction:** [ADR 0006](../../adr/framework/0006-brometal-render-driver_H.md)
  says only the Antiky-owned `RenderDriver` directly uses BroMetal. The driver owns programs,
  textures, render targets, buffers, GPU state, and disposal. Other systems send Antiky IDs,
  renderer-neutral keys, and typed prepared updates.
- **Documented direction:** [rendering and assets architecture](../../architecture/framework/rendering-and-assets_A.md)
  separates source, compiled, live, and last-good resources; describes `RenderWorld`, render passes,
  dependencies, diagnostics, and candidate replacement; and keeps asset/material meaning above the
  backend. Its final driver and graph interfaces remain open decisions.
- **Verified:** Framework's import-boundary test rejects BroMetal, DOM/browser globals, Node,
  Studio, and MCP imports from portable runtime source
  ([`import-boundary.test.mjs`](../../../packages/framework/tests/import-boundary.test.mjs)).
  Any inspection schema proposed here belongs above BroMetal and must preserve that test.

### Implemented boundary today

- **Verified:** Framework currently contains no shared concrete `RenderDriver` implementation or
  public BroMetal dependency. `GameHostContext` supplies a canvas, runtime ID, input, mode, and a
  reporting callback. A game module creates and owns its renderer
  ([`host.ts`](../../../packages/framework/src/game/host.ts)).
- **Verified:** `GameMeasurements` can publish optional `instances`, `drawCalls`,
  `uploadBytesPerFrame`, and a note. It has no measurement method, source, time window, confidence,
  pass split, timing, capability, or completeness metadata.
- **Verified:** Antiky Town names BroMetal's `Renderer` as its game-owned render driver, but its
  private runtime seam is only update, render, digest, and dispose. It does not implement a shared
  Framework driver contract.
- **Verified:** current Antiky and pure BroMetal demos instantiate BroMetal within their own package.
  Framework sees only their optional inspection publication and canvas.

```text
current
CLI host -> game module -> optional EngineSession / inspection mirror
                        -> game-owned BroMetal -> WebGPU

target
authoring/runtime -> prepared RenderWorld -> Antiky render graph
                                        -> Antiky RenderDriver
                                        -> BroMetal -> WebGPU
```

This distinction matters. A raw WebGPU object explorer would make today's accidental ownership
model permanent. Inspection should instead help land and validate the accepted boundary.

## Current agent-visible rendering evidence

### Framework snapshot

**Verified:** [`InspectionSnapshot`](../../../packages/framework/src/inspection/snapshot.ts) is a
strict, immutable version-1 view. Its render section has canvas width/height and optional draw,
instance, and upload-byte totals. Diagnostics are bounded and may name `runtime` or `render` as
their source. Runtime frames/FPS, session status, point lights, world stores, and events may also be
present.

The snapshot has valuable safety properties: unknown fields are rejected, numeric values are
bounded and non-negative, retained views disclose incompleteness, and runtime/world identities are
cross-checked. Those properties should be copied into render inspection.

**Gaps:** there is no render revision or snapshot ID; presentation frame identity; backend/device
capabilities; measurement origin or window; pass/resource/pipeline/material/shader view; render
object mapping; CPU/GPU timings; allocation/residency/churn; diagnostic relationship to a shader or
draw; target quality profile; or evidence link.

The point-light service is the one implemented semantic precedent. It maintains a stable
entity-to-render-slot binding and publishes authoring, runtime, and render projections at the same
event sequence. Its dirty slots are renderer-neutral prepared state—not BroMetal handles. A general
driver should follow this model for identities and revision fences without treating transient slots
as stable authoring identity.

### CLI, MCP, and Studio

- **Verified:** [`packages/cli/src/mcp/tools.ts`](../../../packages/cli/src/mcp/tools.ts) exposes
  17 tools. Rendering-specific behavior is `get_render_stats`, generic diagnostics, and
  `capture_frame`; the rest concerns development/runtime/session/world/point-light state.
- **Verified:** `get_render_stats` returns the same coarse runtime/render measurements. It does not
  measure BroMetal or the GPU independently.
- **Verified:** the MCP path uses the CLI's typed loopback client and local authorization model.
  That is the right transport and authority boundary for future render tools.
- **Verified:** Studio's inspection panel renders hierarchy, stores, full snapshots, events, calls,
  and diagnostics. The status bar shows only frame/draw information. It has no render graph,
  shader/material/resource inspector, profiler, capture comparison, or provenance surface.
- **Proposal:** CLI, MCP, and Studio should adapt the same headless `RenderInspectionService`.
  None should become the authoritative registry or infer semantic mapping from raw GPU state.

### Capture path and privacy

**Verified:** the browser host performs `canvas.toDataURL('image/png')`, so normal capture includes
the game canvas—not the Studio window, terminal, desktop, microphone, or system audio
([`game-server.ts`](../../../packages/cli/src/host/game-server.ts)). The action broker validates
base64 and the PNG signature, caps decoded data at 32 MiB, associates results with action/runtime/
development-session/build IDs, writes under `.antiky/captures`, uses directory mode `0700` and file
mode `0600`, writes through a temporary file, and removes a late stale result
([`actions.ts`](../../../packages/cli/src/host/actions.ts)).

**Verified limitations:** a capture is the arbitrary current canvas frame. The request has no
expected session step, render revision, camera, input sequence, seed, simulation time, DPR, color
space, exposure, target device, or quality profile. Canvas width/height are validated on input but
not preserved in the public capture result. The result exposes an absolute path, which can reveal a
local username and project path in tool history. Nothing checks whether the game itself rendered a
terminal, prompt, email, account name, token, or other private text into its canvas.

**Required privacy rule:** normal agent evidence must remain game-canvas-only. It must never use OS
screencapture, window capture, terminal capture, desktop capture, microphone input, or desktop
audio. Return an opaque artifact URI and safe relative display name, never an absolute filesystem
path. A privacy scan/attestation must fail closed before evidence is exposed or published. A game
that intentionally renders private content is not safe merely because capture stayed inside the
canvas.

## BroMetal 0.15.0: useful facts and missing observability

The repository pins BroMetal `0.15.0`. The package is MIT-licensed and WebGPU-only. The local
[`patch-brometal.mjs`](../../../scripts/patch-brometal.mjs) guards that exact version and adds
explicit discard/present behavior, so inspection must record both upstream and local-patch identity.

### Available compiler and runtime information

- **Verified:** public `CompiledShader` data includes WGSL source, attributes, instance attributes,
  uniforms, a shader layout, optional storage-write information, and whether compute is present.
  Layout data includes attribute locations/sizes/divisors and uniform type/size/offset/texture/
  sampler bindings plus block size.
- **Verified:** the internal shader compiler also produces warnings and varying information, and
  failures can retain source location through `CompileError`.
- **Verified:** BroMetal's CLI emits human-oriented output and a generated module. That module does
  not retain a complete structured receipt containing warnings, varyings, compiler version/mode,
  source hash, generated-WGSL hash, and generation provenance.
- **Verified:** public `Renderer` exposes backend, canvas, aspect, presentation, loop, target drawing,
  and destruction. Programs expose typed attribute/uniform assignment, index data, draw/dispatch,
  and disposal.
- **Verified:** typed renderer errors cover WebGPU/adapter/device/context unavailability, device
  loss, and GPU errors. `createRenderer` accepts `onError`.
- **Verified gap:** repository demos do not wire BroMetal's `onError` into Framework diagnostics.
  Host guards catch synchronous start/frame exceptions, but asynchronous validation and device-loss
  failures can degrade to console-only output.

### BroMetal observability gaps

BroMetal exposes no general public contract for:

- sanitized device capabilities/limits/features;
- stable debug labels or scoped markers;
- program, pipeline, buffer, texture, sampler, and target enumeration;
- resource sizes, residency, allocation churn, or disposal proof;
- measured draw, instance, dispatch, upload, submission, or pipeline-creation counters;
- CPU phase or GPU timestamp timings;
- render-pass or intermediate-resource capture;
- a bounded instrumentation observer; or
- device-loss/recovery history surfaced through Antiky.

**Proposal:** add only generic backend observability to BroMetal: structured compile results, debug
labels, sanitized capabilities, an opt-in instrumentation observer, optional timestamp queries, and
policy-limited readback. Do not add Antiky world/material/evidence concepts to BroMetal.

### No GPU-backed test harness, though a real WebGPU device is reachable

**Gap**, and an unusual one: the capability exists and is simply not exposed as a test seam.

Every automated test in this repository that needs real WebGPU behaviour has to mock at the
`GPUDevice` boundary, because the only code that launches a browser is
`packages/cli/src/host/managed-capture-runtime.ts` and it is reachable only through `capture_frame`.
That tool returns a **PNG of a whole frame**. It cannot answer "does sampling layer 1 of an array
texture return layer 1's colour", so a test that wants that question answered drives the shipped code
against a recording stub and asserts on the *calls made*, not the *pixels produced*.

**Verified: a real device is one function call away.** Probed 2026-08-15 from a plain Node script:

```
chromium.launchPersistentContext(<real temp dir>, {
  headless: true,
  args: ['--enable-unsafe-webgpu', ...(darwin ? ['--use-angle=metal'] : [])],
})
→ navigator.gpu.requestAdapter() → requestDevice()  ⇒  device ok: apple
```

Two details cost an hour and belong in writing, because both fail in a way that looks like "this
machine has no GPU":

- **The profile directory must be a real path.** An empty string yields no `navigator.gpu`.
- **The page must be on a secure origin.** `about:blank` yields no `navigator.gpu`; a page served
  from `http://127.0.0.1` works. `127.0.0.1` is a secure context, so a throwaway `node:http` server
  is sufficient — no TLS.

Headless is fine. The flags are already in the capture runtime; nothing new is needed from Chromium.

**What the gap costs, concretely.** Goal 15 added a `sampler2DArray` type to BroMetal and required
"a runtime test that an array texture binds without WebGPU validation errors, and that a layer index
selects the layer it names — a two-layer texture of distinct colours, sampled at each index", plus a
per-layer mip test. Both were satisfied against a recording device: the mip test asserts no view has
`arrayLayerCount > 1`, which is a sound proxy but is reasoning about the plan rather than the result.
The only GPU-side evidence is a whole-frame capture that looks correct. A wrong layer index that
happened to land on a similar-coloured material would pass every test in the repository.

**Closed 2026-08-15.** `packages/demos/tests/support/gpu-page.mjs` (~110 lines) launches the same
Chromium with the same flags, serves the repository over loopback, hands a callback a page with a
real device, and returns its result. `packages/demos/tests/texture-array-gpu.test.mjs` uses it to
build an array texture through BroMetal's own patched `buildWebgpuTextureArray`, sample it, and read
pixels back:

| Assertion | Result |
| --- | --- |
| the array binds with no WebGPU validation error (`pushErrorScope`) | pass |
| layer index 0 returns layer 0's colour, index 1 returns layer 1's | pass |
| at mip 6 each layer keeps its own colour and is not an average of both | pass |

Proven able to fail: expecting layer 0 to be the other layer's colour turns test 2 red with the
actual pixel printed.

**No bundler was needed.** BroMetal's `dist` uses relative imports, so serving the repository as-is
lets the page `import('/node_modules/brometal/dist/runtime/webgpu.js')` directly — which has the
advantage of loading the **patched installed copy**, the artifact that actually ships.

One deliberate limit remains: the WGSL doing the sampling is written in the test, not produced by
BroMetal's shader compiler, which has no public entry point from Node (`compileShaderSource` is not
exported). So this proves the patch's **runtime** half — upload, view dimension, per-layer mips —
and the compiler half is still covered by the WGSL-emission test and the demo capture.

Keep the scope: it is a test harness, not a product surface. It must not become a second capture
path, must stay out of the shipped CLI's tool list, and must not run at the same time as a capture —
the shoot script warns against a second managed Chromium, and two will fight over the GPU.

## Demo coverage and what it proves

| Demo | Verified rendering path | Current inspection limit |
| --- | --- | --- |
| Antiky Town | Manual shadow target, scene target, post/present; instancing, textures, water, foliage, characters | About 16 draws are self-reported; no stable pass/resource IDs, measured timing, or causal entity trace |
| Point Light Expo | Three authored inspectable point lights; custom surface and glow; stable semantic light projections | Reports 7 draws, 86 instances, and 1,392 upload bytes; renderer work is still private and totals are self-reported |
| Combat Arena | Fixed-step simulation; surface and additive glow; large projectile/effect batches | Reports 282 instances and 14,724 upload bytes; no per-pass, overdraw, timing, or effect-to-draw trace |
| Traversal Study | Fixed-step simulation; surface, glow, trails, and hazards | Reports 337 instances and 14,908 upload bytes; no material/resource/provenance view |
| Luminous Reef / Shader Study / Solar Forge | One full-screen shader/draw each; useful shader compiler and presentation fixtures | No semantic graph beyond a single private program; no reflection or generated-source receipt through Antiky |
| Pure BroMetal Town Study | Complex renderer without Framework semantic dependencies | Host-level lifecycle/counters only; no Antiky world or render mapping |

These packages are good fixture candidates. They are not evidence of a shared inspection system.
They are also technical regression fixtures, not Antiky's visual-quality bar and not appropriate
hero presentation proof. The first quality-facing evidence should come from a new, deliberately
art-directed moving showcase built from a written visual brief, reference frames, motion beats, and
target-camera composition—not another Antiky Town or Point Light Expo capture.
Current counts are often constants or game-side arithmetic rather than observed driver/backend
events. One archived Town slice even reports roughly 1.1 KiB of upload bytes per frame in the
Framework aggregate while an injected probe reports roughly 1.5 MiB of buffer writes. The values
may intentionally describe different subsets, but the schema cannot say which. A bare number is
therefore not trustworthy enough for regression or budget decisions.

Package tests prove compilation/build/module shape, source-token presence, camera math, session and
presentation behavior, strict schemas, capture transport, and dev/prod generated-output parity.
Historical slice output contains useful one-off GPU probes and visual-similarity records, including
queue submissions, resource creation, buffer writes, and readback. Those probe implementations are
not shipped typed services. The root has Playwright available, but there is no current
repository-owned deterministic GPU visual suite covering the demos.

## Required inspection coverage

An agent doing production rendering work needs causal answers, not only screenshots and totals.

| Question | Current answer | Minimum trustworthy answer |
| --- | --- | --- |
| What shader is live? | Read private game source or generated build output | Stable shader asset/revision, source and WGSL hashes, compiler receipt, reflection, diagnostics, pipelines, and last-good state |
| What material produced this object? | Infer from private code | Antiky material key/revision, parameters, textures/samplers, blend/depth/cull state, shader/pipeline, render items, and provenance |
| Why does this pass/resource exist? | Infer private draw order | Ordered graph, semantic role, dependencies, read/write edges, descriptor, producers/consumers, lifetime, and budget |
| Which entity produced this draw? | Generally impossible | World/entity revision to render item, batch/instance, geometry, material, pipeline, pass, and frame-scoped draw |
| Is lighting/shadow/VFX/post correct? | Inspect final PNG manually | Named passes/features, parameter sources, shadow allocation/use, effect occupancy/overdraw, timings, debug views, final and selected intermediate evidence |
| Is performance acceptable? | Self-reported aggregates and runtime FPS | Measured/qualified CPU and GPU distributions, draws/instances/uploads/submissions/resources/churn against a named target profile |
| Is a regression visual or temporal? | One arbitrary PNG | Deterministic frame and stepped sequence, exact state fence, lossless master, perceptual diff/heatmap, motion metrics, and human verdict |
| Does it work on the target? | One local browser/canvas | Sanitized target profile, WebGPU capabilities/limits, resolution/DPR/quality, browser/OS build, missing-feature/fallback state |
| Did hot reload preserve a good frame? | Full watcher/build/runtime replacement | Candidate compile/reflection, compatibility decision, frame-boundary swap, first-use result, last-good preservation, and disposal proof |
| Is footage safe to share? | Canvas-only transport, but absolute path and no content scan | Opaque artifact reference, game-canvas-only attestation, PII/secret scan result, no desktop pixels/audio, and explicit approval state |

## Proposed ownership model

Choose a renderer-neutral Antiky service rather than exposing raw BroMetal/WebGPU or expanding only
the existing aggregate snapshot.

### Antiky Framework owns

- strict immutable contracts, bounded queries, identities, revisions, and measurement semantics;
- semantic render graph/pass/resource descriptions;
- render-world/entity/object/material/asset relationships;
- target profiles, budgets, diagnostics, and evidence records;
- authority, expected-revision checks, correlation, timeouts, and failure codes;
- candidate/last-good replacement transaction meaning; and
- deterministic capture contracts and privacy policy.

These contracts remain headless and contain no BroMetal, WebGPU, browser, filesystem, Studio, or
MCP objects.

### Antiky `RenderDriver` owns

- the semantic-to-backend mapping;
- stable pass/resource/pipeline/material/geometry keys;
- live-resource incarnations and frame-scoped draw/batch/instance identity;
- aggregation of BroMetal observer events into qualified measurements;
- graph execution, candidate swap, disposal, and device-loss recovery policy; and
- a snapshot-consistent read model for `RenderInspectionService`.

### BroMetal owns only generic backend facts

- shader compile result, generated WGSL, reflection, warnings, and source-located errors;
- backend resource creation/use/destruction with supplied debug labels;
- raw draw/dispatch/upload/submit/pipeline events;
- sanitized WebGPU capabilities and device errors;
- optional timestamp measurement when supported and enabled; and
- explicit, bounded texture/buffer readback requested by its caller.

BroMetal must not know `EntityId`, world revision, Antiky material semantics, authored lights, game
rules, evidence approval, user permissions, MCP, or project file policy.

### CLI/MCP/Studio own presentation and transport

They validate and adapt the same service. CLI persists artifacts through a safe store. MCP exposes
small typed tools and opaque artifact references. Studio renders graphs, inspectors, timelines,
diffs, and diagnostics. None reconstructs truth by scraping logs or private game objects.

## Identity and lifetime model

Render inspection needs identities whose lifetime is explicit:

| Identity | Lifetime and meaning |
| --- | --- |
| `RuntimeInstanceId` | Existing launched runtime; replacement retires it |
| `RenderRevision` | Monotonic accepted render-world/graph state within a runtime |
| `RenderSnapshotId` | Immutable coherent inspection fence over one render revision and collected frame/window |
| `PresentationFrameId` | One submitted/presented frame; never reused within a runtime |
| `RenderPassId` | Stable while a build's semantic graph definition is unchanged |
| `PipelineKey`, `MaterialKey`, `GeometryKey` | Stable semantic/derived key; revision or compatibility hash changes separately |
| `RenderResourceId` + `incarnation` | Stable logical resource plus each allocation/replacement lifetime |
| `RenderItemId`, `BatchId`, `DrawId` | Frame- or snapshot-scoped unless the driver explicitly guarantees a longer lifetime |
| `ShaderAssetId`, `TextureAssetId`, `MeshAssetId` + revision | Stable Antiky content identity, never a GPU object reference |
| `TargetProfileId`, `EvidenceId`, `ArtifactId` | Stable configuration/evidence references with bounded metadata |

Every operation on transient IDs also carries expected `runtimeInstanceId`, `renderRevision`, and
`renderSnapshotId`. A stale or retired identity yields a structured stale result; it never silently
selects the current object. Raw BroMetal programs, bind groups, buffers, textures, pipelines,
encoders, and GPU handles never cross the service boundary.

## Core read models

### Qualified measurements

Every metric must say what it means:

```ts
type Measurement<T> = Readonly<{
  status: 'measured' | 'reported' | 'estimated' | 'unsupported' | 'unavailable';
  value: T | null;
  source: 'render-driver' | 'brometal-observer' | 'gpu-timestamp' | 'game-report';
  method: string;
  window: Readonly<{
    firstPresentationFrameId: PresentationFrameId;
    lastPresentationFrameId: PresentationFrameId;
    sampleCount: number;
  }> | null;
}>;
```

The compatibility `get_render_stats` projection may preserve today's numbers but must label them
`reported`/`game-report` until measured driver instrumentation exists. Unsupported timestamp
queries return `unsupported`; they do not become zero or estimated GPU time.

### Render overview and capabilities

```ts
type RenderOverview = Readonly<{
  schemaVersion: 1;
  runtimeInstanceId: RuntimeInstanceId;
  buildRevision: number;
  renderRevision: number;
  renderSnapshotId: RenderSnapshotId;
  presentation: Readonly<{
    frameId: PresentationFrameId;
    completedStepCount: number | null;
    width: number;
    height: number;
    devicePixelRatio: number;
  }>;
  backend: Readonly<{
    name: 'webgpu';
    brometalVersion: string;
    patchRevision: string | null;
    sanitizedAdapterClass: string | null;
  }>;
  capabilities: RenderCapabilities;
  totals: RenderFrameMeasurements;
  graph: Readonly<{ passCount: number; resourceCount: number; incomplete: boolean }>;
  diagnostics: readonly RenderDiagnosticSummary[];
  incomplete: boolean;
}>;
```

`RenderCapabilities` advertises shader reflection, graph inspection, per-pass counters, CPU timing,
GPU timestamps, intermediate capture, deterministic frame/sequence capture, hot reload, debug
views, supported texture formats, and sanitized WebGPU features/limits. Each optional capability has
an explicit `supported`, `enabled`, and reason/code state. Agents discover capability instead of
guessing from browser or hardware names.

### Shader, material, graph, and resource views

`ShaderInspection` should include stable asset/revision, safe project-relative source reference,
source/generated hashes, compiler name/version/mode, stages, structured reflection, warnings and
errors with safe source ranges, layout/compatibility hash, live pipeline keys, candidate/accepted/
last-good state, and exact runtime/build/render revisions. It must not dump arbitrary source unless
the caller separately has source-read authority.

`MaterialInspection` is an Antiky view: material key/revision, shader and pipeline keys, parameter
names/types/current values, texture/sampler asset bindings and revisions, blend/depth/cull/write
state, bound render items, target profile/variant, provenance links, and diagnostics. BroMetal
continues to expose programs and uniforms, not an Antiky material authoring system.

`RenderPassInspection` should include pass ID/label/semantic role/order/enabled state; dependencies;
read/write resource edges with load/store/clear intent; color/depth formats and dimensions; draw,
instance, dispatch, upload, and submission measurements; CPU/GPU timing distributions and budgets;
and diagnostics. Semantic roles may include `shadow`, `opaque`, `transparent`, `vfx`, `ui`,
`post-process`, `compute`, and `present` without prescribing game rules.

`RenderResourceInspection` should include logical ID/incarnation, kind, descriptor, dimensions/
format/usage, estimated or measured bytes, source asset and revision, producer/consumer passes,
first/last use, persistent/transient/external state, allocation/disposal status, target-profile
variant, readback policy, and diagnostics. When lifetime aliasing is introduced, alias groups must be
explicit rather than inferred from equal descriptors.

### Scene/render-object trace

```ts
type RenderObjectTrace = Readonly<{
  runtimeInstanceId: RuntimeInstanceId;
  renderRevision: number;
  renderSnapshotId: RenderSnapshotId;
  worldId: WorldId | null;
  worldRevision: number | null;
  entityId: EntityId | null;
  renderItems: readonly Readonly<{
    renderItemId: RenderItemId;
    batchId: BatchId | null;
    instanceIndex: number | null;
    bounds: BoundsInspection | null;
    geometryKey: GeometryKey;
    materialKey: MaterialKey;
    pipelineKey: PipelineKey;
    passIds: readonly RenderPassId[];
    drawIds: readonly DrawId[];
  }>[];
  incomplete: boolean;
}>;
```

Queries work in both directions: entity/render item/material/resource/pass/draw to their related
objects. Mappings come from the Antiky driver as it prepares and submits work; BroMetal cannot infer
an entity from a buffer offset. Bounds and visibility/culling reasons are valuable but should be
added only when the driver genuinely owns them.

## Evidence contract

One PNG is an artifact, not proof. A render-evidence bundle binds artifacts to state, method,
provenance, privacy, and verdict.

```ts
type RenderEvidence = Readonly<{
  schemaVersion: 1;
  evidenceId: EvidenceId;
  kind: 'frame' | 'sequence' | 'profile' | 'comparison';
  createdAt: string;
  session: Readonly<{
    developmentSessionId: string;
    runtimeInstanceId: RuntimeInstanceId;
    buildRevision: number;
    renderRevision: number;
    renderSnapshotId: RenderSnapshotId;
  }>;
  state: Readonly<{
    worldId: WorldId | null;
    worldRevision: number | null;
    completedStepCount: number | null;
    inputRecordingHash: string | null;
    seed: string | null;
    simulationTime: number | null;
  }>;
  targetProfile: RenderTargetProfile;
  capture: RenderCaptureContract;
  provenance: Readonly<{
    sourceRevision: string;
    artifactManifestHash: string;
    toolVersions: readonly ToolVersion[];
  }>;
  artifacts: readonly RenderEvidenceArtifact[];
  privacy: RenderPrivacyAttestation;
  comparison: RenderComparison | null;
}>;
```

`RenderTargetProfile` records an Antiky profile ID/version, drawing-buffer size, DPR, quality tier,
API, required features/limits, browser and OS build, sanitized adapter class, color space/tone map/
exposure, and frame/memory budgets. Do not hard-code a universal “AAA” budget; a project owns named
device and scalability profiles.

`RenderCaptureContract` records capture source (`final-canvas` or an explicitly permitted render
resource), camera/view identity, fixed simulation step(s), input/seed/time, frame count/cadence,
warm-up, lossless master format, optional delivery encoding, and whether profiling/readback altered
execution. A deterministic sequence is the default motion proof: pause, verify expected completed
step, advance recorded inputs one fixed step at a time, capture named frames, and record the fence.

Artifacts use `antiky-evidence://<evidence-id>/<artifact-id>` or another opaque local URI. They carry
safe name, MIME type, dimensions/duration, byte count, SHA-256, lossless/derived role, and retention
policy. The transport resolves the URI only for an authorized caller. It never returns a home,
workspace, username, or temporary filesystem path.

`RenderPrivacyAttestation` records `gameCanvasOnly: true`, `desktopPixelsPossible: false`, audio
source (`none` or game-mix-only), scan status/tool/version, checked PII/secret classes, findings,
review state, and `approvedFor` scopes such as local review or publication. A failed or unavailable
required scan quarantines or deletes the artifact and returns no retrievable URI.

Comparison evidence references immutable candidate/reference evidence, dimensions/color handling,
metric versions, thresholds, masks, raw scores, difference and heatmap artifacts, and a separate
human verdict. Pixel/SSIM/perceptual metrics catch change; they do not decide whether lighting,
composition, readability, animation, or art direction is good. Motion review also needs frame-time
distribution and preferably optical-flow/temporal-difference signals, but final approval remains a
human art/design gate.

## Proposed service operations and MCP projection

Prefer a small query surface with discriminated unions over one MCP tool per field or BroMetal
method.

| Service operation | MCP projection | Purpose | Priority |
| --- | --- | --- | --- |
| `getRenderOverview(request)` | `get_render_overview` | Coherent identity/capability/totals/graph summary and diagnostics | P0 |
| `queryRenderGraph(request)` | `query_render_graph` | Bounded pass/resource/dependency query at one snapshot | P1 |
| `traceRenderObject(request)` | `trace_render_object` | Causal lookup among entity, item, material, resource, pass, and draw | P1 |
| `inspectRenderAsset(request)` | `inspect_render_asset` | Shader/material/geometry/texture reflection, provenance, live and last-good state | P1 |
| `profileRenderWindow(request)` | `profile_render_window` | Bounded frame window with qualified CPU/GPU/counter distributions | P1 |
| `captureRenderEvidence(request)` | `capture_render_evidence` | Deterministic final-canvas or policy-approved intermediate evidence | P0 |
| `getRenderEvidence(request)` | `get_render_evidence` | Read metadata and authorized opaque artifact references | P1 |
| `compareRenderEvidence(request)` | `compare_render_evidence` | Reproducible numeric/visual/motion comparison without automatic approval | P1 |
| `reloadRenderAsset(request)` | `reload_render_asset` | Compile and safely propose/swap one derived shader/material asset | P2 |
| `setRenderDebugView(request)` | `set_render_debug_view` | Expiring presentation-only view such as normals, depth, overdraw, pass isolate | P2 |

Existing `get_render_stats` remains a compatibility projection of the overview. Existing
`capture_frame` becomes the simplest final-canvas evidence request and returns an evidence ID,
dimensions, hash, and opaque URI rather than a raw absolute path. Keep renderer diagnostics in the
existing general diagnostic stream unless volume demonstrates the need for a paginated render-only
query.

All query responses declare `available`, `retained`, and `incomplete`, use bounded limits/cursors,
and are fenced by runtime/render/snapshot identity. Large shader source, images, traces, and buffers
are artifacts—not inline MCP JSON or base64.

### Minimum request guards

Every operation carries:

- protocol/schema version and correlation ID;
- development-session and runtime identity;
- expected build and render revision;
- expected render snapshot for transient object queries;
- bounded selection/window/artifact limits; and
- principal plus required permission supplied by the trusted host, not asserted inside an
  untrusted model payload.

The service reparses outputs at every transport boundary as existing session/point-light paths do.
Reads never mutate renderer state. Actions serialize or reject conflicts instead of interleaving
capture, profile, reload, and debug mutations unpredictably.

## Authority model

| Permission | May do | Must not do |
| --- | --- | --- |
| `render.inspect` | Read bounded semantic graph, reflection, mappings, qualified measurements, sanitized capabilities | Read arbitrary source bytes, GPU handles, secrets, or unrestricted resource contents |
| `render.capture` | Create bounded game-canvas or policy-approved intermediate artifacts | Capture desktop/window/terminal/microphone/system audio, publish externally, or bypass privacy checks |
| `render.profile` | Enable bounded instrumentation for a declared frame window | Run indefinitely, change gameplay rules, hide intrusive overhead, or retain unrestricted traces |
| `render.compare` | Compare immutable authorized evidence with declared methods | Replace a reference, approve art, or mutate runtime/build state |
| `render.debug.view` | Apply an expiring presentation-only debug visualization | Change authored/runtime state, persist into a release, or alter game-rule decisions |
| `render.asset.reload` | Build a derived candidate and request a revision-safe swap | Edit source, accept authoring changes, execute arbitrary WGSL/code, or discard last-good state |

Authored light power remains a world command such as `world.light.edit`. A temporary light isolate,
shadow-map view, or contribution visualization can be a render debug view because it affects only
inspection presentation and auto-expires. Likewise, material parameters used by gameplay remain
authoring/runtime commands; a normals or roughness debug override is presentation-only.

Sensitive fields require additional scope. Shader source, raw intermediate targets, full GPU
traces, adapter identifiers, and artifact bytes can disclose proprietary content or machine data.
The default overview should contain hashes, safe relative references, and sanitized device class,
not source bodies, absolute paths, PCI identifiers, or user-controlled labels copied without
validation.

## Failure semantics

Return a stable machine code plus bounded human diagnostic. Do not collapse unsupported,
unavailable, stale, incomplete, rejected, and failed into an empty array, zero, timeout, or console
line.

| Condition | Required result |
| --- | --- |
| No shared driver/instrumentation | `INSPECTION_UNAVAILABLE` with supported capability subset; compatibility aggregates may still be returned as `reported` |
| Unknown stable ID | Typed `NOT_FOUND` naming safe identity kind, not an exception containing internals |
| Retired runtime or stale revision/snapshot | `RUNTIME_RETIRED` or `REVISION_STALE`; never retarget current state |
| Bounded/truncated graph or trace | Successful response with `incomplete: true`, counts, and a stable cursor if supported |
| GPU timestamps unsupported/disabled/disjoint | Measurement status `unsupported`/`unavailable` with reason, never zero |
| Profiling would exceed limits or conflicts | `PROFILE_LIMIT_EXCEEDED` or `ACTION_BUSY`; no partially enabled observer |
| Instrumentation affects performance | Success records `intrusive: true` and method/overhead context |
| Shader compile failure | `COMPILE_FAILED`, structured source diagnostics, candidate rejected, accepted/last-good program remains live |
| Layout compatibility mismatch | `INCOMPATIBLE_LAYOUT`; no unsafe swap; list bounded changed bindings |
| Candidate creation/bind/first-use failure | `SWAP_FAILED`; restore or retain last-good and emit renderer diagnostic |
| Old resource disposal failure | New state may remain accepted only with `DISPOSAL_FAILED` diagnostic and leaked incarnation visible; never pretend cleanup succeeded |
| Validation, out-of-memory, or device loss | Stable renderer diagnostic linked to affected frame/pass/resource when known; runtime enters explicit degraded/fault/recovering state |
| Invalid/oversize/non-PNG or timed-out capture | `CAPTURE_INVALID`, `CAPTURE_TOO_LARGE`, or `CAPTURE_TIMEOUT`; no artifact URI |
| Capture result from stale runtime/action/build | `CAPTURE_STALE`; late file deleted as the current broker already attempts |
| PII/secret/privacy-policy finding | `PRIVACY_REJECTED`; quarantine/delete under policy and expose no retrievable URI |
| Comparison lacks compatible artifacts/profile | `COMPARISON_UNAVAILABLE`; never coerce sizes/color spaces silently |

BroMetal `onError` must be wired once at driver creation into bounded Framework render diagnostics.
Diagnostics should carry code, severity, safe message, runtime/build/render/presentation identity, and
optional shader/pipeline/pass/resource keys. Raw driver/browser messages may be retained only in a
restricted local artifact after redaction. Device loss invalidates all live resource incarnations;
recovery creates a new render revision and cannot reuse stale transient IDs.

## Hot reload transaction

Current development reload watches files, regenerates/builds, and replaces a whole runtime. A safe
shader/material loop should be earned later through this explicit transaction:

```text
source change
  -> structured BroMetal compile receipt
  -> Antiky candidate asset revision
  -> reflection/layout comparison to accepted revision
  -> compatible | requires rebind | incompatible
  -> dry-run validation and candidate program/bindings
  -> expected-render-revision check
  -> frame-boundary swap
  -> first-use validation/error-scope result
  -> publish new render revision and evidence fence
  -> dispose old incarnation exactly once
```

Antiky owns stable asset/material/pipeline keys, the candidate transaction, expected revision,
compatibility policy, last-good selection, bindings, frame-boundary swap, and receipt. BroMetal owns
generic compilation/reflection and program/resource mechanics. Compilation success alone never
changes accepted state. An incompatible reflection can remain inspectable as a rejected candidate.
Failed first use preserves or restores the last-good program and reports whether any candidate
frame was presented.

No reload operation accepts arbitrary inline shader code from MCP. It references a known project
asset candidate produced by the trusted build pipeline. This prevents the render tool from becoming
an unbounded code-execution surface.

## BroMetal additions required by the adapter

These changes benefit renderers generally and respect ADR 0006:

1. **Structured compiler result.** Return/emit JSON containing source and WGSL hashes, compiler
   identity/mode, stages, reflection/layout, warnings, varyings if public, storage/compute facts,
   and source-located errors. Preserve a separate receipt alongside the generated module.
2. **Caller-supplied debug labels.** Programs, pipelines, buffers, textures, samplers, targets,
   passes, and commands accept bounded labels. Antiky supplies semantic-safe labels; BroMetal does
   not invent world identity.
3. **Sanitized capability snapshot.** Expose supported features/limits and timestamp/readback
   availability without leaking unnecessary adapter/system identity.
4. **Opt-in instrumentation observer.** Bounded events for resource create/destroy, buffer/texture
   upload, pipeline creation, pass begin/end, draw, dispatch, submit, error, and device loss. It must
   be zero/low-cost when disabled and document whether counts are logical calls or backend commands.
5. **Optional timing.** CPU markers and WebGPU timestamp queries behind capability/permission and a
   fixed sampling window. Handle unsupported and disjoint results explicitly.
6. **Explicit readback.** Caller-selected texture/buffer region, hard byte/dimension/format limits,
   timeout/cancellation, and no ambient readback. Antiky policy decides which resource can be read.

Do not add a scene graph, ECS, authored material database, light/gameplay model, render commands,
evidence store, privacy scanner, permissions, or MCP server to BroMetal. Those are Antiky concerns.

## Verification strategy

### Contract and integration tests

- Strictly validate, deeply freeze, sort, bound, and cross-check every Framework render view.
- Keep the Framework import-boundary test green: no BroMetal/WebGPU/browser/Node/MCP dependencies.
- Use one deterministic fake at the lowest driver/backend boundary to prove identities, revision
  staleness, bounded pagination, unsupported capability, observer aggregation, and failure mapping.
- Test the BroMetal adapter against structured compiler receipts, debug labels, measured events,
  async `onError`, candidate compatibility, first-use failure, device loss, and exactly-once disposal.
- Prove CLI, MCP, and Studio are equivalent projections of the same service and cannot escape
  permissions or return absolute paths/raw handles.
- Retain current capture action/runtime/build correlation, single pending-action behavior, size and
  PNG validation, safe permissions, atomic rename, and stale-result deletion.

### Real Chrome/WebGPU fixtures

Use current repository-owned demos only as technical fixtures that exercise different mechanics:

- Antiky Town: stable shadow -> scene -> post/present graph and target dependencies;
- a full-screen shader study: compile receipt/reflection and one-pass baseline;
- Point Light Expo: authored entity/light -> prepared slot -> material/pass/draw trace;
- Combat or Traversal: instancing, translucent VFX, upload and occupancy pressure;
- a compute/storage study: dispatch, storage-written reflection, and dependency/barrier facts; and
- an error fixture: shader compile failure, WebGPU validation error, and simulated device loss.

Prove zero normal-frame GPU readback. When timestamps are absent, the suite must prove explicit
`unsupported`, not skip or fabricate values. When instrumentation is disabled, it must not retain
per-draw/resource histories.

Separately, create a new art-directed moving showcase as the first presentation-quality proof. Its
master is a lossless canvas-only image sequence or lossless video plus exact frame cadence, state
fence, source/build/profile hashes, and review notes. Produce web/video derivatives only through a
recorded quality target and encoder/version/settings; inspect native-resolution frames and motion
before approval. Privacy attestation must prove the source is the game canvas alone. Current demos
may validate the evidence machinery, but they cannot stand in for this showcase's art gate.

### Visual and motion evidence

- Capture at exact runtime/build/render/world/step identities after declared warm-up.
- Preserve lossless PNG masters and derive delivery images/video separately with hashes and encoder
  versions. Compression is never the only master.
- Test wide, portrait, and high-DPI drawing buffers plus named quality/device profiles; assert actual
  dimensions and profile identity.
- Compare in a declared color pipeline with threshold calibration, masks only for known stochastic
  regions, and stored diff/heatmap artifacts.
- Capture deterministic stepped sequences for animation, particles, water, trails, camera motion,
  temporal stability, and performance distribution. A one-step still is not useful motion proof.
- Require an independent human visual gate for composition, readability, lighting, motion, polish,
  and target positioning. Passing numeric similarity is necessary regression evidence, not an art
  verdict.

### Privacy tests

- Place Studio and a terminal containing obvious synthetic PII outside the game canvas and prove
  final evidence contains only canvas pixels.
- Render synthetic email/path/token-like text into a test canvas and prove publication-scoped
  capture is rejected or quarantined by the configured scan.
- Assert MCP/CLI responses contain no username, home/workspace/temp absolute path, authorization
  value, browser prompt, raw base64 image, or adapter serial/PCI identifier.
- Prove microphone, system audio, window, and desktop capture capabilities are absent from the
  normal evidence path. If game-mix audio is added later, it must originate from the game's audio
  graph only.
- Prove stale/failed/privacy-rejected artifacts are removed or quarantined with restrictive
  permissions and no retrievable URI.

## Delivery priorities

### P0: truthful, private evidence

1. Extend render measurements with `status`, `source`, `method`, and sampling window while preserving
   compatibility with current aggregate reporting.
2. Wire BroMetal `onError` and device-loss/validation failures into bounded Framework diagnostics.
3. Preserve capture dimensions and capture source; replace absolute path output with opaque
   artifact identity; add canvas-only/privacy attestation and publication fail-closed policy.
4. Add deterministic paused-frame capture fenced by expected completed step, runtime, build, and
   render revision. Record DPR/profile/color facts.
5. Publish a small `RenderOverview` plus capability discovery. Do not pretend today's self-reported
   values are driver/GPU measurements.

### P1: first real driver and causal trace

1. Route only Antiky Town's shadow, scene, and post/present path through the first Antiky
   `RenderDriver`; do not migrate gameplay rules or broaden scope prematurely.
2. Register stable pass/resource/program/material/geometry keys and logical resource incarnations.
3. Publish structured BroMetal compiler receipts and measured observer counters.
4. Map at least one stable Town or Point Light Expo entity through render item, batch/instance,
   material, pipeline, pass, and draw.
5. Add graph, asset/reflection, and causal trace queries with revision-safe bounded results.

### P1: profiles, performance, and visual/motion proof

1. Define project-owned target/scalability profiles and budgets.
2. Add bounded CPU timing and optional GPU timestamp profiling with distributions and intrusive flag.
3. Build the new art-directed moving showcase and capture its privacy-safe lossless canvas master;
   create quality-controlled delivery derivatives with explicit encoder settings and visual review.
4. Create evidence bundles, lossless masters, deterministic sequences, comparison metadata,
   heatmaps, and human review fields.
5. Establish a repository-owned Chrome/WebGPU fixture suite for shadow, post, full-screen shader,
   instancing, compute/storage, translucent VFX, failures, and privacy.

### P2: safe iteration and advanced diagnosis

1. Candidate/last-good shader and material hot reload with reflection compatibility and frame-boundary
   swap receipts.
2. Expiring presentation-only debug views for pass isolate, normals, depth, roughness, lighting,
   shadow maps, wireframe/bounds, and overdraw where supported.
3. Policy-gated intermediate-resource captures and external GPU-debugger trace references.
4. Resource residency/churn/leak reports, upload-region attribution, pipeline-cache diagnostics, and
   target-device comparison.

## Explicit non-goals

- Moving world, ECS, scene-graph, material-authoring, lighting/gameplay, animation, camera, or other
  game rules into BroMetal.
- Exposing raw GPU/BroMetal handles, arbitrary source/code evaluation, unrestricted WGSL,
  filesystem paths, browser internals, or unbounded traces through MCP.
- Normal-frame GPU readback, desktop/window/terminal capture, microphone/system-audio capture, or
  public posting from a render tool.
- Treating a screenshot, self-reported total, similarity score, or green test as proof of visual
  quality.
- Creating a broad scheduler or second asset/world authority inside rendering inspection.

## Primary local evidence

- [BroMetal render-driver ADR](../../adr/framework/0006-brometal-render-driver_H.md)
- [Rendering and asset architecture](../../architecture/framework/rendering-and-assets_A.md)
- [Framework game host contract](../../../packages/framework/src/game/host.ts)
- [Framework inspection snapshot](../../../packages/framework/src/inspection/snapshot.ts)
- [Framework import-boundary test](../../../packages/framework/tests/import-boundary.test.mjs)
- [CLI MCP tools](../../../packages/cli/src/mcp/tools.ts)
- [CLI capture action broker](../../../packages/cli/src/host/actions.ts)
- [Browser game host](../../../packages/cli/src/host/game-server.ts)
- [BroMetal package demos](../../../packages/demos/brometal/README.md)
- [Rendering/shader/material skill research](../skill-research/rendering-shaders-materials.md)
