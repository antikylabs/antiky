# Gameplay design and iteration inspection audit

Research snapshot: 2026-08-09

This report audits the Antiky Framework and BroMetal gameplay-development loop from concept through
player evidence. It asks what an agent must be able to inspect, manipulate, replay, compare, and
measure to improve a game rather than merely make a demo compile, move, or emit particles.

Antiky Framework, the Antiky CLI/Studio development host, current Antiky demos, and BroMetal 0.15.0
are the only implementation targets. The game-design recommendations come from the local
[game-design and player-experience skill research](../skill-research/game-design-ux.md) and
[recommended skill library](../skill-research/recommended-library.md).

Existing seed skills such as `build-antiky-games`, `write-brometal-shaders`, and
`source-game-assets` are non-authoritative scaffolds, not validated foundations. External-engine
research is comparative input only; this report proposes no external-engine integration or API.

No code or tools were changed as part of this audit.

## Evidence labels

- **Current** means implemented in the repository and supported by source or tests.
- **Accepted direction** means an accepted ADR or architecture document describes it, but the
  capability is not necessarily implemented.
- **Gap** means the current surface cannot produce or manipulate the evidence required by the
  gameplay task.
- **Recommendation** is a proposed Antiky-native service, schema, or evaluation, not an accepted API.
- **Quality boundary** states what the evidence can establish and what still requires human player
  observation or creative judgment.

## Executive conclusion

**Current:** Antiky already has the right low-level spine for agent-operated iteration:

- a versioned project and accepted build revision;
- a fixed 1/60-second simulation clock with explicit captured input, stable system order, pause,
  resume, retry-safe single-step, revisions, and a state digest;
- immutable bounded runtime, world, store, event, diagnostic, and measurement snapshots;
- stable world/entity/session/command identities;
- exact game-canvas PNG capture correlated to build and runtime identity;
- one complete point-light query, command, readback, event, correction, and render-projection path;
- narrow game modules that keep Framework state above BroMetal rendering.

**Gap:** That spine does not yet close a gameplay-design iteration loop. An agent cannot currently:

1. discover a game's semantic actions, mechanic contracts, tunables, scenarios, or debug probes;
2. inject a step-addressed semantic action trace;
3. create or restore a gameplay checkpoint;
4. seed, run, and stop a bounded scenario from an exact state;
5. retain a step-aligned input/state/combat/physics/AI/camera/UI trace;
6. capture motion or debug views correlated to exact simulation steps;
7. compare two runs, parameter variants, or branches as one evidence operation;
8. tune combat, movement, camera, AI, levels, UI, or progression through validated generic
   commands - the point-light power is the only live semantic authoring example;
9. package a human playtest session and consented telemetry without confusing it with event-sourcing
   history.

The highest priority is a replayable **gameplay run** contract: build + content + checkpoint + seed
+ semantic actions + step-aligned observations + canvas-only motion + comparison. Domain probes and
design skills become reliable only after that contract exists.

**Quality boundary:** Deterministic tools can prove that an action was reachable, a collision was
resolved, a camera stayed within a motion budget, or a scenario produced a specified result. They
cannot prove that a choice was interesting, a level taught clearly, combat felt satisfying, or a
player wanted another session. Representative human play remains a separate gate.

## Current Antiky/BroMetal surface

### Development and control plane

**Current:** [`packages/cli/src/mcp/tools.ts`](../../../packages/cli/src/mcp/tools.ts) advertises 17
MCP Tools:

- ten reads for development/build/runtime/render/diagnostics/session/world/events/point lights;
- reload and exact canvas capture;
- pause, resume, and one fixed simulation step;
- point-light power set and correction.

The development snapshot correlates project/build revisions, build attempt, runtime, processes,
diagnostics, and Framework inspection. Actions also carry development-session, runtime, build, and
action identities.

**Current limitation:** The browser action broker has hard-coded action kinds. `GameInspectionPort`
in [`packages/framework/src/game/host.ts`](../../../packages/framework/src/game/host.ts) exposes a
snapshot, three simulation controls, and two point-light methods. Core gameplay changes still
require source edits and a rebuild/reload. There is no generic game-command registry, capability
discovery, preview, sandbox, checkpoint, scenario, or run API.

### Fixed-step session

**Current:** [`EngineSession`](../../../packages/framework/src/sessions/engine-session/contract.ts)
captures an immutable semantic input for each `advance`, applies at most three fixed steps per
display frame, reports discarded time, runs systems in a fixed order, and retains the latest step's
input in-process. Inspection exposes counts, system order, revisions, fault source, and the latest
state digest. Tests cover equal-input repeatability, input immutability, pause reasons, stale-step
rejection, callback faults, and command ordering.

**Current limitation:** MCP single-step uses the game module's current browser input. The caller
passes only `expectedCompletedStepCount`; it cannot provide the step input. Inspection omits the
captured input payload. There is no retained input sequence, checkpoint state, replay operation, or
declared determinism scope. A digest can detect a difference but cannot restore, explain, or inspect
it.

**Accepted direction:** [ADR 0013](../../adr/framework/0013-explicit-simulation-inputs_H.md) requires
explicit clock, random seed/stream, external input, and system order and makes replay a consequence.
The current session implements most of the clock/input ordering foundation, not replay storage or
scenario control.

### Input host

**Current:** The game host creates only:

- normalized two-axis `movement` from WASD or arrow keys;
- normalized pointer position, down/click, activity, and accumulated drag;
- an `interactive`, `ambient`, or `thumbnail` host-mode type, with the current CLI host mounting
  `interactive`.

