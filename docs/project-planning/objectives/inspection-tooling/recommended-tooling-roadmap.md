# Recommended inspection-tooling roadmap

Research snapshot: 2026-08-09

This roadmap turns the [capability gap matrix](capability-gap-matrix.md) into incremental Antiky
Framework, CLI, MCP, Studio, and BroMetal work. It is direction, not an approved implementation
plan. Each phase still needs a real game slice, design, tests, and an owner.

The existing seed skills are disposable scaffolding, not compatibility requirements. External
engine skills and integrations inform patterns and failure cases only; this roadmap builds no
Unity, Unreal, or Godot support.

## Decision

Three implementation shapes were considered.

| Shape | Advantage | Failure mode | Decision |
| --- | --- | --- | --- |
| One MCP tool per object and property | Obvious for the first demo | Tool explosion, duplicated validation/authority, inconsistent results, shallow APIs, costly discovery | Reject beyond narrowly proven special cases |
| One generic script/eval tool | Maximum apparent flexibility | Bypasses schemas and authority, arbitrary code, weak readback, poor auditability, large blast radius | Reject as the normal path |
| A few deep typed Framework services adapted into capability-grouped tools | Shared rules, bounded discovery, reusable UI/tests, consistent authority and evidence | Requires careful schemas and complete slices | Adopt |

The point-light tools are a successful vertical slice, not the template for hundreds of
`set_<component>_<field>` tools. The next step is to generalize the deep boundaries the slice
proved: typed schema, semantic query, named command, expected revision, authority, accepted fact,
projection readback, correction, and evidence.

## Target shape

```text
human / Studio / agent / test / CI
              |
     task-oriented typed services
              |
 capability discovery + policy decision
              |
 query | change set | sandbox | scenario | evidence | jobs
              |
         EngineSession single writer
      +----------+----------+----------+
 authoring     runtime     render state
      |          |              |
 commands     systems       RenderDriver
 events       subsystems       BroMetal
```

Framework owns semantic contracts and policy inputs. The CLI owns project/process/build/connection,
local capability grants, artifact persistence, and transport. Studio owns presentation, selection
intent, workspace state, and human approvals. MCP adapts the same services. BroMetal remains below
Antiky's render boundary.

## Common protocol contracts

Before adding broad domain tooling, establish a small common vocabulary.

### `ContextRef`

Every operation and artifact should identify the applicable subset of:

- project manifest path and content revision;
- development session and accepted build revision;
- engine session, world, runtime instance, and world revision;
- sandbox/change-set/scenario/job identity;
- Framework, BroMetal, tool-schema, component-schema, and asset-registry versions;
- target environment and renderer profile.

An unavailable identity is explicit. A client never infers that two captures or snapshots describe
the same runtime from filenames or timestamps.

### `TargetRef`

One versioned target union should serve queries, selection, feedback, permissions, changes,
diagnostics, and evidence. Initial target kinds can include:

- world, zone, entity, component, component property, and relationship;
- asset and asset revision;
- system, command, event, diagnostic, and scenario checkpoint;
- render item, material, shader, pipeline, pass, and resource;
- specialized sub-item with a stable owner entity or asset.

Temporary aliases and screen/world hit details are evidence. They do not replace persistent IDs.

### `Page<T>` and `PartialStatus`

Every potentially large read needs deterministic ordering, a bounded page size, cursor, available
and retained counts, source revision, and explicit completeness. Clients must not mistake a bounded
response for the entire world.

### `PolicyDecision`

Every privileged operation should record principal/task identity, requested capability, semantic
and path scope, decision, reason code, expiry, approval identity when applicable, and policy
revision. The transport does not create permissions.

### `ChangeSet`

A change set groups ordered commands with:

- stable identity and owner;
- base world/project/schema revisions;
- declared semantic targets and file paths;
- previewed authoring/runtime/render/asset effects;
- validation warnings and policy decisions;
- atomicity and partial-failure policy;
- command results, accepted facts, postcondition queries, and evidence;
- correction/revert relationship rather than deleted history.

### `ScenarioRun` and `EvidenceBundle`

A scenario run records setup, seed, fixed-step input trace, commands, checkpoints, assertions,
diagnostics, performance samples, captures, asset/build identities, environment, and result. An
evidence bundle references immutable artifacts and hashes; it does not embed unlimited logs,
captures, or private paths.

### `DevelopmentJob`

Imports, builds, shader compilation, profiling, long scenario runs, visual comparisons, and target
device work cannot rely on one synchronous request timeout. Use one bounded async job protocol:

