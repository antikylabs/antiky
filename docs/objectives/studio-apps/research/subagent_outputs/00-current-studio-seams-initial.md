# Current Studio composition and extension seams

## Evidence labels

- **Established** — implemented in repository code or asserted by a current test.
- **Claimed** — described by documentation but not implemented or not fully verified.
- **Inferred** — conclusion from repository evidence that requires runtime or integration verification.

No files were edited and no tests were run; this was a repository evidence pass.

## Findings

1. **Established:** Studio is one hard-coded application shell, not an application host. `App` creates project and development state, then renders a single `StudioShell` (`packages/studio/app/src/App.tsx:34-90`). `StudioShell` directly composes Live, Terminal, Inspection, and Activity panels (`packages/studio/app/src/components/StudioShell.tsx:290-360`). The layout is a fixed two-by-two CSS grid (`packages/studio/app/src/styles.css:245-258`) that becomes a fixed vertical stack below 760 px (`packages/studio/app/src/responsive.css:1-59`).

2. **Established:** The strongest existing extension seams are below the panel layer:

   - `EditorHost` isolates project selection, validation, activation, recents, creation, and project events (`packages/studio/app/src/editor/types.ts:47-56`).
   - `StudioDevelopmentCoordinator` isolates polling, stale-state handling, session replacement, and serialized controls behind injected clients and lifecycle callbacks (`packages/studio/app/src/development/coordinator.ts:19-72`, `packages/studio/app/src/development/coordinator.ts:137-384`).
   - The shared browser `DevelopmentClient` already exposes validated inspection, capture, evidence, mutation, and simulation operations (`packages/cli/src/development/browser-client.ts:76-120`, `packages/cli/src/development/browser-client.ts:510-599`).
   - The CLI development-session handle owns service startup and complete cleanup (`packages/cli/src/host/session.ts:76-101`, `packages/cli/src/host/session.ts:522-704`).

3. **Established:** `Panel` is only a visual primitive. Its contract contains a title, optional actions, children, class name, and a closed four-value workspace-area union; it has no identity, activation, disposal, service context, command contributions, state serialization, or placement metadata (`packages/studio/app/src/components/primitives.tsx:3-24`).

4. **Established:** Project activation is a meaningful lifecycle boundary. `ProjectManager` validates the candidate, runs `beforeProjectSwitch`, activates it through `EditorHost`, and only then publishes the new project (`packages/studio/app/src/editor/projectManager.ts:81-150`). Studio uses that hook to close the native terminal before switching (`packages/studio/app/src/editor/useEditorProject.ts:20-40`). The development hook keys a coordinator by manifest path and revision and replaces it when the active project changes (`packages/studio/app/src/development/useStudioDevelopment.ts:56-97`).

5. **Established:** Development state has one central owner. The coordinator polls snapshot and MCP log together, rejects mismatched sessions, publishes them atomically, and retains a stale snapshot after repeated failures (`packages/studio/app/src/development/coordinator.ts:137-220`). Controls and lifecycle operations are serialized (`packages/studio/app/src/development/coordinator.ts:224-384`). Unit tests cover atomic session replacement, stale recovery, connected reload, and serialized controls (`packages/studio/app/src/development/coordinator.test.ts:132-207`, `packages/studio/app/src/development/coordinator.test.ts:229-354`).

6. **Established:** The current Live panel is not a reusable WebGPU viewport. It is an iframe that receives a session-scoped game URL and permits scripts, same-origin content, pointer lock, gamepad, fullscreen, and WebGPU (`packages/studio/app/src/components/LiveGameFrame.tsx:1-20`). The CLI game host creates and owns the actual canvas, input listeners, module lifecycle, and animation frame (`packages/cli/src/host/game-server.ts:38-60`, `packages/cli/src/host/game-server.ts:398-507`).

