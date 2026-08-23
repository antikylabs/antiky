# Inspect a running game in Studio

Antiky Studio puts your running game, a terminal, simulation controls, and structured runtime data
in one window. Use it when you want to watch a game and inspect what the Framework and development
host report without reading terminal output or browser internals.

## Open the workspace

An [Antiky project](projects.md) has one named `<name>.antiky` manifest at its project root. If an
existing game folder has no manifest, run this command in that folder:

```sh
antiky init
```

The command creates only the project manifest. Start the macOS source-development app with:

```sh
npm run dev:studio
```

Studio starts at the launcher. To initialize an existing game folder there, enter its project name,
select **Create project**, and choose the folder. Studio creates the same manifest as `antiky init`
and opens it. To open an existing manifest, select **Open project** in the launcher or choose
**File > Open Project…** (`Command-O`), then choose its `.antiky` file.

Projects that opened successfully appear under **Recent projects** the next time the launcher opens.
Select an available launcher entry, or choose it from **File > Recent Projects**, to reopen it.
The File menu remains available while a project is open, so you do not have to close Studio to return
to the launcher. Studio stores this bounded history on your device, not in the project. It keeps a
moved or deleted project visible as **Missing** and disables that entry.

Studio reads at most 64 KiB, validates the manifest without running project code, and uses the file's
canonical parent directory as the project root. The workspace shows the project name in the title
bar without adding manifest or schema details to the working area.

Use **File > Open Project…** or **File > Recent Projects** in an active workspace to switch projects
in the same Studio window. Studio closes the old terminal and development session as it activates a
valid replacement. If the new file is invalid, Studio reports the error and leaves the current
workspace unchanged. Invalid input includes a missing, oversized, malformed, incompatible, or unsafe
file. Canceling the picker also keeps the current workspace.

Build the local macOS application bundle with:

```sh
npm run build --workspace @antiky/studio-tauri
```

The application bundle is under `packages/studio/tauri/target/release/bundle/macos/`, and the disk
image is under `packages/studio/tauri/target/release/bundle/dmg/`. The application registers
`.antiky` as an Antiky Studio document type. Double-click one `.antiky` file in Finder to open the
same validated workspace. Opening another `.antiky` file while Studio runs switches the existing
window after validation. See [Package and release Antiky Studio](package-and-release.md) for the
version and GitHub release steps.

If a project still uses the old `antiky.config.json`, migrate it once from the project root:

```sh
antiky migrate --name "Harbor Lights" --output harbor-lights.antiky
```

The visible `.antiky` file is tracked project input. The hidden `.antiky/` directory holds ignored
local development state. Do not rename the runtime directory to match the manifest.

Studio starts the project service automatically after it validates and activates the project. The
service starts the game compiler, shader watcher, game host, inspection service, and MCP endpoint.
Studio stops the complete session when you close or replace the project. You do not need to run
`antiky dev` in the embedded terminal.

### Terminal appearance and shell ownership

Studio applies an Antiky color profile to the embedded terminal surface, including its background,
text, cursor, selection, and ANSI palette. The shell starts in the selected project with an isolated
Studio startup profile and a non-identifying `% ` prompt. It does not load personal shell startup
files, print a banner, or write shell history. This prevents user and machine names from appearing
in the workspace by default. Your Ghostty settings outside Studio's visual color keys still apply.

If Studio cannot load its packaged terminal color profile, the Terminal panel shows a clear error.
The rest of the workspace remains available. The terminal stays available for your shell, build
commands, tests, and coding tools. It does not own Studio's project-service lifecycle.

## Use the workspace

On a wide window, Studio puts the live game in the larger upper-left area. Inspection is on the
upper right. The terminal is below the game, and Activity is below Inspection in a smaller lower
row. This keeps the running game prominent while the supporting tools remain visible.

In a narrow window or at high zoom, the areas stack in this order: Live game, Terminal, Inspection,
Activity. Scroll the workspace to reach each area.

The workspace has these areas:

