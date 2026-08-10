# QA, performance, and release inspection

Research snapshot: 2026-08-09

This report audits the current Antiky Framework, CLI, Studio, game-demo, website-artifact, and skill-
research surfaces against the evidence needed to ship and operate Antiky games. Antiky and BroMetal
are the implementation targets. References to browser, image, tracing, crash, and release tools are
components of an Antiky-native pipeline, not an external-engine roadmap.

## Executive conclusion

Antiky has a strong deterministic kernel and a trustworthy development-inspection boundary, but it
does not yet have a production QA runner. The current code can prove that equal fixed-step inputs can
produce equal state digests, that snapshots and events are bounded and internally consistent, that a
runtime is related to an accepted development build revision, and that a captured PNG came from that
runtime. It cannot yet prove that a named player journey was replayed on an exact release artifact,
that its pixels and motion match an approved baseline, that it stayed within target-device budgets,
that save/load or network recovery worked, or that the downloadable release is the artifact that
passed those gates.

The most valuable next slice is therefore not a broad testing dashboard. It is one end-to-end,
typed evidence path:

```text
quality profile + deterministic scenario
  -> isolated run of an exact game artifact
  -> semantic input trace + state checkpoints
  -> canvas frames/footage + diagnostics + performance samples
  -> machine-verifiable run evidence
  -> artifact/release receipt referring to those exact evidence hashes
  -> independent gate verdict and human release approval
```

Keep Combat Arena, Traversal Study, and Town as deterministic regression fixtures, not as the quality
or showcase bar. Prove the complete release-evidence path on at least one **new art-directed playable
slice** with meaningful motion, audio, UI, failure/retry, target performance, and independent human
design/art/QA review. A hundred schema tests or ten distinct high-resolution posters still do not
prove that a game is compelling, readable, stable, or performant in motion.

## Evidence labels

- **Current** means the repository contains executable code and focused tests for the claim.
- **Current but narrow** means the evidence is real but proves only one subsystem, demo, target, or
  development path.
- **Gap** means neither current code nor current tests prove the production capability.
- **Recommendation** is an Antiky design proposal. Proposed types, tools, commands, gates, and
  priorities below are not represented as implemented.

Architecture and research documents are direction, not runtime proof. A schema proves validation,
not gameplay correctness. A still capture proves pixels at one instant, not animation quality. An
average FPS counter does not prove frame pacing. A local build does not prove the downloadable
release.

## Verified current foundation

### Deterministic session and semantic inspection

**Current:** [`EngineSession`](../../../packages/framework/src/sessions/engine-session/contract.ts)
and its implementation in
[`runtime.ts`](../../../packages/framework/src/sessions/engine-session/runtime.ts) provide:

- one fixed 1/60-second step, a 0.05-second accepted-frame cap, and at most three simulation steps per
  presentation frame;
- immutable captured semantic input, deterministic system order, a single writer, explicit pause
  reasons, retry-safe single-step, and fail-closed callback faults;
- completed-step/input/command/control/world counters and an optional game-owned state digest; and
- explicit accepted and discarded elapsed time rather than hidden catch-up behavior.

The focused
[`engine-session.test.ts`](../../../packages/framework/src/sessions/engine-session/engine-session.test.ts)
tests fixed-clock boundaries, long-frame discard, pause/resume/single-step, equal input/digest results,
immutable input and system order, command sequencing, reentrancy, cleanup, counter bounds, and
terminal fault behavior.

**Current:** the shared inspection contract is strict, immutable, and bounded:

- [`snapshot.ts`](../../../packages/framework/src/inspection/snapshot.ts) owns runtime lifecycle,
  Framework diagnostics, FPS/frame count, canvas size, draws, instances, uploads, and optional
  session/world/event/point-light views;
- [`world.ts`](../../../packages/framework/src/inspection/world.ts) validates stable world/runtime
  identity, entity/component/store counts, `ChildOf` relationships, hierarchy integrity, ordering,
  and honest incomplete views; and
- [`events.ts`](../../../packages/framework/src/inspection/events.ts) validates contiguous accepted
  events, identities, bounded JSON, and declared memory/persistent retention semantics.

Their tests exercise mismatched identities, unknown fields, invalid hierarchy, bounds, immutability,
ordering, and false completeness claims. This is unusually good infrastructure for assertions and
evidence receipts.

**Current but narrow:** point-light commands demonstrate one complete authoring -> runtime -> render
-> event -> inspection -> correction/replay path. The
[`command-flow.test.ts`](../../../packages/framework/src/point-light/command-flow.test.ts) suite proves
idempotency, optimistic revision behavior, render acknowledgement, bounded history, correction, and
ordered fact replay. That does not constitute whole-game input replay, checkpoint restoration, or a
general save system.

### Current host and CLI evidence

**Current:** [`game/host.ts`](../../../packages/framework/src/game/host.ts) exposes a renderer-neutral
game-module contract with semantic pointer and two-axis movement state, a game-owned measurement
report, optional semantic inspection, and session controls. The CLI-owned browser host in
[`game-server.ts`](../../../packages/cli/src/host/game-server.ts) mounts the compiled module, owns the
canvas and presentation loop, translates keyboard/pointer state, publishes inspection, handles
visibility/disposal, and reports startup/frame failures.

**Current:** [`tools.ts`](../../../packages/cli/src/mcp/tools.ts) defines 17 bounded MCP tools:

- ten reads: development, build, runtime, render, diagnostics, session, whole-world, event history,
  point-light list, and one point light;
- five lifecycle/evidence actions: reload, canvas-frame capture, pause, resume, and single-step; and
- two point-light authoring/correction actions.

The shared typed development client, human CLI, HTTP transport, Studio-compatible client, and MCP
adapter are tested to return the same snapshots and control results. The browser boundary rejects
wrong origin, missing authorization, incompatible, stale, malformed, and oversized messages.

**Current:** [`actions.ts`](../../../packages/cli/src/host/actions.ts) captures only the game canvas,
accepts only a validated PNG up to 32 MiB, stores it under `.antiky/captures`, gives the directory
mode `0700` and file mode `0600`, and returns development-session, runtime, build-revision, action,
capture, byte-length, and SHA-256 identity. The action broker allows one action at a time, uses a
ten-second default timeout, rejects stale completion, and cleans up late/failed temporary files.

**Current but narrow:** [`build-tracker.ts`](../../../packages/cli/src/host/build-tracker.ts) watches
bounded source, shader, asset, and project changes. It accepts a new development revision only after
a newer ready runtime appears; shader changes additionally wait for the generated module. Tests cover
create/rename/delete/nested changes and ten source plus ten shader updates inside the ten-second
development target. This is hot-reload readiness, not a clean build, tested package, artifact digest,
or release revision.

