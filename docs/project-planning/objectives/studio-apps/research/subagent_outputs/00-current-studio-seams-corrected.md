# Corrected report: Current Studio composition and extension seams

## Validation note

This is a complete replacement for the first report. Every cited path below was checked against the current worktree and every cited line range was re-read.

No files were edited and no tests were run.

### Findings changed after validation

- **Changed:** The accepted Studio ADR does not explicitly define terminal authority and engine-command authority as separate permission systems. It establishes that a user-selected coding agent runs in the terminal and connects to a structured engine API (`docs/adr/studio/0001-ai-integrations_H.md:15-23`). The explicit separate-permissions statement appears in the in-progress architecture guide (`docs/architecture/studio/overview_A.md:344-356`). The implementation does use separate terminal IPC and development-client paths, but the permission-policy wording must be labelled **Claimed**, not established by ADR 0001.

- **Changed/refined:** There is an application-lifecycle test, but it is a source assertion that the Tauri run callback does not close the native terminal during AppKit termination (`packages/studio/tauri/tests/app-lifecycle.test.mjs:7-16`). It does not verify development-worker or descendant-process cleanup. The earlier application-close cleanup gap therefore remains, but “no lifecycle test exists” was incorrect.

- **Path corrections:** The native host is under `packages/studio/tauri/`; `NativeTerminal.tsx` is directly under `packages/studio/app/src/`; accepted ADR filenames carry their actual `_H.md` names; Studio user documentation is under `docs/user-facing-docs/studio/`.

No other substantive finding changed after path and line validation.

## Findings

1. **Established:** Studio is one hard-coded application shell, not an application host. `App` owns page state, project state, and development state and renders one `StudioShell` (`packages/studio/app/src/App.tsx:34-90`). `StudioShell` directly composes Live game, Terminal, Inspection, and Activity surfaces (`packages/studio/app/src/components/StudioShell.tsx:283-360`).

2. **Established:** The workspace is a fixed two-by-two CSS grid with fixed area names (`packages/studio/app/src/styles.css:245-258`). Below 760 px it becomes a fixed vertical stack in Live game, Terminal, Inspection, Activity order (`packages/studio/app/src/responsive.css:1-59`).

3. **Established:** `Panel` is a visual primitive, not an extension contract. It accepts a title, actions, children, class name, and a closed four-value `workspaceArea` union; it defines no identity, registration, activation, disposal, commands, service access, state restoration, or placement metadata (`packages/studio/app/src/components/primitives.tsx:3-24`).

4. **Established:** The real reusable seams are below the visual panel layer:

   - `EditorHost` owns bounded project operations (`packages/studio/app/src/editor/types.ts:47-56`).
   - `ProjectManager` isolates ordered project validation and activation behind an injected host and switch hook (`packages/studio/app/src/editor/projectManager.ts:33-47`, `packages/studio/app/src/editor/projectManager.ts:111-150`).
   - `StudioDevelopmentCoordinator` isolates polling, stale state, session replacement, controls, and lifecycle operations behind injected callbacks (`packages/studio/app/src/development/coordinator.ts:50-72`, `packages/studio/app/src/development/coordinator.ts:137-384`).
   - The CLI `DevelopmentClient` is a validated browser-safe operation boundary (`packages/cli/src/development/browser-client.ts:76-120`, `packages/cli/src/development/browser-client.ts:185-219`).
   - The CLI development-session handle owns project-service status and cleanup (`packages/cli/src/host/session.ts:91-101`, `packages/cli/src/host/session.ts:522-612`).

5. **Established:** Studio has one central development-state owner. The coordinator polls the snapshot and MCP log together, rejects data from a different session, and publishes the pair atomically (`packages/studio/app/src/development/coordinator.ts:170-207`). It retains the previous snapshot as stale after three consecutive failures (`packages/studio/app/src/development/coordinator.ts:60`, `packages/studio/app/src/development/coordinator.ts:196-207`).

6. **Established:** The development hook creates one coordinator per active native project revision. Its key is the manifest path plus revision, and browser mode receives no connection (`packages/studio/app/src/development/useStudioDevelopment.ts:56-77`). Cleanup stops the coordinator and asks the native host to stop the service (`packages/studio/app/src/development/useStudioDevelopment.ts:79-97`).