The canvas must hold focus for movement keys. Games map these values into private semantic input.

**Gap:** There are no named action maps, contexts, pressed/held/released semantics, device identity,
gamepad input, remapping, conflicts, deadzone/curve metadata, input timestamps, buffering evidence,
glyph selection, alternate controls, or agent input injection. The current host cannot distinguish
a robust action system from a game that happens to respond to WASD and click.

### World inspection and events

**Current:** `WorldInspection` provides stable entities, typed component summaries with bounded
JSON data, real `ChildOf` relationships, authoring/runtime/render store kinds, revisions, counts,
and explicit incompleteness. `EventHistory` provides ordered typed facts, command/entity/world
identity, UTC occurrence time, revisions, bounded data, and declared retention. MCP returns the
complete current bounded world and one event history.

**Current limitation:** The views are full latest snapshots, not filtered queries, deltas, spatial
queries, or time series. Component payloads are game-authored JSON without standard gameplay domain
schemas. MCP cannot select an entity, trace a property to a system, or ask what changed between two
steps. One snapshot contains one event source, capped at 512 retained events.

Combat and traversal retain 32 runtime-instance events, drop the oldest, and record wall-clock
`occurredAt`, not simulation steps. High-frequency gameplay data correctly does not belong in
durable history, but no separate development trace exists.

### Capture and measurements

**Current:** `capture_frame` saves only the game canvas under the project `.antiky/captures`
directory. The result includes PNG type, byte length, SHA-256 digest, build revision, development
session, runtime instance, capture ID, action ID, and path. This is a good privacy boundary and must
remain the default.

**Current limitation:** A capture result does not identify the session step, state digest, world
revision, camera, debug layers, canvas dimensions, device pixel ratio, or scenario. Capture and
pause are separate actions rather than one atomic evidence request. There is no canvas-only clip,
frame sequence, before/after pair, perceptual comparison, or annotated timeline.

Inspection publishes the latest snapshot about every 250 ms and samples FPS over 500 ms. Demo
draw/instance/upload values come from `context.report`, usually as constants, not GPU counters.
This cannot resolve one-to-three-frame response, hit timing, camera impulses, frame pacing, or GPU
spikes.

### BroMetal rendering boundary

**Current:** BroMetal 0.15.0 supplies a WebGPU renderer, typed ahead-of-time shader compilation,
program attributes/instance attributes/uniforms, primitive geometry, textures, render targets,
storage buffers, GLB mesh/image parsing, and a camera with set-position/rotation/lens/look-at plus
view matrices. It reports distinguishable GPU creation, device-loss, and uncaptured-error codes.

**Current limitation:** Public `Renderer`, `BroMetalProgram`, and `Camera` APIs do not expose labeled
render items, pass/resource graphs, actual draw/upload counts, GPU timestamps, uniform readback,
camera state getters, projection/unprojection, picking, debug passes, or capture markers. The Antiky
world therefore cannot currently relate a player-visible pixel or performance cost back to a
specific entity, ability, VFX layer, camera impulse, or BroMetal program without custom game code.

### Studio presentation

**Current:** Studio shows the live canvas, simulation controls, hierarchy/components/stores, full
snapshot, events, MCP calls, and diagnostics through the same development client.

**Gap:** There is no implemented canvas/hierarchy selection service, property inspector, gameplay
timeline, entity focus, editor camera, scenario runner, input trace, checkpoint browser, comparison
view, or gameplay authoring UI. Those operations appear in the
[Studio architecture](../../architecture/studio/overview_A.md) as accepted direction, not current
product evidence.

## What the current demos prove - and do not prove

The demos are useful adversarial and technical fixtures precisely because their automated success
criteria are much narrower than a compelling game.

| Fixture/evidence | What current source/tests establish | What they do not establish |
| --- | --- | --- |
| `EngineSession` | Fixed clock, stable system/input ordering, bounded catch-up, pause/step, digest and fault behavior | Good controls, enjoyable rules, meaningful choices, useful replay, or cross-platform identity |
| Antiky Town character motor | Deterministic sweep/slide/step/ledge/slope/penetration/support behavior across tested inputs | Pleasing acceleration, readable navigation, deliberate level design, or a game loop |
| Antiky Town point light | Stable IDs, expected revision, command ordering, projection, facts, correction, and visual readback | Generic gameplay authoring or a desirable player experience |
| Combat Arena | Movement, automatic projectiles, enemy hit/defeat facts, dash bounds, fixed-step state, hierarchy, and BroMetal feedback layers | Player damage/risk, attack choices, counterplay, readable enemy intent, challenge, balance, depth, or fun |
| Combat Arena idle test | With no player action, projectiles fire and hits occur | Player agency; in fact, this is an adversarial fixture for confusing autonomous spectacle with play |
| Traversal Study | Auto-running, auto-jumping, moving platforms, hazards, checkpoints, events, reverse input, and deterministic authored positions | That a player learned the controls, chose a route, mastered a mechanic, found failure fair, or wanted another lap |
| Traversal attract-loop test | An idle input travels, jumps, and lands | Responsiveness or level teaching; the automation bypasses the need for player understanding |
| BroMetal shader studies | Typed shaders compile and a portable WebGPU canvas renders procedural motion | A core loop, player goal, interaction, accessibility, or coherent game |
| Exact PNG capture | The canvas had those pixels at an unrecorded moment in the current runtime | Motion quality, latency, audio, haptics, causal state, player comprehension, or preference |
| FPS/draws/instances | Coarse host FPS and game-declared render quantities are available | Frame-time distribution, GPU cost, correctness of declared counts, or gameplay quality |

