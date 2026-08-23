# Studio direction gaps

Important direction that is missing or under-specified in `direction-studio.md`.

```text
Studio direction gaps
|-- Product boundary [Vision; Studio architecture]
|   |-- Studio is a visual client of Framework, not the engine or source of game truth.
|   |-- Games build, run, and ship without Studio; Studio adds human visibility and control.
|   |-- The long-term goal is a creator workspace, not a replacement for every traditional editor.
|   `-- Current Studio is a portable React editor hosted first by a macOS Tauri application.
|-- Shared authority [Studio ADRs 0005-0006; CLI ADRs 0002-0003]
|   |-- CLI project services are the single authority for build, host, inspection, MCP, and cleanup.
|   |-- Studio calls the shared project-service library directly instead of parsing CLI output.
|   |-- One strict <name>.antiky manifest defines project identity and one project per window.
|   |-- Panels read shared projections; every edit goes through the same commands as agents and tests.
|   `-- Studio keeps engine facts separate from process, build, and connection facts.
|-- Agent experience [Studio ADR 0001; Studio ACP objective]
|   |-- Users bring their installed coding agent, provider, account, and payment plan.
|   |-- ACP owns agent conversation and streaming; MCP remains the agent-to-engine API.
|   |-- Tauri owns the local ACP process; React receives bounded, validated conversation state.
|   |-- Terminal agents remain available, but a terminal is not the structured ACP experience.
|   |-- ACP permission prompts never bypass Framework commands, grants, or revision checks.
|   `-- Agent transcripts, multiple agents, background work, and agent installation are later decisions.
|-- Mini-app system [Studio apps objective]
|   |-- The current four-panel shell is a compatibility baseline, not an app API.
|   |-- Apps need stable IDs, declared capabilities, activation, disposal, and failure isolation.
|   |-- Apps provide validated workspace presets; restored user layout wins after first activation.
|   |-- Panels, UI commands, host services, app state, and workspace layout stay separate concepts.
|   |-- Terminal, viewport, project data, commands, diagnostics, and persistence are optional services.
|   |-- Raw Tauri, Framework world, renderer, and GPU objects never become app capabilities.
|   `-- Prove the seam with the game editor, one GPU app, and one non-GPU utility.
|-- Viewport ownership [Studio apps objective; Framework ADR 0021]
|   |-- Studio owns canvas mounting, size, focus, scheduling policy, and lifecycle coordination.
|   |-- The renderer or app owns programs, buffers, textures, targets, and rebuildable GPU state.
|   |-- Device loss, resize, hidden panels, async setup, and disposal need explicit behavior.
|   `-- Shared-device, dedicated-device, iframe, and worker hosting remain an open design choice.
|-- Selection and context [Framework ADR 0022; Studio ACP objective]
|   |-- Canvas selection resolves a GPU pick to a stable Framework EntityId before Studio sees it.
|   |-- Framework and CLI own the bounded selected-context projection; React does not reconstruct it.
|   |-- Context names project, build, runtime, world, entity, revision, hierarchy, and completeness.
|   |-- Selection-follow submits one current context and coalesces rapid clicks to the latest target.
|   `-- Stale, missing, partial, cleared, or cross-project context must remain visibly truthful.
|-- Feedback workflow [Studio ADR 0003; contextual-feedback architecture]
|   |-- Feedback is a durable comment with ID, author, target, revision, status, and audit history.
|   |-- Stored context preserves the exact hierarchy, property, asset, render, and diagnostic evidence.
|   |-- Comments are untrusted requests for attention; they never mutate their targets directly.
|   |-- Humans and agents share create, list, inspect, reply, assign, resolve, and reopen operations.
|   |-- Feedback links proposed changes and proof while keeping explicit human or policy approval.
|   `-- Retention, privacy, attachments, notifications, and source-control export remain open.
|-- Creator modes and editing [Studio architecture]
|   |-- Attached, detached-paused, and detached-live modes separate game and editor control.
|   |-- The editor camera and input owner stay separate from the game camera and player input.
|   |-- Continuous controls use previews, then commit one validated authoring command.
|   `-- Undo, sandbox comparison, promotion, and correction use Framework authority rather than UI state.
|-- Renderer and asset breadth [Studio ADR 0007; library objective]
|   |-- Framework plus BroMetal is the preferred path, but renderer-only game modules remain inspectable.
|   |-- Studio inspects published semantics, never Three.js, BroMetal, or WebGPU internals.
|   `-- Asset and shader apps should project the shared catalog, provenance, install, and evidence services.
|-- Safety, accessibility, and quality [inspection-tooling and Studio apps objectives]
|   |-- Terminal, ACP, MCP, filesystem, process, capture, network, and engine authority stay separate.
|   |-- Secrets, local paths, raw stderr, GPU handles, and unbounded world data stay out of agent context.
|   |-- Project, runtime, observation, turn, and app generations fence late or stale updates.
|   |-- Keyboard focus, native overlays, responsive layout, screen readers, and reduced motion need proof.
|   `-- Owner-approved visual references should prevent mini apps from drifting into generic UI.
|-- Current reality to state [current Studio code]
|   |-- Current: launcher, recent projects, live game, native terminal, controls, inspection, and activity.
|   |-- Current: four hard-coded resizable panels and one Settings page, not a composable app workspace.
|   |-- Planned: GPU selection and one native ACP conversation with click-to-agent context.
|   |-- Research only: the mini-app contract, reusable WebGPU viewport, and app workspace persistence.
|   `-- Missing: feedback storage, sandboxes, authoring modes, ACP host, and selected-entity UI.
`-- Decisions still open [active objectives and ADR review]
    |-- Choose first mini apps, customization limits, layout scope, trust model, and activation policy.
    |-- Choose viewport/device ownership, app isolation, app diagnostics, and project-local contributions.
    |-- Choose ACP profile storage, transcript policy, multi-agent behavior, and optional capabilities.
    |-- Choose feedback governance, retention, notifications, attachment limits, and synchronization.
    |-- Choose cross-platform terminal behavior, release packaging, and detached-session UX.
    `-- Choose an explicit accessibility target and the Studio states that require visual approval.
```