- submit with idempotency key, context, capability grant, inputs, outputs, and limits;
- query status/progress/diagnostics;
- cancel when safe;
- return exact artifacts, hashes, logs, and final state;
- survive client disconnect without losing durable result identity;
- define whether cancellation leaves staged output and how cleanup works.

## Provisional shared service and MCP surface

Exact names should be finalized by the first complete workflows. The goal is a small surface where
each operation is deep enough to serve CLI, Studio, MCP, tests, and skills.

| Capability group | Provisional operations | Notes |
| --- | --- | --- |
| Context | `get_development_capabilities`, `get_project_context` | Return feature groups, schemas, versions, limits, authority classes, current identities, and unavailable reasons |
| Semantic inspection | `query_world`, `get_target_context`, `diff_world` | Filters/paging/field selection and target-scoped readback replace repeated whole-world transfer |
| Authoring | `preview_change_set`, `apply_change_set`, `correct_change_set` | Named registry commands only; expected revisions, capability grant, readback, and journal are mandatory |
| Sandboxes | `create_sandbox`, `compare_sandbox`, `discard_sandbox`, `promote_sandbox` | Promotion produces ordinary validated commands against the current primary revision |
| Simulation | `run_scenario`, `get_scenario_run`, `compare_scenario_runs` | Supports headless runs, input trace, fixed steps, state/event assertions, diagnostics, and evidence refs |
| Selection | `set_selection`, `pick_canvas_target`, `capture_target_context` | Studio, hierarchy, canvas, and MCP share `TargetRef`; selection is temporary and non-authoritative |
| Assets | `query_assets`, `get_asset_context`, `validate_asset_change` | Stable assets/revisions, dependency graph, importer results, provenance, runtime/render bindings |
| Rendering | `get_render_context`, `run_render_profile`, `capture_visual_evidence` | Entity-to-render causality, shaders/materials/passes/resources, timing, controlled capture, comparison |
| Jobs | `submit_development_job`, `get_development_job`, `cancel_development_job` | One lifecycle for long work; job kind and capability define the actual operation |
| Audit | `get_change_journal`, `export_evidence_bundle` | Permission-filtered, bounded, correlated, redacted, and hash-stable |

Specialized subsystem services can extend `query_world`, `get_target_context`, scenario evidence,
and registered commands before they need separate MCP groups. A separate tool is warranted when the
job has distinct lifecycle, data volume, safety, or performance behavior - not because a new
component type exists.

## Phase 0 - freeze the current baseline

Before generalizing, turn the existing behavior into a versioned baseline.

### Work

- Document one machine-readable capability response for all 17 current tools, schemas, limits,
  annotations, current runtime availability, and required call ordering.
- Add common `ContextRef`, `TargetRef`, paging/completeness, policy-decision, job, change-set,
  scenario-run, and evidence-manifest schemas at the proper ownership boundaries.
- Define compatibility and migration rules. Current per-tool `schemaVersion: 1` values are not a
  substitute for a coherent tool-schema identity.
- Make current MCP action classification and authority explicit, including which operations mutate
  authoring, runtime control, files, captures, or external state.
- Replace absolute capture paths in default MCP results with opaque artifact IDs and a separately
  authorized metadata lookup; ensure logs and evidence exports cannot reintroduce private paths.
- Expose an authorized, non-recursive audit/evidence read path without causing the call log to log
  itself indefinitely.
- Record no-tool/no-skill baselines for representative tasks.

### Proof fixture

Use the existing point-light slice. A client must discover, inspect, change, read back, correct,
replay, and audit one light without private engine objects or hidden authority.

### Exit criteria

- All current capabilities and unavailable states are discoverable without reading source.
- Every result carries compatible context identity and strict schema validation.
- Mutation and capture policy is visible before the call.
- Unknown, stale, oversized, unauthorized, and disconnected cases remain fail-closed.
- A complete evidence chain links MCP call, action, command, fact, state projections, capture, and
  correction.

## Phase 1 - semantic inspect/edit loop

Generalize from the point light to framework-owned world data.

### Work

- Implement the runtime component/relationship/command schema registry.
- Add filtered, paginated, field-selectable world queries and exact target context.
- Add revision diffs and a bounded delta subscription shared by typed clients and Studio.
- Implement generic named command batches with preview, expected revisions, scoped authority,
  results, readback, and correction.
- Add explicit mutation leases/change packets for local human, Studio, test, and agent work.
- Add first sandbox create/compare/discard/promote workflow only after the generic command path
  works on the primary world.

### Proof fixture