**Quality boundary:** These fixtures should exercise tools and regression contracts. They should
not be used as quality bars or public proof that Antiky makes compelling games. A showcase slice
needs goal, risk, failure, retry, teaching, escalation, UI/audio/presentation, accessibility paths,
and representative human evidence in addition to technical correctness.

## Complete lifecycle audit

| Lifecycle stage | What an agent must inspect/manipulate/replay/compare/measure | Current Antiky/BroMetal evidence | Missing capability | Priority |
| --- | --- | --- | --- | --- |
| Concept and core loop | Experience promise, verbs, decisions, loop states, success/failure, anti-goals, risky hypotheses; trace each claim to a scenario | No project or runtime mechanic-contract schema | Versioned mechanic/experience contracts linked to game systems, scenarios, evidence, and rejection criteria | P0 |
| Mechanic contract | State machine, resources, rules, interrupts, tunables, invariants, feedback obligations, teaching beats | Rules and constants exist privately in demo TypeScript | Discoverable typed contracts; stable tunable IDs/ranges; validation; contract-to-state/event mapping | P0 |
| Input and controls | Named actions/contexts/bindings; device state; event-to-action-to-state-to-pixel timing; buffering, coyote, deadzone, conflicts, remap | Generic movement/pointer values; session captures a private semantic input | Action-map schema, input injection, action trace, device profiles, timing markers, remap/accessibility queries | P0 |
| Combat | Ability phases, hit/hurt volumes, targeting, damage, resources, statuses, cancel windows, threat, deaths, encounter outcome | Combat fixture exposes player/enemy transforms, enemy health, dash/cooldown, projectile pool, hit facts | Standard combat probe, scenario setup, volume debug view, causal combat trace, parameter commands, outcome metrics | P1 |
| Traversal/physics | Controller state, contacts, sweeps, support, reachable envelope, jump windows, routes, falls, checkpoints | Strong private character-motor tests; traversal fixture exposes velocity/grounded/platforms/falls | Runtime physics query/probe, contact trace, deterministic route runner, debug geometry, reachability analysis | P1 |
| Camera and game feel | Camera state, target, framing/occlusion, impulses, input response, animation/VFX/audio/haptic timing, reduced-motion variant | Demo camera functions and visual feedback are private; still capture only | Camera/feedback trace, screen-space metrics, debug capture, clip comparison, audio/haptic markers and reduction paths | P1 |
| Enemies and AI | Perception, memory, decision state, goals, target score, path, steering, attack opportunity, stuck/recovery, seed | Combat drones use private orbit steering; no player threat/damage loop | AI contract/probe, deterministic seeds, nav/path facts, decision rationale codes, batch scenarios and interventions | P1 |
| Level teaching | Spatial metrics, graph/routes, gates, mechanic exposure, teach/practice/test beats, sightlines, failure clusters | Traversal platforms/hazards/checkpoints are source arrays; no teaching schema or player route history | Level/beat schema, spawn/checkpoint commands, spatial queries, path/heatmap trace, blind-session correlation | P1 |
| UI/UX/accessibility | Screen/flow/focus/action prompts/input owner; redundant cues; settings; remap; subtitles; safe areas; reduced motion/flashing | Canvas label and Studio controls; game modules publish no player-UI semantics | Game UI tree/flow/focus schemas, settings/action APIs, accessibility barrier matrix, modality and viewport test runner | P1 |
| Balance/difficulty/progression | Tunables and provenance, economy graph, encounter distributions, dominant options, difficulty dimensions, unlock and failure curves | Source-coded constants; one world revision; no progression/economy service | Versioned tuning tables, parameter sweeps, headless batch simulation, sensitivity/exploit analysis, cohort metrics | P1 |
| Playtesting | Exact build/condition, consent, participants, input/event/media timeline, annotations, findings, decision | Manual live canvas and one-frame capture only | Canvas-only session recording, consent/retention record, observation annotation, evidence export, human/agent role separation | P1 |
| Telemetry/experiments | Purpose-bound schema, session/cohort/condition, funnels, guardrails, data quality, consent/opt-out/deletion | Runtime-instance event history is inspectable but is not telemetry | Separate versioned telemetry stream/store, privacy ledger, validation, local query/funnel/experiment artifacts | P2 |
| Quality review | Compare intended experience with behavior, motion, access, performance, and representative play; issue publish/no-publish | No integrated evidence ledger or run comparison | Evidence bundle, independent reviewer packet, claim classes, unresolved-risk gate, human creative approval | P0 |

## Foundational design: one gameplay-run service

**Recommendation:** Add a Framework-owned development service rather than many unrelated MCP
handlers. One deep `GameDevelopmentPort` should describe capabilities, read contracts,
execute/correct commands, create checkpoints, run/read scenarios, and compare runs. CLI, Studio,
tests, and MCP adapt that service.

The game supplies semantic adapters. Framework owns validation, identities, limits, ordering,
revision checks, retention declarations, and immutable copies. The CLI owns local persistence,
build/runtime correlation, bounded capture, and transport. BroMetal supplies render observations
through an Antiky-owned render adapter; it never becomes gameplay authority.

Keep four changes distinct: authoring commands persist revisioned/correctable facts; scenario setup
creates disposable sandbox state; semantic input follows the normal player path; debug presentation
changes only overlays, camera, trace retention, or capture and cannot affect the gameplay digest.

The current point-light flow is the model for authoring commands: stable command/target identities,
expected revision, bounded values, authority supplied by the host, structured result codes, facts,
readback, and correction. Generalization should register typed command contracts, not expose a
free-form JSON patch into live objects.

