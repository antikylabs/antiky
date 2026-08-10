# Inspection and agent-tooling research

Research snapshot: 2026-08-09

This package audits the inspection, control, and evidence surfaces that agents and skills need to
build serious games with Antiky Framework, BroMetal, and Antiky Studio. It compares the current
implementation in `packages/framework` and `packages/cli` with the production needs identified in
the [game-development skill research](../skill-research/README.md).

Antiky/BroMetal is the sole implementation target. Other engines and public integrations contribute
comparative patterns only.

The existing seed skills are non-authoritative scaffolding. This research does not assume their
roles, prompts, artifacts, or workflows should survive. New skills must be derived from Antiky's
actual services, real game slices, and evaluation evidence.

## Executive conclusion

Antiky already has the beginning of the right control plane:

- stable UUIDv7 world, entity, command, and session identities;
- immutable, validated, size-bounded inspection snapshots;
- distinct development, build, runtime, session, world, event, render, and diagnostic facts;
- a fixed-step session with explicit input, pause reasons, retry-safe single-step, system order,
  revisions, state digests, fail-closed faults, and a single writer;
- accepted event history and correction rather than history deletion;
- one complete point-light path through authoring, runtime, render, command, event, inspection, and
  correction;
- build/runtime identity correlation, stale-runtime rejection, game-canvas-only capture, and a
  bounded MCP call log with field-name-based secret redaction.

Those last two protections are incomplete. The current capture result exposes an absolute local
filesystem path, and arbitrary strings or pixels are not content-scanned for PII. Evidence export
therefore needs opaque artifact references, permission-filtered metadata, and explicit privacy
validation before agents may treat captures or logs as safe to share.

That foundation proves the architecture, but not yet a general game-production surface. The
current MCP has 17 tools: ten reads, five lifecycle/evidence actions, and two point-light mutation
tools. Most world data is available only as one bounded whole-world snapshot, and point lights are
the only semantic object with dedicated query and authoring commands.

The central gap is therefore not “add more prompts” or “add hundreds of low-level MCP tools.” It is
to add a small set of deep Framework services that expose:

1. typed schema and capability discovery;
2. filtered, paginated, revision-aware semantic queries and diffs;
3. generic validated command batches with preview, authority, readback, and correction;
4. isolated worlds/sandboxes with compare, discard, and explicit promotion;
5. deterministic scenarios, input traces, checkpoints, replay, and evidence bundles;
6. selection and exact target context from hierarchy, canvas, assets, diagnostics, and rendering;
7. asset/import/dependency/provenance inspection;
8. render-item, shader, material, pass, resource, GPU-timing, and visual-diff inspection;
9. subsystem observability for gameplay, physics, navigation, AI, abilities, animation, audio,
   UI/accessibility, persistence, networking, and streaming as real game slices require it;
10. production QA, performance-budget, target-device, build-artifact, and release gates.

These capabilities should live behind shared typed services. CLI, MCP, Studio, tests, and agents
should adapt the same contracts. MCP tool names are not the architecture.

## Recommended direction

Do not invest next in polishing the seed prompts or multiplying feature-specific MCP setters. Build
three Antiky-native loops in order:

1. **Understand and change safely:** capability/schema discovery, targeted world queries, stable
   target references, registered commands, preview/readback/correction, scoped authority, and
   privacy-safe artifacts.
2. **Reproduce and prove:** semantic input traces, seeds, checkpoints, deterministic scenarios,
   state/event assertions, motion capture, run comparison, and evidence bundles.
3. **Connect intent to presentation:** selection/picking, asset provenance and dependencies,
   authoring-to-render causality, shader/material/pass inspection, GPU profiles, and controlled
   visual/audio evidence.

Prove these loops with new, art-directed, playable slices whose mechanics, motion, camera, effects,
audio, UI, failure/retry, and performance are reviewed as a whole. Keep current demos as narrow
regression fixtures; do not use them as the product-quality or marketing bar. Only then should
discipline skills be rebuilt around the services and evidence that actually worked.

## What tooling can and cannot do

Better inspection removes blindness. Safer commands remove guesswork and reduce corruption.
Deterministic evidence makes iteration comparable. None of those guarantees a compelling or “AAA”
game. Creative direction, game design, content quality, coherent presentation, representative human
playtests, and judgment remain separate gates.

The tooling succeeds when it lets an agent answer, with evidence:

- What exact project, build, runtime, session, world, target, and revision am I observing?
- What does the player do, what state changed, and why did it change?
- Which authored value, runtime projection, render item, asset, command, or system produced what the
  player saw and heard?
- Can I reproduce the behavior with the same input, time, seed, build, and assets?
- Can I change it inside declared authority, inspect the proposed delta, and roll it back?
- Did the change improve the intended experience in motion, on target hardware, without breaking
  another state, platform, accessibility path, or release constraint?

## Concrete findings from the current repository

- Runtime-backed reads do not expose one common observation sequence/time/freshness fence, so a
  disconnected client can receive retained state without proving it is current.
- A legal bounded Framework world publication can exceed the CLI transport's 256 KiB message cap;
  raising the cap would not replace targeted queries, paging, or diffs.
- A system may mutate game-owned closure state and then fault without advancing the completed-step
  counter. The current counter is therefore not an atomic commit proof.