Use a purpose-built world-authoring fixture with more than one component type and relationship. A
task should create or modify an entity, move it in the hierarchy, change a render-relevant
property, inspect all state projections, compare a sandbox, and promote or discard the exact delta.
Existing demos may provide regression cases, but they are not the quality target for the slice.

### Exit criteria

- Studio, MCP, CLI, and tests use the same registry/query/command services.
- Large or truncated worlds remain queryable without pretending a page is complete.
- Generic editing does not expose a generic memory/property writer.
- Two stale or conflicting changes cannot silently overwrite one another.
- A sandbox can prove and promote one bounded change through normal authority.
- Framework core keeps its import boundaries.

## Phase 2 - deterministic scenario and evidence loop

Let an agent prove gameplay behavior instead of narrating success from code and screenshots.

### Work

- Define project-owned semantic input schemas and input-owner/focus state.
- Record and inject input traces through the same explicit simulation input boundary.
- Add headless-first scenario setup, seeds, commands, limited steps/duration, state/event
  assertions, diagnostics, checkpoints, and repeatability hashes.
- Add batch stepping through the scenario runner rather than multiplying interactive single-step
  calls.
- Add run comparison and first-divergence reporting.
- Store exact build/project/assets/tool/environment identity in every evidence bundle.

### Regression and proof fixtures

- Use Combat Arena and Traversal Study as narrow regression fixtures for movement, combat,
  traversal, failure/retry, camera behavior, and deliberately seeded defects.
- Prove the player-facing evidence contract on the new art-directed showcase: a coherent loop,
  intentional motion/camera/audio/UI, failure/retry, and a scenario an independent reviewer can
  actually play and judge.

### Exit criteria

- Three clean runs produce equal semantic checkpoints and declared tolerances.
- A seeded state, input, timing, or event defect is localized to its first divergence.
- Scenario runs work headlessly when rendering is not required.
- Visual evidence supplements - not replaces - state/event assertions.
- An interrupted or timed-out run leaves a queryable job result and cleans owned resources.

## Phase 3 - selection, assets, rendering, and motion evidence

Connect semantic intent to the actual asset and pixels the player experiences.

### Work

- Implement shared `SelectionService` and canvas picking with stable owner resolution.
- Implement stable asset identity/revisions, dependency and dependent queries, source/provenance,
  import status, runtime/render bindings, and staged validation.
- Generalize entity/asset-to-render-item mapping beyond point lights.
- Expose shader/material source and generated hashes, reflection, variants, bindings, diagnostics,
  hot-reload generation, and fallback state.
- Add render pass/resource inspection and explicit CPU/GPU profile jobs.
- Add controlled captures by scenario/time/camera/target/debug view, frame sequences or footage,
  color/encoding metadata, perceptual comparison, and final-delivery compression checks.

### Proof fixtures

- A new art-directed Antiky showcase slice: hierarchy/canvas selection, asset dependencies,
  authoring/runtime/render mapping, controlled motion footage, and intentional camera/presentation.
- A new BroMetal rendering study: shader compilation/reflection, materials, lighting/VFX, GPU
  resources, render passes, and target performance.
- Existing Antiky Town and Point Light Expo paths remain regression fixtures for compatibility,
  not evidence that the visual or gameplay quality bar has been met.

### Exit criteria

- Selecting a visible target resolves to its stable semantic owner and current asset/render
  context.
- An agent can explain which authored values, assets, shader variant, material, pass, and draw
  produced the selected result.
- Asset changes are staged, provenance-complete, deterministically imported, visually validated,
  and reversible.
- Capture payloads and metadata never expose terminal, desktop, username, host, personal path,
  notification, account, or unrelated application content; privacy-safe evidence is addressed by
  an opaque artifact ID rather than a local path.
- Motion evidence is clear at intended website/game delivery size and includes more than repeated
  views of one state.

## Phase 4 - representative game disciplines

Grow specialized inspection only through game features that need it.

### Candidate slices

- **Ability/combat:** definitions, activation, tags, cost/cooldown/effects, targeting, hit/damage,
  temporary signals, accepted facts, balance values, and causal trace.
- **Physics/traversal:** bodies/colliders, contacts, queries, authority, moving platforms, debug
  geometry, timings, and determinism.
- **Navigation/AI:** navigation queries, paths, perception, goals, decisions, behavior state,
  failure reasons, crowd budgets, and scenario traces.
- **Animation:** asset/rig/clip identity, graph state, transitions, root motion, contacts/notifies,
  gameplay causality, controlled playback, and performance.
- **Audio:** event routing, buses, voices, attenuation, concurrency, latency, streaming, loudness,
  synchronized evidence, and source rights.