7. **Established:** The current Live game surface is not an in-process canvas or reusable WebGPU viewport. It is an iframe receiving only a development-session ID and game URL (`packages/studio/app/src/components/LiveGameFrame.tsx:1-20`). The CLI game host creates the canvas and owns sizing, input, game-module mounting, frame scheduling, and disposal (`packages/cli/src/host/game-server.ts:38-60`, `packages/cli/src/host/game-server.ts:398-507`).

8. **Established:** The native terminal is a specialized native overlay rather than an ordinary React-rendered terminal. `NativeTerminal` measures a DOM placeholder and sends open, layout, focus, hide, and close operations over Tauri IPC (`packages/studio/app/src/NativeTerminal.tsx:103-245`). The native bridge stores one static Ghostty app/config/view and reuses the existing view on another open (`packages/studio/tauri/src/native/terminal_bridge.m:15-18`, `packages/studio/tauri/src/native/terminal_bridge.m:335-350`).

9. **Established:** Inspection and Activity are read-only projections of centrally supplied state. `InspectionPanel` receives a complete `DevelopmentSnapshotV2`, derives hierarchy/store/raw-snapshot views, and exposes no command callbacks (`packages/studio/app/src/components/InspectionPanel.tsx:71-175`). `ActivityPanel` receives snapshot, MCP log, coordinator issue, and stale state and exposes no mutation callbacks (`packages/studio/app/src/components/ActivityPanel.tsx:122-183`).

10. **Established:** The accepted architecture forbids panels from becoming new world or renderer authorities. External state changes use versioned commands (`docs/adr/framework/0007-commands-as-mutation-boundary_H.md:27-60`). Renderer resources stay with the game module or `BroMetalRenderDriver`, and Studio receives inspection copies rather than renderer objects (`docs/adr/studio/0007-framework-first-allow-others_H.md:41-59`, `docs/adr/framework/0021-brometal-render-driver-ownership_H.md:29-61`).

## Component and ownership map

```text
main.tsx
├─ platform detection, URL/hash page state, SSPS preference
└─ App
   ├─ useEditorProject(platform)
   │  └─ ProjectManager
   │     └─ EditorHost / Tauri project adapter
   ├─ useStudioDevelopment(platform, activeProject)
   │  └─ StudioDevelopmentCoordinator
   │     ├─ Tauri DevelopmentHost
   │     │  └─ packaged Node worker
   │     │     └─ CLI startDevelopmentSession()
   │     └─ browser-safe DevelopmentClient
   ├─ ProjectLauncher / Settings when no native project is active
   └─ StudioShell
      ├─ titlebar simulation and lifecycle controls
      ├─ Live Panel
      │  └─ LiveGameFrame iframe
      │     └─ CLI-owned game-host page and canvas
      ├─ Terminal Panel
      │  └─ NativeTerminal
      │     └─ singleton native Ghostty view
      ├─ InspectionPanel
      ├─ ActivityPanel
      ├─ Settings overlay
      └─ status bar
```

Evidence for the top-level composition is `packages/studio/app/src/main.tsx:28-58`, `packages/studio/app/src/App.tsx:34-90`, and `packages/studio/app/src/components/StudioShell.tsx:206-421`.

| Owner | Current responsibility | Real seam | Missing application concern |
|---|---|---|---|
| `main.tsx` / `App` | Platform, settings route, active project, development state | Props passed to `StudioShell` (`packages/studio/app/src/App.tsx:75-89`) | No app discovery, registration, activation, or routing |
| `ProjectManager` | Ordered validation and activation | Injected `EditorHost`, switch hook, and state callback (`packages/studio/app/src/editor/projectManager.ts:33-47`) | No project-scoped app configuration |
| `StudioDevelopmentCoordinator` | Connection, polling, stale data, controls, stop/restart | Injected client, discovery, lifecycle, scheduler (`packages/studio/app/src/development/coordinator.ts:50-72`) | Hook exposes fixed actions rather than a reusable scoped service (`packages/studio/app/src/development/useStudioDevelopment.ts:99-132`) |
| `StudioShell` | Layout, fullscreen, resizers, controls, every surface | React props | Direct knowledge of all surface types and their data requirements (`packages/studio/app/src/components/StudioShell.tsx:74-204`, `packages/studio/app/src/components/StudioShell.tsx:283-418`) |
| Tauri `ProjectHost` | Prepared and active native project boundary | Stage, validate, activate (`packages/studio/tauri/src/project.rs:62-184`) | No app/plugin loading authority |
| Tauri `DevelopmentHost` | Packaged-worker process and bounded connection | Start, reuse, restart, stop (`packages/studio/tauri/src/development.rs:236-344`) | Does not expose UI contributions |
| CLI development session | Build watcher, game host, inspection/MCP, captures, child processes, cleanup | Typed lifecycle handle (`packages/cli/src/host/session.ts:91-101`) | Correctly remains service/runtime infrastructure, not workspace composition |

