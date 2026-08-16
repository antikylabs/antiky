# Studio apps research plan

**Research date:** 2026-08-14
**Objective:** [`../objective.md`](../objective.md)

This is a full objective at the research phase. The owner supplied substantive intent in
`objective.md`, and the folder had no prior research or plan documents. This phase will establish
the smallest extension model that can support real Studio apps without weakening the existing game
workspace or accepted ownership boundaries. It will not select an implementation plan or create
executable goals.

## Questions

1. How is Studio's current workspace, panel tree, project lifecycle, terminal, inspection client,
   and live game surface composed, and which seams are real rather than only visual boundaries?
2. Which current panels and near-term app ideas provide sufficiently different proving cases for
   an extension contract, and what capabilities does each actually require?
3. What is the smallest useful vocabulary for an app, panel, workspace contribution, command,
   service, and lifecycle without creating a general plugin framework prematurely?
4. How should Studio discover, identify, validate, load, activate, stop, replace, and version apps?
   Which code is first-party, project-local, or untrusted, and what capability rules follow?
5. Who owns workspace layout: the app, the user, or Studio? How can an app suggest an initial
   arrangement while preserving user changes, responsive behavior, accessibility, and the current
   game-editor experience?
6. What contract can make a WebGPU viewport reusable across apps while keeping canvas, device,
   renderer, frame-loop, resize, input, GPU-resource, and disposal ownership explicit?
7. How should apps read Studio, project, engine, and render information or request changes without
   bypassing shared services, commands, permissions, the portable `EditorHost`, or the game-module
   boundary?
8. Which practices from established extensible editors and browser application shells transfer to
   Antiky, and which would add complexity or conflict with accepted direction?
9. What tests, diagnostics, performance budgets, accessibility checks, and failure isolation prove
   that the extension seam is useful, visually coherent, and safe to evolve?
10. Which product or architecture choices need an owner decision before planning can begin?

## Why each question matters

| Question | Decision it unblocks |
| --- | --- |
| 1 | Prevents the plan from treating CSS regions as stable APIs or duplicating current lifecycle and service ownership. |
| 2 | Ensures the extension seam grows from real consumers and exposes missing owner direction about the first apps. |
| 3 | Defines an 80/20 contract instead of a universal plugin platform. |
| 4 | Determines the trust boundary, compatibility policy, and whether discovery needs a new project-schema or architecture decision. |
| 5 | Prevents app presets from erasing user intent or degrading the shipped workspace on narrow and accessible layouts. |
| 6 | Determines whether reuse belongs at the canvas host, renderer adapter, render driver, or app level and prevents hidden GPU lifetime conflicts. |
| 7 | Preserves one engine API for humans and agents and keeps UI extensions from becoming new authorities. |
| 8 | Supplies tested alternatives and vocabulary without copying another editor's scale or assumptions. |
| 9 | Gives later goals observable acceptance evidence and catches extension failures outside the happy path. |
| 10 | Keeps product policy and architecture decisions with the owner rather than burying them in an implementation plan. |

## Lines of inquiry

### 00 — Current Studio composition and extension seams

- Scope: Trace the current React component tree, workspace layout, development coordinator,
  project activation, native host contract, terminal, inspection surface, and live game frame.
  Identify current ownership, coupling, state flow, mount/unmount behavior, and real test seams.
- Sources: `packages/studio/app/`, relevant `packages/studio/tauri/` boundaries,
  `packages/cli/src/studio-*`, Studio user documentation, Studio architecture, and tests.
- Return: A component and ownership map, a current-panel capability matrix, concrete seams and
  blockers with file evidence, facts that are only documented rather than implemented, and gaps.
  Do not change files.

### 01 — Proving apps and capability pressure

- Scope: Derive distinct app scenarios from the shipped game editor, the owner's recorded ideas,
  and nearby Studio direction. Treat the voxel renderer as one candidate, not as authorization to
  build it. Determine the minimum capabilities each scenario pressures and where scenarios do not
  yet have enough owner intent.
- Sources: `docs/objectives/studio-apps/objective.md`, `docs/objectives/ideas/`, current Studio
  documentation and UI, architecture open decisions, and relevant existing demos or tools.
- Return: A use-case matrix covering panels, workspace needs, viewport/GPU needs, commands,
  persistence, host access, and lifecycle; the smallest set of genuinely independent proving apps;
  unsupported assumptions; owner questions; and gaps. Do not write a plan or change files.

### 02 — Workspace composition, design coherence, and accessibility

- Scope: Evaluate the current fixed split layout and the requirements for composable panels,
  app-provided workspace presets, user customization, responsive fallback, keyboard operation,
  focus/input ownership, persistence, recovery, and design-system consistency. Compare only
  directly relevant browser layout primitives or libraries.
- Sources: Studio components, CSS, screenshots and tests; WCAG and WAI-ARIA primary guidance;
  official documentation and source for a small number of relevant docking/layout systems.
- Return: Established current behavior, a layout state/ownership model, accessibility and design
  constraints, a bounded comparison of implementation shapes, failure cases, evidence links, and
  gaps. Do not select a library or change files.

### 03 — Extension-system precedents

- Scope: Compare how mature extensible editors define contributions, activation, commands,
  services, panels/views, workspace defaults, state, compatibility, and disposal. Focus on lessons
  for an initially first-party Antiky app system, not marketplace scale.
- Sources: Primary documentation and repositories for VS Code, Eclipse Theia, JupyterLab, Godot,
  and one browser-first application shell if it adds a distinct model. Date fast-moving claims.
- Return: A comparison table, transferable practices, complexity traps, terminology that maps or
  does not map to Antiky, at least two bounded contract shapes, and explicit gaps. Popularity is a
  discovery signal only. Do not change files.