| Area | What you can do |
| --- | --- |
| Live game | Use the configured game page without a second renderer |
| Terminal | Run a shell, coding agent, or Antiky command in the selected project |
| Pause, Resume, and Step | Control the connected fixed-step engine session |
| Restart game and Stop game | Reload or shut down the managed game session |
| Hierarchy | Read all published entities, component summaries, and `ChildOf` relationships |
| Stores | Read bounded authoring, runtime, and render views that the game publishes |
| Snapshot | Inspect the complete current development and Framework snapshot |
| Events | Read accepted event-sourcing facts in their source order |
| MCP calls | Review Tool calls handled during this development session |
| Diagnostics | Read current CLI and Framework diagnostics |

The inspection panels are read-only. Studio does not expose component editing or private engine,
renderer, or GPU objects.

## Control the online presence signal

Open **Settings**, then find **Online presence signal**. The setting is on by default. Turn it off if
you do not want this Studio instance to appear in the online count.

Settings opens over the current workspace. Opening or closing it does not reload the game, restart
the project service, or replace the terminal session.

SSPS receives only the signal needed to count this Studio instance as online. Antiky does not send
project names, commands, activity, or usage information through this signal. It only helps display
the active-user count on the Antiky website.

Changing the setting reloads Studio so the signal starts or stops immediately. Turning it off also
removes the SSPS visitor ID that was stored on this device. The preference stays off until you turn
it on again.

## Restart or stop the game

Select **Restart game**. It reloads the current game runtime without replacing the project service.
Studio waits for the new runtime before publishing its current state. If the game is already
stopped or unavailable, the same control recreates the managed project service instead.

Select **Stop game** to stop the managed game host, compiler, shader watcher, inspection service,
and MCP endpoint. The Studio window and terminal remain available. After **Stop game**, select
**Restart game** to start a fresh managed project service for the same validated project.

## Pause and advance the game

Select **Pause** to add the development-tool pause reason. Select **Step** while paused to advance
exactly one fixed simulation step and one presented frame. The paused canvas remains visible before
and after that frame. Studio sends the completed-step count from the current snapshot, so a repeated
or stale step cannot advance the game twice. Select **Resume** to remove only the tool pause reason.
A user or visibility pause can keep the game paused.

The controls are unavailable when the game does not publish an engine session, another control is
pending, or the displayed data is not current.

## Understand the two logs

The Events and MCP calls tabs answer different questions:

| Log | Owner and lifetime | What it contains |
| --- | --- | --- |
| Events | Framework; the source declares `runtime-instance`, `session`, or `durable` lifetime | Accepted domain facts that a game chose to event-source |
| MCP calls | Development host; in-memory for one project-service session | MCP Tool names, bounded arguments, result or error, timing, and available correlation IDs |

Simulation steps, diagnostics, and MCP traffic do not become event-sourcing facts. Reading the MCP
call log does not create another MCP call. Studio shows the retained range, capacity, dropped count,
redaction, and truncation reported by each source.

The development host keeps at most 100 complete MCP calls and drops the oldest entry when the log
is full. It replaces credential-, password-, secret-, token-, and API-key fields with a redaction
marker. Do not put secrets in MCP Tool arguments even with this safeguard. The call log is not
persisted and does not enter a game build, event stream, capture, or terminal transcript.

## Recover from a stopped session

If the managed project service stops unexpectedly, Studio keeps the live game mounted and marks the
last structured view as stale. It does not present retained data as current. Brief polling failures
leave the current workspace in place while Studio reconnects. The terminal remains available.
Select **Retry** to ask Studio to start the same validated project service again.

An incompatible snapshot is handled the same way. Check the Diagnostics tab and the terminal for a
stable error code. Do not edit `.antiky/dev-session.json`.

Press `Ctrl-C` in the embedded terminal to stop its foreground command. Studio stays open, and its
managed game host and development services keep running. Close or replace the project to stop that
session.

See [Connect Studio to a project service](development-connection.md) for the typed connection boundary.
See [Use BroMetal or Three.js in Studio](renderers.md) for renderer-specific mounting and agent
inspection behavior.
See [Runtime inspection](../framework/inspection.md) to publish hierarchy, store, and event data
from your game.