## Current-panel capability matrix

| Surface | Data/render source | Mutation authority | Mount/platform behavior | Current composability limit |
|---|---|---|---|---|
| Live game | Session ID and game URL rendered as iframe (`packages/studio/app/src/components/LiveGameFrame.tsx:1-20`) | Game input stays inside the host canvas while focused (`packages/cli/src/host/game-server.ts:419-446`) | Rendered while a snapshot exists, retained during stale reconnect state, removed when stopped (`packages/studio/app/src/components/StudioShell.tsx:309-335`) | URL/iframe seam only; Studio receives no canvas, GPU device, render driver, or camera |
| Terminal | DOM geometry controls one native Ghostty view (`packages/studio/app/src/NativeTerminal.tsx:121-180`) | Project-root `/bin/zsh -d -i` shell, outside the development command API (`packages/studio/tauri/src/commands.rs:269-289`, `packages/studio/tauri/src/native/terminal_bridge.m:395-413`) | Native macOS only; hidden through null layout while Settings is open and closed on switch/unmount (`packages/studio/app/src/components/StudioShell.tsx:339-350`, `packages/studio/app/src/NativeTerminal.tsx:198-216`) | One global native view; no multi-instance identity |
| Inspection | Whole `DevelopmentSnapshotV2`; hierarchy, stores, raw snapshot (`packages/studio/app/src/components/InspectionPanel.tsx:137-175`) | None | Local tab state; direct shell child | No selection, commands, service scope, or disposal contract |
| Activity | Snapshot events, MCP log, Studio issue, CLI/Framework diagnostics (`packages/studio/app/src/components/ActivityPanel.tsx:14-151`, `packages/studio/app/src/components/ActivityPanel.tsx:153-183`) | None | Local tab state; direct shell child | No action or contribution API |
| Simulation controls | Fixed `pause`, `resume`, `step`, `refresh`, `restartGame`, `stopGame` interface (`packages/studio/app/src/components/StudioShell.tsx:36-38`) | Coordinator and development client | Shell titlebar only (`packages/studio/app/src/components/StudioShell.tsx:213-251`) | Commands are neither discoverable nor contributable |
| Status bar | Fixed connection/build/runtime/step/frame/draw facts (`packages/studio/app/src/components/StudioShell.tsx:411-418`) | None | Shell-owned | No contextual status contribution seam |

## State and lifecycle behavior

### Project activation

- **Established:** `ProjectManager` parses the shared manifest, validates the native boundary, runs `beforeProjectSwitch` for a different path or revision, calls native activation, and only then publishes the new project (`packages/studio/app/src/editor/projectManager.ts:111-140`).

- **Established:** Studio supplies `closeNativeTerminal` as the pre-switch hook (`packages/studio/app/src/editor/useEditorProject.ts:20-40`).

- **Established:** Native project state uses separate pending, prepared, and active slots. Activation accepts only the exact prepared selection/path/revision (`packages/studio/tauri/src/project.rs:62-69`, `packages/studio/tauri/src/project.rs:122-170`).

- **Established:** Invalid native candidates preserve the existing active project. The Rust test covers validation without activation and failed replacement (`packages/studio/tauri/src/project.rs:385-450`); the TypeScript manager test covers invalid JSON preserving the active project (`packages/studio/app/tests/editor/projectManager.test.ts:92-146`).

- **Inferred:** Project switching depends on React effect cleanup to stop the old development service after native project activation and state publication. `project_activate` itself only changes project state and recents (`packages/studio/tauri/src/commands.rs:183-207`); the subsequent project-key change triggers development cleanup (`packages/studio/app/src/development/useStudioDevelopment.ts:91-97`). Module-global lifecycle serialization should order that stop before the new start (`packages/studio/app/src/development/native.ts:87-108`), but no packaged switch test proves the complete sequence.

### Workspace visibility and local state

- **Established:** Settings is rendered over an inert but still-present workspace (`packages/studio/app/src/components/StudioShell.tsx:283-289`, `packages/studio/app/src/components/StudioShell.tsx:404-409`). The static render test asserts that all four surfaces, the iframe, and native terminal placeholder remain present (`packages/studio/app/tests/components/StudioShell.test.tsx:258-282`).

