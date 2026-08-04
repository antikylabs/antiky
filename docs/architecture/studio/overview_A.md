# Studio and Agent Workflows

**In Progress**

## Purpose

Antiky Studio is a visual development application for Antiky Framework. Its long-term goal is to
support most game-development work through a live canvas that users can inspect.

Studio is one client of the framework. It does not contain the true world state or make final game
decisions.

This guide explains the Studio host, editor session, modes, inspection, MCP, sandboxes, and AI rules.
It expands these ADRs:

- [Studio 0001: Let users choose their AI coding tools](../../adr/studio/0001-ai-integrations_H.md)
- [Studio 0002: Keep the Studio web editor independent from Tauri](../../adr/studio/0002-tauri-portable-web-editor_H.md)
- [Studio 0003: Attach each feedback comment to its exact target](../../adr/studio/0003-contextual-feedback-queue_H.md)
- [Studio 0004: Make CLI and Studio use the same engine services](../../adr/studio/0004-share-engine-services-with-cli_H.md)
- [Framework 0003: Use one engine API for humans and agents](../../adr/framework/0003-agent-native_H.md).

## What Studio does

A game can build and run with Antiky Framework alone. Studio adds visual editing, inspection,
diagnostics, feedback, asset tools, and integrated development tools. A game does not need Studio at
runtime.

Real production work must guide Studio development. The first version will not replace all features
of Unity or Unreal.

It does not need a complete animation editor, visual scripting, a terrain suite, a marketplace, or
all future content tools.

## One API rule

If Studio can change engine or project state, an authorized agent or test must be able to call the
same service. Studio components do not directly change world storage, GPU resources, or event stores.

```text
Studio UI -> EditorSession --+
CLI -------------------------+-> commands / queries / updates -> EngineSession
MCP adapter -----------------+
Tests -----------------------+
```

The UI and MCP adapter can present operations in different ways. They must use the same engine
behavior.

Screenshots and captures help users make visual judgments. They add to structured data about
entities, components, assets, dependencies, passes, events, and diagnostics.

An agent must not need to infer all state from image pixels.

## CLI and Studio

The CLI and Studio have different presentations. They do not have different engine behavior.

`antiky dev` starts and supervises the local development host and game process. Studio connects to
the same host. It uses structured engine services instead of terminal text.

The Studio host can start an approved local CLI process. It can later use the same launch service
directly if a real use case needs this integration. It must not implement a second launcher.

The framework owns semantic inspection and measurements. The development host owns process, build,
connection, and cleanup facts. Studio can show both sources without becoming their owner.

## Web and desktop hosts

The Studio editor is a portable web application. Development starts in a browser. Tauri is the first
desktop application that hosts the editor.

The web UI depends on a narrow host contract for operations such as:

- Open and describe a project.
- Start, find, or connect to an engine session.
- Select files and directories.
- Show a source asset in the file system.
- Start approved local development processes.
- Open native menus or notifications.
- Report available host features.

Tauri controls application windows, installation packages, operating-system features, local
processes, file-system permissions, and secure process messages. Only the host adapter imports Tauri.
Panels and engine clients do not import it.

This design lets Studio use a normal browser, a different desktop application, or a remote
environment. It does not require a large portability framework.

## Where the engine runs

The architecture supports both local and detached sessions:

| Form | Editor | Engine | Use |
| --- | --- | --- | --- |
| Browser development | Browser | Local browser session and development host services | Prove panels and engine rules quickly |
| Local Studio | Tauri web view | Same process or a managed local process | Normal game and asset development |
| Separate Studio | Tauri or browser | Existing game or server process | Inspect a live runtime without direct access to its objects |
| Headless tools | Optional UI | Headless session | Tests, validation, import, and agent sandboxes |

The project has not selected the engine process location or connection method. Direct calls, Tauri
process messages, and local networks must use the same validation and authority rules.

## EditorSession

`EditorSession` is the Studio API for one engine session. It groups operations by user task. It does
not expose internal parts of each engine system.

