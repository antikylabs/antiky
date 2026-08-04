# Antiky Town Implementation Plan

**Status: Slices 00 and 01 direction approved**

## Goal

Port the current BroMetal Town into a real Antiky Framework consumer. Keep the current demo as a
working reference during the port.

The port must grow through complete features. It must not begin with a broad engine rewrite.

Use [`slice-list.md`](slice-list.md) for the short active sequence. Update that list after every
slice run. This document keeps the design context and alternatives.

## Baseline

The current `brometal-town` implementation owns all simulation, town data, render preparation, and
BroMetal calls. It remains available through the `town-study` route.

The first complete framework feature must prove this path:

```text
intent
  -> validated command
  -> accepted event or temporary update
  -> authoring state
  -> runtime state
  -> render state
  -> BroMetal update
  -> inspection and undo
```

The early event history can stay in memory. The early connection can use typed values in one
process. Database and production network work are outside the first slices. Studio is a later
visual client of the same engine services.

Slice 0 starts `@antiky/cli` and the framework inspection service. The CLI reports development and
build facts. The framework reports runtime, render, and diagnostic facts. MCP adapts the same
service surface that CLI, Studio, and tests use.

Later slices extend the framework service with world, entity, asset, clock, selection, command, and
history operations.

Read [`DEV_HARNESS_RESEARCH_A.md`](DEV_HARNESS_RESEARCH_A.md) for the engine research and Slice 0
design. Read [`INSPECTION_TOOLING_A.md`](INSPECTION_TOOLING_A.md) for the accepted native inspection
scope.

## Rules for every slice

- Keep `brometal-town` runnable as the reference.
- Add a complete behavior before a general abstraction.
- Add tests at each new boundary.
- Keep framework core free of DOM, React, BroMetal, and website imports.
- Keep stable IDs out of compact runtime and render indexes.
- Do not serialize data between normal modules in one process.
- Preserve the current town appearance unless a selected slice explicitly changes it.
- Record measurements before an optimization changes data structures.
- Supply machine-readable evidence through the shared framework service. A screenshot is
  supporting evidence, not the only evidence.
- State the reload effect for every changed source, shader, asset, or configuration boundary.
- Finish and commit one slice before the next slice starts.

## Slice directions

Each slice puts its plan, owner input, and delivery outputs in a separate `slice-NN/` folder. The
slice plan links its `owner-input_H.md` file as required reading.

The owner approved the Slice 00 harness direction and the Slice 01 reusable point-light direction.
For Slices 2 through 6, the recommended sequence is `2A, 3A, 4A, 5A, 6A`.

The choices are starting directions. A later measured need can justify a different implementation.

| Slice | Selected or recommended | Other choices |
| --- | --- | --- |
| 0. Development harness | Selected: current host plus `@antiky/cli` and native framework inspection | Dedicated Vite host; framework-owned web server |
| 1. First complete object | Selected: reusable point-light feature with one visible lamp | 1B. Small generic registry; 1C. Full ECS first |
| 2. Session and clock | 2A. Minimal fixed-step session | 2B. General scheduler; 2C. Demo-owned clock |
| 3. Character simulation | 3A. Move the reusable motor | 3B. Add a demo adapter; 3C. Define physics services first |
| 4. Town content | 4A. Compiled town asset with owner entities | 4B. Entity-rich town; 4C. One opaque town entity |
| 5. Rendering | 5A. Town-specific BroMetal adapter | 5B. Generic render lists; 5C. General render graph |
| 6. Selection workflow | 6A. CPU selection with stable owner mapping | 6B. GPU ID pass; 6C. Hierarchy-only selection |

## Preconditions for all slices

Do not start a slice until all of these statements are true:

- The slice owner-input file is answered when the slice needs owner judgment.
- All earlier slices pass their completion criteria.
- The reference behavior and measurements for this slice are recorded.
- The visible outcome, structured inspection evidence, and failure behavior are explicit.
- Required runtime schemas and stable IDs are selected or included as work in the slice.
- Required MCP resources and tools already exist, or their contracts and implementation are part of
  the slice.
- The reload and reconnect effect is defined for every file type that the slice adds.
- Tests are named before implementation. A reported failure gets a failing regression test first.
- Any open ADR question that changes ownership or public contracts for this slice is resolved.
  Unrelated ADR research does not block the slice.
- The slice has one command that runs its complete verification set.

## Acceptance criteria for all slices

Each slice must meet every applicable category. Its own evidence section adds feature-specific
checks.