**Current:** lifecycle diagnostics use stable codes, correlation IDs, and bounded fields.
[`mcp-call-log.ts`](../../../packages/cli/src/host/mcp-call-log.ts) keeps at most 100 source-ordered
development-session calls, redacts secret-like field names, truncates deep/large values, and records
correlation identities. Session tests prove busy-port rejection, partial-spawn cleanup, child-failure
cleanup, process-group termination, interrupt cleanup, reconnect/reload identity, safe request failure,
and capture identity.

### Current demo tests

All ten demo manifests use schema version 1, one 1280x720 development viewport, loopback ports, and a
build command of `npm run build`; only the two Three.js examples omit a shader watcher. The strict
manifest implementation in [`project.ts`](../../../packages/cli/src/project.ts) bounds the file to
64 KiB and validates exact keys, portable working directories, command tokens, ports, URL, and
viewport. Its `build` section contains only `command` and `workingDirectory`.

**Current Antiky behavior evidence:**

- [Antiky Town](../../../packages/demos/antiky/antiky-town) tests continuous collision, sliding,
  corners, tunneling, steps, slopes, penetration recovery, moving support, bit-identical motor state,
  equal fixed-tick subdivision, host/session composition, pause/step/resume, equal state digests, and
  the point-light adapter.
- [Combat Arena](../../../packages/demos/antiky/combat-arena) tests initial visible fire, bounded hit
  events, directional attack/dash and arena containment, camera framing, pointer bounds, hierarchy,
  runtime stores, and event inspection.
- [Traversal Study](../../../packages/demos/antiky/traversal-study) tests its attract loop, running,
  jumping, landing, course progress, deterministic moving platforms, manual reverse input, finite
  coordinates, camera behavior, authored course inspection, and live events.
- [Point Light Expo](../../../packages/demos/antiky/point-light-expo) tests three stable render
  bindings and one accepted light edit reaching a bounded render change.

**Current but narrow:** BroMetal Town Study repeats strong motor and render-input tests. Most other
BroMetal and Three.js demo tests prove compilation, deterministic layout, or source-level feature
presence. They do not drive a browser player journey or inspect rendered output. There is no current
browser E2E suite for game verbs, scene transitions, failure/retry, or runtime inspection.

### Current artifact and package integrity

**Current:** the website owns a real artifact-verification pipeline rather than importing demo source
at runtime:

- [`build-demo-artifact.mjs`](../../../packages/website/scripts/build-demo-artifact.mjs) emits schema
  version 1 with the game-module contract, project/slug, source revision, entry, WebGPU requirement,
  viewport, portable files, sizes, and SHA-256 hashes; it caps one file at 64 MiB, the artifact at
  96 MiB, and the set at 256 files;
- [`stage-demo-artifacts.mjs`](../../../packages/website/scripts/stage-demo-artifacts.mjs) rejects
  unapproved demos/renderers, stale source, invalid or missing manifests, symlinks, path escape,
  extra/missing files, and hash/size mismatch before staging; and
- [`demo-artifact.test.mjs`](../../../packages/website/tests/demo-artifact.test.mjs) builds all ten
  artifacts, verifies portable/hash-complete outputs and module load, rejects local-path/credential/
  timestamp leakage from the manifest, and proves byte-identical repeated Shader Study output.
  [`demo-delivery.test.mjs`](../../../packages/website/tests/demo-delivery.test.mjs) checks the staged
  artifacts and high-resolution distinct poster assets.

This is the current strongest artifact provenance. Its exact limitation matters: the source revision
covers each project and the artifact-builder input declared in
[`demo-publication.json`](../../../packages/website/demo-publication.json), but not every shared
Framework/BroMetal/compiler/Node/dependency/toolchain input. The manifest has no executed-test,
scenario, target-device, trace, visual-baseline, signer, SBOM, attestation, release, or rollback
reference. Reproducibility is sampled on one simple demo, not demonstrated for each release artifact
in an independent clean environment.

**Current but narrow:** Studio can build a local macOS `.app`. Its
[`package.json`](../../../packages/studio/tauri/package.json) runs Tauri with `--bundles app`, and
[`tauri.conf.json`](../../../packages/studio/tauri/tauri.conf.json) packages the project service,
Node runtime, terminal profile, file association, and brand asset. The pinned Ghostty/Zig dependency
receipt is hash-tested for `macos-arm64`, and native/package contracts are tested. The app is still
version `0.0.0`; there is no repository release workflow, signed/notarized artifact receipt, installer
matrix, GitHub Release upload, download verification, or rollback automation. The root `build` script
builds the website only, and the CLI has no `antiky build`, `qa`, `package`, or `release` command even
though the project manifest stores a build command.

### Current privacy and accessibility foundations

**Current privacy positives:** inspection and browser messages are bounded; the development endpoint
is loopback-only with an ephemeral credential and origin checks; MCP traffic is redacted/truncated;
frame capture is canvas-only and private on disk; artifact tests reject credentials and `/Users/`
paths; and Studio's
[`antiky-studio.zshrc`](../../../packages/studio/tauri/resources/terminal/antiky-studio.zshrc)
clears startup scrollback, disables history, and uses a non-identifying `%` prompt. The associated
[`terminal-bridge.test.mjs`](../../../packages/studio/tauri/tests/terminal-bridge.test.mjs) explicitly
injects a username/hostname-style fixture and proves it is not displayed. This terminal isolation is
required evidence, not cosmetic polish.

**Current accessibility positives:** the development and website canvases are focusable and labelled;
the website host has visible Run/Pause/Resume/Retry controls, labelled pointer-driven movement buttons,
an `aria-live` performance readout, focus/visibility cleanup, and a reduced-motion check before ambient
activation.

**Current gaps:** child stdout/stderr is copied to the development terminal without a structured
redaction/retention contract. Captures can still contain game-supplied personal content. There is no
crash/telemetry data inventory or scrub test, no consent/retention workflow, and no privacy-safe
community-feedback ingest. Accessibility evidence does not include semantic action remapping,
controller/touch alternatives, contrast/text/caption inspection, assist modes, zoom/reflow of game UI,
screen-reader alternatives, automated axe checks, or representative manual testing. Automated DOM
checks alone could not establish canvas-game accessibility in any case.

## Exact production gaps