### Proposed Tool groups

These names make tasks evaluable; the shared service, not MCP, owns behavior.

| Proposed Tool | State effect | Required input | Required result | Priority |
| --- | --- | --- | --- | --- |
| `get_gameplay_capabilities` | None | Optional domain filter | Supported contract/query/command/scenario/probe IDs, schema versions, authority, limits, determinism, retention | P0 |
| `get_gameplay_contracts` | None | Kind, IDs, revision, cursor/limit | Bounded mechanic/action/level/UI/tuning contracts with provenance and incompleteness | P0 |
| `create_gameplay_sandbox` | Creates isolated state | Base build/world revision, limits, lifetime | Sandbox/world/runtime IDs, base revision, permissions, expiry, disposal command | P0 |
| `create_gameplay_checkpoint` | Persists bounded dev state | Sandbox, expected step/revision, reason | Checkpoint ID/hash/schema, build/content/seed compatibility and byte/retention facts | P0 |
| `run_gameplay_scenario` | Advances sandbox | Checkpoint, seed, semantic action trace, step/time budget, probes, capture schedule, stop conditions | Run ID, status, final step/digest, observation counts, artifact references and structured failures | P0 |
| `get_gameplay_run` | None | Run ID, domains, step/time range, cursor/limit | Step-aligned action/state/event/probe samples with declared gaps and retention | P0 |
| `compare_gameplay_runs` | None or local artifact | Two compatible run IDs, alignment, metric/visual thresholds | Structured deltas, aligned captures, changed outcomes, regressions, unsupported comparisons | P0 |
| `submit_game_command` | Changes sandbox authoring by default | Registered command type/schema, IDs, expected revision, bounded payload | Accepted/rejected result, changed values, revision, facts, affected contracts, correction identity | P0 |
| `correct_game_command` | Records a correction | New command ID, corrected command ID, expected revision | Restored/derived values, new fact, readback and revision | P0 |
| `capture_gameplay_media` | Creates evidence only | Run/step range, game/editor camera ID, canvas/debug layers, resolution, frame rate/duration | Canvas-only frame/clip IDs, hashes, timing map, dimensions, encoding, build/run/camera/debug provenance | P1 |
| `export_gameplay_evidence` | Creates local package | Run/comparison/playtest IDs, redaction policy, destination inside project | Manifest, hashes, changed-file list, retention, redaction result, missing-evidence list | P1 |

Do not create one Tool per component property. Capability descriptors and registered schemas let one
deep query/command/run service support combat, traversal, camera, AI, UI, and progression while
remaining closed-world and inspectable.

## Required schemas and evidence

### 1. Mechanic contract

The contract anchors tools to a player-facing reason. It is authoring data, not a claim that the
experience succeeded.

```ts
type MechanicContract = Readonly<{
  schemaVersion: 1;
  mechanicId: string;
  revision: number;
  label: string;
  playerPromise: string;
  verbs: readonly string[];
  decisions: readonly string[];
  states: readonly string[];
  success: readonly string[];
  failure: readonly string[];
  invariants: readonly string[];
  interruptRules: readonly string[];
  tunableIds: readonly string[];
  actionIds: readonly string[];
  feedbackCueIds: readonly string[];
  teachingBeatIds: readonly string[];
  scenarioIds: readonly string[];
  hypotheses: readonly { claim: string; requiredEvidence: string }[];
  provenance: { path: string; revision: string };
}>;
```

Every tunable needs a stable ID, type/unit, minimum/maximum, default, safe preview range, current
revision, mechanic owner, reason, and evidence links. A source constant such as `0.72` seconds is
not agent-safe tuning data until its meaning and constraints are declared.

### 2. Semantic action map and trace

Actions - not keys - are the replay unit.

```ts
type ActionContract = Readonly<{
  actionId: string;
  valueType: 'button' | 'axis-1d' | 'axis-2d';
  contexts: readonly string[];
  phases: readonly ('pressed' | 'held' | 'released')[];
  deadzone?: number;
  bufferSteps?: number;
  toleranceSteps?: number;
  conflicts: readonly string[];
  bindings: readonly { device: string; control: string; remappable: boolean }[];
  alternatives: readonly string[];
}>;

type SemanticActionSample = Readonly<{
  completedStepId: number;
  inputSequence: number;
  actionId: string;
  phase: 'pressed' | 'held' | 'released' | 'value';
  value: boolean | number | readonly [number, number];
  source: 'player' | 'replay' | 'automation';
  sourceEventId: string;
}>;
```

Host input events need monotonic receipt time; the session records capture input sequence and step;
gameplay transitions record the causal action/event ID and step; presentation records which frame
first displayed the result. That chain permits input-to-state and input-to-pixel latency without
putting wall-clock reads inside authoritative simulation.

### 3. Gameplay checkpoint and run

```ts
type GameplayRunRequest = Readonly<{
  schemaVersion: 1;
  sandboxId: string;
  scenarioId: string;
  checkpointId: string;
  seed: string;
  build: {
    acceptedBuildRevision: number;
    artifactSha256: string;
    projectRevision: string;
    frameworkVersion: string;
    brometalVersion: string;
  };
  contentRevision: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  actionTraceId: string;
  maximumSteps: number;
  stopConditions: readonly string[];
  probeIds: readonly string[];
  captureSteps: readonly number[];
}>;
```

A checkpoint must declare the game schema, world revision, completed step, seed/random-stream
state, compatibility identifiers, retention, size, and hash. Restoring it creates sandbox state; it
must never overwrite a newer primary world. A digest alone is not a checkpoint.