- **Established:** Fullscreen changes CSS layout and hides the other panels; it does not conditionally remove them from the React tree (`packages/studio/app/src/styles.css:260-288`, `packages/studio/app/src/components/StudioShell.tsx:283-360`).

- **Established:** Split values and panel tabs are local React state (`packages/studio/app/src/components/StudioShell.tsx:89-95`, `packages/studio/app/src/components/InspectionPanel.tsx:137-152`, `packages/studio/app/src/components/ActivityPanel.tsx:153-172`).

- **Established audit result:** `rg -n "localStorage|sessionStorage|persist|serialize" packages/studio/app/src` found only SSPS preference persistence in production code (`packages/studio/app/src/main.tsx:31-47`).

- **Inferred:** Reload resets workspace splits and active tabs. A project-to-project switch probably preserves them because `StudioShell` remains at the same React tree position (`packages/studio/app/src/App.tsx:75-90`), but no interactive test establishes either behavior.

### Development lifecycle

- **Established:** The coordinator’s default poll interval is one second and is bounded to 250–60,000 ms when overridden (`packages/studio/app/src/development/coordinator.ts:98-109`).

- **Established:** Controls are serialized against other control and lifecycle operations and trigger an immediate refresh after success (`packages/studio/app/src/development/coordinator.ts:224-261`).

- **Established:** Connected Restart uses HTTP reload and does not replace the project service; stopped/disconnected Restart invokes the native restart callback (`packages/studio/app/src/development/coordinator.ts:263-314`). Tests cover both paths with injected fakes (`packages/studio/app/tests/development/coordinator.test.ts:229-283`).

- **Established:** The hook wires its polling “discovery” callback to `startNativeDevelopmentConnection`, while a passive `discoverNativeDevelopmentConnection` function exists but is unused by production Studio (`packages/studio/app/src/development/useStudioDevelopment.ts:79-87`, `packages/studio/app/src/development/native.ts:83-108`).

- **Established:** Native `DevelopmentHost::start` makes repeated same-project/same-revision start calls idempotent while the worker remains alive (`packages/studio/tauri/src/development.rs:248-268`).

- **Inferred:** Discovery and startup are unnecessarily conflated even though idempotence prevents a new worker on every poll. This matters to an app service model because a read-oriented consumer currently participates in service-start authority.

## Concrete extension seams and blockers

### Real seams

- **Established:** `EditorHost` is a narrow, fakeable project boundary (`packages/studio/app/src/editor/types.ts:47-56`). Its manager tests use a fake host rather than mocking manager internals (`packages/studio/app/tests/editor/projectManager.test.ts:46-89`).

- **Established:** `StudioDevelopmentCoordinator` is a strong service seam because connection discovery, client creation, native lifecycle, scheduling, and state publication are injected (`packages/studio/app/src/development/coordinator.ts:50-72`).

- **Established:** The shared `DevelopmentClient` already supplies snapshots, captures, evidence, point lights, world/event queries, MCP logs, mutation commands, and simulation controls (`packages/cli/src/development/browser-client.ts:88-120`, `packages/cli/src/development/browser-client.ts:510-599`).

- **Established:** Studio already defines a browser-safe `StudioCaptureClient` type for capture capabilities, frame capture, gameplay sequences, and render evidence (`packages/studio/app/src/development/coordinator.ts:40-46`). It is currently only checked as a type contract (`packages/studio/app/tests/development/coordinator.test.ts:19-26`) and is not exposed by `useStudioDevelopment` (`packages/studio/app/src/development/useStudioDevelopment.ts:121-132`).

- **Established:** The inspection server has a bounded route set and validates host, origin, CORS, and session credentials before serving development data (`packages/cli/src/host/inspection-server.ts:95-149`, `packages/cli/src/host/inspection-server.ts:324-415`).

### Composition blockers

- **Established:** A new panel currently requires changes to direct JSX composition, the closed workspace-area union, desktop grid CSS, responsive CSS, and corresponding layout assertions (`packages/studio/app/src/components/StudioShell.tsx:283-401`, `packages/studio/app/src/components/primitives.tsx:3-9`, `packages/studio/app/src/styles.css:245-258`, `packages/studio/app/src/responsive.css:46-59`, `packages/studio/app/tests/components/StudioShell.test.tsx:181-205`).

