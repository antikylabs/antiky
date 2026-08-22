# Research plan - BroMetal issue #8 capability response

**Prepared:** 2026-08-14
**Objective:** [`../objective.md`](../objective.md)
**Primary request:** [BroMetal issue #8](https://github.com/ericdrowell/brometal/issues/8)

## Questions

1. What does the requester need for lightweight entity tracking, click-to-pick, and a 2D
   pan/zoom/follow camera? What has the BroMetal project said in response?
2. Which parts of lightweight entity and transform tracking exist in Antiky today as reusable code?
3. What exists today for the complete selection path: pointer input, GPU object-ID rendering,
   readback, stable Framework entity identity, shared selection state, and Studio inspection?
4. Which parts of a simple 2D camera exist today, including projection, pan, zoom, follow,
   coordinate conversion, input ownership, and a reusable API?
5. How can an external BroMetal user use the relevant Antiky code today without adopting unrelated
   CLI or Studio code?
6. Which project owns each missing part: Antiky Framework, Antiky Studio, or BroMetal?
7. What executable Antiky example can prove the requester's small 2D use case and the required
   GPU-to-Framework-to-Studio selection path?

## Why each question matters

| Question | Decision it unblocks |
| --- | --- |
| 1 | Keeps the external request separate from assumptions about what its author asked Antiky to build. |
| 2 | Shows which entity and transform work can be reused and which work is missing. |
| 3 | Defines every link needed for a Studio click to resolve the rendered item to the correct stable Framework entity. |
| 4 | Shows whether existing camera code is reusable or only demo-specific. |
| 5 | Separates open-source access from npm package distribution and unrelated package dependencies. |
| 6 | Keeps renderer work in the driver or BroMetal, stable identity in Framework, and Studio behavior in Studio. |
| 7 | Gives the later plan a concrete integration proof. It does not define a release or package version. |

## Owner direction received after the first synthesis

The owner clarified two requirements on 2026-08-14:

- GPU picking is required because Studio must trace a rendered item back to its stable Framework
  entity. A CPU-only picking proof does not satisfy this objective.
- “A few dozen 2D objects” describes the requester's use case and a useful test fixture. It is not
  an Antiky product limit or a release version. The research must name any proposed proof as an
  example, demo, or integration fixture.

## Lines of inquiry

### 00 - Issue and BroMetal surface

Read issue #8, all comments and state, BroMetal's current primary documentation, the installed
`0.17.2` package, its camera/runtime types, and current Antiky patch metadata. Return:

- the requester's concrete use case and minimum implied contract;
- what is established by the issue author, what is only claimed by a commenter, and whether a
  maintainer has answered;
- BroMetal primitives that already help and capabilities it deliberately does not supply;
- any missing general renderer primitive that could justify an upstream contribution;
- dated sources and explicit gaps.

### 01 - Entity, transform, and inspection coverage

Read `packages/framework/src/identity/`, `point-light/`, `inspection/`, `sessions/`, the public
exports and API docs, relevant tests, ADRs 0001, 0009, and 0011, and the world/session architecture.
Return a requirement-by-requirement matrix that distinguishes reusable code, feature-specific code,
inspection-only records, architecture direction, and missing behavior. Include the smallest reusable
boundary supported by current evidence and explicit gaps.

### 02 - Picking and selection coverage

Read the game pointer contract and host adapter, Framework render contracts and BroMetal driver,
demo render data, Studio and rendering selection architecture, inspection surfaces, tests, and
current BroMetal runtime support. Return the complete pointer-to-Studio path, marking every existing
and missing link:

1. pointer input and the exact clicked pixel;
2. a GPU object-ID value for each selectable draw or instance;
3. asynchronous GPU readback with frame and alias lifetime checks;
4. conversion from the temporary GPU value to a stable Framework `EntityId`;
5. shared selection state;
6. Studio hierarchy and inspection views of the same entity.

CPU picking can be recorded as a fallback or comparison. It cannot replace the required GPU path.

### 03 - Camera and coordinate coverage

Read BroMetal's `Camera` API, Antiky game/host contracts, camera and presentation code across current
demos, tests, ADR 0004, and Studio camera architecture. Return a matrix for projection, pan, zoom,
follow, damping, viewport/world conversion, resize, ownership, headless testing, and reuse. State
whether existing code is a reusable 2D camera or only separate ingredients. Include evidence and
explicit gaps.

### 04 - External product fit and ownership

Read package manifests and exports, build and publication configuration, user documentation,
current release posture, ADRs 0020 and 0021, the render-driver work, and the other research returns.
Return:

- how an external BroMetal user can use Antiky now;
- the dependency and complexity cost;
- at least two bounded delivery options with tradeoffs;
- a capability ownership matrix for Framework, Studio, BroMetal, or no action;
- any owner decisions that genuinely change the product direction.

### 05 - GPU-to-Framework-to-Studio correction

Recheck the latest branch after the owner made GPU picking and Studio tracing explicit. Return:

- current coverage for render ownership, per-instance aliases, a GPU pick target, readback, stable
  entity resolution, selection state, and Studio display;
- the missing links in their required order;
- the correct Framework, driver, BroMetal, and Studio ownership boundaries;
- plain-language corrections for the first research synthesis.

## Return format for every line

Each raw return must contain:

1. **Findings** - concise answers tied to the assigned questions.
2. **Evidence** - a source file and line, command output, or primary URL for each material claim.
3. **Established / claimed / inferred** - label the evidence status explicitly.
4. **Gaps** - unanswered points and what would answer them.
5. **Planning implications** - decisions the evidence supports, without writing a plan or goal.

An unverifiable claim must remain visible and labelled.

## Out of scope

- Implementing, patching, installing, upgrading, or publishing a package during research.
- Replying on issue #8, messaging the requester, or opening an upstream issue or pull request.
- Building the complete Studio editor, feedback system, or general ECS.
- Treating CPU-only picking as completion of the required GPU-to-entity path.
- Treating the requester's canal visualization as an Antiky-owned product.
- Writing implementation plans or executable goals during the research phase.

## Known constraints

- `docs/VISION_DIRECTION_H.md` requires Studio to identify the entity behind a clicked rendered
  object and attach feedback to that stable entity.
- `docs/GOOD_ENGINEERING_H.md` requires evidence, small working proofs, and more than one design
  before a significant choice.
- [Framework ADR 0001](../../../adr/framework/0001-entity-component-system_H.md) requires stable
  entities and simple private storage while rejecting a premature general ECS.
- [Framework ADR 0004](../../../adr/framework/0004-23d_H.md) requires equal Framework support for
  2D, 3D, and 2.3D games.
- [Framework ADR 0009](../../../adr/framework/0009-separate-state-projections_H.md) keeps authoring,
  runtime, and render state separate.
- [Framework ADR 0011](../../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md) requires
  stable UUIDv7 identity at public and durable boundaries and temporary numeric aliases in GPU hot
  paths.
- [Framework ADR 0020](../../../adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md)
  gives raw pointer events and canvas ownership to a host while game code owns semantic input.
- [Framework ADR 0021](../../../adr/framework/0021-brometal-render-driver-ownership_H.md) gives GPU
  work to the Framework-owned BroMetal driver and allows general renderer work upstream.
- BroMetal is pre-1.0. Version-sensitive claims use the installed `0.17.2` snapshot dated
  2026-08-14.
- Research is read-only. Unrelated demo and render-driver work must not be edited, staged, or
  reverted.