The determinism claim is scoped. Equal build/content/checkpoint/seed/action trace should produce
equal declared simulation observations and final digest on supported targets. Pixel identity is a
separate claim and usually needs frozen render time plus tolerance. Antiky must not promise binary
identity across platforms unless the subsystem verifies it.

### 4. Step-aligned gameplay trace

Durable event history, high-frequency development trace, and playtest telemetry are different data
products:

| Product | Purpose | Typical facts | Lifetime |
| --- | --- | --- | --- |
| Domain event history | Rebuild/audit selected authoritative facts | Authored changes, inventory, quests, important results, corrections | Declared runtime/session/durable |
| Gameplay development trace | Explain and compare a bounded run | Input phases, contacts, ability/AI/camera/UI transitions, performance markers | One run; bounded and local |
| Playtest telemetry | Answer a consented research/product question | Attempts, failures, funnels, settings, progression, session summaries | Purpose-limited policy with deletion date |

Do not put 60 Hz movement, contacts, camera transforms, or particle samples into the existing event
history. Add a paginated run trace with step/time ranges, domain tags, causal IDs, retained/dropped
counts, and an explicit sampling policy.

Each sample needs run/sandbox/session/runtime/world/build/content/scenario identities, completed step
and simulation time, causal input/action ID, stable domain IDs, typed data, relevant digest,
capture/performance correlation IDs, and sampling/incompleteness facts.

### 5. Evidence bundle and comparison

An evidence bundle is a manifest, not a folder of unexplained screenshots:

```text
evidence.json
  intent: brief/mechanic/hypothesis IDs and revisions
  provenance: project/build/artifact/content/framework/BroMetal/device identities
  execution: sandbox/checkpoint/scenario/seed/action trace/run IDs
  observations: state, events, traces, diagnostics, performance and accessibility results
  media: canvas-only frame/clip hashes plus step/camera/debug/encoding metadata
  comparison: baseline/candidate alignment and thresholds
  human: study/consent/condition/annotation references, never fabricated participants
  gaps: dropped/incomplete/unsupported/unverified facts
  decision: technical pass/fail, quality-review status, human approver
```

`compare_gameplay_runs` must refuse incompatible builds, checkpoints, scenarios, viewports, or
sampling policies unless the caller explicitly selects a supported normalization. It should align
by completed step, named marker, or semantic event - not approximate wall-clock screenshots.

## Domain inspection requirements

Domain adapters should register standard observations and commands through the shared gameplay-run
service. They are not invitations to put private engine objects into inspection JSON.

### Concept, core loop, and mechanic contracts

An agent needs to map `player intent -> action -> state transition -> consequence -> next decision`.
Expose stable mechanic/state IDs, active state, resources, transition reason, affected entities,
source, and owner. Review whether the player decided anything, could fail/recover/retry, had
meaningfully different options, and produced evidence capable of rejecting the hypothesis.

The current Combat Arena idle fire/hit path and Traversal Study auto-run/auto-jump path are required
negative fixtures: a mechanically self-playing scene cannot pass a player-agency claim merely
because events and motion occur.

### Input and controls

Required probes and measurements:

- current action contexts, active device, bindings, conflicts, and remap state;
- raw host event receipt, semantic action phase, captured input sequence, applied simulation step,
  visible response frame, and optional audio/haptic marker;
- deadzone/curve samples, repeated/suppressed events, button buffer and coyote-window consumption;
- action availability, cooldown/lockout/cancel reason, input ownership, and prompt glyph;
- device-specific traces for keyboard, pointer/touch, and supported gamepads;
- median, high-percentile, and worst input-to-state and input-to-pixel latency by action - not just
  average FPS.

Agent injection must use the same action contracts as players. It may select the source as replay or
automation for evidence, but cannot bypass cooldown, targeting, collision, or authority.

### Combat and abilities

Standard combat observations should include:

- ability ID and revision; phase (`ready/startup/active/recovery/cooldown/interrupted`); phase start
  step and remaining steps;
- costs, resources, target query/result, aim/facing, range, tags, cancel/interrupt decision and
  reason code;
- hitbox/hurtbox shapes and transforms, collision layer/mask, overlap/contact result, hit ID and
  deduplication;
- damage/healing/status calculation inputs and result, health/poise/shield, death/respawn;
- readable enemy telegraph start/impact/recovery markers and player response opportunity;
- feedback markers for animation, VFX, audio, camera, haptics, UI, hit-stop, and accessibility
  alternatives.

Measurements should cover time to first meaningful decision, attack startup/active/recovery,
input-to-impact, hit-confirm delay, damage taken/dealt, time-to-kill, time in threat range, interrupt
rate, dominant-action share, resource starvation/overflow, encounter completion/failure, and
variance across seeds/scenarios.

The current combat fixture needs player risk/damage, enemy attacks and telegraphs, explicit player
attack choice, failure/retry, and at least one counterplay decision before it can evaluate combat
quality. Its existing dash, projectile, enemy health, and hit events are useful seeds for the probe.

### Traversal, collision, and movement

Standard traversal/physics observations should include:

- motor configuration/revision; desired and actual velocity; acceleration/braking; grounded state;
- jump request/consume, buffer and coyote steps, apex, landing impact, squash/recovery;
- sweep/overlap/ground-query parameters and results, support, contacts, normals, layers, penetration,
  ledge/slope/step rejection reason;
- platform and hazard authored bounds, current transforms, checkpoint and respawn state;
- route/gate IDs, progress, failure location/reason, retry and time lost;
- a debug geometry view for player capsule, sweep, contacts, support, hazard, reachable envelope,
  spawn, checkpoint, and critical route.

