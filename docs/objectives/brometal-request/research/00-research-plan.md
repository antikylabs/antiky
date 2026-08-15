# Research plan — BroMetal issue #8 capability response

**Prepared:** 2026-08-14
**Objective:** [`../objective.md`](../objective.md)
**Primary request:** [BroMetal issue #8](https://github.com/ericdrowell/brometal/issues/8)

## Questions

1. What behavior does the requester actually need for lightweight entity tracking, click-to-pick,
   and a 2D pan/zoom/follow camera, and what has the BroMetal project actually said in response?
2. Which parts of lightweight entity and transform tracking exist in Antiky today as implemented,
   reusable public behavior rather than architecture prose or feature-specific code?
3. Which parts of pointer-to-entity picking exist today, including pointer capture, screen/world
   mapping, hit testing, stable target identity, selection state, inspection, and renderer support?
4. Which parts of a simple 2D camera exist today, including orthographic projection, pan, zoom,
   follow, coordinate conversion, input ownership, and a reusable API?
5. Can an external BroMetal user consume the relevant Antiky capabilities today without adopting
   unrelated CLI, Studio, game-host, or Framework complexity?
6. For each requested capability, should the next plan reuse existing Antiky behavior, extract or
   implement an Antiky-owned module, contribute a general primitive upstream to BroMetal, or take no
   action?

## Why each question matters

| Question | Decision it unblocks |
| --- | --- |
| 1 | Prevents the objective from solving a larger scene-graph problem than the issue asks for, or treating a contributor reply as maintainer direction. |
| 2 | Determines whether Antiky can truthfully say it already provides the requester's object model and what, if anything, must be generalized. |
| 3 | Determines whether the existing pointer contract and planned selection architecture amount to usable picking, and selects the smallest missing vertical slice. |
| 4 | Determines whether BroMetal's perspective camera and demo-specific follow logic meet the 2D request or only provide ingredients. |
| 5 | Determines whether the response should be a usable package and example, an Antiky release task, or only a future-direction statement. |
| 6 | Establishes the ownership boundary required before planning and prevents Antiky-specific policy from leaking into BroMetal. |

## Lines of inquiry

### 00 — Issue and BroMetal surface

Read issue #8, all comments and state, BroMetal's current primary documentation, the installed
`0.17.2` package, its camera/runtime types, and current Antiky patch metadata. Return:

- the requester's concrete use case and minimum implied contract;
- what is established by the issue author, what is only claimed by a commenter, and whether a
  maintainer has answered;
- BroMetal primitives that already help and capabilities it deliberately does not supply;
- any missing general renderer primitive that could justify an upstream contribution;
- dated sources and explicit gaps.

### 01 — Entity, transform, and inspection coverage

Read `packages/framework/src/identity/`, `point-light/`, `inspection/`, `sessions/`, the public
exports and API docs, relevant tests, ADRs 0001, 0009, and 0011, and the world/session architecture.
Return a requirement-by-requirement matrix that distinguishes implemented reusable behavior,
feature-specific behavior, inspection-only DTOs, architecture-only direction, and absence. Include
the smallest reusable boundary supported by current evidence and explicit gaps.

### 02 — Picking and selection coverage

Read the game pointer contract and host adapter, Framework render contracts, demo interaction code,
Studio and rendering selection architecture, inspection/MCP surfaces, tests, and current BroMetal
runtime support. Return the complete pointer-event-to-stable-entity path, marking every implemented
and missing link. Compare bounded CPU hit testing and GPU object-ID picking for the requester's few
dozen 2D objects without choosing a final design. Include evidence and explicit gaps.

### 03 — Camera and coordinate coverage

Read BroMetal's `Camera` API, Antiky game/host contracts, camera and presentation code across current
demos, tests, ADR 0004, and Studio camera architecture. Return a matrix for projection, pan, zoom,
follow, damping, viewport/world conversion, resize, ownership, headless testing, and reuse. State
whether existing code is a reusable 2D camera or only separate ingredients. Include evidence and
explicit gaps.

### 04 — External product fit and ownership

Read package manifests and exports, build/publication configuration, user documentation, current
release posture, ADRs 0020 and 0021, the render-driver work, and the other four research returns.
Return:

- what an external BroMetal user can consume now;
- the dependency and complexity cost of doing so;
- at least two bounded delivery shapes with tradeoffs;
- a capability ownership matrix: existing Antiky, new Antiky, upstream BroMetal, or no action;
- owner decisions needed before planning and any unverifiable claims.

## Return format for every line

Each raw return must contain:

1. **Findings** — concise answers tied to the assigned questions.
2. **Evidence** — source file and line, command output, or primary URL for each material claim.
3. **Established / claimed / inferred** — label the evidence status explicitly.
4. **Gaps** — unanswered points and what would be needed to answer them.
5. **Planning implications** — decisions the evidence supports, without writing a plan or goal.

An unverifiable claim must remain visible and labelled. Do not silently drop it or rewrite it as a
fact.

## Out of scope

- Implementing, patching, installing, upgrading, or publishing any package.
- Replying on issue #8, messaging the requester, or opening an upstream issue or pull request.
- Designing a general scene graph, archetype ECS, editor, physics system, or material system.
- Selecting a final picking algorithm before the requester's scale and Antiky's current render
  mapping are understood.
- Treating the requester's canal visualization as an Antiky-owned product.
- Writing implementation plans or executable goals during the research phase.

## Known constraints

- `docs/VISION_DIRECTION_H.md` requires lightweight, reusable Framework capabilities proven by
  working demos, with work implemented in the project that owns it.
- `docs/GOOD_ENGINEERING_H.md` requires the simplest useful boundary, evidence before optimization,
  and at least two designs before a significant choice.
- [Framework ADR 0001](../../../adr/framework/0001-entity-component-system_H.md) requires stable
  entities, versioned components, typed relationships, systems, and queries, while keeping storage
  private and rejecting a premature general ECS.
- [Framework ADR 0004](../../../adr/framework/0004-23d_H.md) requires equal Framework support for
  2D, 3D, and 2.3D games.
- [Framework ADR 0009](../../../adr/framework/0009-separate-state-projections_H.md) keeps authoring,
  runtime, and render state separate.
- [Framework ADR 0011](../../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md) requires
  stable UUIDv7 identity at public and durable boundaries and temporary aliases in hot paths.
- [Framework ADR 0020](../../../adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md)
  gives raw pointer events, canvas ownership, and platform signals to a host while game code owns
  semantic input and state.
- [Framework ADR 0021](../../../adr/framework/0021-brometal-render-driver-ownership_H.md) makes the
  Framework-owned BroMetal driver the default, allows direct BroMetal use only as a game-module
  exception, and permits upstream contributions only when they help renderers generally or fix an
  error.
- BroMetal is a pre-1.0 dependency. The installed and latest published version was `0.17.2` when
  checked on 2026-08-14; version-sensitive claims must carry that date.
- Research is read-only. The unrelated dirty changes already present in demos and render-driver
  code belong to other work and must not be edited, staged, or reverted.
