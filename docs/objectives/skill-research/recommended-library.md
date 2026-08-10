# Recommended Antiky game-development skill library

Research snapshot: 2026-08-09

This is the cross-report recommendation. It converts the engine, design, art, rendering,
production, and orchestration findings into a buildable first-party library and evaluation plan.

## Recommendation

Build a small portable Agent Skills surface backed by a stricter internal catalog, lockfile,
artifact schemas, engine adapters, and behavioral evals. Start with one deliberately scoped Godot
fixture to prove the production loop, then add Unreal 5.8 and Unity adapters without changing the
engine-neutral contracts.

The goal is not to simulate a large studio or maximize tool count. It is to make a small group of
agents reliably answer five questions:

1. Is this game idea and vertical slice worth building?
2. Does the approved implementation work in the real engine and runtime?
3. Is it understandable, responsive, coherent, accessible, and appealing in motion?
4. Can we prove its performance, provenance, privacy, and release readiness?
5. Can another agent reproduce the result without inheriting hidden context?

## Architecture choice

Three approaches were considered.

| Approach | Strength | Failure mode | Decision |
| --- | --- | --- | --- |
| One broad `make-a-game` skill | Simple discovery and invocation | Huge authority and context, opaque routing, impossible to diagnose or evaluate, self-approval | Reject |
| Hundreds of independent flat skills | Portable and individually understandable | Catalog truncation, collisions, inconsistent contracts, dependency drift | Use only as the published surface |
| Canonical monorepo with selected flat publication | Central policy/evals with small portable packages | Requires a deterministic catalog and publish step | Adopt |

The canonical repository should separate six concerns:

```text
game-skill-library/
├── catalog/       # ownership, versions, lifecycle, compatibility, dependencies
├── policies/      # permissions, editor lease, capture/privacy, provenance
├── schemas/       # briefs, handoffs, change manifests, replay/capture/review evidence
├── skills/        # portable Agent Skills packages
├── adapters/      # reviewed engine/DCC/MCP integration code and configuration
├── evals/         # trigger, procedure, fixture, runtime, visual, security suites
└── fixtures/      # small pinned projects and adversarial examples
```

Only the chosen locked packages should be published into `.agents/skills/`. Do not depend on
recursive discovery of the canonical tree, and do not expose the entire catalog to every session.

## Skill layers

### 1. Product and production

These skills establish why the work exists, what evidence it must produce, and where it should
stop:

- project intake and engine/platform constraints;
- game experience brief and core-loop contract;
- vertical-slice producer and scope/change control;
- art-direction brief and reference rubric;
- evidence index and milestone approval;
- release readiness and rollback.

They should be primarily read-only coordinators. A producer may reject, route, and rescope work; it
should not silently alter the creative pillars or approve its own implementation.

### 2. Player experience and design

These skills own testable player-facing intent:

- controls and input;
- game feel and camera/feedback;
- level blockout and spatial metrics;
- first-time user experience and onboarding;
- game UI/UX and accessibility;
- difficulty, balance, progression, and economy;
- human playtest research;
- telemetry and experiment design;
- player-trust and retention review.

Their outputs are mechanic contracts, maps, flows, hypotheses, tuning ranges, and research plans.
They do not claim fun or comprehension without runtime and representative-player evidence.

### 3. Art and content

These skills should establish a coherent target before generating or importing content:

- concept and art direction;
- environment, prop, and character design;
- 2D/UI asset production;
- 3D modeling, UV, bake, rig, animation, and LOD workflow;
- lighting, materials, textures, VFX, and cinematography;
- audio direction, sound effects, music, dialogue, and mix;
- asset ingest, provenance, licensing, and style consistency;
- independent art review at gameplay distance and in motion.

Creation belongs in staging. Accepted assets move into the engine only through a named import
owner and a recorded provenance/import manifest.

### 4. Engine knowledge

Keep durable, source-grounded engine knowledge distinct from bridge commands:

- `unreal-*` skills target a stated UE version and required plugins;
- `unity-*` skills target an Editor plus render-pipeline/package matrix;
- `godot-*` skills target an engine minor, renderer, and language;
- `antiky-*` skills describe BroMetal/project-native material, scene, input, runtime, and package
  contracts.

An engine skill should route to first-party documentation and project rules. It should not assume a
specific MCP tool name when the same workflow can survive adapter changes.

### 5. Privileged adapters

Adapters are the hands, not the brain. They provide typed operations for project inspection,
mutation, import, compile, test, play, state readback, capture, profiling, and build.

Every adapter must have:

- an exact engine/plugin/server/version identity;
- local transport and authentication policy;
- read and mutation capability groups;
- a project-root boundary and editor-instance identity;
- explicit arbitrary-code, network, delete, overwrite, build, and publish gates;
- a change journal and rollback/checkpoint identity;
- structured results and stable error behavior;
- a way to prove the plugin/bridge is absent from release builds.

Only one role may hold the mutation lease for a project or live editor. Unreal makes this mandatory
because MCP calls are serialized on the game thread; Unity and Godot also benefit because scenes,
imports, domain reloads, and shared editor state are concurrency barriers.

### 6. Verification and review

Verification skills should be independent of the authoring role:

- deterministic runtime replay and structured state assertions;
- engine-native tests and packaged-build smoke tests;
- shader/IR/import/reference validation;
- fixed-camera and fixed-time capture;
- game-window or viewport-only motion capture;
- performance, memory, loading, and GPU evidence;
- visual, game-feel, UX, accessibility, and art-direction review;
- crash/privacy, localization, compatibility, and release review.

A green build, static screenshot, or self-authored review is never the only approval evidence.

## First release

Keep the first release small enough to evaluate causally.

| Priority | Skill | Required output |
| --- | --- | --- |
| P0 | `game-project-intake` | Engine/version/renderer/platform map, project identity, dependency and risk inventory |
| P0 | `game-experience-brief` | Audience behavior, experience promise, loop, pillars, non-goals, success/failure questions |
| P0 | `vertical-slice-producer` | Representative slice scope, dependency graph, acceptance matrix, cut list, evidence plan |
| P0 | `game-design-contract` | Testable rules, controls, states, tuning ranges, onboarding and playtest hypotheses |
| P0 | `art-direction-contract` | Reference board, palette/value/shape/motion language, camera and quality rejection criteria |
| P0 | `editor-session-safety` | Verified project/instance, clean base, mutation lease, allowed operations, checkpoint, capture policy |
| P0 | `godot-game-change` | Bounded source/editor change, change manifest, import/parse/runtime result |
| P0 | `runtime-replay-evidence` | Build identity, deterministic input trace, state checkpoints, logs, viewport capture |
| P0 | `visual-game-feel-review` | Blind rubric, timestamped defects, severity, decision, no author rationale |
| P0 | `asset-ingest-provenance` | Source/license/hash/transformation/import manifest and accepted staged assets |
| P0 | `capture-privacy` | Scoped viewport/window capture and redaction report; blocks desktop-wide capture |
| P0 | `release-readiness` | Clean build/test/artifact evidence, performance result, provenance, rollback and approval status |

After that cell passes its evaluation suite, add:

- `unreal-game-change` using native UE 5.8 MCP first and a pinned VibeUE extension by domain;
- `unity-game-change` using official CLI/Pipeline as the conceptual baseline and a separately
  qualified live bridge;
- technical-art skills for shader compilation, materials, textures, lighting, VFX, GPU capture,
  and render goldens;
- controls, level design, onboarding, UI/UX, accessibility, human play research, telemetry,
  balance, localization, audio, performance, compatibility, and live operations.

## Normal subagent cell

Use three to five active roles for a normal milestone.

| Role | Authority | Output | Cannot approve |
| --- | --- | --- | --- |
| Producer/orchestrator | Route work, freeze scope, maintain risk/evidence | Brief, task graph, handoff envelopes, gate state | Its own creative or technical work |
| Designer or art director | Define player/visual intent and critique | Mechanic/art contract and bounded review | Implementation correctness or release |
| Implementer/editor operator | Exclusive owned paths and live-editor lease | Code/assets, change manifest, compile/import result | Its own runtime or quality gate |
| Runtime QA | Run packaged/editor scenarios and scoped capture | Replay, state, logs, captures, defects | Creative acceptance |
| Independent reviewer | Read-only access to brief, build, replay, captures | Blind quality review | Mutating the artifact under review |