The Antiky Town character motor already has rich private debug contacts and deterministic tests.
Expose a bounded semantic adapter rather than duplicating its internal arrays. Traversal scenarios
should run exact traces at the edge of jump distance, coyote time, moving support, and hazard bounds,
then compare human attempts against automated reachability.

### Camera and game feel

Required camera observations:

- camera ID/type, transform, target, lens, aspect, mode, active impulse sources and blend weights;
- subject screen-space bounds, look-ahead, target distance, occluder IDs, clipping and offscreen
  critical entities;
- position/rotation velocity and acceleration, shake amplitude/frequency/decay, field-of-view change,
  motion-reduction setting;
- causal feedback timeline from action through simulation, animation, render, audio, haptic, UI, and
  next-action availability.

BroMetal camera setters are sufficient to render but not to inspect this state. Antiky should own a
camera projection record and send matrices to BroMetal. A debug camera or overlay must not alter the
game camera or simulation digest.

Still images are inadequate for feel. `capture_gameplay_media` needs canvas-only fixed-rate clips or
frame sequences with exact step/frame markers. It must capture no desktop, Studio chrome, terminal,
username, host name, private path, notifications, or other applications.

### Enemies, navigation, and AI

Standard AI observations should include:

- agent/archetype/behavior revision, deterministic random stream, current state/goal/subgoal;
- perception stimuli and expiry, target candidates/scores/selection reason, memory/blackboard facts;
- requested path, path revision, waypoints/corners, nav region, steering request, avoidance/contact;
- action selected/rejected, ability opportunity, telegraph state, cooldown, resource and interrupt;
- stuck detection, recovery attempt, unreachable/invalid target, idle/no-op duration;
- squad/encounter director state, spawn budget, role distribution, pressure and respite markers.

An agent may query or intervene in a sandbox (set a stimulus, target, or start state) through
registered scenario operations. It should not rewrite a private blackboard or force a hidden AI
transition in the primary world. Batch evaluation needs distributions across declared seeds, not
one narrated simulated player.

### Level teaching and onboarding

Required authored data and evidence:

- level/zone/encounter graph; spawn/checkpoint/goal/failure/gate IDs;
- player metrics and reachable envelopes by controller/loadout/access setting;
- teaching beats with `expose -> invite -> practice -> test -> combine` roles;
- expected player knowledge before/after a beat, permitted help, prompt and replay/skip rules;
- critical/optional routes, sightline/framing targets, navigation and collision proof;
- step-aligned route traces, first-attempt actions, hesitation, failures, reset locations and help use;
- aggregated path/failure heatmaps generated from trace data, never inferred from one screenshot.

Automation can prove reachability, trigger order, absence of softlocks, and prompt/state consistency.
Only blind/no-help representative sessions can show that players noticed, understood, and applied
the lesson without coaching.

### Player UI, UX, and accessibility

The game needs a semantic player-interface inspection tree distinct from Studio's own DOM:

- screen/overlay/dialog IDs, state and transition reason;
- focus graph, current focus, navigation actions, modal/input owner, escape/recovery path;
- critical information and every visual/audio/text/haptic channel that conveys it;
- prompt action ID and current device glyph; safe area; scale; localization expansion bounds;
- setting IDs, defaults, dependencies, availability before play, and runtime effect;
- reduced motion/flashing, color/contrast alternatives, subtitles/captions, remapping, timing and
  difficulty assists, skip/replay, and no-audio/no-color modes.

Required automated scenarios include keyboard-only, supported controller, pointer/touch, remapped
controls, focus recovery after modal close, narrow/wide viewports, large text/localization expansion,
no-color, no-audio, reduced motion, and settings-before-opening. Automated checks find barriers;
disabled-player research remains the validation gate.

The current `GameHostContext` has no gamepad, audio, haptic, player-UI root, focus, settings, safe
area, or accessibility contract. These need game/platform adapters; they do not belong in BroMetal.

### Balance, difficulty, progression, and retention

Required authoring and measurement:

- versioned tuning tables with units, ranges, rationale, dependencies, current values and mechanic
  contracts;
- combat/traversal/AI scenario matrices and headless parameter sweeps;
- distributions, uncertainty, sensitivity, outliers, dominant/dead choices, exploits and safe ranges;
- explicit difficulty dimensions such as timing, information, failure penalty, resources,
  navigation help, enemy pressure, and puzzle assistance;
- progression node/prerequisite/reward/cost/source/sink graphs, unlock pace, build diversity,
  recovery and reset;
- playtest/telemetry queries tied to a named decision, never a universal score for fun.

Agents should tune in sandboxes, compare against a baseline, and submit a bounded change packet.
They must not optimize session length, streak completion, spending, notification response, or
stopping friction as unconstrained goals. Player-trust guardrails and a human review are required
for retention, monetization, child-directed design, and social pressure.

### Human playtests and telemetry

A local playtest record should contain:

- study/research-question ID, condition and scenario;
- participant pseudonym or study-local ID only;
- consent version, allowed capture modalities, withdrawal/deletion route, retention date and owner;
- exact build/content/checkpoint/seed/settings/device/viewport;
- canvas-only media, semantic actions, events, traces, diagnostics and performance correlated to
  one timeline;
- researcher observations separated from interpretation and participant statements;
- annotations linked to steps/markers/captures, contradictory evidence, findings, decision and
  unresolved questions.

Telemetry needs a versioned schema and purpose/data-owner/retention ledger. Reject unknown events,
free-form text, direct identifiers, unbounded cardinality, silent collection, and events without a
design question. Provide opt-out/deletion tests before collection. Metrics locate behavior; they do
not explain motivation.