| Production need | What current evidence proves | Exact gap |
| --- | --- | --- |
| Deterministic scenarios | Equal systems/inputs/steps can yield equal step records and digests. Combat, traversal, and Town have narrow deterministic logic tests. | No named scenario format, fixture/seed contract, scenario runner, multi-assertion timeline, isolated run, or evidence bundle. Randomness and wall/platform time are not globally owned. |
| Functional/integration tests | Package tests cover pure logic, Framework integration, host transports, lifecycle, and several demo behaviors. | No automated browser journey against the real compiled artifact, no typed input injection, no boot/main-verb/transition/fail/retry test, and no exact release-artifact smoke test. |
| Load and soak | The build watcher survives repeated fixture updates; lifecycle cleanup is tested. | No long-running game session, repeated mount/dispose/transition cycle, memory-growth sampling, concurrency/load profile, resource-exhaustion case, or packaged-runtime soak verdict. |
| Input record/replay | A step owns immutable semantic input and a digest; single-step is retry-safe. | The host exposes current pointer/movement state only. There is no recorder, trace schema, seed, direct semantic injection, replay driver, divergence location, or presentation-input timing record. |
| Save/load | Point-light accepted facts can rebuild that point-light service. | No game checkpoint codec, whole-world save, fresh-runtime load, round-trip/migration/corruption test, atomic save policy, compatibility version, or rollback-save validation. |
| Multiplayer, when relevant | Nothing in the current game/session/manifest contracts declares or coordinates multiplayer. | No topology/capability declaration, multi-client orchestration, authoritative-state/hash comparison, latency/loss/reconnect scenario, protocol compatibility, or load evidence. Games without multiplayer should declare `none` and receive an honest N/A gate. |
| Crash and log triage | Framework faults hide thrown messages, publish stable source/system codes, and stop retry; CLI tracks child exit and safe lifecycle/action errors. | No bounded structured game log, persisted run log, stack/source-map/symbol bundle, crash fingerprint, minidump ingestion, synthetic-crash test, correlated reproduction package, retention/access policy, or dashboard health gate. |
| Visual regression and motion | `capture_frame` returns exact canvas PNG identity; website posters are unique, at least 2560x1440, and compressed under 1.2 MiB. | Capture has no scenario/step/camera/seed/target manifest, baseline approval, color policy, masks, diff/heatmap, temporal frame sequence, or canvas-only video. Resolution and uniqueness tests do not judge polish or prove gameplay motion. |
| Performance | Inspection exposes FPS, frame count, canvas dimensions, draws, instances, upload bytes, and session discarded time. Some demos report fixed counts. | No raw frame-time series/percentiles/hitches, CPU/GPU/pass timing, long tasks, memory/VRAM, load time, shader compilation, backend/device metadata, profiler trace, warm-up policy, comparison baseline, or enforced scenario/target budget. Reported counts are game-supplied, not independently measured. |
| Browser/device compatibility | Manifests declare one viewport. Artifacts declare only `webgpu: boolean`. The README asks for a WebGPU-capable browser. Studio is explicitly macOS arm64. | No supported-browser/OS/GPU matrix, browser version/backend/DPR/aspect/input/locale record, hardware lane, clean-install/update/suspend/offline test, or compatibility verdict. WebKit automation is not proof of Safari on Apple hardware. |
| Accessibility | Labelled/focusable canvas, D-pad buttons, pause/retry, reduced-motion ambient behavior. | No accessibility target profile, semantic action map/remapping, game-UI inspection, captions/audio alternatives, visual settings, assist modes, axe scan, keyboard-only full journey, zoom/reflow evidence, or human accessibility review. |
| Localization | No current Antiky game localization contract was found. | No stable string keys/catalog, locale negotiation/fallback, variables/plurals, pseudo-localization, font/glyph/RTL/CJK/IME validation, localized asset inventory, per-locale scenario, LQA record, or late-string change control. A game with no player-facing text should declare that fact rather than silently skip the gate. |
| Privacy/security evidence | Loopback auth/origin, bounded schemas, safe failures, redacted MCP log, private canvas captures, isolated Studio prompt. | No run-wide data inventory, log/trace/capture scrubber, synthetic PII fixture, consent, retention/deletion/access record, telemetry offline behavior, untrusted-feedback handling, or signed privacy verdict. Raw child output and absolute paths can enter terminal/log evidence. |
| Artifact provenance | Website artifacts have bounded exact files, source revision, hashes, and stale-source verification. | No clean-input/dependency/toolchain/SBOM identity, source-map/symbol map, scenario evidence references, independent rebuild comparison, signature/attestation, or downloadable-release verification. |
| Build/package/release mapping | Each demo can build `dist/antiky.game.js`; the website verifies/stages it. Studio can build one local `.app`. | `.antiky` does not name artifact paths/targets/configurations; CLI does not execute its build field; no candidate/channel/version graph, CI release workflow, GitHub asset receipt, signing/notarization handoff, known-issues manifest, install smoke, or human go/no-go. |
| Rollback and recovery | Website staging verifies all demos before swapping; point-light correction preserves history. | Neither is release rollback. There is no previous-candidate pointer, download/config rollback, save/schema backward-compatibility result, staged rollout/health threshold, rollback rehearsal, or incident record. |
| Community playtest evidence | The public site and Discord can recruit participants, but no test evidence contract exists. | No research question, build/target capture, consent, cohort, task script, observation record, anonymized finding, severity/confidence, decision link, or re-test. Discord identities/messages must not be copied into agent context by default. |

## Recommended Antiky contracts

These should be strict, versioned, exact-key, immutable, bounded contracts with the same validation
discipline as current inspection. Large files should be content-addressed external artifacts; schemas
should carry safe references and digests rather than embed screenshots, videos, traces, dumps, or raw
logs.

### 1. Quality profile

Keep the current `.antiky` manifest focused on project discovery. A future manifest schema should
reference one portable project-owned quality profile rather than adding every testing concern to the
manifest itself.

```ts
type AntikyQualityProfileV1 = Readonly<{
  schemaVersion: 1; profileId: string; projectManifestRevision: `sha256:${string}`;
  gameModuleContractVersion: 1;
  capabilities: Readonly<{
    persistence: 'none' | 'checkpoint' | 'save-slots'; multiplayer: 'none' | 'peer' | 'client-server';
    localization: 'none' | 'text' | 'text-and-voice'; accessibilityUi: 'canvas-only' | 'semantic-overlay';
  }>;
  targetIds: readonly string[]; scenarioIds: readonly string[]; budgetIds: readonly string[];
  privacyPolicyId: string;
}>;
```

The profile makes N/A explicit. A single-player, language-neutral experiment should not be forced
through fake multiplayer or LQA work; it should declare `none`, and its gate receipt should record why
the lane was not applicable.

### 2. Target profile

