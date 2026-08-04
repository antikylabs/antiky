# Development Harness Research

**Status: Proposed; owner choices are required before implementation**

**Research date: 2026-08-04**

## Result

Antiky Town should start with a development-harness slice.

The first version should use the current Next.js demo host. It should not build a new bundler or a
new hot-module-reload system. A small Antiky supervisor should read project configuration, start the
existing host and shader watcher, keep one inspection session alive, and stop all child processes.

The browser runtime can restart after a source change. State-preserving code replacement is not a
Slice 0 requirement. The supervisor and inspection endpoint must stay available while the browser
reconnects.

Antiky also needs its own structured inspection API. A screenshot can confirm appearance, but it
cannot prove entity identity, state revisions, reload results, render counts, or diagnostics.

[`webgpu_inspector`](https://github.com/brendan-duncan/webgpu_inspector) is a strong optional GPU
inspection layer. It does not replace Antiky inspection because it sees GPU objects and commands,
not Antiky entities, assets, sessions, or commands.

## Antiky today

The repository already has part of this loop:

- The root development script dispatches to one npm workspace.
- The demo script validates an optional slug and starts the website host.
- The website and demo scripts hard-code port `3010`.
- The website compiles demo shaders once before it starts Next.js. It does not keep a shader
  compiler running.
- [`LiveDemoStage`](../../react/LiveDemoStage.tsx) owns WebGPU renderer creation, the browser frame
  loop, pause state, disposal, FPS, draw-call count, instance count, and upload-byte statistics.
- Those browser values stay in React state. An external agent cannot query them through a stable
  contract.

Slice 0 can wrap these working parts. It does not need to replace the renderer or demo host.

## What other engines do

### Phaser 4

Phaser's official TypeScript template uses Vite. Its `npm run dev` command starts a local server,
and Vite recompiles changes and reloads the browser. Phaser delegates this work to a web development
server instead of implementing its own bundler and watcher.

Phaser 4 does not use WebGPU. It is relevant to Antiky's web-game development loop, but it is not a
reference for WebGPU inspection.

Sources:

- [Phaser Vite TypeScript template](https://github.com/phaserjs/template-vite-ts)
- [Phaser 4 renderer changelog](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/CHANGELOG-v4.0.0.md)

Lesson for Antiky: own the game workflow and configuration, but reuse a proven web development
server.

### Phaser AE

Phaser AE is a separate, closed engine built for the Phaser Game Agent. Phaser describes it as
WebGPU-first with a compatibility renderer. Its API is shaped around agent intent and small
capabilities, not renderer details.

The Phaser team also describes a development pipeline in which each reusable component gets a
playable test rig and headless checks. A human then plays the complete game. Local agent clients can
use its MCP service, and published games get a playable URL and build report.

Sources:

- [How Phaser built its Game Agent and test-rig workflow](https://phaser.io/news/2026/06/how-we-built-the-phaser-game-agent-with-claude-managed-agents-and-superserve)
- [Phaser 4 and Phaser AE comparison](https://phaser.io/news/2026/07/no-you-didn-t-miss-a-3d-update)
- [Phaser AE v2 and its WebGPU-first runtime](https://phaser.io/news/2026/07/phaser-ae-v2-is-now-the-engine-behind-every-new-game)

Lesson for Antiky: give agents a small intent-level surface, runnable slices, headless evidence, and
a human play gate. Do not expose a large renderer API to compensate for missing engine concepts.

### Three.js

The Three.js installation guide recommends npm with Vite for local development. Its
`WebGPURenderer` uses WebGPU when it is available and can use a compatibility renderer otherwise.
Antiky is WebGPU-only, so it should not copy that policy.

Sources:

- [Three.js installation guide](https://threejs.org/manual/en/installation.html)
- [Three.js WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html)

Lesson for Antiky: a canvas engine does not need to own the web server. Engine policy and web-server
policy can stay separate.

### Bevy

Bevy publishes browser examples that run with WASM and WebGPU. Bevy also treats asset reload as a
separate feature. Its asset server detects changed files and updates loaded assets when file watching
is enabled on a supported platform.

Bevy 0.19 added a built-in diagnostics overlay. Its release notes still list a complete entity
inspector as future work. This shows that render output, diagnostics, and world inspection are
separate capabilities.

Sources:

- [Bevy WebGPU examples](https://bevy.org/examples-webgpu/)
- [Bevy asset hot reloading](https://docs.rs/bevy/latest/bevy/asset/)
- [Bevy 0.19 diagnostics and entity-inspector status](https://bevy.org/news/bevy-0-19/)

Lesson for Antiky: define separate source, shader, asset, and runtime reload behavior. Add structured
diagnostics before a large editor exists.

### PlayCanvas

PlayCanvas can replace a changed script while an application runs. The script must explicitly copy
state and clean up event listeners. PlayCanvas also supplies a scene hierarchy, property inspector,
and real-time profiler.

Sources:

- [PlayCanvas hot reloading](https://developer.playcanvas.com/user-manual/editor/scripting/hot-reloading/)
- [PlayCanvas profiler](https://developer.playcanvas.com/user-manual/optimization/profiler/)
- [PlayCanvas Editor](https://developer.playcanvas.com/user-manual/editor/)

Lesson for Antiky: state-preserving replacement is a lifecycle feature, not a free result of module
reload. Start with safe reconstruction, then add state transfer only when a real slice needs it.

### Babylon.js

Babylon.js supplies scene instrumentation for frame time, render time, draw calls, animation,
physics, and other measurements. Its Inspector exposes the scene graph and entity properties.

Babylon.js also has a headless `StartInspectable` API and an experimental Inspector CLI intended
for AI agents. The CLI can query entities, scene statistics, screenshots, and performance data
without showing the Inspector UI.

Sources:

- [Babylon.js WebGPU support](https://doc.babylonjs.com/setup/support/webGPU/)
- [Babylon.js SceneInstrumentation](https://doc.babylonjs.com/typedoc/classes/BABYLON.SceneInstrumentation)
- [Babylon.js Inspector package and headless inspection](https://www.npmjs.com/package/babylonjs-inspector)
- [Babylon.js Inspector CLI announcement](https://forum.babylonjs.com/t/inspector-cli-for-ai-agents/63243)

Lesson for Antiky: the browser must publish engine meaning, not only pixels and console logs. Human
tools and agent tools should use the same inspection source.

## WebGPU Inspector assessment

WebGPU Inspector is engine-independent. On the research date, its package metadata identified
version `1.5.0` and the MIT license. It supplies three main capabilities:

- Live GPU-object, allocation, frame-time, and shader inspection.
- Frame capture with commands, passes, render outputs, buffers, textures, and validation errors.
- Multi-frame recording that can be replayed or attached to a bug report.

Sources:

- [WebGPU Inspector overview](https://github.com/brendan-duncan/webgpu_inspector)
- [Package metadata](https://raw.githubusercontent.com/brendan-duncan/webgpu_inspector/main/package.json)
- [MIT license](https://raw.githubusercontent.com/brendan-duncan/webgpu_inspector/main/LICENSE)

The inspector must wrap the WebGPU API before the game creates any WebGPU object. Manual injection
can do this in the page. Its Local Capture API can return capture metadata and payloads without a
DevTools panel. CDP injection can do it without changing the game page.

Source: [WebGPU Inspector manual injection and Local Capture API](https://github.com/brendan-duncan/webgpu_inspector/blob/main/docs/manual_injection.md)

The repository also contains a Claude Code plugin with a Model Context Protocol (MCP) server. Its
design is useful even when Antiky does not use that plugin:

```text
MCP client
  -> stdio MCP bridge
  -> localhost HTTP and WebSocket bridge
  -> Chrome DevTools Protocol
  -> instrumented game page
```

Its MCP tools can launch or attach to a browser, capture frames, list commands, inspect GPU objects
and shaders, read buffers and textures, report validation errors, and analyze performance. Results
are summarized or paginated instead of returning large binary blobs.

Source: [WebGPU Inspector Claude plugin and MCP tools](https://github.com/brendan-duncan/webgpu_inspector/blob/main/claude-plugin/README.md)

The current plugin has limits that matter to Antiky:

- It does not automatically instrument dedicated workers.
- It uses one fixed bridge port, so two concurrent plugin sessions conflict.
- Immediate capture expects a `requestAnimationFrame` loop.
- It supplies GPU facts, but it cannot identify an Antiky entity or explain an accepted command.

### Recommended use

Use WebGPU Inspector as an optional development dependency or separate tool. Pin a reviewed version
or commit. Do not load it in production builds.

Use it for Slice 5 render evidence and difficult GPU failures. Do not make it the only Slice 0
inspection path. Antiky must remain inspectable when the extension, plugin, or controlled browser is
not installed.

## Proposed Slice 0 boundary

```text
files and config
      |
      v
Antiky dev supervisor --------------------+
  | starts host and shader watcher         |
  | owns session and build revisions       |
  | owns diagnostics and cleanup           |
  v                                        |
current Next.js game host                  |
  |                                        |
  v                                        |
browser runtime -> local inspection bridge+
                         |
                         +-> Streamable HTTP MCP
                         +-> test and CLI queries

optional WebGPU Inspector -> GPU captures and validation details
```

The supervisor is a development tool. It does not belong in framework core. The framework and demo
publish typed inspection snapshots to it. The MCP adapter reads the same snapshots. It does not
read React state, simulate clicks, or expose BroMetal objects.

The MCP specification permits an independently running Streamable HTTP server. A local server must
bind to localhost, validate `Origin`, and authenticate connections. If a required agent client
cannot connect to Streamable HTTP, Slice 0 must also supply a thin `antiky mcp` stdio adapter that
connects to the same bridge.

Source: [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

## Reload contract

Slice 0 must name each reload type. The word "hot reload" alone is not sufficient.

| Change | Slice 0 behavior | State guarantee |
| --- | --- | --- |
| TypeScript or React source | Let the selected web host apply its normal update or full reload | Browser runtime can restart |
| WGSL source | Compile, keep the last good output on error, update the browser after success | Broken shader does not replace the last good shader module |
| Static asset | Invalidate and reload the changed asset or restart the browser runtime | No state preservation is required |
| Development config | Validate again; keep the last valid config on error; restart affected child processes when required | Supervisor stays in control |
| Browser disconnect | Mark runtime disconnected and accept a new connection | Development session stays alive |

The inspection state must contain three different values:

- A development-session ID that remains stable until `antiky dev` stops.
- A runtime-instance ID that changes when the browser runtime restarts.
- A build revision that changes only after a successful source, shader, asset, or config update.

This distinction lets an agent tell the difference between a reload, a reconnect, and a new
development command.

## Configuration choices

### C1. `antiky.config.json` — Recommended

Use strict JSON with a versioned schema. Reject unknown fields. Resolve paths relative to the
configuration file.

Benefits:

- Humans and tools can read it without running code.
- JSON Schema can supply validation and editor help.
- The same input produces the same launch plan.

Cost:

- It cannot calculate values with code.

### C2. `antiky.config.ts`

Use a typed JavaScript module.

Benefit:

- It supports imports, conditions, and calculated values.

Costs:

- Reading configuration runs project code.
- External tools need the TypeScript loader and project dependencies.
- Dynamic values make launch behavior harder to reproduce.

### C3. `package.json#antiky`

Put the configuration in the root package file.

Benefit:

- It adds no new top-level file.

Costs:

- It mixes game configuration with package-manager metadata.
- Large projects and multiple game entries become harder to read.

### Proposed JSON shape

This example defines intent. The implementation slice must publish the final JSON Schema.

```json
{
  "schemaVersion": 1,
  "game": {
    "id": "antiky-town",
    "route": "/demos/antiky-town"
  },
  "dev": {
    "host": "127.0.0.1",
    "port": 3010,
    "open": false,
    "strictPort": true,
    "inspection": {
      "enabled": true,
      "port": 3011
    }
  }
}
```

The command must print the resolved config path, game URL, inspection URL, session ID, and each
started service. It must stop with a clear error if a strict port is in use. It must not silently
select a different port.

Vite supports an explicit port, strict-port failure, file watching, HMR, and custom HMR events. This
is useful if Antiky later selects a dedicated Vite host.

Sources:

- [Vite server options](https://vite.dev/config/server-options)
- [Vite HMR API](https://vite.dev/guide/api-hmr)

## Minimum structured inspection

The internal inspection service is the source of truth. MCP is one adapter over it.

All records must be versioned, bounded, and valid at runtime. They must use stable IDs, revisions,
units, and machine-readable diagnostic codes. Large lists need pagination. The service must not
return live JavaScript, DOM, BroMetal, or GPU objects.

### Slice 0 resources

The exact MCP names can change before implementation. These meanings cannot:

| Proposed resource | Required information |
| --- | --- |
| `antiky://dev/status` | Config, URLs, service health, session ID, and start time |
| `antiky://build/latest` | Build revision, change kind, result, duration, and diagnostics |
| `antiky://runtime/status` | Connection, runtime-instance ID, game ID, phase, and WebGPU status |
| `antiky://render/stats` | Canvas size, frame count, FPS sample, draw calls, instances, and upload bytes when known |
| `antiky://diagnostics` | Bounded active diagnostics with codes, severity, source, revision, and related IDs |

### Slice 0 tools

| Proposed tool | Required behavior |
| --- | --- |
| `dev_reload` | Request a controlled runtime reload and return the new or failed revision |
| `capture_frame` | Request a visual frame capture with runtime and build IDs; this is supporting evidence |

Read operations must stay read-only. A tool that changes runtime state must say what it changes and
return a structured result.

Later slices add world, entity, asset, clock, selection, command, and history operations. The
[implementation plan](IMPLEMENTATION_PLAN_A.md) defines when each operation becomes required.

## Host choices for Slice 0

### 0A. Current Next.js host plus Antiky supervisor — Recommended

Keep the current website and demo route. Add configuration, a shader watcher, the local inspection
bridge, MCP, reload events, and child-process cleanup around it.

Benefits:

- It keeps the working town visible during the framework port.
- It changes the fewest unrelated files.
- It tests the inspection contract before a host migration.

Costs:

- The game harness remains temporarily coupled to the website host.
- Next.js reload behavior is broader than a game-only Vite host.

### 0B. Dedicated Vite game host plus Antiky supervisor

Move Antiky Town to a small canvas-only Vite host. Keep the same supervisor and inspection bridge.

Benefits:

- It matches Phaser and Three.js browser-game workflows.
- It gives direct control over game entry modules and HMR events.

Costs:

- It adds a host migration before the first framework feature.
- The website and game host need a clear integration boundary.

### 0C. Framework-owned server and reload implementation

Build HTTP serving, dependency watching, module updates, error overlays, and asset invalidation in
Antiky.

Benefit:

- Antiky controls every development-server detail.

Costs:

- It recreates mature web-tool behavior.
- It delays visible framework work and adds a large maintenance surface.

Do not select 0C without a proven requirement that Next.js or Vite cannot meet.

## Decision requested

Approve or change this starting set before implementation:

- Host: **0A**, current Next.js host plus the Antiky supervisor.
- Configuration: **C1**, `antiky.config.json` with a versioned JSON Schema.
- Inspection: built-in Antiky semantic inspection and Streamable HTTP MCP.
- GPU evidence: optional, pinned WebGPU Inspector; required for the Slice 5 GPU evidence pass.
- Reload: safe browser reconstruction in Slice 0; no promise of state-preserving module replacement.

This choice makes the development loop observable without forcing the world model, renderer API, or
Studio to exist first.
