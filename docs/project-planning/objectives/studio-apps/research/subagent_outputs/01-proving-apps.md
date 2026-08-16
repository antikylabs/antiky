# Proving apps and capability pressure

## Evidence posture

Repository source and documentation were inspected. Studio and the external voxel projects were not run. “Established” means verified in current source or an accepted ADR; “Claimed” means recorded intent or documentation that was not independently exercised; “Inferred” means a conclusion drawn from those facts.

## Findings

### The first apps are not yet identified

- **Claimed:** The owner says there are “a few first apps,” but does not name them. `docs/objectives/studio-apps/objective.md:23`
- **Established policy:** Files under `docs/objectives/ideas/` are premature opportunities, not commitments or authority. `docs/objectives/ideas/README.md:3-12`
- **Claimed candidate only:** The voxel idea asks for WebGPU voxel rendering and records `.vox`, WebGPU-.vox, Voxel Builder, and MagicaVoxel shaders as relevant work. It does not state whether the product is a viewer, editor, importer, shader workbench, or project asset tool. `docs/objectives/ideas/voxel-renderer.md:1-7`
- **Established:** The voxel file is not currently listed in the ideas index, so it has no indexed status beyond the folder-wide “not worth building yet” rule. `docs/objectives/ideas/README.md:14-19`
- **Claimed, not app direction:** The other idea records describe deferred skills, requirement contracts, and a design-review gap. They do not propose Studio apps:
  - measurement skills are deferred because thresholds remain unvalidated; `docs/objectives/ideas/agent-legible-quality-measurement.md:59-68`
  - executable contracts are explicitly too early; `docs/objectives/ideas/executable-requirement-contracts.md:94-109`
  - the design critic explicitly does not need a new agent, taxonomy, or scoring rubric yet. `docs/objectives/ideas/design-critic.md:62-67`

Therefore, voxel is the only recorded idea that naturally pressures a new Studio workspace, and even it is not authorized work.

### The game editor is the only implemented app-shaped baseline

- **Established from source:** The current shell hard-codes four areas: Live game, Terminal, Inspection, and Activity. `packages/studio/app/src/components/StudioShell.tsx:283-360`
- **Established from source:** The reusable `Panel` primitive accepts only those four fixed workspace-area names. It is a presentation component, not an extension registration seam. `packages/studio/app/src/components/primitives.tsx:3-24`
- **Established from source:** The wide layout is a fixed 2×2 grid; narrow layouts stack the same four areas. `packages/studio/app/src/styles.css:245-258`, `packages/studio/app/src/responsive.css:46-59`
- **Established from source:** Users can resize two splits, but the values live only in `StudioShell` component state. No persistence call occurs on that path. `packages/studio/app/src/components/StudioShell.tsx:89-94`, `packages/studio/app/src/components/StudioShell.tsx:162-204`
- **Established from source:** The game surface is a sandboxed iframe that permits WebGPU. It is not a canvas mounted directly by a Studio panel. `packages/studio/app/src/components/LiveGameFrame.tsx:10-19`
- **Established decision:** The development game host owns the canvas, platform input, frame scheduling, and listener cleanup. The game module owns its lifecycle, and its renderer or Framework driver owns GPU resources. `docs/adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md:38-61`, `docs/adr/studio/0007-framework-first-allow-others_H.md:41-50`
- **Established from source:** Inspection and Activity expose fixed tab sets. Inspection is hierarchy/stores/snapshot; Activity is events/MCP calls/diagnostics. `packages/studio/app/src/components/InspectionPanel.tsx:11-12`, `packages/studio/app/src/components/InspectionPanel.tsx:137-174`, `packages/studio/app/src/components/ActivityPanel.tsx:12-12`, `packages/studio/app/src/components/ActivityPanel.tsx:153-181`
- **Established:** Current inspection panels are read-only. State changes must use shared services and commands. `docs/user-facing-docs/studio/getting-started.md:89-105`, `docs/adr/framework/0007-commands-as-mutation-boundary_H.md:27-42`

The game editor must therefore be treated as a regression consumer of any extension seam, not as evidence that the current CSS regions are already plugin APIs.

### Existing work supplies useful pressure tests, but not more Studio apps

