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
- The runtime's point-light authoring, projection, binding, and accepted-fact view when the game
  publishes one.

Framework measurements and CLI development measurements remain separate, and every measurement
record identifies its owner. A game runtime that publishes Antiky inspection snapshots supplies the
real lifecycle, frame, canvas, and render facts; the CLI does not infer them from terminal output or
the DOM.

Code that needs the same service contract can use the exported typed client:

```ts
import { connectDevelopmentClient } from '@antiky/cli';

const client = await connectDevelopmentClient('antiky.config.json');
const development = await client.readDevelopmentSnapshot();
const lights = await client.listPointLights();
const harborLamp = await client.getPointLight(lights.pointLights[0].entityId);
```

This client is also the supported boundary for a Studio integration. It reads the same state and
exposes the same reload, frame-capture, and point-light operations as the CLI and MCP adapters.

Point-light changes use the complete versioned framework command. Keep the command ID stable when
diagnosing a retry; a new command ID represents a new request.

```ts
import { createCommandId } from '@antiky/framework';

if (!harborLamp.pointLight) throw new Error('The point light is unavailable.');

const changed = await client.setPointLightPower({
  protocolVersion: 1,
  commandVersion: 1,
  type: 'antiky.authoring.set-point-light-power',
  commandId: createCommandId(),
  worldId: harborLamp.worldId,
  entityId: harborLamp.pointLight.authoring.entityId,
  expectedRevision: harborLamp.pointLight.authoring.revision,
  data: { power: 2 },
});

if (
  changed.code === 'ACCEPTED'
  && changed.commandId
  && changed.resultingRevision !== null
) {
  await client.correctPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    commandId: createCommandId(),
    correctedCommandId: changed.commandId,
    expectedRevision: changed.resultingRevision,
  });
}
```

Call `getPointLight` again after an accepted result to read the newly published inspection state.
The browser runtime remains the service owner; the client does not keep a second mutable copy.

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

### Development state tools

The endpoint advertises a tools-only model-facing interface so every supported operation is directly
callable by an agent. It does not duplicate the same values as MCP Resources. Read tools are marked
read-only, non-destructive, idempotent, and closed-world. The session-wide reads and
`list_point_lights` take no arguments; `get_point_light` takes one stable entity ID.

| Tool | Use it when | State returned |
| --- | --- | --- |
| `get_dev_status` | Start here to orient to a session | Session, config, service health, connection, cleanup, and CLI measurements |
| `get_latest_build` | Source, shader, asset, or config files changed | Accepted revision and latest build attempt |
| `get_runtime_status` | Before reload or capture, or when runtime facts are missing | Runtime connection and framework inspection snapshot |
| `get_render_stats` | Check renderer health or performance without capturing pixels | Available framework-owned runtime and render measurements |
| `get_diagnostics` | A build is not ready, a runtime is unavailable, or an action failed | Development and framework diagnostics with stable codes |
| `list_point_lights` | Discover point lights published by the runtime | Stable world and entity IDs, authoring records, revisions, and event sequence |
| `get_point_light` | Inspect one stable point-light ID | Authoring and runtime values, optional render binding, and accepted facts |

Each tool description carries this selection and sequencing guidance in the MCP discovery response,
so an agent does not need this guide in its context to choose the safe next call.

### Development action tools

- `dev_reload` is appropriate after `get_latest_build` reports a ready accepted revision and
  `get_runtime_status` reports a connected runtime. It reloads that runtime without starting a new
  development session or rebuilding source. The result relates the development session, build
  revision, old and new runtime instances, and action ID.
- `capture_frame` captures the exact game-canvas pixels as a PNG under `.antiky/captures/`. Use it
  after `get_runtime_status` confirms a connected runtime, and use `get_render_stats` for canvas and
  renderer measurements. The result contains the path, digest, byte count, capture ID, action ID,
  development session, runtime instance, and build revision.
- `set_point_light_power` submits one versioned power command. Supply a new command ID, the world
  and entity IDs returned by inspection, the current expected revision, and a power from `0`
  through `4`.
- `correct_point_light_power` records a correction for an earlier accepted command. Supply a new
  command ID, the corrected command ID from its accepted fact, and the current expected revision.

The two point-light action tools return the framework's stable command result. An accepted change
adds a fact; a rejection does not mutate authoring, runtime, or render state. The local host supplies
the `world.light.edit` permission, receipt time, principal, and runtime identity separately from
tool arguments.

Frame captures support visual review. Runtime and render facts still come from the framework
inspection snapshot, not from image analysis.

## Local bridge security

The development listener accepts only the configured `127.0.0.1` host and exact Host header. It
rejects a supplied browser Origin unless it matches the configured game origin. Inspection REST
requests use the per-session bearer credential and versioned, field-checked, size-bounded messages.
A retired runtime cannot replace a newer runtime's facts.

Point-light commands are limited to 4 KiB. Trusted identity, permissions, receipt time, and runtime
identity never enter command data or inspection output.

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

- `ANTIKY_ARGUMENT_INVALID`: the command, option, or development action input is not supported.
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
