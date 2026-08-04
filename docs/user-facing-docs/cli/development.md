# Antiky Development CLI

The `antiky` command runs and inspects one local development session for your game. It keeps the
game process, shader watcher, runtime inspection, and AI tooling behind one project-level command.

## Configure your project

Put `antiky.config.json` at the project root. The schema is versioned and strict, so Antiky rejects
unknown fields before starting a process. Adapt the commands and game route to your project:

```json
{
  "schemaVersion": 1,
  "game": {
    "command": [
      "npm",
      "run",
      "game:dev",
      "--",
      "--host",
      "{host}",
      "--port",
      "{gamePort}"
    ],
    "shaderCommand": [
      "npm",
      "run",
      "shaders:watch"
    ],
    "workingDirectory": ".",
    "url": "http://127.0.0.1:3010/game",
    "viewport": {
      "width": 1280,
      "height": 720
    }
  },
  "network": {
    "host": "127.0.0.1",
    "gamePort": 3010,
    "inspectionPort": 3011
  }
}
```

`workingDirectory` is relative to the config file and must stay inside its directory. Command
arguments can use `{host}`, `{gamePort}`, `{inspectionPort}`, `{gameUrl}`, `{gameWidth}`, and
`{gameHeight}` placeholders. Antiky expands each argument directly without invoking a shell. The
optional `viewport` declares the game's intended canvas width and height; it defaults to `1280x720`
when omitted and is available to the game process through `ANTIKY_GAME_WIDTH` and
`ANTIKY_GAME_HEIGHT`.

The game URL must use HTTP at the configured game address. Antiky binds development services to the
IPv4 loopback address `127.0.0.1`; it does not accept a LAN or wildcard host.

## Start the development session

From the project root, run:

```sh
antiky dev
```

The `antiky dev` command starts the shader watcher, your configured game host, inspection service,
and MCP service. The game command should open a focused development surface for the game itself;
Antiky does not require or add a marketing site, navigation shell, or documentation UI.
It prints the resolved config path, game URL, inspection URL, MCP URL, development-session ID, and
service names after startup. The MCP URL is the inspection origin followed by `/mcp`, such as
`http://127.0.0.1:3011/mcp`.

To use another config path, run:

```sh
antiky dev --config path/to/antiky.config.json
```

Antiky validates the complete config and reserves both ports before starting a child. If validation
or reservation fails, no configured process starts.

The session credential is random. Antiky stores it only in `.antiky/dev-session.json` with mode
`0600`. The credential does not appear in command output, the game URL, diagnostics, or inspection
results. Antiky removes the descriptor when the session stops.

## Inspect the session

In another terminal, run:

```sh
antiky inspect
```

The command prints the current `DevelopmentSnapshot` as JSON. It contains:

- The development-session ID and accepted build revision.
- The resolved config and local addresses.
- Game and shader process health.
- The latest build kind, result, changed path, and duration when available.
- Runtime connection and cleanup health.
- CLI-owned launch measurements and development diagnostics.
- The latest framework `InspectionSnapshot`, or `null` before a runtime connects.

Framework measurements and CLI development measurements remain separate, and every measurement
record identifies its owner. A game runtime that publishes Antiky inspection snapshots supplies the
real lifecycle, frame, canvas, and render facts; the CLI does not infer them from terminal output or
the DOM.

Code that needs the same service contract can use the exported typed client:

```ts
import { connectDevelopmentClient } from '@antiky/cli';

const client = await connectDevelopmentClient('antiky.config.json');
const development = await client.readDevelopmentSnapshot();
```

This client is also the supported boundary for a Studio integration. It reads the same state and
exposes the same reload and frame-capture actions as the CLI and MCP adapters.

## Track development updates

Antiky watches source, shader, asset, and config files under the configured working directory. It
accepts a revision only after the changed build reaches a newer ready browser runtime. A browser
reload can change the runtime-instance ID without changing the development-session ID.

For a shader change, Antiky waits for the matching generated shader before accepting a ready
runtime. A failed update leaves the accepted revision and generated shader unchanged and adds a
structured build diagnostic. Fixing the file clears that active diagnostic after the next ready
runtime.

## Connect an MCP client

Prefer the Streamable HTTP endpoint that `antiky dev` starts. Point an MCP client that supports a
remote URL at the printed MCP URL. A representative client entry looks like this, although the
outer configuration keys vary by client:

```json
{
  "mcpServers": {
    "antiky": {
      "type": "http",
      "url": "http://127.0.0.1:3011/mcp"
    }
  }
}
```

The endpoint is stateless and implements MCP protocol version `2025-11-25`. It returns JSON for
requests and does not keep an SSE session open.

For a client that supports only standard input/output, configure that client to launch the adapter:

```json
{
  "mcpServers": {
    "antiky": {
      "command": "antiky",
      "args": ["mcp", "--config", "/absolute/path/to/antiky.config.json"]
    }
  }
}
```

The MCP client owns this `antiky mcp` subprocess; you do not need to run it in a separate terminal.
The adapter connects to the development session already started by `antiky dev` and writes protocol
JSON only to standard output.

### State tools and resources

Read-only tools are the primary model-facing state interface. Matching resources remain available
for clients that support browsing or explicitly attaching resources:

| Read-only tool | Matching resource | State returned |
| --- | --- | --- |
| `get_dev_status` | `antiky://dev/status` | Session, config, service health, and CLI measurements |
| `get_latest_build` | `antiky://build/latest` | Accepted revision and latest build attempt |
| `get_runtime_status` | `antiky://runtime/status` | Runtime connection and framework inspection snapshot |
| `get_render_stats` | `antiky://render/stats` | Available framework-owned runtime and render measurements |
| `get_diagnostics` | `antiky://diagnostics` | Development and framework diagnostics |

The read-only tools take no arguments and are marked read-only, non-destructive, idempotent, and
closed-world in their MCP annotations.

### Development action tools

- `dev_reload` asks the connected browser runtime to reload. The result relates the development
  session, build revision, old and new runtime instances, and action ID.
- `capture_frame` captures the game canvas as a PNG under `.antiky/captures/`. The result contains
  the path, digest, byte count, capture ID, action ID, development session, runtime instance, and
  build revision.

Frame captures support visual review. Runtime and render facts still come from the framework
inspection snapshot, not from image analysis.

## Local bridge security

The development listener accepts only the configured `127.0.0.1` host and exact Host header. It
rejects a supplied browser Origin unless it matches the configured game origin. Inspection REST
requests use the per-session bearer credential and versioned, field-checked, size-bounded messages.
A retired runtime cannot replace a newer runtime's facts.

The `/mcp` route deliberately does not require the rotating inspection credential so MCP clients can
keep one stable local URL across restarts. Its trust boundary is the loopback bind plus the Host and
Origin checks. Any local process can reach that endpoint, so do not expose the inspection port
through a LAN bind, tunnel, or reverse proxy.

A production game build must exclude the local browser adapter, inspection endpoint, development
environment key, and credential bootstrap code.

## Stop and cleanup

Press `Ctrl-C` in the `antiky dev` terminal. Antiky sends a normal stop to every owned process, waits
for it, closes the inspection and MCP listener, removes the session descriptor, and releases both
configured ports. An owned child failure performs the same cleanup and returns a nonzero status.

## Stable errors

The CLI writes a stable error code before its message:

- `ANTIKY_ARGUMENT_INVALID`: the command or option is not supported.
- `ANTIKY_CONFIG_NOT_FOUND`: the selected config file does not exist.
- `ANTIKY_CONFIG_INVALID`: JSON, fields, paths, commands, URLs, or ports are invalid.
- `ANTIKY_PORT_BUSY`: a configured port cannot be reserved. No child starts.
- `ANTIKY_CHILD_START_FAILED`: an owned process could not start. Any partial start is cleaned up.
- `ANTIKY_SESSION_UNAVAILABLE`: `antiky inspect` cannot find or reach the selected session.
- `ANTIKY_UNAUTHORIZED`: the inspection service rejected the session credential.
- `ANTIKY_RUNTIME_UNAVAILABLE`: reload or capture needs a connected browser runtime.
- `ANTIKY_ACTION_BUSY`: another controlled development action is still active.
- `ANTIKY_ACTION_TIMEOUT`: the connected runtime did not finish the action in time.
- `ANTIKY_ACTION_STALE`: an action result belongs to an inactive request or runtime.
- `ANTIKY_CAPTURE_INVALID`: the browser returned invalid or oversized PNG data.

Fix a config or port error and run the command again. Do not edit the local session descriptor.
