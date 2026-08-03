# Studio and Agent Workflows

**In Progress**

## Purpose

Antiky Studio is the visual development application built on Antiky Framework. Its long-term goal is
to support most game-development work through a live, inspectable canvas while remaining one client
of the framework rather than a privileged source of truth.

This guide explains Studio's host boundary, editor session, modes, inspection, MCP integration,
sandbox workflow, and AI policy. It expands Studio ADRs
[0001](../../adr/studio/0001-ai-integrations_H.md),
[0002](../../adr/studio/0002-tauri-portable-web-editor_H.md), and
[0003](../../adr/studio/0003-contextual-feedback-queue_H.md), plus framework ADR
[0003](../../adr/framework/0003-agent-native_H.md).

## Product boundary

Games remain buildable and runnable with Antiky Framework alone. Studio adds visual editing,
inspection, diagnostics, feedback, asset workflows, and integrated development tools. It does not
become a required runtime dependency.

Studio should grow from real production workflows. The first version is not a general Unity or
Unreal replacement and does not need a full animation editor, visual scripting, terrain suite,
marketplace, or every future content tool.

## Shared capability rule

Anything Studio can do to engine or project state must be expressed through a shared service that an
authorized agent or test can also call. Studio components do not mutate world registries, GPU
resources, or event stores directly.

```text
Studio UI ----+
              +-> EditorSession -> commands / queries / subscriptions -> EngineSession
MCP adapter --+
```

The UI and MCP adapter can present different ergonomics. They must not implement different engine
behavior.

Screenshots and captures remain useful for visual judgment. They supplement entity, component,
asset, dependency, pass, event, and diagnostic data rather than forcing an agent to infer all state
from pixels.

## Host architecture

Studio's editor is a portable web application. Development begins in a browser-hosted path, and
Tauri is the initial desktop shell.

The web UI depends on a narrow host contract for operations such as:

- opening and describing a project;
- starting, finding, or connecting to an engine session;
- choosing files and directories;
- revealing a source asset;
- starting approved local development processes;
- opening native menus or notifications; and
- reporting host capabilities.

Tauri owns windows, packaging, operating-system integration, local process boundaries, filesystem
permissions, and secure IPC. Tauri-specific imports stay in the host adapter rather than spreading
through panels and engine clients.

This keeps a regular browser, another desktop host, or a remote environment possible without making
portability itself a large framework.

## Process placement

The architecture supports both local and detached sessions:

| Form | Editor | Engine | Use |
| --- | --- | --- | --- |
| Browser development | Browser | Local browser session plus development host services | Prove panels and engine contract quickly |
| Local Studio | Tauri webview | Same process or managed local process | Normal game and asset development |
| Detached Studio | Tauri or browser | Existing game or server process | Inspect a live runtime without importing its objects |
| Headless tools | Optional UI | Headless session | Tests, validation, import, and agent sandboxes |

Engine placement and transport remain open. Direct calls, Tauri IPC, and local network transports
must implement the same validated protocol and authority semantics.

## EditorSession

`EditorSession` is the Studio-facing facade over one engine session. It should provide coherent,
task-oriented capabilities rather than expose subsystem internals.

### Session control

- get engine, world, mode, clock, and connection status;
- pause, resume, and step ticks;
- switch attached and detached modes;
- create, compare, discard, and promote sandboxes; and
- subscribe to lifecycle changes.

### World inspection

- inspect an entity and its components;
- query entities by component, relationship, name, zone, or asset;
- read hierarchy and non-hierarchy relationships;
- inspect runtime and authored values without conflating them; and
- explain stable identity and current revisions.

### Assets and rendering

- list and inspect assets;
- follow dependencies and dependents;
- inspect an entity's geometry, material, pipeline, and render passes;
- request development-time compilation or reload;
- read structured shader and GPU diagnostics; and
- capture a frame, selection, or debug view.

### Selection and feedback

- get, set, focus, and clear selection;
- pick a semantic target from the canvas;
- create a comment from the current selection and context;
- browse and work the feedback queue; and
- link feedback to proposed changes and validation evidence.

### Mutation

- execute authorized commands;
- preview continuous editor gestures ephemerally;
- commit one coherent authored change;
- undo and redo through commands; and
- receive structured results and projection updates.

Exact method and tool names should follow the first implemented workflows. The capability groups are
the stable architecture.

## Editor modes

Mode changes alter ownership of simulation time, input, and camera. They do not reconstruct the
world.

### Attached

- Simulation runs.
- Game input is active.
- The game camera presents the view.
- Studio observes and may offer non-interfering selection.

### Detached paused

- Simulation is paused.
- Rendering continues.
- Editor input and camera are active.
- Game input and camera state are preserved.
- Inspection, editing, and tick stepping are available.

### Detached live

- Simulation continues.
- Editor input and camera are active.
- Game camera state remains preserved.
- Moving systems can be inspected from an arbitrary viewpoint.

Frame stepping is an operation while paused. The editor can request one tick, a bounded number of
ticks, or a bounded simulation duration according to session policy.

## Camera and input ownership

The editor camera is separate from the game camera. Detaching never overwrites game-camera state.
Focusing a selection moves the editor camera or its orbit target only.

Input routing follows mode and focused surface. A canvas, terminal, text input, and game controller
must not all receive the same keystroke accidentally. Studio exposes current ownership in its status
and diagnostics.

## Initial workspace

A useful first workspace contains:

- live game canvas;
- mode and stepping controls;
- scene hierarchy;
- entity and component inspector;
- asset browser and dependency view;
- console and structured diagnostics;
- command or event history;
- render-pass inspection;
- feedback queue; and
- an optional integrated terminal or agent pane.