- **Established:** The Studio package is private and declares no package exports (`packages/studio/app/package.json:1-29`).

- **Established audit result:** `rg -n "plugin|extension|contribution|registerPanel|panel registry|app registry" packages/studio/app/src` returned no matches. The implemented composition is the explicit `StudioShell` tree above.

- **Established:** Inspection and Activity receive large state objects directly instead of a surface-scoped service (`packages/studio/app/src/components/InspectionPanel.tsx:137-140`, `packages/studio/app/src/components/ActivityPanel.tsx:153-163`). The development hook keeps the client private and returns only one state object plus six fixed actions (`packages/studio/app/src/development/useStudioDevelopment.ts:20-35`, `packages/studio/app/src/development/useStudioDevelopment.ts:121-132`).

- **Established:** The strict version-1 `.antiky` schema is defined as the full allowed form and rejects unknown fields (`docs/adr/studio/0005-use-one-antiky-project-manifest_H.md:19-53`). Adding app declarations as arbitrary project metadata is therefore not compatible with the accepted schema.

- **Established audit result:** `rg -n "ErrorBoundary|componentDidCatch|getDerivedStateFromError" packages/studio/app/src` returned no matches.

- **Inferred:** A thrown React render error from one in-process surface is not isolated from the shell. A browser-mounted test with a deliberately throwing contribution would establish the exact failure behavior.

### Native and portability blockers

- **Established:** The accepted portable-editor ADR says the web editor should use a small `EditorHost` and only the Tauri adapter should import Tauri directly (`docs/adr/studio/0002-tauri-portable-web-editor_H.md:24-45`).

- **Established divergence:** Production Tauri imports exist in the project adapter, development adapter, `StudioShell`, and `NativeTerminal` (`packages/studio/app/src/editor/tauriHost.ts:1-2`, `packages/studio/app/src/development/native.ts:1`, `packages/studio/app/src/components/StudioShell.tsx:5`, `packages/studio/app/src/NativeTerminal.tsx:1`). The project `EditorHost` is real but is not the complete native-host boundary.

- **Established:** The terminal capability is macOS-only (`packages/studio/tauri/capabilities/main.json:3-7`). Browser Studio renders an unavailable-terminal state (`packages/studio/app/src/components/StudioShell.tsx:345-350`).

- **Inferred:** Two mounted `NativeTerminal` instances would contend for one static native view because another open only relayouts the existing view (`packages/studio/tauri/src/native/terminal_bridge.m:15-18`, `packages/studio/tauri/src/native/terminal_bridge.m:349-350`). A native two-instance test would confirm focus and close behavior.

- **Established:** JavaScript invokes `development_restart`; Rust implements and registers the command (`packages/studio/app/src/development/native.ts:101-104`, `packages/studio/tauri/src/commands.rs:238-257`, `packages/studio/tauri/src/lib.rs:154-171`). However, `development_restart` is absent from the generated command manifest and main capability (`packages/studio/tauri/build.rs:3-19`, `packages/studio/tauri/capabilities/main.json:7-25`).

- **Inferred:** Restart after Stop is likely denied at the packaged Tauri permission boundary. The JavaScript test mocks `invoke` (`packages/studio/app/tests/development/native.test.ts:36-64`), while the capability test explicitly freezes a list without `allow-development-restart` (`packages/studio/tauri/tests/tauri-config.test.mjs:34-59`). A packaged IPC test is required to confirm the runtime failure.

### Process and cleanup boundary

- **Established:** Studio packages a current Node runtime and a bundled CLI worker into Tauri resources (`packages/studio/app/scripts/build-project-service.mjs:7-34`, `packages/studio/app/scripts/build-project-service.mjs:36-54`, `packages/studio/tauri/tauri.conf.json:49-55`).

- **Established:** The worker loads one project, starts the shared CLI session with dynamic Studio ports, and returns one bounded connection (`packages/cli/src/studio-worker.ts:65-101`).

- **Established:** Graceful native stop writes a bounded stop message, waits up to five seconds, then kills the worker if necessary (`packages/studio/tauri/src/development.rs:116-148`). The worker’s graceful stop calls the CLI session’s complete cleanup (`packages/cli/src/studio-worker.ts:103-127`, `packages/cli/src/host/session.ts:522-612`).

- **Established:** `DevelopmentHost::drop` kills and waits for the worker without sending the graceful stop message (`packages/studio/tauri/src/development.rs:338-344`). The CLI game and shader children are started detached on non-Windows platforms (`packages/cli/src/host/session.ts:614-637`).