- **Established:** `shader-study` is a renderer-only BroMetal game module that accepts the host canvas, reports measurements, implements `frame`, and disposes its renderer. `packages/demos/brometal/shader-study/src/game.ts:9-39`
- **Inferred:** Shader Study proves the existing renderer-neutral game-host contract. It does not prove an app-owned Studio viewport, custom panels, workspace presets, app persistence, or app discovery.
- **Established:** The asset catalog already has browser search data, a static JSON API, and a bounded project installer. `docs/user-facing-docs/assets/catalog.md:72-105`, `packages/asset-catalog/src/node/install.ts:65-154`
- **Established:** Asset installation is currently a CLI workflow, not a `DevelopmentClient` operation exposed to Studio. `packages/cli/src/cli.ts:306-324`, `packages/cli/src/development/browser-client.ts:88-120`
- **Established:** Frame capture, render evidence, frame statistics, motion statistics, and a separate visual target suite exist. `package.json:17-18`, `scripts/frame-stats.mjs:1-11`, `scripts/motion-stats.mjs:1-14`
- **Claimed:** The measurement idea says the capability is young and its thresholds are not owner-validated. `docs/objectives/ideas/agent-legible-quality-measurement.md:59-68`
- **Established direction:** Contextual feedback is an accepted Studio capability with a shared queue and commands, but its storage and retention remain open. `docs/adr/studio/0003-contextual-feedback-queue_H.md:15-40`, `docs/architecture/studio/contextual-feedback_A.md:202-212`, `docs/architecture/studio/contextual-feedback_A.md:289-298`

## Use-case matrix

| Scenario and evidence status | Panels | Workspace | Viewport / GPU | Commands | Persistence | Host access | Lifecycle |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Game editor — implemented baseline** | Live game, Terminal, Inspection with three tabs, Activity with three tabs. | Fixed resizable 2×2 layout; fixed narrow stack; fullscreen game mode. Current split values are session-local. | Sandboxed game iframe. Development host supplies the game canvas and frame clock; game module or Framework driver owns renderer resources. | Pause, resume, step, restart, stop, retry; read-only inspection. Additional shared client commands exist but are not all presented in the UI. | One strict `.antiky` project manifest; recent projects persist on the device; event and MCP histories have source-defined lifetimes. Layout does not currently persist. | Project selection/creation/validation/activation, native terminal, and development-service lifecycle. | One active project per window. Activation starts services; replacement clears old state and stops the old session. |
| **Voxel viewport or workbench — recorded idea, candidate only** | **Claimed:** a WebGPU voxel-rendering surface. Scene tree, palette, material, shader, inspector, or export panels are not requested and remain unsupported assumptions. | **Claimed:** Studio apps should configure a workspace, but no voxel-specific arrangement or coexistence with the game editor is defined. | WebGPU is explicit. Device ownership, renderer choice, resource sharing, resize, frame scheduling, picking, and disposal are unspecified. Raw GPU access must not be assumed. | No editing workflow is stated. A viewer may need no domain mutation; an editor would need authoring commands, undo, validation, and stable asset identity. | `.vox` is named as interchange prior art, but open/save, project import, autosave, generated artifacts, and workspace state are unspecified. | File selection is required only if local `.vox` opening is part of the first workflow. Export, arbitrary filesystem, process, and network access are not authorized. | Mount, resize, input focus, frame, device-loss recovery, and dispose are inferred GPU pressures. Standalone versus project-scoped activation is unknown. |
| **Contextual review — accepted capability; packaging as an app is inferred** | Queue, target context, replies, assignment/status, linked changes, and validation evidence. | Accepted first workflow places feedback alongside live selection and inspection. A dedicated review workspace is not decided. | No owned viewport is required. It consumes selection details and optional captures from the game/editor surface. | Create, reply, claim, assign, change status, link evidence, resolve, dismiss, and reopen. Feedback never changes its target directly. | Durable comment history is accepted. Storage adapter, retention, source-control synchronization, and attachment limits remain open. | No direct filesystem or Tauri access is established. Native notifications are only a possible future host capability. | Project or review scoped; must retain historical context when a target changes or disappears. |
| **Asset library and verified install — existing product/tool; Studio app is inferred** | Search/filter, results, asset detail, license/provenance, install state, and receipt are suggested by the existing product, not by a Studio specification. | Can be a no-engine browse/detail workspace. Installation introduces an active-project context. A 3D preview is optional and is not necessary to prove the workflow. | No GPU is required for search or installation. Model preview requirements are unspecified. | Existing bounded `asset install` mutation verifies catalog identity, paths, sizes, and hashes. Studio has no equivalent shared-client operation yet. | Static catalog data; installed files under project assets; durable `assets/antiky-assets.json` provenance registry. | Static catalog network read plus a bounded local install service. A panel must not receive arbitrary filesystem authority. | Discovery can plausibly work without a running game. Whether Studio requires an open project before browsing is an owner decision; install necessarily targets one validated project. |
| **Visual evidence review — existing tools; near-term app status unsupported** | Capture list, image, frame metrics, motion metrics, budgets, and diagnostics are plausible views, but none is requested as a Studio app. | Most naturally contributes panels beside the live game and Activity rather than replacing the workspace. | Does not need a second GPU viewport; it consumes game-host captures and structured measurements. | Capture and reload already exist through development services. Running repository verification or changing budgets is not a current Studio service. | Capture artifacts and metric sidecars exist; budget ownership and threshold validity remain unresolved. | Would need evidence-artifact reads and possibly a bounded verification service, not arbitrary shell or file access. | Bound to an exact development session, runtime, build, and capture identity. It is dependent on the game-editor workflow rather than genuinely independent. |