An automated agent role-playing a player is scenario exploration, not a participant. Friend-only,
coached, unconsented, or leading-question sessions cannot support a broad quality claim.

## Priority roadmap

### P0 - make one mechanic reproducible and comparable

Deliver this as one complete Antiky slice using Combat Arena or Traversal Study as a technical
fixture, then validate on a new human-designed showcase slice.

1. Add game capability and schema discovery.
2. Add action-contract publication and step-addressed semantic input injection.
3. Add sandbox checkpoint/restore with seed and compatibility declarations.
4. Add bounded scenario execution and step-aligned run traces.
5. Correlate run, build, content, checkpoint, seed, step, digest, events, diagnostics, captures, and
   measurements.
6. Add baseline/candidate run comparison and a manifest-style evidence bundle.
7. Generalize point-light command/correction discipline to registered game authoring commands.

P0 exit criteria:

- a fresh agent discovers the fixture without source archaeology;
- the same action trace can reproduce the declared outcome from the same checkpoint;
- stale build/content/checkpoint inputs fail before simulation changes;
- a tunable change occurs only in a sandbox, is read back, compared, corrected, and fully traced;
- a comparison identifies expected and unexpected state/event/timing deltas;
- evidence captures only game-owned output and never desktop/terminal context;
- the evidence reviewer can reject a technically green but self-playing/empty mechanic.

### P1 - explain player-facing failures

Add domain adapters through real vertical slices:

1. input/action timing and device/remap coverage;
2. combat/ability and hit-volume probes;
3. character/physics/traversal and level-route probes;
4. camera/framing/feedback traces plus canvas-only clips;
5. AI/perception/decision/path/stuck probes;
6. player UI/focus/settings/accessibility semantics;
7. tuning tables, batch scenarios, difficulty dimensions and progression graphs;
8. local human-playtest capture/annotation/export with consent and retention.

Each adapter must improve diagnosis on a deliberately flawed fixture, remain bounded, and avoid
moving game rules into inspection or BroMetal.

### P2 - scale evidence safely

- persistent local run index, trace/media retention and garbage collection;
- aggregated route/failure/encounter/setting funnels and privacy-governed telemetry queries;
- experiment conditions and guardrails;
- target-device performance correlation and BroMetal render/GPU probes;
- Studio timelines, aligned run comparison, selection/focus and evidence annotations;
- long-run progression/economy simulations and exploit search;
- promotion of approved sandbox change packets into primary authoring state.

P2 should not precede P0 correctness. Scaling uncorrelated screenshots, guessed metrics, or
self-authored reviews would only produce more low-quality evidence.

## Required evaluation scenarios

### E1 - reject autonomous spectacle as player agency

Use current Combat Arena idle input and Traversal Study attract input. Both produce motion and
events without a meaningful player action. The tooling must reproduce them, but the evidence review
must reject claims for player decision depth, control clarity, or onboarding. Passing the automated
run is not a quality pass.

### E2 - exact input-to-response trace

From one checkpoint, press a semantic dash/jump action at a declared step. Assert the input receipt,
capture, mechanic transition, movement/ability state, feedback markers, camera impulse and first
presented frame. Compare two tuning variants. Fail on missing causal IDs, dropped samples, hidden
browser input, or an unsupported latency claim.

### E3 - combat decision and counterplay

Create static, moving, attacking, and crowded enemy scenarios from fixed seeds. Exercise at least
two player actions and one defensive/counterplay decision. Inspect telegraphs, attack phases,
hit/hurt volumes, damage, resources, cancels, enemy decisions, deaths and retries. Measure outcome
distributions. Human comparison decides whether the result is readable and satisfying.

### E4 - traversal reachability and feel

Run traces just inside/outside the jump envelope and coyote/buffer windows; include moving support,
slope, ledge, collision, hazard, checkpoint and reset cases. Compare controller variants with exact
contacts and route outcomes. Blind participants then test discoverability, perceived control and
fairness; automation cannot answer those questions.

### E5 - camera, motion, and reduced-motion variant

Replay one combat/traversal run through normal and reduced-motion settings. Record camera target,
screen-space subject bounds, occlusion, angular/linear motion, impulses and aligned clips. Detect
clipping or lost critical targets. Human reviewers compare readability and impact in motion.

### E6 - deterministic AI diagnosis

Run multiple declared seeds with a blocked path, unreachable target, crowded avoidance, lost
perception and attack opportunity. Record perception, goal, target score, path, action reasons,
stuck/recovery and outcome. Repeating a seed must reproduce declared state observations; variation
across seeds must remain visible rather than averaged away.

### E7 - level teaching versus prompt presence

Define one expose/practice/test/combine sequence. Automation verifies reachability, triggers,
prompts, skip/replay and no softlock. A blind no-help session records first correct action,
hesitation, failure, route and help use. The evaluation must fail if it concludes comprehension only
because tutorial text appeared.

### E8 - accessibility paths

Run remapped controls, keyboard/controller/pointer paths, reduced motion, no-color, no-audio, large
text/localization expansion, focus recovery, timing assist and difficulty-assist conditions. The
bundle reports barriers and unsupported paths. It cannot claim accessibility from settings labels
alone; representative disabled-player review remains required.

### E9 - balance and progression sweep

Vary a bounded tuning matrix from identical checkpoints and seeds. Report distributions,
sensitivity, dominant/dead options, exploits and guardrails; preserve individual outliers. Reject a
“balanced” verdict based only on equal expected values or one successful automated route.

