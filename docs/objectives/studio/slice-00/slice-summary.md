# Studio Slice 00 summary

Studio Slice 00 is complete. Antiky now has one macOS Studio workspace that uses the same local development session as the CLI and MCP clients. It shows the live game beside a native terminal, structured inspection, session controls, event history, and MCP call history.

## Feedback 08 layout update

The owner approved the Feedback 08 implementation on `2026-08-06`. Studio now follows the website's
game-first hierarchy. The larger live game is in the upper left, Inspection is in the upper right,
Terminal is below the game, and Activity is below Inspection. A narrow window stacks those surfaces
as Live game, Terminal, Inspection, and Activity.

The title, simulation controls, panel headings, tabs, dividers, and status bar use the website's
compact visual language. Studio still displays live project data. It does not copy the website's
sample terminal text, town poster, inspection records, or event records.

The native terminal now clips to its visible panel intersection and follows element resize, window
resize, scrolling, and visual-viewport changes. It hides when its panel is offscreen. The custom title
bar is a native drag region, and keyboard focus on the terminal has a visible boundary. Native runs
showed one window, one terminal, and one non-white live-game iframe at desktop, intermediate, and
narrow sizes.

The complete repository checks and both Studio builds pass. Owner-approved native captures are in the
[Feedback 08 evidence run](outputs/studio-s00-feedback-08-20260806T181038Z/confirmation-checks.md).
Browser Control had no attached browser, so no browser capture is claimed. The feedback is complete with
that evidence limitation retained in the receipt.

## Live presence and image storage follow-up

The launched desktop app now loads SSPS site `268`. Its Tauri policy permits the SSPS script and presence
WebSocket without widening other network access. Production website pages load the same configured script
and show the current live visitor count as “active now” in the global footer. The website omits this
integration in development so local sessions do not inflate the published count.

Git now routes every `.png` and `.jpeg` through Git LFS. The current delivery converts all 50 tracked image
assets to LFS pointers without rewriting existing history. Working-tree checkouts remain ordinary usable
images.

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

Audit image storage:

```sh
git lfs fsck --pointers
git lfs ls-files
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

For the Feedback 08 layout, resize Studio from a wide window to its minimum width. Confirm that the
wide workspace uses two rows and two columns, and that the narrow workspace stacks Live game,
Terminal, Inspection, and Activity. Scroll the narrow workspace and confirm that the native terminal
never covers Inspection or Activity. Use the title bar to move the window, then use the keyboard to
reach the terminal and confirm that its focus boundary is visible.

From another terminal, these commands exercise the same host:

```sh
./node_modules/.bin/antiky tool get_world_inspection
./node_modules/.bin/antiky tool get_event_log
```

Press `Ctrl-C` in the development terminal when done. The CLI must stop its child processes and remove `.antiky/dev-session.json`.

The original completed run is recorded in the [Slice 00 receipt](outputs/studio-s00-20260806T043040Z/receipt.json).
The approved layout and follow-up delivery are recorded in the
[Feedback 08 receipt](outputs/studio-s00-feedback-08-20260806T181038Z/receipt.json). Native process,
webview connection, semantic data, terminal-surface, SSPS, LFS, build, test, and cleanup evidence passed.