| Category | Required evidence |
| --- | --- |
| Visible result | A human can reach the configured URL and observe the intended behavior. |
| Structured result | An agent can query the relevant IDs, revisions, values, and diagnostics without reading pixels. |
| Correctness | Unit, contract, and integration tests cover success and failure paths. |
| Reload | A relevant file change has a defined update, restart, or no-reload result. |
| Recovery | Invalid input or a failed compile keeps the last valid state when that is safe. |
| Lifecycle | Start, reconnect, reload, dispose, and process shutdown release owned resources once. |
| Performance | The slice records its relevant time, count, or byte measurements and checks approved limits. |
| Security | Local services bind narrowly; reads do not change state; changes use explicit authority. |
| Reference | Intended parity or an approved difference from `brometal-town` is recorded. |
| Completion | Documentation, test output, inspection output, and the verification command are available. |

## Slice readiness and inspection growth

The names below are proposed MCP names. The stable requirement is the meaning of each operation.
CLI, Studio, MCP, and tests must call the same typed inspection and command services.

| Slice | Required before work starts | Structured interface required by completion |
| --- | --- | --- |
| 0 | Answered owner input, Node 22, installed workspaces, a supported WebGPU browser, and a working reference route | Development, build, runtime, render-stat, and diagnostic resources; controlled reload and frame-capture tools |
| 1 | Slice 0 is green; lamp baseline, stable-ID rules, component schema, command limits, and permission test identities exist | Entity list and entity inspection; command result, revision, render binding, and undo evidence |
| 2 | Slice 1 is green; fixed step, long-frame limit, and pause rules are approved | Session and clock state; pause, resume, and single-step tools |
| 3 | Slice 2 is green; recorded movement input, collision baseline, and actor IDs exist | Actor state, simulation step, state digest, and active simulation diagnostics |
| 4 | Slice 3 is green; town content hash, compile validation, and selectable-owner policy exist | Asset list and inspection, dependency and compile state, and owner-to-compiled-range evidence |
| 5 | Slice 4 is green; visual, pass, draw, upload, and disposal baselines exist | Render-pass list, resource dependencies, render diagnostics, and GPU capture evidence |
| 6 | Slice 5 is green; selectable bounds or ID-pass input and expected hit records exist | Selection get/set, entity inspection, command submission, and correction-based undo |

Playwright MCP is not a precondition. Browser screenshots remain useful for visual review. Antiky's
own inspection service supplies semantic evidence. Native Antiky diagnostics and BroMetal test
instrumentation supply low-level render evidence.

## Slice 0: Development harness and minimum inspection

The executable contract is [`slice-00/plan.md`](slice-00/plan.md). The accepted owner decisions are
in [`slice-00/owner-input_H.md`](slice-00/owner-input_H.md). Slice 00 is ready to start.

### Outcome

Run the selected game with `antiky dev`. Read a versioned configuration file, use strict local
ports, watch source and shaders, and keep one development session alive across browser reloads.

Publish engine facts through the framework inspection service. Publish process and build facts
through the CLI development host. Give CLI, Studio, MCP, and tests one service surface.

Slice 0 does not add the Antiky world model. It reports only facts that the current host and demo can
truthfully supply.

### Current Next.js host plus Antiky CLI — Recommended

Keep the current demo route and Next.js host. Add `@antiky/cli` for configuration validation,
shader watching, service health, runtime connections, and child-process cleanup.

Add the first headless inspection contract and service to `@antiky/framework`. The CLI reads the
framework facts. It does not calculate game facts itself.

Benefits:

- Keeps the working reference visible.
- Adds the smallest new process surface.
- Proves the development and inspection contracts before a host migration.

Costs:

- The first harness remains coupled to the website host.
- Source updates can restart the complete browser runtime.

### Dedicated Vite game host plus Antiky CLI

Move Antiky Town to a canvas-only Vite entry. Keep the same supervisor and inspection contracts.

Benefits:

- Gives direct game-entry and HMR control.
- Matches common Phaser and Three.js development workflows.

Costs:

- Adds a host migration before the first framework behavior.
- Requires a new boundary between the website and game host.

### Framework-owned web server and reload system

Build Antiky-specific file serving, dependency watching, reload messaging, asset invalidation, and
error display.

Benefit:

- Gives Antiky full control.

Costs:

- Recreates mature web-development features.
- Delays the first game-framework result and adds long-term maintenance.

### Slice 0 evidence

- `antiky dev` loads `antiky.config.json`, validates its schema, and prints the resolved config path,
  game URL, inspection URL, and development-session ID.
- The default host is `127.0.0.1`. Network binding requires an explicit config change.
- A configured strict port is used exactly. A busy or invalid port produces a stable error code and
  starts no partial session.