- **Claimed:** Studio stops the complete lifecycle when the project changes or workspace closes (`docs/user-facing-docs/studio/development-connection.md:41-47`, `docs/user-facing-docs/studio/getting-started.md:63-66`).

- **Established:** The Tauri run callback handles only opened URLs. Its comment explicitly relies on process exit for terminal cleanup (`packages/studio/tauri/src/lib.rs:175-183`). The lifecycle test only asserts that native terminal teardown is absent from that callback (`packages/studio/tauri/tests/app-lifecycle.test.mjs:7-16`).

- **Inferred:** Graceful cleanup of CLI services and detached descendants during application termination is not established. A packaged application-close test observing worker descendants, loopback ports, and descriptor removal would answer it.

## Tauri and CLI Studio boundaries

- **Established:** Tauri owns `ProjectHost`, `DevelopmentHost`, resource paths, recent-project storage, and the terminal theme (`packages/studio/tauri/src/lib.rs:66-76`).

- **Established:** The bounded native command surface includes project selection/validation/activation, development lifecycle, connection discovery, and terminal operations (`packages/studio/tauri/src/lib.rs:154-171`).

- **Established:** Native development start and restart resolve the active project identity and call `DevelopmentHost`; stop acts on that host (`packages/studio/tauri/src/commands.rs:217-267`).

- **Established:** The CLI session owns dynamic or manifest ports, session identity, credential, inspection server, game host, build/shader children, and cleanup (`packages/cli/src/host/session.ts:241-323`, `packages/cli/src/host/session.ts:457-520`, `packages/cli/src/host/session.ts:668-731`).

- **Established:** `antiky studio` does not start a project service. On macOS it asks Launch Services to open the installed Studio bundle with the manifest path (`packages/cli/src/studio-launch.ts:26-48`).

- **Established:** This operational boundary uses the CLI implementation once through a packaged worker; it does not run an `antiky dev` child command (`packages/cli/src/studio-worker.ts:76-85`). That conforms to the accepted requirement that Studio and CLI share one project-service implementation and that local Studio not launch through `antiky dev` (`docs/adr/studio/0006-use-cli-project-services-directly_H.md:24-45`).

## Documented versus implemented