7. **Established:** The native terminal is a specialized singleton-style native overlay rather than a normal React surface. `NativeTerminal` sends DOM bounds, visibility, focus, and close commands to Tauri (`packages/studio/app/src/components/NativeTerminal.tsx:103-245`). The Objective-C bridge stores one static Ghostty app/config/view and reuses the existing view on subsequent open calls (`packages/studio/app/src-tauri/native/terminal_bridge.m:15-18`, `packages/studio/app/src-tauri/native/terminal_bridge.m:349-413`). The shell and working directory are fixed to `/bin/zsh -d -i` and the active project root (`packages/studio/app/src-tauri/native/terminal_bridge.m:384-413`).

8. **Established:** Inspection and Activity are read-only projections of central state. `InspectionPanel` locally selects Hierarchy, Stores, or raw Snapshot views and accepts no action callbacks (`packages/studio/app/src/components/InspectionPanel.tsx:71-175`). `ActivityPanel` locally selects Events, MCP calls, or Diagnostics and likewise exposes no mutation interface (`packages/studio/app/src/components/ActivityPanel.tsx:12-183`).

9. **Established:** Native platform behavior is not fully hidden behind `EditorHost`. Besides the intended Tauri project adapter, the development adapter imports Tauri directly, `NativeTerminal` invokes Tauri directly, and `StudioShell` imports the Tauri window API for fullscreen (`packages/studio/app/src/editor/tauriHost.ts:1-2`, `packages/studio/app/src/development/native.ts:1`, `packages/studio/app/src/components/NativeTerminal.tsx:1`, `packages/studio/app/src/components/StudioShell.tsx:5`). This differs from the accepted portable-host decision that only the adapter should import Tauri (`docs/adr/studio/0002-editor-host-boundary.md:24-45`).

10. **Established:** The architecture intentionally prevents Studio panels from receiving live renderer or GPU objects. The game module or render driver owns renderer resources, while Studio consumes inspection data (`docs/adr/studio/0007-renderer-neutral-game-host.md:20-59`, `docs/adr/framework/0021-brometal-render-driver.md:29-61`). Live or GPU-backed objects must not cross the serialization boundary (`docs/adr/framework/0010-serialize-only-at-real-boundaries.md:18-48`).

## Component and ownership map

```text
main.tsx
├─ owns platform detection, storage, URL/hash page state
└─ App
   ├─ useEditorProject
   │  └─ ProjectManager → EditorHost/Tauri project adapter
   ├─ useStudioDevelopment(active project)
   │  └─ StudioDevelopmentCoordinator
   │     ├─ Tauri DevelopmentHost / packaged CLI worker
   │     └─ browser DevelopmentClient
   ├─ ProjectLauncher or Settings when no native project is active
   └─ StudioShell
      ├─ title controls: pause/resume/step/refresh/restart/stop
      ├─ Live Panel → LiveGameFrame → CLI-owned game-host canvas
      ├─ Terminal Panel → NativeTerminal → singleton native Ghostty view
      ├─ InspectionPanel → snapshot-derived read-only views
      ├─ ActivityPanel → events/MCP/diagnostic read-only views
      ├─ Settings overlay
      └─ status bar
```

Evidence: `packages/studio/app/src/main.tsx:28-58`, `packages/studio/app/src/App.tsx:34-90`, `packages/studio/app/src/components/StudioShell.tsx:74-418`, `packages/studio/app/src/development/useStudioDevelopment.ts:47-132`.