- The configured game route reaches a canvas and reports WebGPU initialization success or a
  structured failure.
- A watched TypeScript change causes a successful host update or browser-runtime restart. The
  runtime-instance ID changes when the runtime restarts.
- A valid WGSL change compiles and updates the browser. An invalid WGSL change reports a diagnostic,
  keeps the last good compiled output, and does not crash the supervisor.
- The build revision changes only after a successful source, shader, asset, or config update.
- The development-session ID stays stable when the browser reloads or reconnects.
- Ten consecutive valid fixture edits each produce a newer build revision and a ready runtime within
  ten seconds. The integration test reports median and slowest update-to-ready time.
- MCP resources report service health, latest build, runtime state, render statistics, and active
  diagnostics without a screenshot or DOM query.
- Direct framework inspection, CLI inspection, MCP, and a Studio-compatible client report the same
  engine facts.
- At least one selected agent client can discover the running session and read every Slice 0
  resource. If that client does not support Streamable HTTP, Slice 0 supplies a stdio adapter.
- The controlled-reload tool returns the old and new runtime-instance IDs or a structured failure.
- Frame capture includes the development-session ID, runtime-instance ID, and build revision.
- Structured results are versioned and bounded. Large collections use pagination or summaries.
- The service does not expose React state, DOM objects, BroMetal objects, or raw GPU objects.
- An integration test starts the harness on reserved test ports, connects a fixture runtime, changes
  a watched fixture, observes a new successful revision, and verifies reconnect behavior.
- Contract tests cover malformed config, unknown fields, occupied ports, invalid runtime messages,
  shader failure, disconnect, reconnect, and unauthorized MCP requests.
- The HTTP endpoint validates `Origin` and a per-session credential. The credential does not appear
  in URLs, logs, diagnostics, or normal inspection results.
- `Ctrl-C` and normal child failure stop every owned process, close the inspection endpoint, and
  release both ports.

## Slice 1: First complete object

The executable contract is [`slice-01/plan.md`](slice-01/plan.md). The accepted owner decisions are
in [`slice-01/owner-input_H.md`](slice-01/owner-input_H.md). Slice 01 remains blocked only until
Slice 0 is complete.

### Outcome

Move one market lamp through the complete framework path. Give the lamp a stable `EntityId`, a
label, a transform, and a point-light component.

Build a reusable point-light service that supports multiple lamps by stable ID. Use the market lamp
as its first visible consumer.

Add one command that changes its power. Validate identity, permission, value limits, request ID,
and expected revision. Record an accepted in-memory event. Support inspection and correction-based
undo.

Project the accepted value into runtime and render state. Update the matching practical-light slot
without rebuilding town geometry.

### 1A. Reusable point-light feature — Selected

Build the point-light types, commands, and service needed to add more lamps. Let the service own
multiple lamp records by stable ID. Use typed maps and explicit functions. Keep storage private.
Wait for another feature type before adding a generic registry or entity-component-system.

Benefits:

- Supports more lamps without a new service for each lamp.
- Easy to compare with the current practical-light uniforms.
- Avoids choosing final component storage too early.

Costs:

- Some code can change after a non-light feature proves a broader boundary.
- Early APIs remain intentionally specific to point lights.

### 1B. Small generic registry

Create generic entity, component, command, event, and state-copy registries before the lamp feature.
Use the lamp as their first consumer.

Benefits:

- The second feature can reuse more infrastructure.
- Public concepts appear early.

Costs:

- The first slice has more code and more unproven interfaces.
- Generic types can hide feature behavior.

### 1C. Full ECS first

Select or build component storage, queries, archetypes, scheduling, and change tracking before the
lamp feature.

Benefits:

- Establishes a data-oriented base immediately.
- Can support later high-volume entities.

Costs:

- Chooses an open architecture question without measurements.
- Delays the first visible framework result.
- Creates the highest rework risk.

### Slice 1 evidence

- A headless test accepts one valid command and rejects invalid, duplicate, stale, and unauthorized
  commands without changing state.
- A second headless point light uses the same service. Changing one light does not change the other.
- Replay and correction-based undo produce the expected authoring state.
- A complete state rebuild matches the small state updates.
- Inspection returns the lamp ID, label, components, revision, and render binding.
- MCP entity inspection returns the same lamp record as the headless framework query.
- Command rejection and undo results include stable codes and related request, entity, and revision
  IDs in the development diagnostics.
- The default lamp value matches `brometal-town`.
- One accepted change marks only the lamp render entry as changed.

## Slice 2: Session and fixed-step clock