| Topic | Documentation | Current implementation |
|---|---|---|
| Architecture maturity | **Claimed:** The Studio overview is explicitly “In Progress” (`docs/architecture/studio/overview_A.md:1-3`). | It should not override accepted ADRs or current code. |
| Local startup | **Claimed/stale:** The overview says `antiky dev` supervises the local host and Studio reads its descriptor (`docs/architecture/studio/overview_A.md:54-77`, `docs/architecture/studio/overview_A.md:121-134`). It still links superseded ADR 0004 (`docs/architecture/studio/overview_A.md:16-20`). | **Established:** Tauri starts the packaged worker, which calls `startDevelopmentSession` directly (`packages/studio/tauri/src/development.rs:248-323`, `packages/cli/src/studio-worker.ts:76-101`). ADR 0004 is explicitly superseded (`docs/adr/studio/0004-share-engine-services-with-cli_H.md:3-5`). |
| Portable host | **Established decision:** Only the host adapter should import Tauri (`docs/adr/studio/0002-tauri-portable-web-editor_H.md:24-45`). | **Established divergence:** `StudioShell` and `NativeTerminal` import Tauri directly, in addition to the two adapter modules. |
| Browser/detached Studio | **Claimed:** The overview describes browser, local, separate, and headless forms plus an `EditorSession` (`docs/architecture/studio/overview_A.md:121-183`). | **Established:** Browser mode receives an initial disconnected state and no connection provider (`packages/studio/app/src/development/useStudioDevelopment.ts:63-77`). `rg -n "EditorSession" packages/studio packages/cli/src` returned no implementation match. |
| Initial workspace | **Claimed and established:** The overview describes the Live, controls, hierarchy, stores, snapshot, diagnostics, events, MCP, and terminal workspace and says panels are read-only (`docs/architecture/studio/overview_A.md:227-245`). | The shell and two semantic panels implement that subset (`packages/studio/app/src/components/StudioShell.tsx:283-360`, `packages/studio/app/src/components/InspectionPanel.tsx:137-175`, `packages/studio/app/src/components/ActivityPanel.tsx:153-183`). |
| Input ownership | **Claimed:** Studio shows the current input owner and separates editor and game cameras (`docs/architecture/studio/overview_A.md:217-225`). | **Established:** The game host owns current canvas focus/input (`packages/cli/src/host/game-server.ts:419-446`); the Studio status bar contains no input-owner or editor-camera state (`packages/studio/app/src/components/StudioShell.tsx:411-418`). |
| Project metadata | **Claimed:** The projects guide says the workspace shows name, manifest path, schema version, and root (`docs/user-facing-docs/studio/projects.md:82-84`). | **Established:** The shell shows only the project name, and its test asserts that path/schema/root are absent (`packages/studio/app/tests/components/StudioShell.test.tsx:227-256`). The getting-started guide describes the implemented behavior correctly (`docs/user-facing-docs/studio/getting-started.md:33-35`). |
| Project-switch shutdown order | **Claimed:** The guide says Studio closes the old terminal and development session as it activates a replacement (`docs/user-facing-docs/studio/getting-started.md:37-41`). | **Established:** Terminal close occurs before native activation; development stop follows state publication through effect cleanup (`packages/studio/app/src/editor/projectManager.ts:126-135`, `packages/studio/app/src/development/useStudioDevelopment.ts:91-97`). |
| Restart after Stop | **Claimed:** Restart starts a fresh managed service after Stop (`docs/user-facing-docs/studio/getting-started.md:123-131`). | **Inferred risk:** Coordinator and Rust behavior exist, but packaged command permission appears incomplete. |
| Terminal/engine separation | **Claimed:** The in-progress overview explicitly gives terminal and engine tools separate permissions (`docs/architecture/studio/overview_A.md:344-356`). | **Established mechanism:** Terminal IPC and development HTTP/IPC are separate code paths (`packages/studio/app/src/NativeTerminal.tsx:34-35`, `packages/studio/app/src/development/native.ts:95-108`). The exact permission-policy statement is not in accepted Studio ADR 0001. |
| Renderer ownership | **Established decision and implementation:** Renderer selection stays inside the game module and Studio does not inspect renderer objects (`docs/adr/studio/0007-framework-first-allow-others_H.md:20-59`). | Live game remains an iframe over the shared renderer-neutral game host (`packages/studio/app/src/components/LiveGameFrame.tsx:1-20`, `packages/cli/src/host/game-server.ts:458-507`). |

## Test seams and limitations

- **Established:** Project lifecycle has behavioral tests around an injected `EditorHost`, including cold and warm open, cancellation, invalid input, replacement, duplicate native events, recents, and creation (`packages/studio/app/tests/editor/projectManager.test.ts:46-146`, `packages/studio/app/tests/editor/projectManager.test.ts:199-245`).

- **Established:** Coordinator tests cover one polling owner, atomic session replacement, stale recovery, connected reload, stop/fresh restart, and serialized controls (`packages/studio/app/tests/development/coordinator.test.ts:132-207`, `packages/studio/app/tests/development/coordinator.test.ts:229-285`).

- **Established:** Native project and development hosts have unit tests for prepare/activate behavior and start/reuse/restart/stop behavior (`packages/studio/tauri/src/project.rs:385-467`, `packages/studio/tauri/src/development.rs:357-404`).

- **Established:** JavaScript native-boundary parsers require exact bounded response shapes (`packages/studio/app/src/editor/tauriHost.ts:72-157`, `packages/studio/app/tests/editor/tauriHost.test.ts:22-80`, `packages/studio/app/src/development/native.ts:42-80`).

- **Established:** Workspace resizing is isolated into pure functions with boundary tests (`packages/studio/app/src/components/workspaceLayout.ts:10-49`, `packages/studio/app/tests/components/workspaceLayout.test.ts:11-34`).

- **Established:** `StudioShell` and `LiveGameFrame` tests use server-rendered markup and source inspection rather than a mounted browser (`packages/studio/app/tests/components/StudioShell.test.tsx:1-17`, `packages/studio/app/tests/components/LiveGameFrame.test.tsx:1-21`). The fullscreen test’s “without unmounting” assertion checks one static iframe plus source/CSS patterns; it does not perform a fullscreen transition (`packages/studio/app/tests/components/StudioShell.test.tsx:380-400`).

- **Established audit result:** Searching Studio app and Tauri tests for Playwright, WebDriver, jsdom, happy-dom, and Testing Library found only Playwright packaging for the CLI capture worker, not Studio UI end-to-end coverage (`packages/studio/app/scripts/build-project-service.mjs:22-50`, `packages/studio/tauri/tests/tauri-config.test.mjs:194-216`).