### Session control

- Get engine, world, mode, clock, and connection status.
- Pause, resume, and run individual simulation steps.
- Switch between attached and detached modes.
- Create, compare, discard, and apply sandbox changes.
- Receive session start, stop, and other status changes.

### World inspection

- Inspect an entity and its components.
- Find entities by component, relationship, name, zone, or asset.
- Read hierarchy and other relationships.
- Inspect runtime values and authoring values as different data.
- Show stable IDs and current revisions.

### Assets and rendering

- List and inspect assets.
- Follow dependencies and dependent assets.
- Inspect the geometry, material, pipeline, and render passes of an entity.
- Request compilation or resource replacement during development.
- Read structured shader and GPU diagnostics.
- Capture a frame, selection, or debug view.

### Selection and feedback

- Get, set, focus, and clear the selection.
- Select a stable target from the canvas.
- Create a comment from the current selection and its context.
- Browse and use the feedback queue.
- Link feedback to proposed changes and validation evidence.

### Changes

- Run permitted commands.
- Show temporary previews for continuous editor controls.
- Commit one complete authoring change.
- Use commands for undo and redo.
- Receive structured results and state-copy updates.

The first complete workflows must guide exact method and tool names. These operation groups are the
stable architecture.

## Editor modes

A mode controls simulation time, input, and the active camera. A mode change does not rebuild the
world.

### Attached

- Simulation runs.
- Game input is active.
- The game camera presents the view.
- Studio observes the game and can supply selection that does not affect gameplay.

### Detached paused

- Simulation is paused.
- Rendering continues.
- Editor input and camera are active.
- Studio preserves game input and camera state.
- Users can inspect, edit, and run individual simulation steps.

### Detached live

- Simulation continues.
- Editor input and camera are active.
- Studio preserves game-camera state.
- Users can inspect moving systems from any view.

Single-step operation is available while the simulation is paused. The editor can request one step,
a limited number of steps, or a limited simulation duration.

Session rules control these limits.

## Camera and input ownership

The editor camera is separate from the game camera. Detached mode does not change game-camera state.
When a user focuses a selection, only the editor camera or its orbit target moves.

Studio sends input to the active area for the current mode. The canvas, terminal, text field, and game
controller must not receive the same key accidentally.

Studio shows the current input owner in status information and diagnostics.

## Initial workspace

A useful first workspace contains:

- Live game canvas
- Mode and single-step controls
- Scene hierarchy
- Entity and component inspector
- Asset browser and dependency view
- Console and structured diagnostics
- Command or event history
- Render-pass inspection
- Feedback queue
- Optional integrated terminal or agent panel.

The hierarchy is a view of parent-child relationships. The inspector also shows other relationships,
stable IDs, revisions, asset references, recent relevant history, and diagnostics.

Panels show read-only views. Their edit controls send commands.

## Selection

The hierarchy, canvas, and MCP use the same selection service. Each selection method produces the
same selection record.

A canvas selection can include:

- Entity or asset ID
- World position and surface direction
- Distance
- Voxel, mesh, sprite, or batch details
- Material and pipeline
- Render pass
- Owner entity.

Selection is temporary session state by default. A comment from a selection stores context as
described in [Contextual feedback](contextual-feedback_A.md).

## Contextual feedback

Studio lets a human select an exact entity, component, property, relationship, asset, render item,
pass, or diagnostic. The human can then submit a comment about it.

The feedback service records the stable target ID, relevant resource details, revision, and complete
parent hierarchy.

The comment enters a queue for humans and agents with permission. They can inspect, claim, discuss,
and resolve it through Studio or MCP.

A comment requests attention. It does not change the target.

For example, "the grass is not green enough" can identify a known grass entity, material, or
property. A reviewer can compare stored context with current state.

## MCP adapter

The Model Context Protocol (MCP) adapter calls `EditorSession`. It supplies tools for tasks and
resources for read operations. Its operation groups include:

- Engine and mode control
- World and hierarchy inspection
- Selection from the hierarchy or canvas
- Assets and dependencies
- Rendering and diagnostics
- Visual capture
- Commands and sandbox management
- Feedback queue operations.

MCP handlers validate input and call the same service as the UI. They do not simulate clicks, read
private panel state, or add engine rules.

Read operations do not change state. Changes require explicit command data and current permissions.
Destructive actions, sandbox changes, and expensive simulation can require stronger rules or human
confirmation.

## Agent sandbox workflow

The default agent write workflow is:

```text
inspect structured state and feedback
  -> create a limited sandbox at a known revision
  -> apply allowed commands
  -> simulate and validate
  -> inspect diagnostics, metrics, and captures
  -> prepare a proposed change set with evidence
  -> human or policy review
  -> run approved commands again in the primary session
```

The agent does not receive direct world memory or BroMetal objects. Limits control message size,
command count, permitted targets, asset size, elapsed time, and simulation work.

## AI integration policy

Studio supports the user's current coding-agent tool through an integrated terminal and structured
engine API. It does not require an AI subscription from Antiky.

Optional AI in Studio runs on the user's computer by default. Each feature states its model,
download, memory, processing, and privacy requirements.

Optional cloud features use provider credentials from the user. Secrets stay in protected host
settings. Studio does not put them in project data, logs, comments, or MCP results.

The terminal and engine MCP tools have separate permissions. Access to engine commands does not give
access to arbitrary shell commands. Terminal access does not give permission to change engine state.

## Diagnostics and status

Studio must show this information to humans and agents:

- Connection, session, world, mode, clock, and revision
- Selected target and stored context
- Command result and stable rejection code
- State-copy delay or incompatibility
- Shader, asset, runtime, and GPU diagnostics
- Frame, pass, draw, upload, and simulation-step measurements
- Sandbox target limits and current usage
- Feedback queue status and ownership.

Structured diagnostics need IDs that link related operations. These IDs let users follow a command,
compile, resource replacement, frame, capture, and feedback response across boundaries.

## Security boundaries

- Default permissions are narrow and prevent unrequested changes.
- Studio validates process messages, local network messages, and MCP inputs at runtime.
- Tauri supplies a small host API. It does not supply arbitrary file-system or process access.
- Agent sandboxes are the default write target.
- Applying changes to the primary world needs separate permission and a revision check.
- Comments and captures respect project sensitivity and access permissions.
- Provider keys and other secrets never enter project state or feedback context.
- Terminal and process execution have explicit, separate rules.

## First complete workflow

The first complete feature must prove one development loop:

1. Open the running town through an `EngineSession`.
2. Pause without resetting simulation.
3. Detach and move the editor camera.
4. Select an entity from the hierarchy or canvas.
5. Inspect its components, assets, and render dependencies.
6. Create a comment for that target and see it in the shared queue.
7. Let a human or agent inspect the same comment through the shared API.
8. Test an authorized change in a sandbox.
9. Review validation evidence and apply the command set to the primary world.
10. Reload only affected resources where needed.
11. Undo through a correction command.
12. Resume from preserved state.

This complete workflow is more important than partial implementations of many panels.

## Verification

- UI and MCP produce the same command results for the same permissions.
- No panel directly changes world or renderer state.
- Switching mode preserves world and game-camera state.
- Selection from the hierarchy, canvas, and MCP identifies the same stable target.
- Feedback from a selection keeps its target and hierarchy context. It appears in UI and MCP queues.
- A sandbox cannot change the primary world before the primary session runs approved commands.
- The primary session explicitly rejects out-of-date sandbox changes.
- A broken resource reload preserves the last good rendered state.
- Host and engine protocols reject malformed messages and messages without permission.
- Framework-only and headless consumers do not depend on Studio.

## Open decisions

- Web UI framework and panel-layout library
- Engine process location and connection method
- First game-canvas selection method
- Exact integrated-terminal process model
- Workspace storage and project discovery
- Notification behavior for feedback and diagnostics
- The first Studio feature after the shared editor session exists.