| Owner | Current responsibility | Existing seam | Missing application-level concern |
|---|---|---|---|
| `main.tsx` / `App` | Platform, storage, page selection, active project, development lifecycle | Props passed into `StudioShell` | No app discovery, registration, activation, or routing contract (`packages/studio/app/src/main.tsx:28-58`, `packages/studio/app/src/App.tsx:34-90`) |
| `ProjectManager` | Ordered project validation and activation | Injectable `EditorHost`, switch hook, state callback (`packages/studio/app/src/editor/projectManager.ts:22-47`) | No project-scoped app configuration |
| `StudioDevelopmentCoordinator` | One connection, polling, stale state, controls | Injectable discovery/client/lifecycle/scheduler (`packages/studio/app/src/development/coordinator.ts:50-72`) | Hook exposes a fixed action set and state rather than a reusable scoped service (`packages/studio/app/src/development/useStudioDevelopment.ts:99-132`) |
| `StudioShell` | Layout, controls, fullscreen, resizers, all surfaces | React props | Direct knowledge of every surface and its data dependencies (`packages/studio/app/src/components/StudioShell.tsx:74-204`, `packages/studio/app/src/components/StudioShell.tsx:206-421`) |
| CLI development session | Game host, inspection service, build/shader processes, cleanup | Typed lifecycle handle (`packages/cli/src/host/session.ts:76-101`) | No Studio-app ownership; correctly remains service/runtime infrastructure |

## Current-panel capability matrix

| Surface | Data and rendering | Mutation authority | Lifecycle and platform | Current composability limit |
|---|---|---|---|---|
| Live | Receives only `sessionId` and `gameUrl`; renderer and canvas remain inside the iframe/game host (`packages/studio/app/src/components/LiveGameFrame.tsx:1-20`, `packages/cli/src/host/game-server.ts:38-60`) | Game input is owned inside the host while its canvas is focused (`packages/cli/src/host/game-server.ts:419-446`) | Mounted while a snapshot exists, including stale reconnect state; removed when stopped (`packages/studio/app/src/components/StudioShell.tsx:309-335`) | URL/iframe seam only; Studio has no canvas, device, render-driver, or scene-camera handle |
| Terminal | Native Ghostty view positioned over a React placeholder (`packages/studio/app/src/components/NativeTerminal.tsx:103-245`) | Arbitrary project-root shell, separate from engine command authority (`packages/studio/app/src-tauri/native/terminal_bridge.m:384-413`, `docs/adr/studio/0001-terminal-and-engine-command-boundaries.md:15-26`) | macOS/Tauri capability; hidden by null bounds and closed on switch/unmount (`packages/studio/app/src/components/NativeTerminal.tsx:121-157`, `packages/studio/app/src/editor/useEditorProject.ts:29-39`) | One global native view; not currently a multi-instance React panel |
| Inspection | Whole `DevelopmentSnapshotV2`; derives hierarchy, components, relationships, stores, and raw JSON (`packages/studio/app/src/components/InspectionPanel.tsx:71-175`) | None | Local active-tab state; direct child of shell | No selection service, command service, or surface descriptor |
| Activity | Snapshot events, MCP log, coordinator issue, framework and CLI diagnostics (`packages/studio/app/src/components/ActivityPanel.tsx:12-183`) | None | Local active-tab state; direct child of shell | No action or contribution API |
| Simulation controls | Fixed titlebar action list with availability derived in `StudioShell` (`packages/studio/app/src/components/StudioShell.tsx:36-38`, `packages/studio/app/src/components/StudioShell.tsx:97-117`, `packages/studio/app/src/components/StudioShell.tsx:220-251`) | Coordinator pause/resume/step/reload/stop/restart | Shared shell chrome | Commands are not discoverable or contributable by a surface |
| Status | Fixed connection, revision, mode, and stale facts (`packages/studio/app/src/components/StudioShell.tsx:411-418`) | None | Shell-owned | No contribution or contextual-status contract |

## Concrete seams and blockers

### Existing seams worth preserving

- **Established:** `ProjectManager` is independently testable because project I/O and the pre-switch lifecycle hook are injected (`packages/studio/app/src/editor/projectManager.ts:33-47`). Its tests cover cold start, cancellation, revision changes, invalid candidates preserving the active project, duplicate events, recents, and project creation (`packages/studio/app/src/editor/projectManager.test.ts:46-146`, `packages/studio/app/src/editor/projectManager.test.ts:199-245`).

- **Established:** `StudioDevelopmentCoordinator` is independently testable because discovery, client construction, lifecycle operations, scheduling, and state publishing are injected (`packages/studio/app/src/development/coordinator.ts:50-72`). This is a stronger service seam than any current panel abstraction.