```ts
type AntikyTargetProfileV1 = Readonly<{
  schemaVersion: 1; targetId: string; kind: 'browser' | 'studio-preview';
  operatingSystem: Readonly<{ name: string; versionRange: string; architecture: string }>;
  browser?: Readonly<{ name: string; channel: string; versionRange: string }>;
  graphics: Readonly<{ api: 'webgpu'; backend: string; gpuClass: string;
    minimumFeatures: readonly string[] }>;
  display: Readonly<{ width: number; height: number; devicePixelRatio: number;
    refreshHertz: number; colorSpace: string }>;
  input: readonly ('keyboard' | 'pointer' | 'touch' | 'controller')[]; locale: string;
  accessibilitySettings: readonly string[];
  networkProfile: 'offline' | 'local' | 'nominal' | 'impaired';
}>;
```

An actual run receipt resolves ranges and classes to exact observed values: OS/build, browser/version,
GPU vendor/device/driver/backend, resolution/DPR/refresh, locale, input device, power/thermal mode,
and network conditions. Missing facts must be reported as unknown, never inferred from a user agent.

### 3. Deterministic scenario and input trace

```ts
type AntikyScenarioV1 = Readonly<{
  schemaVersion: 1;
  scenarioId: string;
  revision: `sha256:${string}`;
  purpose: 'smoke' | 'functional' | 'regression' | 'visual' | 'performance' | 'soak' | 'playtest';
  start: Readonly<{ checkpointId: string | null; seed: string; completedStepCount: number }>;
  topology: Readonly<{ participants:
    readonly Readonly<{ participantId: string; role: string }>[] }>;
  traceId: string;
  assertions: readonly AntikyScenarioAssertionV1[];
  limits: Readonly<{ maximumSteps: number; maximumWallMilliseconds: number;
    maximumArtifactBytes: number }>;
}>;

type AntikyInputTraceV1 = Readonly<{
  schemaVersion: 1;
  traceId: string;
  inputSchemaId: string;
  fixedStepSeconds: number;
  seed: string;
  entries: readonly Readonly<{ participantId: string; firstCompletedStepId: number;
    repeatStepCount: number; semanticInput: Readonly<Record<string, unknown>> }>[];
}>;
```

Assertions need typed variants for state digest, world/entity/component/store query, event sequence or
predicate, session status, diagnostic absence/presence, checkpoint, capture, performance interval, and
game-owned outcome metric. Every assertion must name its evaluation step and return an actual value,
expected value/range, stable result code, and evidence reference.

The simulation-authoritative trace should store one immutable semantic input per completed fixed step,
using run-length encoding only as a storage detail. Do not replay DOM key events and call the result
deterministic. A separate presentation trace may retain platform-frame/input timing for latency and feel
analysis. Replay must stop at the first divergent digest/assertion and return that completed-step ID,
the previous matching checkpoint, system order, event range, and diagnostic correlations.

Multiplayer topology is activated only when the quality profile declares it. Then the participant
record gains process/connection roles, and scenarios can assert authoritative and replicated digests,
protocol versions, reconnect, loss/latency behavior, and server/client budgets. This contract does not
imply a multiplayer architecture before a real Antiky game needs one.

### 4. Checkpoint/save contract

Framework cannot serialize arbitrary game state safely. Each participating game should register a
bounded codec with a stable ID/version and explicit migrations.

```ts
type AntikyCheckpointReceiptV1 = Readonly<{
  schemaVersion: 1; checkpointId: string; codecId: string; codecVersion: number;
  gameStateSchemaVersion: number; worldId: string; completedStepCount: number;
  worldRevision: number; stateDigest: string;
  payload: Readonly<{ path: string; byteLength: number; sha256: string }>;
}>;
```

Release gates should include save -> dispose process/runtime -> fresh load -> digest/outcome equality,
all supported previous-version migrations, interrupted atomic write, corrupt/truncated/oversized input,
unknown version, storage-full behavior, and rollback to the previous release. Never use a heap/object
dump as a save format or attach arbitrary player saves to remote diagnostics.

### 5. Run evidence, visual comparison, and performance result

```ts
type AntikyRunEvidenceV1 = Readonly<{
  schemaVersion: 1;
  runId: string;
  scenario: Readonly<{ id: string; revision: string }>;
  project: Readonly<{ manifestRevision: string; qualityProfileRevision: string }>;
  artifact: Readonly<{ artifactId: string; sha256: string }>;
  target: Readonly<{ targetId: string; observedEnvironmentId: string }>;
  runtime: Readonly<{ developmentSessionId?: string; runtimeInstanceId: string;
    sessionId?: string; worldId?: string }>;
  startedAt: string;
  durationMilliseconds: number;
  result: 'passed' | 'failed' | 'inconclusive' | 'cancelled';
  assertions: readonly Readonly<{ assertionId: string;
    result: 'passed' | 'failed' | 'not-applicable'; evidenceIds: readonly string[] }>[];
  artifacts: readonly Readonly<{
    evidenceId: string; kind: 'input-trace' | 'checkpoint' | 'log' | 'capture' | 'frame-sequence' |
      'video-derivative' | 'visual-diff' | 'performance-trace' | 'crash';
    path: string; byteLength: number; sha256: string;
    privacyClass: 'public' | 'internal' | 'restricted';
    scrubStatus: 'not-required' | 'passed' | 'failed';
  }>[];
  diagnostics: Readonly<{ codes: readonly string[]; droppedCount: number }>;
}>;
```

A capture manifest must additionally bind the PNG to scenario revision, artifact/build, target,
runtime/session/world, completed step, camera/view ID and transform, seed, canvas pixel dimensions,
DPR, color space/transfer, warm-up, and source-state digest. A visual-comparison record binds reference
and candidate hashes, masks, algorithm/version, exact thresholds, differing pixel/region metrics,
perceptual result, heatmap hash, and human baseline-approval decision.

Regression authority should use lossless canvas frames. A fixed-step PNG sequence can also be encoded
into a convenient high-quality video derivative for motion/design review. The video is presentation
evidence, not a deterministic byte baseline; encoder, codec, bitrate/quality, frame rate, color metadata,
and source-frame manifest must be recorded. Capture only the canvas, never the desktop or Studio
terminal.

Performance results need distributions, not one FPS value:

```ts
type AntikyPerformanceResultV1 = Readonly<{
  schemaVersion: 1; performanceRunId: string; runId: string; budgetId: string;
  warmupSteps: number; measuredSteps: number;
  metrics: readonly Readonly<{
    metric: 'cpu-frame-ms' | 'gpu-frame-ms' | 'present-interval-ms' | 'long-task-ms' |
      'load-ms' | 'memory-bytes' | 'gpu-memory-bytes' | 'draw-calls' | 'instances' |
      'upload-bytes-per-frame' | 'discarded-simulation-seconds';
    statistic: 'p50' | 'p95' | 'p99' | 'maximum' | 'mean' | 'slope';
    value: number; unit: string; sampleCount: number; profilerOverhead: string;
  }>[];
  trace: Readonly<{ path: string; byteLength: number; sha256: string }>;
  result: 'passed' | 'failed' | 'inconclusive';
}>;
```