- **Inferred:** Current tests do not establish surface activation/disposal order, React failure isolation, iframe state preservation during actual transitions, native terminal behavior with multiple mounts, or packaged Tauri command permissions.

## Gaps and what would answer them

- **Packaged restart permission:** A real packaged-Tauri test invoking Stop then Restart would confirm whether the missing generated permission blocks `development_restart`.

- **Project-switch lifecycle:** An integration test recording terminal close, project activation, old service stop, and new service start would establish the full sequence and failure recovery.

- **Application-close cleanup:** A packaged close test that observes the worker, detached compiler/shader children, loopback ports, and session descriptor would determine whether termination is graceful.

- **Surface lifecycle contract:** A mounted browser test with observable activation, visibility, deactivation, and disposal callbacks would establish behavior across Settings, fullscreen, project switch, and app replacement.

- **Failure isolation:** A deliberately throwing in-process surface would determine whether isolation needs a per-surface React error boundary or a stronger process/iframe boundary.

- **Workspace state ownership:** Current code does not answer whether splits/tabs are global, project-specific, app-specific, or ephemeral. An owner decision is needed before persistence behavior can be specified.

- **Terminal multiplicity:** A two-instance native experiment would determine whether Terminal must be a declared singleton capability or whether the bridge needs multiple native views.

- **Browser/detached support:** The architecture claims these forms, but the current hook has no connection injection. A supported launch, authentication, and host-capability contract would be required.

- **Application discovery:** The current direct tree and strict project schema do not establish whether applications are compiled first-party registrations, bundled manifests, or project-selected code. That trust and configuration decision must precede any loading contract.

- **Reusable viewport:** The iframe proves game-host isolation but does not answer in-process canvas, WebGPU device, resize, frame scheduling, input, device-loss, or disposal ownership. A bounded viewport proof is needed to answer those runtime questions.

## Planning implications

- The strongest cut points are `EditorHost`, `ProjectManager`, `StudioDevelopmentCoordinator`, `DevelopmentClient`, and the CLI lifecycle handle. `Panel` is too shallow to serve as the application abstraction (`packages/studio/app/src/components/primitives.tsx:3-24`). This matches the repository guidance to wait for narrow natural cut points and build deep interfaces (`docs/GOOD_ENGINEERING_H.md:12-22`).

- A surface contract would need explicit identity, placement, activation, visibility, disposal, and narrowly scoped services. Passing the complete shell or raw coordinator state to every application would preserve the current change amplification rather than hide it (`docs/GOOD_ENGINEERING_H.md:95-98`).

- Development polling and project-service lifecycle should remain centrally owned. Applications should consume a scoped view of the existing validated client rather than create independent coordinators or start services.

- Mutation capabilities should remain command-based and permission-aware. Applications must not receive writable worlds, renderer objects, GPU handles, or direct project-service ownership (`docs/adr/framework/0007-commands-as-mutation-boundary_H.md:27-60`, `docs/adr/framework/0010-serialize-at-boundaries_H.md:18-47`).

- The existing Live iframe and a reusable in-process WebGPU viewport are different capabilities. Preserving the iframe retains the shipped game-editor behavior; an in-process viewport requires new canvas/GPU/frame/input/disposal ownership rather than reuse of `LiveGameFrame`.

- Terminal should remain an explicit specialized or singleton native capability until its multiplicity and lifetime are decided. Its geometry, focus, shell process, and native overlay cannot be represented honestly as an ordinary React child.

- Project-manifest application selection would require a schema/version decision because version 1 is exact and rejects unknown fields (`docs/adr/studio/0005-use-one-antiky-project-manifest_H.md:52-73`). A first-party compiled registry would avoid that schema expansion but would not answer future project-local trust.

- Portability work should reconcile the accepted `EditorHost` direction with the direct Tauri imports before application code gains more native dependencies.

- The highest-value verification points are surface lifecycle, project switching, packaged restart, native-terminal ownership, failure isolation, and application-close cleanup. These are system cut points rather than prose or frozen-content tests, consistent with the repository’s testing guidance (`docs/GOOD_ENGINEERING_H.md:57-61`).

- Any abstraction should preserve the existing four-surface game workspace and emerge from a small number of real applications. The repository direction explicitly favors concrete production slices and incremental growth over a complete engine or editor framework upfront (`docs/VISION_DIRECTION_H.md:31-50`).