- **Established:** The browser-safe `DevelopmentClient` validates loopback origin, session identity, and credentials before returning its operations (`packages/cli/src/development/browser-client.ts:185-219`, `packages/cli/src/development/browser-client.ts:295-430`). This provides an existing validated capability boundary for future consumers.

- **Established:** Project validation has prepare/activate semantics. Native activation only changes the active project after the exact prepared candidate succeeds, and tests assert that an invalid candidate preserves the active project (`packages/studio/app/src-tauri/src/project.rs:62-184`, `packages/studio/app/src-tauri/src/project.rs:385-450`).

### Composition blockers and change amplification

- **Established:** Adding a fifth panel currently requires coordinated edits across shell imports/props/JSX, the closed `workspaceArea` union, desktop CSS grid, responsive CSS, and source-oriented tests (`packages/studio/app/src/components/StudioShell.tsx:290-401`, `packages/studio/app/src/components/primitives.tsx:3-24`, `packages/studio/app/src/styles.css:245-258`, `packages/studio/app/src/responsive.css:1-59`, `packages/studio/app/src/components/StudioShell.test.tsx:258-282`).

- **Established:** Workspace split positions and active tabs are component-local state (`packages/studio/app/src/components/StudioShell.tsx:74-95`, `packages/studio/app/src/components/InspectionPanel.tsx:137-175`, `packages/studio/app/src/components/ActivityPanel.tsx:153-183`). The only persisted browser state initialized by `main.tsx` is the SSPS/local-storage state (`packages/studio/app/src/main.tsx:28-58`).

- **Inferred:** A project-to-project transition should preserve shell split and tab state because the active `StudioShell` remains at the same React tree position while `ProjectManager` replaces the project only after activation (`packages/studio/app/src/App.tsx:75-89`, `packages/studio/app/src/editor/projectManager.ts:126-150`). Reload persistence and deliberate per-project state are not implemented or tested.

- **Established:** Fullscreen and Settings hide or cover existing surfaces rather than redefining the workspace. Fullscreen uses CSS to hide non-game panels (`packages/studio/app/src/styles.css:260-288`), and Settings is rendered beside the workspace (`packages/studio/app/src/components/StudioShell.tsx:404-409`). The static shell test asserts that all four surfaces remain present on the Settings page (`packages/studio/app/src/components/StudioShell.test.tsx:258-282`).

- **Inferred:** Panel failures share the shell’s React failure domain because all panels are direct children and no boundary is present in this composition (`packages/studio/app/src/components/StudioShell.tsx:290-360`). An interactive test with a deliberately throwing surface would establish the actual containment behavior.

- **Established:** The Studio package is private and publishes no exports, so there is no package-level contribution API (`packages/studio/app/package.json:1-29`).

- **Established:** The accepted project format is exact and intentionally rejects unknown fields (`docs/adr/studio/0005-project-schema-and-identity.md:19-73`). Application declarations cannot be added to `.antiky` as arbitrary metadata without an explicit schema/version decision.

### Native and lifecycle blockers

- **Established:** The development hook’s polling discovery callback calls `startNativeDevelopmentConnection`, not the separately implemented passive discovery function (`packages/studio/app/src/development/useStudioDevelopment.ts:80-87`, `packages/studio/app/src/development/native.ts:83-108`). `DevelopmentHost` makes same-project, same-revision starts idempotent (`packages/studio/app/src-tauri/src/development.rs:248-268`), but service discovery and service startup are currently conflated.

- **Inferred:** Multiple `NativeTerminal` instances would contend for one native view because the bridge stores one static view and an additional open only repositions it (`packages/studio/app/src-tauri/native/terminal_bridge.m:15-18`, `packages/studio/app/src-tauri/native/terminal_bridge.m:349-350`). A two-mount native integration test would establish exact focus/layout behavior.