Budgets belong to a scenario and target. A 16.67 ms frame budget is appropriate only when the game has
declared a 60 Hz target; do not install universal numbers. Include hitch definitions, steady/peak memory,
memory slope in soak, load/compile stalls, thermal state, and raw trace. A profile from Studio or a
development browser may diagnose a problem, but only the exact candidate on target-class hardware can
close a release performance gate.

### 6. Failure envelope and privacy receipt

Extend the current safe fault/diagnostic pattern rather than logging arbitrary exceptions everywhere.

```ts
type AntikyFailureEnvelopeV1 = Readonly<{
  schemaVersion: 1;
  failureId: string; fingerprint: string; code: string; component: string;
  severity: 'warning' | 'error' | 'fatal';
  artifactId: string; runtimeInstanceId?: string; sessionId?: string;
  scenarioId?: string; completedStepId?: number;
  environmentId: string; occurredAt: string;
  safeAttributes: Readonly<Record<string, string | number | boolean>>;
  restrictedArtifactIds: readonly string[];
}>;
```

Raw logs, stack traces, source maps, minidumps, GPU traces, saves, screenshots, and feedback stay in
separately access-controlled artifacts. Before any remote crash provider is enabled, add a typed data
inventory and synthetic scrub tests containing terminal username/hostname, absolute home paths, email,
account/Discord IDs, bearer tokens, chat, save names, and arbitrary game text. Record purpose, consent/
legal basis, processor/destination, retention, access roles, deletion path, offline queue, sampling, and
upload failure behavior. A redacted MCP call log is not a general-purpose telemetry privacy program.

### 7. Build, artifact, candidate, and release receipts

Extend the working website artifact model; do not replace it with unchecked CI metadata.

```ts
type AntikyBuildReceiptV1 = Readonly<{
  schemaVersion: 1; buildId: string; projectManifestRevision: string;
  sourceRevision: string; dependencyLockSha256: string;
  toolchain: readonly Readonly<{ name: string; version: string; sha256?: string }>[];
  targetId: string;
  configuration: 'development' | 'test' | 'release';
  command: readonly string[];
  outputs: readonly Readonly<{ path: string; byteLength: number; sha256: string }>[];
  sbom?: Readonly<{ format: 'spdx' | 'cyclonedx'; path: string; sha256: string }>;
}>;

type AntikyReleaseCandidateV1 = Readonly<{
  schemaVersion: 1; candidateId: string; version: string;
  channel: 'internal' | 'playtest' | 'release';
  sourceRevision: string; buildReceiptIds: readonly string[]; requiredGateIds: readonly string[];
  knownIssues: readonly Readonly<{ issueId: string; severity: string; disposition: string }>[];
  rollbackCandidateId: string;
  dataCompatibilityReceiptIds: readonly string[];
}>;

type AntikyReleaseReceiptV1 = Readonly<{
  schemaVersion: 1; releaseId: string; candidateId: string;
  provider: 'github-releases'; releaseUrl: string;
  publishedArtifacts: readonly Readonly<{
    name: string;
    downloadUrl: string;
    byteLength: number;
    sha256: string;
    signatureOrAttestationId?: string;
    downloadVerificationRunId: string;
  }>[];
  approvalId: string;
  rollbackCandidateId: string;
}>;
```

The candidate must refer to immutable evidence from the same exact bytes. Build, sign/notarize, upload,
and publish are separate jobs with separate authority. Signing and GitHub publishing credentials must
never enter a game runtime, Studio terminal capture, prompt, generic MCP server, or evidence bundle.
Verification downloads the staged/released asset from the same GitHub surface users will use, checks
hash/signature/attestation, installs or unpacks it in a clean account/environment, runs smoke scenarios,
and records the result. Rollback is complete only after restoring the previous artifact/config and
proving save/schema compatibility.

## Recommended service, CLI, and MCP surface

The architecture should be a shared typed `QualityService`; CLI, Studio, tests, and MCP adapt it. Do
not put scenario logic in MCP handlers.

Long runs cannot use the current one-action/ten-second broker. Add a bounded job protocol:

```ts
type AntikyQualityJobV1 = Readonly<{
  schemaVersion: 1; jobId: string; idempotencyKey: string;
  kind: 'scenario' | 'replay' | 'save-roundtrip' | 'visual' | 'profile' | 'soak' |
    'build-candidate' | 'verify-candidate';
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  projectManifestRevision: string; artifactId?: string; progressSequence: number;
  startedAt?: string; finishedAt?: string; resultEvidenceId?: string; errorCode?: string;
}>;
```

Each job gets isolated ports/runtime/output, explicit CPU/wall-time/storage ceilings, structured
progress, cooperative cancellation, cleanup receipt, and retry semantics. One game/project revision
must not overwrite another run's evidence.

Proposed CLI commands, clearly **not current**:

```bash
npm run antiky -- qa list --project path/to/game.antiky
npm run antiky -- qa run smoke.main-loop --target mac-chromium --project path/to/game.antiky
npm run antiky -- qa replay .antiky/traces/combat-main.json --project path/to/game.antiky
npm run antiky -- qa save-roundtrip save.migration --project path/to/game.antiky
npm run antiky -- qa visual visual.combat-hit --target mac-chromium --project path/to/game.antiky
npm run antiky -- qa profile perf.combat-crowd --target mac-minimum --project path/to/game.antiky
npm run antiky -- qa soak soak.repeated-restart --target mac-minimum --project path/to/game.antiky
npm run antiky -- release build --candidate rc.json --project path/to/game.antiky
npm run antiky -- release verify --candidate-id <id>
```

Recommended MCP adapters after the service is proven:

- read-only: `get_quality_capabilities`, `list_quality_scenarios`, `get_quality_job`,
  `get_run_evidence`, `get_performance_result`, and `get_release_candidate`;
- bounded local actions: `start_scenario`, `start_replay`, `start_visual_comparison`,
  `start_profile`, and `cancel_quality_job`; and
- no default MCP tool for signing, notarizing, publishing, rolling back production, uploading raw
  crashes, or exporting Discord/community history.

Every action accepts expected project/artifact/scenario revisions plus an idempotency key. Read tools
return incomplete counts/pagination just as current world/event inspection does. Studio may visualize
jobs and request local runs, but Framework/game services remain the source of simulation truth.

## Tool choices and constraints

Nothing in this section is installed by this recommendation.