The hierarchy is a projection of parent-child relationships. The inspector also shows non-tree
relationships, stable IDs, revisions, asset references, recent relevant history, and diagnostics.

Panels are read models. Their edit controls emit commands.

## Selection

Selection uses a shared semantic service. Selecting from the hierarchy, clicking the canvas, and
setting selection through MCP produce the same selection record.

A rich pick can include:

- entity or asset identity;
- world position and normal;
- distance;
- specialized voxel, mesh, sprite, or batch detail;
- material and pipeline;
- render pass; and
- semantic owner.

Selection is session state by default. A comment created from selection captures a durable context
record as described in [Contextual feedback](contextual-feedback_A.md).

## Contextual feedback

Studio lets a human select an exact entity, component, property, relationship, asset, render item,
pass, or diagnostic and submit a comment about it. The feedback service captures stable target
identity, relevant resource detail, revision, and the target's full ancestor hierarchy at submission.

The comment enters a queue that authorized humans and agents can inspect, claim, discuss, and
resolve through either Studio panels or MCP. A comment describes desired attention; it never mutates
the target by itself.

This turns "the grass is not green enough" into feedback about a known grass entity, material, or
property with enough context for a reviewer to inspect current and captured state.

## MCP adapter

MCP is a thin protocol adapter over `EditorSession`. It exposes task-oriented tools and read-oriented
resources in capability groups such as:

- engine and mode control;
- world and hierarchy inspection;
- selection and picking;
- assets and dependencies;
- rendering and diagnostics;
- visual capture;
- commands and sandbox management; and
- feedback queue operations.

MCP handlers validate input and call the same service as the UI. They do not simulate clicks, reach
into panel state, or add engine rules.

Read operations are side-effect free. Mutations require explicit command inputs and current
capabilities. Destructive actions, promotion, and high-cost simulation may require stronger policy or
human confirmation.

## Agent sandbox workflow

The default agent write workflow is:

```text
inspect structured state and feedback
  -> fork a bounded sandbox at a known revision
  -> apply allowed commands
  -> simulate and validate
  -> inspect diagnostics, metrics, and captures
  -> prepare a proposed change set with evidence
  -> human or policy review
  -> re-dispatch approved commands to primary authority
```

The agent does not receive raw world memory or BroMetal objects. Payload, command count, target
scope, asset size, elapsed time, and simulation work are budgeted.

## AI integration policy

Studio supports the user's existing coding-agent harness through an integrated terminal and the
structured engine surface. It does not require an Antiky-hosted AI subscription.

Optional built-in AI runs locally by default and states its model, download, memory, compute, and
privacy requirements. Hosted features use the user's own provider credentials and remain optional.
Secrets stay in the host's protected configuration and are never placed in project data, logs,
comments, or MCP results.

The terminal is a separate permission boundary from engine MCP tools. Exposing engine commands does
not implicitly authorize arbitrary shell execution, and hosting a terminal does not grant engine
mutation capabilities.

## Diagnostics and observability

Studio should make the following visible to humans and agents:

- connection, session, world, mode, clock, and revision;
- selected target and captured context;
- command result and stable rejection code;
- projection lag or incompatibility;
- shader, asset, runtime, and GPU diagnostics;
- frame, pass, draw, upload, and tick metrics;
- sandbox scope and budget usage; and
- feedback queue status and ownership.

Structured diagnostics need correlation IDs so a command, compile, resource swap, frame, capture,
and feedback response can be followed across boundaries.

## Security boundaries

- Default capabilities are narrow and deny unrequested mutation.
- IPC, local network, and MCP inputs are runtime-validated.
- Tauri exposes a narrow host API, not arbitrary filesystem or process access.
- Agent sandboxes are the default write target.
- Primary-world promotion is separately authorized and revision-checked.
- Comments and captures respect project sensitivity and access scope.
- Provider keys and other secrets never enter project state or feedback context.
- Terminal and process execution have explicit, separate policy.

## First complete workflow

The first vertical slice should prove one coherent development loop:

1. Open the running town through an `EngineSession`.
2. Pause without resetting simulation.
3. Detach and move the editor camera.
4. Select a semantic entity from hierarchy or canvas.
5. Inspect its components, assets, and render dependencies.
6. Create a target-bound comment and see it in the shared queue.
7. Let a human or agent inspect that same comment through the shared surface.
8. Test an authorized change in a sandbox.
9. Review validation evidence and promote the command set.
10. Reload only affected resources where needed.
11. Undo through a compensating command.
12. Resume from preserved state.

The workflow matters more than implementing every panel horizontally.

## Verification

- UI and MCP produce equivalent command results for equivalent capabilities.
- No panel directly mutates world or renderer state.
- Switching mode preserves world and game-camera state.
- Selection from hierarchy, canvas, and MCP resolves to the same stable target.
- Feedback created from selection retains target and hierarchy context and appears in both UI and MCP
  queues.
- A sandbox cannot change the primary world before promotion.
- Stale promotion is rejected explicitly.
- A broken resource reload preserves the last good rendered state.
- Host and engine protocols reject malformed and unauthorized payloads.
- Framework-only and headless consumers do not depend on Studio.

## Open decisions

- Web UI framework and panel-layout library.
- Engine process placement and transport.
- First canvas picking implementation.
- Exact integrated-terminal process model.
- Workspace persistence and project discovery.
- Notification behavior for feedback and diagnostics.
- Which Studio capability is implemented first after the shared editor session exists.