### 04 — Loading, authority, lifecycle, and security boundaries

- Scope: Determine the threat and failure model for built-in, bundled, and project-local app code.
  Trace what can remain an in-process typed contribution and what would require isolation,
  serialization, explicit capabilities, schema changes, or a new ADR. Cover activation failure,
  cleanup, version skew, project switching, secrets, files, processes, network access, and denial
  of service.
- Sources: Accepted Studio, CLI, and Framework ADRs; current `EditorHost` and project-service
  boundaries; Tauri capability configuration; browser module/worker/iframe and CSP primary
  documentation where applicable.
- Return: Trust tiers, an authority and capability matrix, lifecycle invariants, failure-isolation
  options, decisions already settled by ADRs, new decisions that need an ADR or owner input, and
  gaps. Do not design a marketplace or change files.

### 05 — Reusable WebGPU viewport and render ownership

- Scope: Trace current canvas and renderer ownership from Studio through the game host, game
  module, `EngineSession`, and `BroMetalRenderDriver`. Research browser/WebGPU rules for canvas
  configuration, device sharing, multiple canvases, resize, frame scheduling, device loss,
  readback, and disposal. Examine the recorded MagicaVoxel/WebGPU work as concrete prior art.
- Sources: Current Studio/CLI/Framework/BroMetal code and tests; accepted render ADRs; the WebGPU
  specification and MDN or browser-vendor primary documentation; MagicaVoxel `.vox`, WebGPU-.vox,
  and other directly relevant primary repositories.
- Return: An established ownership diagram, reusable-viewport responsibilities, device/resource
  lifetime options and tradeoffs, what must not cross the app boundary, a voxel-app pressure test,
  observable failure modes, and gaps. Do not install or run external projects and do not change
  files.

### 06 — Verification, evolution, and operational limits

- Scope: Define evidence that a first extension seam works and remains habitable. Cover contract,
  integration, lifecycle, project-switch, visual-regression, responsive, accessibility,
  performance, GPU, malformed-contribution, and recovery tests. Determine what versioning and
  diagnostics are justified for an internal first version.
- Sources: Current Studio and CLI tests, repository engineering guidance, Web Platform Tests or
  other primary platform conformance sources, accessibility guidance, and findings from the other
  local surfaces where independently observable.
- Return: A risk-ranked verification matrix, suggested measurable budgets or baselines only where
  evidence exists, compatibility/evolution rules, required diagnostics, claims that need a real
  prototype to answer, and gaps. Do not invent frozen prose tests or change files.

## Return format for every line

Each raw return must contain:

1. **Findings** — concise answers tied to the assigned questions.
2. **Evidence** — a source file and line, command output, or primary URL for each material claim.
3. **Established / claimed / inferred** — label evidence status explicitly.
4. **Gaps** — unanswered points and what would answer them.
5. **Planning implications** — decisions the evidence supports without writing a plan or goal.

An unverifiable claim must stay visible and labelled rather than being dropped or asserted.

## Out of scope

- Implementing an app registry, panel system, docking library, viewport, or sample app.
- Building the voxel renderer or moving any other recorded idea into this objective automatically.
- Installing, executing, or adding an external dependency during research.
- Designing a public marketplace, remote code distribution, billing, or third-party publication
  process.
- Replacing the current game-editor workspace or changing its user experience during research.
- Creating a universal renderer abstraction or exposing BroMetal, WebGPU, engine memory, or Tauri
  APIs directly to panels.
- Changing the `.antiky` manifest, an accepted ADR, or an AIP during research.
- Writing implementation plans or executable goals during this phase.

## Known constraints

- [`VISION_DIRECTION_H.md`](../../../VISION_DIRECTION_H.md) makes Studio a live, AI-native editor
  that should grow from real production slices and use BroMetal as Antiky's graphics foundation.
- [`GOOD_ENGINEERING_H.md`](../../../GOOD_ENGINEERING_H.md) requires minimal frontend complexity,
  deep interfaces, two designs before significant choices, working proofs, and delayed abstraction.
- The owner requires the current game-editor workspace experience to remain intact, enough
  customization for future apps, and visual coherence with the main and Settings pages.
- Studio ADR 0001 keeps AI integrations vendor-neutral and separates terminal authority from engine
  authority.
- Studio ADR 0002 keeps the portable web editor independent from Tauri and allows only a small
  `EditorHost` boundary for platform features.
- Studio ADRs 0005 and 0006 make one strict `.antiky` manifest the project identity and make shared
  CLI project services the local lifecycle authority. The portable UI cannot start a second
  project service.
- Studio ADR 0007 keeps renderer selection inside the game module. Studio and CLI use one game
  module contract and do not branch on renderer type or inspect renderer objects.
- Framework ADRs 0003 and 0007 require Studio, agents, and tests to use shared services and
  versioned commands. A panel cannot directly change authoritative world or GPU state.
- Framework ADRs 0008 and 0009 give worlds and optional rendering to `EngineSession` ownership and
  keep authoring, runtime, and render state separate.
- Framework ADRs 0010 and 0011 serialize only across real boundaries, use JSON by default for early
  Studio protocols, and keep stable UUIDv7 identity separate from temporary runtime/GPU aliases.
- Framework ADR 0015 makes the Antiky Framework render path WebGPU-only.
- Framework ADRs 0020 and 0021 give canvas and platform work to the game host, game lifecycle to
  the game module, and BroMetal/GPU resources to `BroMetalRenderDriver` on the default Framework
  path.
- Current Studio documentation makes the live game, terminal, inspection, and activity surfaces
  one coordinated workspace. It requires explicit input ownership and read-only panels whose edit
  controls send commands.