- HTTP MCP is loopback-scoped but has no caller-specific credential or grant; the host supplies the
  same local principal and point-light permission to callers.
- Frame capture is correctly limited to the game canvas, but its result exposes an absolute path,
  and neither arbitrary strings nor pixels receive a content-aware privacy scan.
- Current game inspections are manually maintained semantic mirrors of private simulations. The
  Framework cannot prove omitted state agrees with the published mirror.
- Asset records, files, sidecars, imports, and runtime bindings are not one system: the audit found
  unused verified content, duplicated atlases, a missing editable source, hardcoded atlas metadata,
  and no shipped demo audio, 3D model, rig, or skeletal-animation assets.
- Render counts are game-reported aggregates rather than qualified backend measurements; BroMetal
  shader/resource/pass causality, GPU timing, and asynchronous failure evidence are not exposed.
- The website artifact pipeline has useful hashes and staging checks, but Antiky has no production
  scenario runner or receipt chain from exact candidate through target evidence to verified GitHub
  Release bytes and rollback.
- Studio's tested non-identifying terminal profile is a required privacy regression gate. Terminal,
  desktop, username, host, path, notification, account, and unrelated-app content are never valid
  game evidence.

## Report map

| Report | Focus |
| --- | --- |
| [Current CLI and MCP surface](cli-mcp-current-state.md) | Implemented tools, transports, schemas, lifecycle, evidence, errors, tests, and missing agent-facing operations |
| [Framework state and inspection](framework-state-and-inspection.md) | Worlds, sessions, commands/events, stable identity, projections, determinism, semantic inspection, and missing typed contracts |
| [Gameplay design and iteration](gameplay-design-iteration.md) | Mechanics, input, combat, traversal, camera/game feel, AI, levels, UI/UX, balance, playtests, and player-facing evidence |
| [World authoring and Studio](world-authoring-and-studio.md) | Hierarchy, selection, components, scenes/zones, editing, sandboxes, transactions, feedback, and production-scale world workflows |
| [Rendering, BroMetal, and visual evidence](rendering-brometal-and-visual-evidence.md) | Render mappings, shaders/materials, lighting/VFX, GPU evidence, capture, visual comparison, scalability, and privacy |
| [Content, assets, animation, and audio](content-assets-animation-audio.md) | Provenance, staging, import/reimport, dependencies, models, textures, rigs, animation, audio, UI assets, and budgets |
| [QA, performance, and release](qa-performance-release.md) | Scenarios, replay, regression, profiling, devices, accessibility, localization, crash/privacy, builds, artifacts, and release gates |
| [Agent orchestration, authority, and safety](agent-orchestration-authority-and-safety.md) | Capability discovery, permissions, leases, change packets, isolation, journals, rollback, handoffs, injection resistance, and approval |
| [Capability gap matrix](capability-gap-matrix.md) | Cross-lifecycle comparison of current evidence, missing capability, risk, and recommended service boundary |
| [Recommended tooling roadmap](recommended-tooling-roadmap.md) | Prioritized slices, proposed contracts, sequencing, evaluation fixtures, and exit criteria |

## Evidence policy

Each report distinguishes:

- **Current:** implemented in the current repository and supported by source/tests.
- **Accepted direction:** described in accepted architecture or ADRs but not necessarily
  implemented.
- **Gap:** a production need not satisfied by current evidence.
- **Recommendation:** a proposed Antiky-native contract or slice that still needs design and
  implementation proof.

Architecture documents are not evidence that a capability works. A demo proves only the narrow
path it exercises. A tool definition proves discoverability, not reliable game-production use. A
test proves only the behavior it covers. A seed skill proves only that the skill mechanism was
scaffolded; it receives no architectural or quality presumption.

## Design constraints

Recommendations in this package follow the repository's engineering rules:

- grow capabilities through complete game slices rather than a broad engine rewrite;
- prefer a few deep services over many shallow tools;
- keep Framework core independent of Node, browser DOM, Studio, MCP, and BroMetal;
- keep game rules and semantic state in Antiky, with BroMetal behind the owned render driver;
- preserve stable identities, explicit authority, one writer, expected revisions, structured
  errors, bounded values, and safe readback;
- make headless operation possible and rendering optional;
- keep screenshots, footage, logs, traces, and feedback privacy-safe by construction;
- measure real bottlenecks and player-facing results rather than optimizing from intuition.

## Primary local evidence

- [`packages/framework/src/sessions/engine-session`](../../../packages/framework/src/sessions/engine-session)
- [`packages/framework/src/inspection`](../../../packages/framework/src/inspection)
- [`packages/framework/src/point-light`](../../../packages/framework/src/point-light)
- [`packages/framework/src/game/host.ts`](../../../packages/framework/src/game/host.ts)
- [`packages/cli/src/mcp`](../../../packages/cli/src/mcp)
- [`packages/cli/src/development`](../../../packages/cli/src/development)
- [`packages/cli/src/host`](../../../packages/cli/src/host)
- [Framework architecture](../../architecture/framework/overview_A.md)
- [Studio architecture](../../architecture/studio/overview_A.md)
- [Vision and direction](../../VISION_DIRECTION_H.md)
- [Skill-library synthesis](../skill-research/recommended-library.md)