- **Player UI/accessibility:** semantic UI state, focus/input graph, safe areas, localization
  expansion, text scale, contrast, reduced motion, announcements, and gameplay-linked evidence.
- **Game feel/camera:** input-to-state/pixel/audio latency, camera intent and collision, hit pause,
  animation/VFX/audio timing, readability, and before/after comparison.

### Exit criteria for each slice

- The game feature is worth having without the inspection feature.
- One typed deep service serves human UI, agents, tests, and diagnostics.
- Semantic state, temporary high-volume state, and durable events remain distinct.
- Headless behavior remains valid where rendering/audio is optional.
- The inspection helps find a seeded real defect that ordinary tests or static screenshots miss.
- Independent design/presentation review still decides player-facing quality.

## Phase 5 - production scale and release

Add these when an Antiky game has the corresponding production requirement:

- save/load, event persistence, snapshots, migration, corruption, and recovery;
- online session placement, players/ownership, replication, prediction/reconciliation,
  latency/loss, server/client traces, and multi-process scenarios;
- zones, streaming, visibility, handoffs, residency, and large-world budgets;
- target device/browser/GPU/driver/scalability matrices;
- performance, memory, loading, network, audio, and content budgets with percentile regression;
- localization registry, pseudo-localization, automated checks, and independent LQA;
- crash/minidump/log/symbol privacy and synthetic-failure verification;
- immutable build artifacts, SBOM/provenance, symbols, smoke tests, signing isolation,
  publication mapping, rollback, and incident evidence;
- contextual feedback queues linked to exact targets, proposed changes, validation, and resolution.

Do not build these as checklists alone. Each needs a production artifact, a typed service, a
repeatable scenario, a failure fixture, and human authority.

## Skill and agent implications

Skills should compose these services; they should not compensate for missing services with brittle
terminal scraping, arbitrary scripts, or screenshots.

| Skill job | Minimum tooling dependency |
| --- | --- |
| Build Antiky gameplay | Capabilities, schema registry, world query, command/change set, sandbox, scenario evidence |
| Author Antiky worlds | Target/selection, hierarchy/query, schema-aware edits, asset registry, sandbox, diffs, visual evidence |
| Build BroMetal rendering | Render/asset causality, shader/material inspection, profiles, controlled visual evidence, target environment |
| Produce content | Asset identity, provenance, deterministic import, dependencies, runtime/render validation, budgets |
| Tune game feel | Input trace, deterministic scenario, state/system timing, synchronized motion/audio evidence, run comparison |
| Test Antiky games | Scenario runner, assertions, diagnostics, evidence bundle, target environments, regression comparison |
| Review game quality | Creative brief, exact build/run identity, gameplay footage, state/performance evidence, blind rubric, no mutation |
| Ship an Antiky game | Artifact identity, complete test/performance/device/provenance/privacy evidence, approvals, rollback |

An agent cell should retain one live mutation owner. Parallel agents can operate isolated sandboxes,
content staging, research, test design, or read-only review. A mutation lease does not replace normal
Git/worktree ownership for source files.

## Evaluation program

Every service/tool addition needs:

- strict schema and boundary tests;
- positive, negative, stale, unavailable, truncated, denied, conflict, timeout, cancellation, and
  recovery cases;
- direct, typed-client, CLI, HTTP/MCP, Studio, and test parity where those adapters exist;
- clean-fixture repetition with stable hashes;
- one malicious project-data/prompt-injection case;
- one path/network/process/secrets/PII abuse case where applicable;
- one seeded game, presentation, or performance defect the capability must reveal;
- comparison with the prior manual/no-tool workflow;
- evidence that the interface stays deep and does not multiply with each component type.

Existing demos are technical fixtures. Add at least two purpose-built showcase slices with distinct
game loops and art directions. They should contain movement, goal, risk, failure, retry, teaching,
escalation, coherent world art, animation/VFX, audio, UI, an authored material, a deliberate camera,
and target-performance evidence. Judge them in motion and through representative play, not from a
single frame.

## Non-goals

- Claiming the tooling itself creates AAA quality.
- Exposing Framework internals, live objects, generic memory, or unrestricted property mutation.
- Moving game rules, world identity, or agent protocol into BroMetal.
- Making Framework core depend on MCP, Studio, Node, browser APIs, or a model provider.
- Building every accepted architecture idea before a game slice needs it.
- Treating terminal output, one screenshot, a successful build, or a self-review as sufficient
  evidence.
- Supporting Unity, Unreal, or Godot through Antiky skills or adapters.