### Outcome

Introduce `EngineSession` ownership of command order, revisions, clocks, state copies, and system
execution. Pause, resume, and single-step operations must preserve state.

### 2A. Minimal fixed-step session — Recommended

Use one ordered list of typed system functions. Give each function explicit time, inputs, and state.
Add dependency ordering only when a real conflict appears.

Benefits:

- Simple execution order.
- Easy repeatability tests.
- Low framework surface area.

Costs:

- Later systems might require a richer scheduler.

### 2B. General system scheduler

Add phases, priorities, dependencies, and automatic ordering before moving actor simulation.

Benefits:

- Makes complex ordering explicit.
- Can support parallel or conditional systems later.

Costs:

- Solves needs that the current town does not have.
- Scheduler rules can become a second programming model.

### 2C. Keep the clock in the demo

Let the demo continue to calculate elapsed time. Use the framework only for commands and authored
state.

Benefits:

- Lowest immediate migration cost.

Costs:

- Does not prove session authority.
- Makes pause, replay, headless tests, and online simulation harder later.

### Slice 2 evidence

- Fixed inputs and step counts produce the same state digest.
- Long frames have a tested step limit.
- Pause and single-step do not reset or rebuild the world.
- Render timing can differ from simulation timing.
- Session inspection reports mode, clock state, fixed step, completed step count, world revision, and
  runtime-instance ID.
- MCP pause, resume, and single-step tools call the same session operations as headless tests.
- Headless framework tests do not import browser or BroMetal code.

## Slice 3: Character simulation

### Outcome

Move hero and NPC movement under `EngineSession`. Keep input temporary. Do not add movement frames
to durable history.

### 3A. Move the reusable character motor — Recommended

Move the generic character motor and its tests into the framework. Keep the town ground and
collider adapter in `antiky-town`.

Benefits:

- Reuses a tested deep module.
- Separates generic motion from town geometry.
- Gives the framework a real fixed-step consumer.

Costs:

- The existing motor API becomes an early framework API candidate.
- Imports and ownership need careful review.

### 3B. Keep the motor private and add a session adapter

Copy or move the motor into `antiky-town`. Let the framework call it through one system function.

Benefits:

- Avoids a public framework commitment.
- Keeps the first session integration narrow.

Costs:

- Reusable physics stays in a demo.
- A later move can cause more import changes.

### 3C. Define physics services first

Create framework interfaces for queries, bodies, contacts, and character control. Adapt the current
motor to those interfaces.

Benefits:

- Creates an explicit physics boundary.
- Can support another physics implementation later.

Costs:

- The town supplies only one proven implementation.
- A broad interface can expose the wrong concepts.

### Slice 3 evidence

- The hero follows the same input and collision rules as `brometal-town`.
- NPC paths remain repeatable for fixed inputs and step counts.
- Runtime indexes do not enter durable events or inspection output as persistent IDs.
- The renderer reads prepared actor state and does not update actor simulation.
- Actor inspection reports stable actor IDs, current movement state, simulation step, and the state
  digest used by repeatability tests.
- Existing character-motor regression tests remain effective after the move.

## Slice 4: Town content and compilation

### Outcome

Move the static town through framework-owned asset and authoring concepts. Keep individual voxels
and generated triangles out of the entity model.

### 4A. Compiled town asset with owner entities — Recommended

Keep the deterministic town builder as a compiler. Store its mesh, collision, foliage, water, and
prop outputs as compiled asset data. Create entities only for meaningful selectable owners.

Benefits:

- Preserves current deterministic generation.
- Matches the architecture rule for specialized high-volume data.
- Supports selection without one entity per voxel.

Costs:

- Requires an explicit map from compiled ranges to owner entities.
- Some current builder output needs clearer ownership metadata.

### 4B. Entity-rich town

Represent each building, stall, bridge section, lamp, prop, and vegetation group as an entity before
compilation.

Benefits:

- Strong inspection and editing detail.
- Clear ownership before compilation.

Costs:

- Large migration before visual parity.
- Can create many low-value entities and component types.

### 4C. One opaque town entity

Treat the complete generated town as one asset on one entity. Add finer owners only when another
slice needs them.

Benefits:

- Fastest path to framework ownership.
- Smallest initial authoring model.

Costs:

- Weak selection and editing.
- Defers the most important ownership questions.

### Slice 4 evidence

- The compiled geometry and validation results match the reference baseline.
- A complete rebuild produces the same content hash.
- Stable owner IDs map to selected compiled objects.
- Asset inspection reports source and compiled versions, dependencies, validation results, content
  hash, and affected stable owners.