- **Established:** React invokes `development_restart`, Rust implements and registers it, but the generated command-permission list and main capability omit it (`packages/studio/app/src/development/native.ts:101-104`, `packages/studio/app/src-tauri/src/commands.rs:238-257`, `packages/studio/app/src-tauri/src/lib.rs:154-171`, `packages/studio/app/src-tauri/build.rs:3-19`, `packages/studio/app/src-tauri/capabilities/main.json:6-25`).

- **Inferred:** A stopped-session Restart is likely denied at the packaged Tauri permission boundary. Existing tests mock the invoke boundary and freeze the capability list without exercising a packaged call (`packages/studio/app/src/development/native.test.ts:36-64`, `packages/studio/app/src-tauri/tests/tauri-config.test.mjs:34-59`). A packaged-app IPC test or runtime trace would confirm or reject this.

- **Claimed:** Workspace close stops the local development lifecycle (`docs/user/studio/development-connection.md:45-47`).

- **Established:** React cleanup requests a development stop on effect teardown (`packages/studio/app/src/development/useStudioDevelopment.ts:91-96`), but the Tauri application callback only handles opened URLs and has no explicit exit cleanup (`packages/studio/app/src-tauri/src/lib.rs:175-183`). `DevelopmentHost::drop` kills the worker directly (`packages/studio/app/src-tauri/src/development.rs:338-344`), while graceful worker shutdown is what calls the CLI session’s full cleanup (`packages/cli/src/studio-worker.ts:103-127`, `packages/cli/src/host/session.ts:522-612`).

- **Inferred:** Graceful cleanup of detached descendants during application close is not established. An application-close integration test observing child processes, ports, and the connection descriptor would answer it.

## Documented versus implemented

| Topic | Documentation | Repository implementation |
|---|---|---|
| Architecture status | **Claimed:** The Studio overview is explicitly “In Progress” (`docs/architecture/studio/overview_A.md:1-3`). | It should not be treated as a record of current behavior where it conflicts with accepted ADRs or code. |
| Service startup | **Claimed/stale:** The overview says `antiky dev` supervises the project and Studio reads its descriptor (`docs/architecture/studio/overview_A.md:54-77`). That reflects the superseded Studio ADR 0004 (`docs/adr/studio/0004-attach-to-cli-development-session.md:3-5`, `docs/adr/studio/0004-attach-to-cli-development-session.md:30-36`). | **Established:** Tauri starts a packaged Node worker that imports the shared CLI session API (`packages/studio/app/src-tauri/src/development.rs:236-335`, `packages/cli/src/studio-worker.ts:33-101`). The packaged-worker model is the accepted boundary (`docs/adr/studio/0006-native-project-service.md:24-57`). |
| Portable host | **Claimed:** Only a small host adapter should import Tauri (`docs/adr/studio/0002-editor-host-boundary.md:24-45`, `docs/architecture/studio/overview_A.md:79-96`). | **Established divergence:** `StudioShell` and `NativeTerminal` import Tauri directly, in addition to the project and development adapters (`packages/studio/app/src/components/StudioShell.tsx:5`, `packages/studio/app/src/components/NativeTerminal.tsx:1`). |
| Browser/detached Studio | **Claimed:** The overview describes browser, local, detached, play, and editor-session forms (`docs/architecture/studio/overview_A.md:121-183`). | **Established:** The hook forces browser mode to disconnected and constructs a native connection only when a native project is active (`packages/studio/app/src/development/useStudioDevelopment.ts:63-77`). No production `EditorSession` implementation is present in the traced Studio tree. |
| Input/editor modes | **Claimed:** The overview describes input ownership and editor modes in Studio status (`docs/architecture/studio/overview_A.md:217-225`). | **Established:** Input focus is owned inside the game-host iframe (`packages/cli/src/host/game-server.ts:419-446`), while the current status bar only shows fixed connection/session facts (`packages/studio/app/src/components/StudioShell.tsx:411-418`). |
| Workspace | **Claimed and substantially implemented:** The overview describes the initial four-surface workspace and read-only inspection panels (`docs/architecture/studio/overview_A.md:227-245`). | **Established:** Those four surfaces are directly composed by `StudioShell`; Inspection and Activity are read-only (`packages/studio/app/src/components/StudioShell.tsx:290-360`, `packages/studio/app/src/components/InspectionPanel.tsx:71-175`). |
| Project metadata | **Claimed:** The projects guide says Studio shows project name, manifest path, schema, and root (`docs/user/studio/projects.md:82-84`). | **Established:** The shell deliberately renders the name without path/schema/root; its test checks that those details do not appear (`packages/studio/app/src/components/StudioShell.test.tsx:227-256`). The getting-started guide’s narrower description matches current behavior (`docs/user/studio/getting-started.md:33-35`). |
| Stop and restart | **Claimed:** The user guide says Stop followed by Restart starts a fresh local session (`docs/user/studio/getting-started.md:123-131`). | **Inferred risk:** Coordinator behavior exists, but native restart permission appears absent from the packaged capability boundary, as detailed above. |
| Renderer ownership | **Claimed and established:** Studio is renderer-neutral and should inspect validated state rather than renderer objects (`docs/user/studio/renderers.md:1-28`, `docs/user/studio/renderers.md:132-163`). | The iframe/game-host boundary and accepted ADRs implement that ownership (`packages/studio/app/src/components/LiveGameFrame.tsx:1-20`, `docs/adr/studio/0007-renderer-neutral-game-host.md:20-59`). |