### E10 - evidence provenance and stale-state failure

Attempt to compare a capture from another build, restore a checkpoint after incompatible content,
submit a stale expected revision, reuse a command ID for a different request, and align traces with
different sampling. Each operation must fail with structured recovery guidance and change nothing.

### E11 - privacy-safe play evidence

Record and export a run and consented playtest while a terminal and other desktop applications are
present. The result may include only the game canvas/offscreen debug output and structured project
facts. It must exclude terminal/shell prompt, username, host name, private path, notifications,
messages, credentials, Studio chrome and unrelated apps. Redaction and retention results are part of
the manifest.

### E12 - quality gate disagreement

Provide a technically green run with sharp visuals and good performance but weak player choices,
unclear goal, or no desire to continue. Automated QA approves only the technical claims. An
independent reviewer records the quality failure and a human creative owner makes the publish call.
The system must preserve the disagreement instead of collapsing it into one score.

## Evidence ladder and claim policy

| Evidence class | Can support | Cannot support alone |
| --- | --- | --- |
| A - source/schema | Intended rules, ownership, declared ranges, contracts | Runtime behavior or player experience |
| B - deterministic headless/run trace | State transitions, invariants, reachability under traces, regression | Appearance, motion communication, human comprehension or fun |
| C - correlated runtime/render | Actual canvas motion, camera/feedback timing, diagnostics, performance on a target | Representative player response or long-term value |
| D - accessibility/device validation | Supported paths and observed barriers on target configurations | Every player's experience or preference |
| E - representative human study | Comprehension, control perception, preference, qualitative why for that sample/context | Population-wide retention or causal live-product effects without adequate design |
| F - consented telemetry/experiment | Behavioral patterns, funnels and causal experiment estimates within scope | Motivation, ethics, creative quality, or why without qualitative evidence |

Every quality claim in an evidence bundle should name its required classes and current status.
“Build passes,” “events occurred,” “canvas looks busy,” “FPS is 60,” and “the agent played it” are
never synonyms for “the game is compelling.”

## Recommended first delivery slice

Use Traversal Study for the platform mechanics, but do not present its current attract loop as the
design target:

1. Publish action and mechanic contracts for move/jump plus player metrics and platform/hazard
   IDs.
2. Add semantic trace injection, checkpoint at course start, fixed seed, and bounded run capture.
3. Expose movement/controller state, jump buffer/coyote consumption, contacts/support, camera state,
   route/teaching markers and failure reason.
4. Make platform/jump/camera values registered sandbox tunables with readback and correction.
5. Compare two control/camera variants over exact traces and canvas-only clips.
6. Add one genuine player choice, explicit goal, failure/retry and teach/practice/test beat so the
   slice can support a human test.
7. Run a blind first-session comparison. Preserve observations, contradictions, and the human
   publish/no-publish decision.

Then apply the same service to Combat Arena. If the service cannot express both without hard-coded
MCP tools, it is too fixture-specific. If it can express only generic JSON with no mechanic/domain
semantics, it is too shallow.

## Local source map

- CLI: [Tools](../../../packages/cli/src/mcp/tools.ts), [development types](../../../packages/cli/src/development/types.ts), [client](../../../packages/cli/src/development/browser-client.ts), [game host](../../../packages/cli/src/host/game-server.ts), and [actions](../../../packages/cli/src/host/actions.ts).
- Framework: [game port](../../../packages/framework/src/game/host.ts), [session contract](../../../packages/framework/src/sessions/engine-session/contract.ts), [runtime](../../../packages/framework/src/sessions/engine-session/runtime.ts), [world](../../../packages/framework/src/inspection/world.ts), and [events](../../../packages/framework/src/inspection/events.ts).
- Combat: [simulation](../../../packages/demos/antiky/combat-arena/src/simulation.ts), [inspection](../../../packages/demos/antiky/combat-arena/src/inspection.ts), and [presentation](../../../packages/demos/antiky/combat-arena/src/presentation.ts).
- Traversal: [simulation](../../../packages/demos/antiky/traversal-study/src/simulation.ts), [inspection](../../../packages/demos/antiky/traversal-study/src/inspection.ts), and [presentation](../../../packages/demos/antiky/traversal-study/src/presentation.ts).
- Antiky Town: [character motor](../../../packages/demos/antiky/antiky-town/src/town/physics/character-motor.ts) and [composition](../../../packages/demos/antiky/antiky-town/src/composition.ts).
- [BroMetal dependency](../../../packages/demos/antiky/combat-arena/package.json).
- Architecture: [Framework](../../architecture/framework/overview_A.md) and [Studio](../../architecture/studio/overview_A.md).
- ADRs: [one shared API](../../adr/framework/0003-agent-native_H.md) and [explicit inputs](../../adr/framework/0013-explicit-simulation-inputs_H.md).
- Skill research: [game design/UX](../skill-research/game-design-ux.md) and [recommended library](../skill-research/recommended-library.md).

## Final recommendation

Build the next inspection slice around **reproducible player intent**, not around another entity
type or visual effect. Once an agent can start from an exact checkpoint, inject named actions,
observe step-aligned gameplay domains, capture canvas-only motion, tune through validated sandbox
commands, and compare against a baseline, Antiky's existing deterministic and identity foundations
become genuinely useful for game design.

Keep the quality gate deliberately plural: source contracts, deterministic behavior, correlated
motion, accessibility/device validation, and representative human play answer different questions.
Antiky should make each form of evidence easier to obtain and harder to mislabel. It should never
turn technical observability into an automated claim that a game is worth playing.
