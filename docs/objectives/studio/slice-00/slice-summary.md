# Studio Slice 00 summary

Studio Slice 00 is complete. Antiky now has one macOS Studio workspace that uses the same local development session as the CLI and MCP clients. It shows the live game beside a native terminal, structured inspection, session controls, event history, and MCP call history.

## What changed in the repository

### Framework

`@antiky/framework` gained immutable world inspection and event-history views. A world view contains stable entities, component summaries, real `ChildOf` relationships, and bounded semantic stores. An event view contains accepted event-sourcing facts and an explicit retention policy.

The point-light service is the first adapter. It publishes authoring, runtime, and render stores. It also publishes its accepted point-light facts as event history. This did not add a general ECS store or durable event database.

### CLI and MCP

The browser-safe development client now reads world inspection, event history, and the development-session MCP call log. `antiky dev` remains the only development host.

MCP gained two read-only Tools:

- `get_world_inspection`
- `get_event_log`

The host also keeps up to 100 complete MCP Tool calls in memory for the current development session. It records bounded arguments, result or error, timing, and useful IDs. It marks secret redaction and truncation. The call log is a protected development query, not an MCP Tool, so reading it does not add another log entry.

### Studio

`packages/studio/app` now contains the portable React workspace. `packages/studio/tauri` hosts it on macOS and embeds the pinned `libghostty` terminal.

The first workspace includes:

- The configured live game page.
- A native project terminal.
- Pause, Resume, and Step controls.
- Entity hierarchy and component summaries.
- Authoring, runtime, and render store views.
- The complete bounded development snapshot.
- The real event-sourcing log.
- The development-session MCP call log.
- CLI and Framework diagnostics.

Studio keeps retained data visibly stale after a disconnect. It keeps the terminal usable. It disables simulation controls until the runtime is ready and connected. The panels are read-only; this slice added no component editor, canvas selection, or second game renderer.

### Documentation

The general Studio, Framework inspection, CLI development, and MCP Tool guides now describe the shipped workflow. The Studio architecture also records the shared client path and the separate owners and lifetimes of the event and MCP logs.

## How to test

Run the repository checks and native build:

```sh
npm run check
npm run build --workspace @antiky/studio-tauri
```

Open Studio:

```sh
npm run dev:studio
```

In the embedded terminal, start the complete development session:

```sh
./node_modules/.bin/antiky dev
```

Confirm that the Town appears. Open the Hierarchy, Stores, Events, MCP calls, and Diagnostics tabs. Pause the game, advance one step, and resume it.

From another terminal, these commands exercise the same host:

```sh
./node_modules/.bin/antiky tool get_world_inspection
./node_modules/.bin/antiky tool get_event_log
```

Press `Ctrl-C` in the development terminal when done. The CLI must stop its child processes and remove `.antiky/dev-session.json`.

The completed run is recorded in the [Slice 00 receipt](outputs/studio-s00-20260806T043040Z/receipt.json). Automated visual capture was unavailable in this run, so the receipt does not claim a screenshot. Native process, webview connection, semantic data, terminal-surface, build, test, and cleanup evidence passed.