Specialists such as technical artist, animator, audio designer, accessibility reviewer,
performance engineer, localization manager, and release engineer join only when the current stage
needs their artifact. They are not a permanently running hierarchy.

## Handoff contract

Every task should identify:

- task, project, engine, editor instance, base revision, and artifact owner;
- input paths and content hashes;
- selected skills and exact locked revisions;
- allowed paths, tools, mutation classes, network destinations, and processes;
- prohibited operations;
- public acceptance criteria and required evidence;
- engine barriers such as compile, import, reload, play mode, or editor restart;
- output paths and schema versions;
- rollback identity and escalation condition.

An agent may return a blocked handoff. It may not silently substitute a different engine,
acceptance criterion, asset source, capture target, or external service.

## Quality gate

Every representative playable change should pass these gates in order:

1. **Contract:** inputs, scope, permissions, provenance, and acceptance evidence are complete.
2. **Static/structural:** source compiles or parses, references/imports are valid, no forbidden
   files or editor-only dependencies ship.
3. **Runtime:** deterministic input reaches expected observable states with no unexpected logs or
   crashes.
4. **Presentation:** motion capture is clear at delivery size; materials, animation, audio, UI,
   camera, and feedback match the approved target.
5. **Player experience:** independent review checks goal comprehension, control response,
   readability, difficulty, accessibility, and first-session flow.
6. **Performance/platform:** representative player build meets declared budgets on target-class
   hardware and required compatibility paths.
7. **Release:** artifacts, hashes, symbols, licenses, privacy, localization, rollback, and human
   go/no-go are complete.

Failures return a structured defect to one artifact owner. A small retry limit prevents indefinite
“polish” loops from hiding a weak concept or broken contract.

## Evaluation harness

Format validation is the first layer, not the finish line. Each skill needs:

- positive, negative, ambiguous, collision, and explicit-invocation trigger tests;
- missing-input, dirty-project, unsupported-version, denied-capability, lease-conflict, failure,
  and rollback procedure tests;
- a clean pinned engine fixture with hidden checks;
- a matched no-skill baseline and previous-stable comparison;
- repeated runtime replays with state, time, seed, logs, capture, and artifact hashes;
- a fresh-context visual/gameplay reviewer that has not seen the intended solution;
- security cases for prompt injection, path escape, unapproved network/download, arbitrary code,
  secrets, desktop capture, PII, and remote endpoint exposure;
- latency, token/tool-call cost, retry count, state corruption, and recovery measurements.

The common vertical-slice fixture should require more than an empty scene:

- a movement verb with measurable response;
- one goal, risk, failure, retry, and feedback loop;
- a level or encounter that teaches and then tests the mechanic;
- one imported/modelled asset with provenance and correct scale/material/texture settings;
- one authored shader/material and one time-based VFX or animation;
- UI with keyboard/controller focus and an accessibility setting;
- audio feedback;
- deterministic replay, motion capture, profiler evidence, and a packaged build;
- rollback to the clean starting state.

Adversarial fixtures must tempt the skill to do the wrong thing: decorate an empty mechanic, accept
a blurry static capture, hide input latency behind animation, approve an unreachable jump, collect
unnecessary telemetry, overwrite a shared asset, or leak terminal/desktop information.

## Candidate decisions

