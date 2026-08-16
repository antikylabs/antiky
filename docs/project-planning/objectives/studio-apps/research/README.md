# Studio apps research

Research date: 2026-08-14

This research answers the questions in [`00-research-plan.md`](00-research-plan.md) against the
owner's [`objective.md`](../objective.md). It does not choose an implementation plan.

## Headline conclusions

1. **The current panels are a workspace, not an app API.** Studio directly composes four fixed
   surfaces. The useful seams are lower: `EditorHost`, project management, the development
   coordinator/client, CLI lifecycle services, versioned commands, the game host, and native
   terminal operations.
2. **Preserve the current game editor as the compatibility consumer.** Any seam must retain its
   Live game, Terminal, Inspection, Activity, Settings, project lifecycle, focus, and responsive
   behavior. Compatibility alone does not prove extensibility.
3. **Prove breadth with two owner-named apps.** Research supports one GPU-native content tool and
   one non-GPU utility in addition to the game-editor baseline. The voxel idea is a strong GPU
   pressure test, but the owner still needs to define its minimum workflow and choose the utility.
4. **Start with first-party composition unless wider trust is required now.** A compiled registry,
   stable identities, bounded host services, validated registrations, and deterministic disposal
   can prove the seam. Project-local executable code is a different security problem and must not
   enter the privileged Studio realm by accident.
5. **Let apps suggest; let Studio and the user own the workspace.** Studio should validate layout,
   render shared chrome, handle focus/input/accessibility/recovery, and apply responsive
   projections. An app supplies an initial preset; a restored user arrangement wins afterward.
6. **Choose the customization ceiling before the layout mechanism.** Named slots, a small
   Studio-owned split/tab tree, and full docking libraries carry very different persistence,
   accessibility, native-terminal, iframe, and lifecycle costs.
7. **A reusable WebGPU viewport is a canvas-host and lifecycle seam.** It needs explicit ownership
   of configuration, device, resize/DPR, scheduling, input, capture, device loss, resources, and
   teardown. It should not expose renderer/GPU objects or absorb app-specific rendering and asset
   semantics.
8. **Keep current authority boundaries.** Apps consume scoped projections and shared commands.
   They do not own a second project service, writable worlds, raw Tauri calls, BroMetal objects, or
   GPU handles.
9. **Make lifecycle correctness part of version 1.** Validate before activation, publish
   transactionally, fence stale async work, stop idempotently, attempt all cleanup, and keep
   project-switch state truthful after partial failure.
10. **Use real browser and owner-reviewed evidence.** Existing SSR/source tests do not establish
    focus, accessibility, layout, native overlays, GPU lifetime, or Studio appearance. Performance,
    memory, and visual thresholds need instrumented proofs rather than borrowed constants.

## Research documents

| Document | What it answers |
| --- | --- |
| [`00-research-plan.md`](00-research-plan.md) | Questions, constraints, scope, and evidence lines |
| [`01-current-state-and-proving-cases.md`](01-current-state-and-proving-cases.md) | Current composition, real seams, compatibility baseline, and independent proving cases |
| [`02-app-contract-and-workspace.md`](02-app-contract-and-workspace.md) | Extension precedents, bounded contract shapes, workspace ownership, layout choices, design, and accessibility |
| [`03-loading-authority-and-lifecycle.md`](03-loading-authority-and-lifecycle.md) | Trust tiers, capability posture, loading, isolation, lifecycle, schema, and security gaps |
| [`04-webgpu-viewport-and-voxel-pressure.md`](04-webgpu-viewport-and-voxel-pressure.md) | Current render ownership, viewport responsibilities, device options, WebGPU constraints, and voxel pressure |
| [`05-verification-and-open-decisions.md`](05-verification-and-open-decisions.md) | Risk-ranked evidence, evolution, diagnostics, prototype claims, and owner decisions |
| [`subagent_outputs/`](subagent_outputs/) | Full raw research reports retained as evidence |

The initial current-Studio raw report is retained for traceability. Its corrected companion
supersedes it because the initial report used stale path aliases; the compiled documents use the
corrected evidence.

## Research-question status

| Question | Status | Answer location |
| --- | --- | --- |
| Current composition and real seams | Answered | Current state and proving cases |
| Proving apps | Answered as capability classes; exact apps open | Current state and proving cases; open decisions |
| Smallest app vocabulary | Narrowed to two contract shapes | App contract and workspace |
| Discovery, loading, trust, and versioning | Answered in principle; product trust choice open | Loading, authority, and lifecycle |
| Layout ownership and preservation | Answered in principle; customization/persistence choices open | App contract and workspace |
| Reusable WebGPU viewport | Responsibilities and options answered; device policy open | WebGPU viewport and voxel pressure |
| Project, engine, and render authority | Answered within accepted ADRs | Current state; loading; viewport |
| External precedents | Answered | App contract and workspace; raw precedent report |
| Verification and diagnostics | Answered in principle; thresholds require proofs | Verification and open decisions |
| Owner decisions before planning | Open by design | Verification and open decisions |

## Decisions needed from the owner

Planning should not silently choose these product and architecture decisions:

1. **First apps:** Name the GPU-native and no-GPU apps that should prove the seam. If voxel is one,
   define its smallest useful user workflow.
2. **Game-editor relationship:** Decide whether the current workspace is core beside apps, becomes
   a built-in app, or is an inviolable built-in app—and which surfaces users may move, hide, or
   close.
3. **Customization and persistence:** Choose the version-1 layout ceiling, persistence scope, and
   behavior when an updated app adds a panel.
4. **Trust and discovery:** Decide whether version 1 is compiled first-party only, permits validated
   project descriptors, or truly requires executable project-local code.
5. **Activation and capabilities:** Decide when apps activate, whether they can be disabled or
   required, whether projectless apps matter, and how Terminal is scoped.
6. **Viewport proof:** Select the first device/hosting policy to investigate and whether both
   continuous and invalidated/progressive rendering must be supported.
7. **Design and accessibility:** Confirm the accessibility baseline, Settings semantics, and the
   shell/app states that need owner-approved visual references.
8. **Durable records:** Decide whether app discovery, permissions, layout, or app state enters the
   strict `.antiky` schema, and whether new architecture choices should be recorded before work.

The complete decision set and prototype claims are in
[`05-verification-and-open-decisions.md`](05-verification-and-open-decisions.md).

## Important unresolved evidence

- No first app has been mounted through a registry because no registry or app contract exists.
- No browser/native integration has tested contributed layout with the native terminal, game
  iframe, focus, zoom/reflow, Settings, or project switching.
- The exact pinned BroMetal root renderer's device-injection, context, loss, and destruction behavior
  was unavailable to this research.
- No representative `.vox` conformance and malformed-input corpus exists.
- No Studio screenshot baselines, GPU/resource measurements, performance distributions, or
  justified numeric thresholds exist.
- Graceful application-close cleanup, packaged restart permission, and rollback after partial
  project-switch teardown need focused verification.
- Existing shared tabs, splitter behavior, Settings semantics, and one faint-text token require
  rendered accessibility review before they become app-platform contracts.

## Direction and ADR alignment

The findings preserve accepted direction: portable Studio behavior behind bounded host adapters;
one CLI project-service lifecycle authority; versioned commands for mutations; serialization only
at real boundaries; separate authoring, runtime, and render state; renderer ownership inside the
game/driver path; and no renderer or GPU objects in Studio panels.

Future choices about project-local executable code, app discovery in `.antiky`, native/webview
capabilities, renderer/device ownership, or a durable VOX asset contract should be recorded as
owner decisions and ADRs rather than hidden inside an implementation plan.