## Test coverage relevant to extension work

- **Established:** Project lifecycle and development coordination have behavioral unit tests around their injected boundaries (`packages/studio/app/src/editor/projectManager.test.ts:46-245`, `packages/studio/app/src/development/coordinator.test.ts:132-354`).

- **Established:** Workspace sizing is isolated into pure functions and has boundary tests (`packages/studio/app/src/components/workspaceLayout.ts:10-18`, `packages/studio/app/src/components/workspaceLayout.test.ts:11-34`).

- **Established:** Tauri response parsing is strict and bounded at the JavaScript boundary (`packages/studio/app/src/editor/tauriHost.ts:72-139`, `packages/studio/app/src/editor/tauriHost.test.ts:22-80`).

- **Established:** Current shell and frame tests are primarily server-rendered markup or source assertions. `StudioShell.test.tsx` reads source directly (`packages/studio/app/src/components/StudioShell.test.tsx:1-18`, `packages/studio/app/src/components/StudioShell.test.tsx:380-400`), and the Live frame test uses static markup rather than a browser mount (`packages/studio/app/src/components/LiveGameFrame.test.tsx:11-21`).

- **Inferred:** Existing UI tests cannot establish mount/unmount behavior, error isolation, focus transfer, resizer interaction, state retention, iframe messaging, or native-view coordination. Browser-mounted and packaged-Tauri tests at those cut points would answer those questions.

## Gaps and what would answer them

- **Restart permission:** Unknown whether `development_restart` succeeds in the packaged app. A real Tauri IPC test after Stop would answer it; current mock tests cannot (`packages/studio/app/src/development/native.test.ts:36-64`).

- **Application-close cleanup:** Unknown whether worker descendants and loopback services are cleaned up on window/application exit. A packaged close test that checks process groups, ports, and descriptor removal would answer it (`packages/studio/app/src-tauri/src/development.rs:338-344`, `packages/cli/src/host/session.ts:522-612`).

- **Surface lifecycle semantics:** There is no established rule for whether hidden, inactive, project-switched, or fullscreen surfaces remain mounted. A browser-mounted lifecycle test with observable activation/disposal callbacks would define the behavior; current CSS and static tests only establish visibility/tree structure (`packages/studio/app/src/styles.css:260-288`, `packages/studio/app/src/components/StudioShell.test.tsx:258-282`).