Matrix evidence:

- Game-editor layout and areas: `docs/user-facing-docs/studio/getting-started.md:80-105`, `packages/studio/app/src/components/StudioShell.tsx:283-360`
- Game controls and lifecycle: `packages/studio/app/src/components/StudioShell.tsx:219-250`, `packages/studio/app/src/development/useStudioDevelopment.ts:72-97`
- Project identity and single-project limit: `docs/adr/studio/0005-use-one-antiky-project-manifest_H.md:19-70`, `docs/adr/studio/0005-use-one-antiky-project-manifest_H.md:75-82`
- Voxel intent and prior-art links: `docs/objectives/ideas/voxel-renderer.md:1-7`
- Feedback operations and persistence: `docs/adr/studio/0003-contextual-feedback-queue_H.md:17-49`
- Asset search/install behavior: `docs/user-facing-docs/assets/catalog.md:55-67`, `docs/user-facing-docs/assets/catalog.md:72-105`
- Capture and evidence client operations: `packages/cli/src/development/browser-client.ts:88-120`
- Host boundary: `docs/adr/studio/0002-tauri-portable-web-editor_H.md:24-45`

## Smallest genuinely independent proving set

**Inferred:** The minimum useful set is three capability shapes, not every recorded idea:

1. **The shipped game editor as the mandatory regression consumer.** It proves a project-scoped, runtime-connected, multi-panel workspace with a native terminal, inspection, responsive behavior, and project-service lifecycle.

2. **One owner-approved GPU-native content tool.** The voxel workbench can fill this role only if the owner promotes it from an idea and defines its first workflow. This case pressures a reusable viewport, input ownership, GPU/resource disposal, file handling, and a workspace unlike the live-game editor.

3. **One owner-approved no-GPU project utility.** The existing asset library/install flow is the strongest available candidate because it pressures data-heavy panels, optional project context, bounded host mutation, provenance, and app activation without forcing every app through an `EngineSession` or viewport.

Contextual feedback and visual QA are useful extension consumers, but they currently depend on the game editor’s selection, session, capture, and inspection surfaces. They do not add a genuinely independent app shape unless the owner explicitly wants dedicated standalone workspaces.

Shader Study is a valuable regression fixture for the existing game-module host. It should not be counted as proof of a Studio app viewport because it runs as the game inside the existing iframe contract. `packages/demos/brometal/shader-study/README.md:3-12`

If the asset library is not an intended early app, another no-GPU first app must be named. Otherwise, the extension contract is likely to overfit the game editor and voxel viewport.

## Unsupported assumptions