| Tool/surface | Current maturity in this repository | Recommended Antiky use | Constraints and risks |
| --- | --- | --- | --- |
| Node test runner and Vitest | **Current.** All workspaces use one or both; root `npm run check` composes typecheck and tests. | Keep as schema, pure logic, deterministic simulation, and Node integration authority. Emit a shared machine-readable result adapter. | Current scripts do not emit one normalized evidence manifest or coverage/risk mapping. Passing unit tests do not prove browser pixels or target performance. |
| Direct [Playwright Test](https://playwright.dev/docs/test-intro) | **Not configured as a direct test dependency.** `@playwright/test` is a root override/optional Next peer in the lockfile, with no Playwright config or game tests. | Run compiled-artifact boot/main-verb/transition/failure journeys; inject semantic traces through a test-only authenticated host boundary; capture canvas frames, console/page errors, and browser traces. | Pin the direct dependency and browser revisions. Headless/software execution does not close GPU quality/performance. Playwright WebKit is not shipping Safari. Never rely on coordinate clicks where a semantic action exists. |
| Browser/Playwright MCP | **Available to agents outside the repo, not a checked-in test authority.** Prior Studio work records cases where no browser was attached. | Exploratory QA, reproduction, and human-visible evidence while developing a scenario. Promote stable findings into direct Playwright/Framework tests. | Session availability, installed browser, signed-in state, and agent timing vary. Do not make a release gate depend only on an interactive MCP transcript. Restrict it to the game page/canvas and local endpoints. |
| Current `capture_frame` plus [Sharp](https://sharp.pixelplumbing.com/) | Canvas capture is current; Sharp is pinned and already verifies website media dimensions/formats/budgets. | Build typed capture manifests, deterministic frame sequences, format/size inspection, simple exact-channel operations, and poster derivatives. | A single capture lacks state/target context. Image dimensions, compression size, and uniqueness do not measure art quality. Sharp alone is not a calibrated perceptual-quality verdict. |
| [OpenImageIO `idiff`](https://openimageio.readthedocs.io/en/latest/idiff.html) and [NVIDIA FLIP](https://github.com/NVlabs/flip) | Researched, not installed. OpenImageIO is established production software; FLIP is source-available under BSD-3-Clause. | Evaluate lossless candidate/reference frames with per-scenario absolute and perceptual thresholds, emitting diff/heatmap artifacts. | Pin versions; calibrate thresholds per scene/target/color pipeline. Perceptual similarity cannot approve composition, novelty, readability, or motion. GPU/ML behavior and floating-point output may vary by platform. |
| Pinned [FFmpeg](https://ffmpeg.org/) | Not installed or integrated. | Encode a verified fixed-step PNG sequence into a canvas-only MP4/WebM derivative for motion and community-review evidence. | Encoder output is not a deterministic regression baseline. Record encoder/version/arguments/color/codec/quality. Review third-party codecs and redistribution. Never record the desktop or terminal. |
| Browser performance trace plus [Perfetto](https://perfetto.dev/docs/) trace processor | No current trace capture/parser. | Collect Chrome/browser scheduling, long tasks, GPU/process events where exposed; join them to Framework steps, captures, and budgets; query repeatable metrics from raw traces. | Browser traces may expose URLs, absolute paths, source names, request metadata, and proprietary shader/resource data. Keep raw traces restricted and measure profiler overhead. Browser support differs. |
| BroMetal/WebGPU timestamp/query and backend capture | Current game reports are estimates; no general GPU timings. | Add optional render-driver timing/pass/resource inspection, then use Xcode Metal capture on the current macOS target when browser/backend permits. | Feature availability varies by browser/GPU and capture overhead can be high. GPU captures can contain source, shaders, buffers, textures, and proprietary assets. No universal backend debugger exists. |
| [axe-core](https://github.com/dequelabs/axe-core) plus manual accessibility matrix | Not installed. Current tests inspect source contracts only. | Automate the website/Studio semantic shell and controls; pair with keyboard-only, zoom/reflow, reduced-motion, contrast, controller/remapping, captions/audio, and assist-mode journeys. | axe cannot understand pixels or gameplay meaning inside a canvas. Manual review and game-owned semantic overlays remain required. |
| Optional [Sentry](https://docs.sentry.io/) crash service/plugin | Not installed or configured. Sentry is only a possible future provider. | After the privacy contract exists, ingest sanitized crash fingerprints, build/release IDs, and symbol/source-map references; use a connector only for read-only issue triage. | Network/processor, cost/quota, consent, IP/device/path/save/log leakage, retention, access, symbol custody, and prompt-injection risks. Do not install or enable by default; never grant a crash connector release credentials. |
| [GitHub Actions](https://docs.github.com/en/actions) and [artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations) | No `.github` workflow is present. Demo hashes are local. | Run clean build/test/scenario lanes, retain receipts, create attestations, stage draft release assets, and verify downloaded assets before human publication. | Pin third-party actions to reviewed commits. Plan/visibility availability can change. Separate build, attestation, signing/notarization, and publishing permissions; protect secrets and fork workflows. |

Useful current verification commands:

```bash
npm run check
npm test --workspace @antiky/framework
npm test --workspace @antiky/cli
npm test --workspace @antiky/demo-combat-arena
npm test --workspace @antiky/demo-traversal-study
npm test --workspace @antiky/website
```

After a direct Playwright dependency/config exists, a reproducible repository command should wrap
`playwright test`; an agent should not run `npx` against an unpinned remote package during a release
gate. For optional image tools, the research command shapes are:

```bash
# Thresholds are scenario-specific examples, never universal defaults.
idiff -fail <absolute-threshold> -failpercent <percent> reference.png candidate.png
flip -r reference.png -t candidate.png

# Encode an already verified lossless frame sequence; do not use the MP4 as regression authority.
ffmpeg -framerate 60 -i frame-%06d.png -c:v libx264 -pix_fmt yuv420p gameplay.mp4
```

## Test layers and gates

### Test layers

1. **Schema/static:** typecheck, exact manifest/profile/scenario parsing, source/import boundaries,
   missing/unsafe assets, dependency/license/provenance, localization placeholders.
2. **Pure deterministic logic:** formulas, state machines, collision, rules, serialization codecs,
   migrations, event invariants, seeded simulation.
3. **Headless scenario:** run fixed steps with semantic input, checkpoints, digests, world/event
   assertions, and first-divergence reporting without rendering.
4. **Compiled browser integration:** launch the actual `antiky.game.js`, drive boot/main verbs/
   transitions/retry, correlate runtime inspection, and test pause/visibility/mount/dispose.
5. **Visual and motion regression:** deterministic named frames/frame sequences, lossless baselines,
   perceptual/absolute diffs, and human art/design review of actual motion.
6. **Target performance:** exact candidate, scenario, hardware/browser/backend, warm-up, raw trace,
   budget result, comparison, and profiler-overhead note.
7. **Compatibility/accessibility/localization/save/network:** parameterized only by declared product
   capabilities and target matrix, with specialist/manual evidence where automation cannot judge.
8. **Soak/load/recovery:** repeated state transitions and reloads, long input trace, memory slope,
   malformed/corrupt/full-storage/focus/offline/reconnect cases, multiplayer concurrency if declared.
9. **Package/release:** clean build, exact files/hashes/SBOM/attestation, clean install/open/update,
   smoke/rollback, download verification, synthetic crash/symbolication, human go/no-go.
10. **Community playtest:** a predeclared research question, representative participants, consent,
    observation, anonymized synthesis, decision, and re-test against the exact candidate.

### Gate schedule

| Gate | Required evidence | Failure policy |
| --- | --- | --- |
| Pull request | Typecheck/unit/schema; affected deterministic headless scenarios; affected artifact build; no new unexpected diagnostics; privacy/safety tests for any evidence boundary. | Block deterministic, schema, security, or affected-scenario failure. Do not run expensive target lanes on every trivial change unless risk demands it. |
| Merge/main | Clean workspace build; all game smoke scenarios against compiled artifacts; artifact hashes/source mapping; replay digest agreement; save round-trip if supported. | Block main on reproducible failures. Quarantine only an independently classified flaky infrastructure case with owner/expiry; never auto-retry deterministic divergence into green. |
| Nightly/lab | Declared browser/device matrix; visual diffs; performance traces; load/soak/recovery; accessibility/pseudo-locale matrices; multiplayer topology if supported. | Open a correlated defect with exact run/artifact/target evidence. A missing required lane is `inconclusive`, not pass. |
| Vertical-slice approval | End-to-end representative loop; final-intent visual/audio/UI evidence in motion; real input/save/retry path; target performance; accessibility intent; independent design/art/QA review; representative player observation. | Feature existence, a still poster, or automated success alone cannot pass. Human owners decide whether the result is compelling enough to represent Antiky. |
| Release candidate | Approved clean source; candidate receipts; exact target packages; all required gate verdicts; known-issue disposition; compatibility/accessibility/localization; crash/privacy scrub and synthetic crash; install/update/offline/suspend smoke as applicable; checksums/SBOM/attestation; rollback rehearsal. | Any missing blocker evidence, target-budget failure, unapproved exception, privacy failure, or rollback incompatibility blocks release. |
| GitHub release/go-live | Human approval for exact candidate/build IDs; isolated signing/notarization; draft asset upload; download/hash/signature/attestation and clean-install verification from `github.com/antikylabs/antiky/releases`; support/known limitations; rollback target. | Never publish through a general MCP or because a build command exited zero. Stop if the downloaded bytes differ from the approved candidate. |
| Post-release | Crash-free/launch/install health, performance/support/community signals by exact release, retention/deletion jobs, incident readiness, rollback threshold, and issue triage. | Pause/stage rollback according to predeclared health thresholds; community volume does not override evidence or product direction by vote. |

## First implementation slices

### P0 — evidence identity and privacy-safe capture

1. Define and validate quality profile, target, scenario/input trace, run evidence, visual capture, and
   performance-budget/result schemas. Add a manifest reference through an explicit project-schema
   migration; never loosen version-1 exact-key parsing.
2. Add a local evidence store with safe relative paths, content hashes, byte/file/run caps, private
   permissions, atomic writes, cleanup, retention, and a synthetic PII/secret/path scrub suite.
3. Extend capture results with the typed capture manifest and add deterministic canvas frame sequences.
   Generate high-quality motion derivatives only from verified frames.
4. Add the long-running isolated quality-job service, direct typed client, CLI adapter, and read-only
   Studio status. Add MCP only after direct tests prove job isolation, cancellation, stale-revision
   rejection, and cleanup.

**Exit gate:** current demos provide stable regression fixtures, while a new art-directed slice runs
from its compiled artifact and produces private content-addressed motion/audio/UI/failure-retry
evidence plus reproducible state checkpoints. Independent humans review its player-facing quality.
Captures stay canvas-only; synthetic terminal names, paths, tokens, and chat cannot enter public
evidence.

### P0 — deterministic replay and browser integration

1. Add a Framework scenario driver that advances exactly one fixed step per semantic trace entry and
   records digests/assertions without browser timing.
2. Add a test-only authenticated input-injection capability to the CLI host, scoped to an isolated QA
   job and expected build/runtime/session identities. Do not make unrestricted input mutation part of
   the public game host.
3. Configure a direct pinned Playwright suite to launch the compiled artifact, bridge semantic input,
   verify runtime/session/world/event facts, and collect browser/canvas evidence.
4. Add first-divergence diagnostics and replay of recorded interactive traces.

**Exit gate:** headless and browser runs of the same declared scenario agree on outcome checkpoints;
two independent same-input runs match; one deliberately changed trace reports the exact first
divergent step; browser failure includes build/runtime/scenario evidence without leaking credentials.

### P0 — performance and artifact-to-release mapping

1. Replace FPS-only authority with present/frame-time samples and target/scenario budgets; preserve
   draw/instance/upload and discarded-simulation measurements as supporting facts.
2. Add browser trace capture/parsing and game/render-driver CPU/GPU/pass/resource timing when supported.
   Establish a macOS minimum/representative target lab before claiming a budget passed.
3. Extend the working website artifact receipt with dependency lock/toolchain/SBOM/build inputs and
   run-evidence references. Apply the same receipt chain to Studio packages intended for GitHub
   Releases.
4. Add clean candidate build, draft upload, download verification, clean install/open, known-limitations,
   and rollback receipt jobs. Keep signing/notarization/publishing behind human approval and isolated
   credentials.

**Exit gate:** an approved candidate maps source -> build receipt -> exact files -> scenario/visual/
performance receipts -> draft GitHub asset -> verified downloaded bytes. A previous candidate can be
restored in rehearsal. No release claim relies on the development build revision.

### P1 — persistence, compatibility, accessibility, localization, and crash triage

1. Implement checkpoint codec/migration contracts through a real game's save/retry need; test fresh
   runtime round-trip, corrupt/oversized/interrupted writes, prior release, and rollback.
2. Declare the supported browser/OS/GPU/input/locale matrix and run browser automation plus physical
   target passes. Record missing coverage honestly.
3. Add semantic action mapping/remapping and game UI/accessibility inspection before expanding
   accessibility automation. Pair axe for DOM surfaces with manual canvas/player testing.
4. Add a stable string/catalog/context/pseudo-locale path only when a real game needs player-facing
   localized content; keep native LQA independent from automated validation.
5. Add structured bounded logs and failure envelopes, source-map/symbol retention, synthetic crash and
   privacy scrub gates. Evaluate a remote crash provider only after data governance is approved.

### P2 — scale, multiplayer when real, and community evidence

1. Add target soak profiles, memory slope, repeated load/dispose/restart, storage/focus/offline and
   recovery fault injection.
2. Add multi-process topology, network impairment, replicated/authoritative assertions, and load only
   for a concrete multiplayer Antiky slice.
3. Add a playtest-study artifact and privacy-safe community defect intake. Discord should recruit and
   route volunteers; do not export private messages, usernames, IDs, or channel history by default.
4. Join release health, defects, anonymized playtest findings, and decisions by exact candidate/release.
   Keep automated QA distinct from evidence that representative people understand and want to play the
   game.

## Community playtest evidence contract

Community growth can support quality, but a Discord reaction count is neither a test result nor design
authority. Each playtest should produce:

- a research question and observable success/failure signals;
- exact release candidate/artifact/scenario/target and known limitations;
- cohort rationale, accessibility needs, consent, compensation if any, recording choice, retention,
  and deletion path;
- a non-leading task script and timestamped observation of intent -> action -> response -> outcome;
- participant report, observed behavior, facilitator note, and analyst inference as separate fields;
- anonymized finding ID, frequency, severity, confidence, supporting evidence, recommendation, owner,
  decision, and re-test status; and
- an optional contact token stored separately from diagnostic evidence only when a participant asks to
  be contacted.

Screen/video upload should be opt-in per session and canvas-only by default. Discord handles, message
history, voice, terminal output, desktop capture, and private project paths are not QA payloads. Agents
may synthesize an authorized, minimized export; they should never scrape the community as ambient
training or treat repeated suggestions as a binding vote.

## Skill-library implications

The existing [production QA research](../skill-research/production-qa.md), [game-design/UX
research](../skill-research/game-design-ux.md), and [recommended
library](../skill-research/recommended-library.md) support a small set of Antiky-native skills:

1. **`test-antiky-game`** owns scenarios and run evidence, but cannot approve its own visual result.
2. **`profile-antiky-game`** owns target traces/budgets and refuses static hotspot guesses as proof.
3. **`review-antiky-visual-motion`** prepares capture/diff evidence and separates regression
   similarity from human judgment of whether the game looks and moves well.
4. **`verify-antiky-release`** maps clean inputs to exact downloadable bytes, smoke, provenance, and
   rollback receipts, without owning signing/publish credentials.
5. **`triage-antiky-failure`** owns safe reproduction, scrubbed crash/log correlation, and routing.
6. **`run-antiky-playtest`** owns consent, observation, anonymized synthesis, and re-test; automated
   agent play never substitutes for representative humans.
7. Later compatibility, accessibility, and localization auditors activate only for declared targets
   and capabilities.

The first-party OpenAI browser-game playtest workflow is the strongest seed for observable browser
discipline. It and every researched community skill are **non-authoritative scaffolding**: their
browser/engine assumptions, thresholds, scripts, and claims cannot become Antiky policy. External-
engine workflows are comparison patterns only. No seed supplies the missing Antiky runtime,
evidence, artifact, privacy, or approval contracts.

Promotion gates for these skills:

- pin compatible Antiky/Framework/BroMetal/Studio/schema/fixture revisions;
- exercise a named complete game slice repeatedly, including failure/refusal paths;
- show measured improvement over the same task without the skill;
- never capture desktop/terminal/credentials or upload restricted evidence automatically;
- separate author, executor, specialist reviewer, and human release authority; and
- include a rollback/migration and revalidation/staleness policy.

## Recommended ownership boundaries

| Owner | Owns | Must not own |
| --- | --- | --- |
| Framework/game | Fixed-step scenario execution, semantic input, game checkpoint codec, state/outcome digests, semantic assertions, render measurement hooks | Browser automation, filesystem evidence store, MCP, release credentials |
| CLI quality service | Isolated jobs, target/runtime launch, evidence store, browser bridge, trace/capture orchestration, build receipts, cleanup | Game rules, arbitrary raw object mutation, production publish authority |
| BroMetal/render driver | Render/pass/resource/timing facts and deterministic capture coordination | Gameplay truth, universal platform claims, artifact publication |
| Studio | Quality profile/scenario/run visualization, local run requests, evidence review and human approval UI | Independent simulation, hidden edits, source of release truth |
| Website artifact pipeline | Verified public demo files and source/hash publication | Claim that poster resolution/uniqueness proves game quality |
| CI/target lab | Clean reproducible jobs, target execution, retained immutable receipts | Signing secrets in untrusted PR jobs, silent baseline approval |
| Human QA/design/art/accessibility/LQA/release owners | Independent quality judgment, exceptions, exact-candidate go/no-go | Replacing missing evidence with confidence or popularity |

## Release-ready definition for Antiky game evidence

An Antiky game or Studio package is release-ready only when the exact downloadable artifact has:

- an immutable source/build/dependency/toolchain/output receipt and checksums;
- required deterministic, browser, save, visual/motion, performance, compatibility, accessibility,
  localization, soak, and multiplayer verdicts according to declared capabilities;
- no unresolved release-blocking diagnostic/defect and an explicit disposition for known issues;
- a privacy inventory, scrub evidence, crash/symbolication path, retention/access controls, and support
  ownership;
- target install/open/update/offline/suspend/recovery smoke as applicable;
- independent human design/art/QA approval that it is worthy of representing Antiky, plus relevant
  community playtest evidence;
- an isolated signing/notarization/attestation and verified GitHub Release download mapping; and
- a rehearsed rollback target with save/data compatibility.

The current repository satisfies valuable parts of the first two bullets for development semantics and
website artifact bytes. It does not yet satisfy this release-ready definition end to end.

## Primary local evidence

- Framework: [engine sessions](../../../packages/framework/src/sessions/engine-session), [inspection](../../../packages/framework/src/inspection),
  [game host](../../../packages/framework/src/game/host.ts), and [point-light slice](../../../packages/framework/src/point-light).
- CLI: [development contracts](../../../packages/cli/src/development), [host](../../../packages/cli/src/host), [MCP tools](../../../packages/cli/src/mcp/tools.ts), and [tests](../../../packages/cli/tests).
- Games: [Antiky demos](../../../packages/demos/antiky) and [all manifests](../../../packages/demos).
- Website: [artifact builder](../../../packages/website/scripts/build-demo-artifact.mjs), [staging](../../../packages/website/scripts/stage-demo-artifacts.mjs), and [tests](../../../packages/website/tests/demo-artifact.test.mjs).
- Studio: [Tauri package](../../../packages/studio/tauri).
- Research: [production/QA](../skill-research/production-qa.md), [rendering/visual evidence](../skill-research/rendering-shaders-materials.md),
  and [game design/playtest](../skill-research/game-design-ux.md).