- **State ownership:** There is no implemented persistence or project scope for splits and panel tabs (`packages/studio/app/src/components/StudioShell.tsx:74-95`, `packages/studio/app/src/components/InspectionPanel.tsx:137-175`). A product decision on global versus project-specific workspace state is required before its behavior can be verified.

- **Native terminal multiplicity:** The single-view bridge does not establish desired behavior for two terminal contributions. A native two-instance experiment would determine whether the surface must remain an explicit singleton (`packages/studio/app/src-tauri/native/terminal_bridge.m:15-18`, `packages/studio/app/src-tauri/native/terminal_bridge.m:349-350`).

- **Browser and detached modes:** Documentation describes them, but the current hook has no browser connection injection (`packages/studio/app/src/development/useStudioDevelopment.ts:63-77`). A concrete supported launch flow and security model would be needed before these can be treated as requirements.

- **Application discovery/configuration:** No registry or contribution contract is implemented, and the project schema rejects unknown fields (`packages/studio/app/src/components/primitives.tsx:3-24`, `docs/adr/studio/0005-project-schema-and-identity.md:19-73`). A decision about built-in-only registration versus project-manifest selection would determine whether schema work is necessary.

## Planning implications

- The current natural cut points are `EditorHost`, `ProjectManager`, `StudioDevelopmentCoordinator`, the validated `DevelopmentClient`, and the CLI lifecycle handle—not the presentational `Panel` component (`packages/studio/app/src/editor/types.ts:47-56`, `packages/studio/app/src/development/coordinator.ts:50-72`, `packages/cli/src/development/browser-client.ts:76-120`). This aligns with the repository guidance to factor at narrow, proven seams and avoid premature shallow abstractions (`docs/GOOD_ENGINEERING_H.md:12-22`).

- A composable surface boundary would need explicit identity, placement, activation/visibility/disposal behavior, and narrowly scoped services. Passing `StudioShell` state or raw Tauri APIs through an open-ended context would reproduce the current coupling and weaken information hiding (`docs/GOOD_ENGINEERING_H.md:95-98`).

- Shared development polling and native-service startup should remain centrally owned. Independent surface coordinators would duplicate network traffic and lifecycle authority already serialized by the coordinator and native adapter (`packages/studio/app/src/development/coordinator.ts:137-220`, `packages/studio/app/src/development/native.ts:83-108`).

- Surface capabilities should expose validated snapshots and command operations, not mutable worlds or renderer/GPU objects. Accepted decisions assign changes to versioned commands and keep renderer ownership in the game module or render driver (`docs/adr/framework/0007-command-owned-world-mutation.md:27-60`, `docs/adr/studio/0007-renderer-neutral-game-host.md:20-59`).

- A Studio-owned WebGPU viewport is a distinct capability from the existing Live iframe. Reusing the iframe preserves the present game experience; an in-process viewport would require an explicit new ownership/lifecycle boundary because the present Studio has neither a canvas nor GPU resource authority (`packages/studio/app/src/components/LiveGameFrame.tsx:1-20`, `docs/adr/framework/0021-brometal-render-driver.md:29-61`).

- The terminal should remain an explicitly specialized native capability until singleton versus multi-instance ownership is decided. Treating it as an ordinary React contribution would conceal its native overlay, focus, geometry, and process-lifecycle constraints (`packages/studio/app/src/components/NativeTerminal.tsx:103-245`, `packages/studio/app/src-tauri/native/terminal_bridge.m:349-481`).

- Integration coverage is most valuable at surface activation/disposal, project switch, native restart, and application close. Those are the system cut points with the least current evidence, consistent with the repository preference for integration tests around critical boundaries (`docs/GOOD_ENGINEERING_H.md:57-61`).

- Any composition work should remain incremental and preserve the existing four-surface game-editor workflow. That matches both the objective’s stated constraint and the repository direction to grow Studio from concrete slices rather than attempting a complete engine abstraction (`docs/VISION_DIRECTION_H.md:31-50`, `docs/VISION_DIRECTION_H.md:52-70`).