- That the voxel renderer is one of the first Studio apps or has left the ideas stage.
- That “voxel renderer” means an editor rather than a viewer, importer, shader study, or game-rendering experiment.
- That `.vox` support includes writing or round-tripping files rather than reading them.
- That every app needs a WebGPU viewport, terminal, active `.antiky` project, or running `EngineSession`.
- That the current four CSS grid regions are stable extension seams.
- That an app may import Tauri, CLI process modules, BroMetal, raw WebGPU devices, live engine objects, or project filesystem APIs directly.
- That “plugin-based” means project-local or third-party executable code. The owner has not selected built-in, bundled, project-local, or external trust tiers.
- That apps own final workspace layout or may overwrite user customization.
- That the asset catalog is an intended first Studio app. This is inferred from existing asset tooling and Studio’s accepted asset-tool direction, not stated by the owner. `docs/architecture/studio/overview_A.md:22-32`
- That contextual feedback should be packaged as a separate app rather than a game-editor contribution.
- That frame and motion measurements are ready for a polished Studio product; their owner thresholds remain unvalidated.
- That a standalone voxel tool should reuse the game-module contract. That contract is proven for hosted games, not general Studio tools.
- That a public marketplace or remote plugin distribution is needed.

## Owner questions

1. Which two or three apps are actually intended first? Is the voxel renderer now promoted from `ideas/`, and should asset library/install or contextual review be among them?
2. What is the smallest voxel workflow: open and render a `.vox`, edit voxels, edit materials/shaders, import into an Antiky project, export `.vox`, or something else?
3. Must the voxel app coexist with the live game workspace, or does it replace the workspace while active?
4. Can an app open without an active `.antiky` project? If yes, which first app proves that state?
5. Does “plugin-based” initially mean only first-party modules compiled with Studio, or must project-local code load in the first version?
6. Which parts of the game-editor experience are inviolable: panel identities, layout, responsive order, terminal visibility, toolbar, fullscreen behavior, project switching, or all of them?
7. Is the Terminal a global Studio surface, an optional app contribution, or something each app may exclude from its workspace?
8. Should an app only suggest an initial layout, with user changes persisted afterward? If so, is persistence per device, project, app, or some combination?
9. Is contextual feedback a shared service available inside every relevant app, a dedicated review app, or initially only part of the game editor?
10. If asset library/install is not an intended proving app, what no-GPU project utility should prevent the app contract from becoming viewport-centric?

## Gaps

- No authoritative inventory, priority, or first workflow exists for the intended apps.
- The voxel idea has no status entry in the ideas index and no viewer/editor/import/export boundary.
- No current app registry, contribution format, activation contract, or app identity exists.
- No Studio viewport exists outside the live-game iframe.
- No app workspace persistence model exists; current split values are component-local.
- No decision says whether apps can operate without a selected project.
- No decision says whether app state belongs to project files, device preferences, or temporary session state.
- Contextual feedback is accepted architecture but has no corresponding current Studio panels or client operations.
- Asset installation exists in CLI/library code but not in the browser-safe development client.
- Visual measurement functions exist, but their thresholds and product presentation remain unvalidated.
- Existing demos prove game-module rendering, not multiple app viewports, concurrent canvases, or app-specific GPU lifetime.
- No evidence yet proves that a single extension vocabulary can support both a GPU content tool and a no-GPU project utility.

## Planning implications

- Planning must wait for the owner to name the actual first apps and define one minimal workflow for each.
- Recorded ideas must remain separate from accepted Studio direction. Voxel can be used as a pressure test without becoming an implementation commitment.
- The game editor should be treated as a compatibility case whose current behavior survives the new seam.
- The extension model should be tested against one GPU-native and one no-GPU consumer so it does not equate “app” with either “game iframe” or “panel.”
- Current `Panel`, workspace-area names, and CSS grid should be treated as implementation details until a real second workspace exposes a stable cut point.
- Apps should request bounded services and host capabilities. They should not receive Tauri, arbitrary filesystem/process access, raw engine objects, or shared GPU objects.
- App state must be separated into durable project artifacts, per-device preferences/layout, and temporary session state before a persistence contract is chosen.
- Shader Study can protect the existing renderer-neutral game-host path, but it cannot substitute for a real app-viewport proving case.
- Feedback and visual QA should remain dependent capability scenarios unless the owner explicitly promotes them to standalone apps.
- If voxel remains only an idea, research should describe a generic “GPU-native content tool” pressure case and avoid creating voxel-specific goals.