- No individual voxel, vertex, triangle, or GPU resource becomes an entity.
- Static asset data uploads only when its version changes.

## Slice 5: Render preparation and BroMetal adapter

### Outcome

Move render preparation out of gameplay code. Keep BroMetal resource creation, updates, draw calls,
and disposal behind an adapter.

### 5A. Town-specific BroMetal adapter — Recommended

Create the smallest adapter that can draw the current town from prepared render state. Preserve the
existing programs and pass order.

Benefits:

- Keeps visual risk low.
- Lets real shadow, scene, and post passes shape future interfaces.
- Avoids a general renderer before a second game exists.

Costs:

- Some adapter code remains town-specific.
- Reuse appears only after later extraction.

### 5B. Generic render lists

Define common sprite, mesh, voxel, light, and pass records first. Convert the complete town to those
records.

Benefits:

- Gives later demos reusable render inputs.
- Makes render state easy to inspect.

Costs:

- Requires more conversion work.
- Can force unrelated draw types into shallow common records.

### 5C. General render graph

Build pass declarations, resource dependencies, ordering, inspection, and lifecycle management
before the town adapter.

Benefits:

- Makes pass and resource relationships explicit.
- Prepares advanced inspection and hot replacement.

Costs:

- Highest implementation and migration cost.
- The first API would come from only one real pass graph.

### Slice 5 evidence

- Framework core compiles without BroMetal, DOM, or React imports.
- Shadow, scene, and post output stay within the selected visual baseline.
- Draw count and per-frame upload measurements do not regress without approval.
- Render inspection reports pass order, resource dependencies, draw counts, upload bytes, active
  shader revisions, and related diagnostic IDs.
- Native Antiky diagnostics and BroMetal tests verify GPU validation results and the expected pass
  and draw structure without making GPU state authoritative.
- Failed resource creation preserves the last valid resources.
- Disposal releases each owned resource exactly once.

## Slice 6: Selection and editing workflow

### Outcome

Select a stable entity in the running town. Inspect it, change it through a command, undo the
change, and resume simulation without resetting the session.

### 6A. CPU selection with stable owner mapping — Recommended

Use existing collision or simple bounds where possible. Map the hit to the stable owner of the
compiled data.

Benefits:

- Reuses CPU data that the town already needs.
- Easy to test without a GPU.
- Supplies hit position and surface information.

Costs:

- Detailed mesh and transparent-object selection can need more work.

### 6B. GPU object-ID pass

Render a stable selection alias for each selectable draw. Read one pixel when the user selects the
canvas.

Benefits:

- Matches visible geometry closely.
- Works across many render shapes.

Costs:

- Adds a render pass and readback behavior.
- Headless selection needs a separate method.

### 6C. Hierarchy-only selection first

Allow selection through inspection queries or a future hierarchy. Add canvas selection later.

Benefits:

- Proves command and inspection workflows with little render work.

Costs:

- Does not complete the intended in-scene workflow.
- Delays validation of compiled-data owner mapping.

### Slice 6 evidence

- Canvas and query selection return the same stable entity when both methods apply.
- Inspection shows components, assets, state-copy revisions, and render dependencies.
- MCP selection and direct query selection return the same stable target and revision.
- A command from the selected entity follows the same validation path as a direct API command.
- Undo creates a correction event and restores the intended value.
- Pause, edit, undo, and resume preserve simulation state.

## Work after Slices 0-6

Continue in this order unless measurements or new ADRs change the priority:

1. Port the remaining authored lights, props, awnings, water, foliage, and actor definitions.
2. Add complete rebuild and small-update parity tests for every state copy.
3. Add versioned asset manifests, dependency tracking, and safe resource replacement.
4. Add durable event-store and snapshot adapters behind the proven in-memory contracts.
5. Add schema conversion tests for supported old command, event, and snapshot versions.
6. Expand the development MCP with any world operations that the first six slices did not need.
7. Add Studio hierarchy, inspectors, pause controls, and editor-camera ownership.
8. Add contextual feedback targets and the shared review queue.
9. Add sandbox creation, validation evidence, conflict detection, and command-based promotion.
10. Add online session hosting only after local session authority and replay tests are stable.
11. Replace maps with compact storage only where profiles show a measured problem.
12. Retire or rename the `town-study` route only after Antiky Town reaches agreed parity.

## Completion definition

Antiky Town replaces the reference only when it meets the selected behavior, visual, performance,
inspection, replay, and lifecycle gates. Until then, both demos remain separate and runnable.

Record each selected direction in this file or a linked decision before implementation starts.
