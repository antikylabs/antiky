# Inspect a running game in Studio

Antiky Studio puts your running game, a terminal, simulation controls, and structured runtime data
in one window. Use it when you want to watch a game and inspect what the Framework and development
host report without reading terminal output or browser internals.

## Open the workspace

The current Studio is a macOS source-development build. Release packaging is not available yet.
From the Antiky workspace that contains your game project, run:

```sh
npm run dev:studio
```

Studio selects the directory where you started the command. Its terminal opens in that directory.
Run the normal development command in the embedded terminal:

```sh
antiky dev
```

When you develop inside the Antiky source repository without a linked CLI binary, use:

```sh
npm run antiky -- dev
```

`antiky dev` starts the game, shader watcher, inspection service, and MCP server together. Studio
finds the local session descriptor and attaches automatically. If the development command was
already running for the selected project, Studio attaches to that session instead of starting a
second game.

## Use the workspace

The first workspace has these areas:

| Area | What you can do |
| --- | --- |
| Live game | Use the configured game page without a second renderer |
| Terminal | Run a shell, coding agent, or Antiky command in the selected project |
| Pause, Resume, and Step | Control the connected fixed-step engine session |
| Hierarchy | Read all published entities, component summaries, and `ChildOf` relationships |
| Stores | Read bounded authoring, runtime, and render views that the game publishes |
| Snapshot | Inspect the complete current development and Framework snapshot |
| Events | Read accepted event-sourcing facts in their source order |
| MCP calls | Review Tool calls handled during this development session |
| Diagnostics | Read current CLI and Framework diagnostics |

The inspection panels are read-only. Studio does not expose component editing or private engine,
renderer, or GPU objects.

## Pause and advance the game

Select **Pause** to add the development-tool pause reason. Select **Step** while paused to advance
exactly one fixed simulation step. Studio sends the completed-step count from the current snapshot,
so a repeated or stale step cannot advance the game twice. Select **Resume** to remove only the
tool pause reason. A user or visibility pause can keep the game paused.

The controls are unavailable when the game does not publish an engine session, another control is
pending, or the displayed data is not current.

## Understand the two logs

The Events and MCP calls tabs answer different questions:

| Log | Owner and lifetime | What it contains |
| --- | --- | --- |
| Events | Framework; the source declares `runtime-instance`, `session`, or `durable` lifetime | Accepted domain facts that a game chose to event-source |
| MCP calls | Development host; in-memory for one `antiky dev` session | MCP Tool names, bounded arguments, result or error, timing, and available correlation IDs |

Simulation steps, diagnostics, and MCP traffic do not become event-sourcing facts. Reading the MCP
call log does not create another MCP call. Studio shows the retained range, capacity, dropped count,
redaction, and truncation reported by each source.

The development host keeps at most 100 complete MCP calls and drops the oldest entry when the log
is full. It replaces credential-, password-, secret-, token-, and API-key fields with a redaction
marker. Do not put secrets in MCP Tool arguments even with this safeguard. The call log is not
persisted and does not enter a game build, event stream, capture, or terminal transcript.

## Recover from a stopped session

If `antiky dev` stops, Studio removes the live game and marks the last structured view as stale. It
does not present retained data as current. The terminal remains available. Start `antiky dev` again
and select **Retry** if you do not want to wait for the next automatic connection attempt.

An incompatible snapshot is handled the same way. Check the Diagnostics tab and the terminal for a
stable error code. Do not edit `.antiky/dev-session.json`.

Press `Ctrl-C` in the development terminal before you close Studio. This lets `antiky dev` stop its
owned processes, close its listeners, and remove its session descriptor.

See [Connect Studio to a running game](development-connection.md) for the typed connection boundary.
See [Runtime inspection](../framework/inspection.md) to publish hierarchy, store, and event data
from your game.