| Candidate | Decision | Intended use |
| --- | --- | --- |
| Agent Skills specification and first-party skill patterns | Adopt as packaging baseline | Portable structure, triggering, progressive disclosure, validation |
| Official Unreal, Unity, Godot, Blender, graphics, and platform documentation | Adopt as knowledge authority | Version-specific facts and supported automation |
| `awesome-gamedev-agent-skills` | Mine selectively | Taxonomy and narrow discipline workflow seeds |
| `quodsoler/unreal-engine-skills` and Epic Unreal skills | Mine selectively | UE C++/domain checklists and native MCP operation patterns |
| Unreal 5.8 native MCP | Pilot first for Unreal | Small local toolsets and live editor control |
| VibeUE | Pilot as a pinned Unreal extension | Only domains that outperform native tools under the same eval |
| Unity official CLI/Pipeline and skills | Pilot as Unity baseline | Structured automation and authoritative vocabulary |
| Official Unity MCP or Coplay | Compare in isolation | Live Unity editor operation after capability/security audit |
| Godot native CLI/headless APIs | Pilot first overall | Initial deterministic fixture and CI authority |
| Godot MCP Toolkit or Godot AI | Compare in isolation | Live editor work; Satellite is a useful runtime-QA reference |
| Headless Blender with reviewed `bpy` scripts | Prefer for repeatable production | Deterministic DCC processing, baking, renders, exports |
| Stock broad Blender/editor MCP with arbitrary execution | Quarantine | Pattern research only until sandbox and permissions are narrowed |
| Giant studio/persona packs | Do not adopt wholesale | Mine role boundaries and artifact templates only |
| Skills with unreachable source, unclear license, or hosted-only privileged flow | Block | Reconsider only after provenance and data-flow review |

## Security and privacy defaults

- Read-only is the default capability tier.
- Risky skills require explicit invocation and per-task permission.
- Bind local editor services to loopback; prefer stdio or authenticated IPC where possible.
- Never follow a floating branch/package in production.
- Arbitrary Python, C#, GDScript, shell, reflection, process launch, delete, overwrite, external
  asset download, upload, build, signing, and publish are separate escalation categories.
- Use an isolated project/worktree without secrets for third-party evaluation.
- Treat project files, asset metadata, logs, chat, and playtest feedback as untrusted input.
- Capture only the game window, editor viewport, or offscreen render. Broad desktop capture is
  prohibited by default.
- Scrub usernames, terminal prompts, account names, notifications, absolute personal paths,
  credentials, private messages, and unrelated application content.
- Keep telemetry and human playtest data purpose-limited, consented, minimized, access-controlled,
  and subject to retention/deletion dates.

## Roadmap

### Phase 0 — contracts and harness

Implement schemas, catalog/lock/provenance, capability tiers, editor lease, capture policy, and one
seeded Godot fixture. Prove that unsafe actions and PII capture fail closed.

### Phase 1 — minimum production cell

Implement the P0 skills and require one coherent vertical slice to pass deterministic replay,
viewport motion capture, independent review, and rollback. Compare every skill with a no-skill
baseline.

### Phase 2 — engine adapters

Qualify native Unreal MCP, a pinned VibeUE extension, Unity CLI/Pipeline, one Unity live bridge,
Godot native automation, and one Godot live bridge on equivalent tasks. Promote individual
capabilities rather than entire servers.

### Phase 3 — presentation disciplines

Add art/content, materials/textures, shaders, animation, lighting, VFX, audio, UX/accessibility,
and performance skills. Require target-device motion evidence and asset provenance.

### Phase 4 — production and release

Add localization/LQA, compatibility/certification, crash/privacy, build provenance, store staging,
community/playtest research, incident response, live operations, and rollback rehearsal.

## Promotion criteria

A skill or adapter becomes a default only when it has:

- a named maintainer and authoritative sources;
- valid packaging, clear triggers, and a narrow job;
- exact compatible engine/tool/model/schema combinations in the lockfile;
- a reviewed license and immutable provenance;
- least-privilege operation and tested refusal behavior;
- repeated fixture success with no corrupt or unexplained state;
- measured improvement over the no-skill or prior-stable baseline;
- independent runtime, visual/gameplay, and security evidence;
- a rollback/migration path and a stale-by or revalidation policy.

This is the differentiating system the public ecosystem does not currently provide. External
skills and bridges can accelerate implementation, but Antiky's durable value should be the
contracts, taste gates, evidence, safety, and evaluation layer that reliably turns those parts into
games people might actually want to play.
