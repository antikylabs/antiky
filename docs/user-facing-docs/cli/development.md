# Run Antiky locally

Run `antiky dev` to start everything you need for local game development: your game process,
shader watcher, runtime inspection, and MCP server. The command keeps those services in one
development session and stops them together.

## Start a development session

From the directory that contains `antiky.config.json`, run:

```sh
antiky dev
```

After startup, Antiky prints the config path, game URL, inspection URL, MCP URL, development-session
ID, and service names. Keep this terminal open while you work.

Use another config file when needed:

```sh
antiky dev --config path/to/antiky.config.json
```

Antiky checks the complete config and reserves both configured ports before it starts any child
process. If the config is invalid or a port is busy, nothing starts.

## Configure your project

Put `antiky.config.json` at your project root. Change the commands and game URL to match your
project:

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
arguments can use these placeholders:

| Placeholder | Value |
| --- | --- |
| `{host}` | The configured loopback host |
| `{gamePort}` | The port for your game |
| `{inspectionPort}` | The port for inspection and MCP |
| `{gameUrl}` | The configured game URL |
| `{gameWidth}` | The viewport width |
| `{gameHeight}` | The viewport height |

Antiky passes each expanded argument directly to the process without using a shell. The optional
`viewport` defaults to `1280x720`. The game process also receives `ANTIKY_GAME_WIDTH` and
`ANTIKY_GAME_HEIGHT`.

The game URL must use HTTP at the configured game address. Development services bind only to the
IPv4 loopback address `127.0.0.1`; Antiky rejects LAN and wildcard hosts.

## Inspect the running session

In another terminal, run:

```sh
antiky inspect
```

The command prints the current development snapshot as JSON. It includes:

- The development-session ID and accepted build revision.
- The resolved config and local addresses.
- Game and shader process health.
- The latest build result, changed path, and duration.
- Runtime connection and cleanup health.
- CLI launch measurements and development diagnostics.
- The latest framework inspection snapshot, or `null` before the game connects.
- Engine-session identity, fixed-clock state, system order, and control revisions when published.
- Point-light state when the game publishes it.

Your game supplies real lifecycle, frame, canvas, and render facts through a framework inspection
snapshot. The CLI does not guess them from terminal output, the page DOM, or a captured image.

## Call a development tool

A person can call the same development tools that an MCP client uses. Keep `antiky dev` running,
then call a tool in another terminal:

```sh
antiky tool list_point_lights
```

Pass one JSON object after a tool that needs input:

```sh
antiky tool get_point_light '{"entityId":"018f0f3a-7b2c-7a1d-8e2f-123456789abd"}'
```

You can use `--input '<json>'` instead of the positional object. Add `--config path` when the
config file is not in the current directory.

The command connects to the session's MCP endpoint, calls the named tool, and prints its structured
result as JSON. Invalid JSON, an unknown tool, or rejected arguments return a nonzero exit code.
See the [MCP tool reference](../mcp/tools.md) for every tool and its inputs.

## Control a fixed-step session

If your game publishes an `EngineSession`, read its current clock and pause it before stepping:

```sh
antiky tool get_session_status
antiky tool pause_simulation
antiky tool step_simulation '{"expectedCompletedStepCount":42}'
antiky tool resume_simulation
```

Replace `42` with `session.clock.completedStepCount` from the status or pause result. An accepted
step advances exactly one fixed tick. Repeating that request after the tick returns
`STALE_COMPLETED_STEP` and does not advance again.

Pause reasons are independent. `resume_simulation` removes the development tool's pause reason,
but a user or visibility pause can keep the game paused. Each action returns both the control result
and the resulting immutable session status.

See [Run a fixed-step game session](../framework/engine-sessions.md) for game-host integration and
the [MCP tool reference](../mcp/tools.md#engine-session-tools) for all result codes.

## Generate stable IDs

Generate a lowercase UUIDv7 without starting `antiky dev`:

```sh
antiky generate id entity
```

Choose `world`, `entity`, `command`, or `session`. The command uses the same Framework generator as
game code. Add `--json` when another program needs the kind and ID as named fields:

```sh
antiky generate id command --json
```

Plain output contains only the ID and a newline. JSON output has this shape:

```json
{
  "kind": "command",
  "id": "018f0f3a-7b2c-7a1d-8e2f-123456789ac0"
}
```

## Use the typed development client

Code that integrates with the same services can use `connectDevelopmentClient`:

```ts
import { connectDevelopmentClient } from '@antiky/cli';

const client = await connectDevelopmentClient('antiky.config.json');
const development = await client.readDevelopmentSnapshot();
const sessionStatus = await client.getSessionStatus();
const lights = await client.listPointLights();
const harborLamp = await client.getPointLight(lights.pointLights[0].entityId);
```

The client also exposes `pauseSimulation`, `resumeSimulation`, `stepSimulation`,
`setPointLightPower`, `correctPointLightPower`, reload, and frame-capture operations. Studio uses
this boundary so it reads and changes the same development session instead of keeping a second
copy of game state.

Pause and step through the typed boundary with the same retry-safe count used by the CLI:

```ts
const paused = await client.pauseSimulation();
const stepped = await client.stepSimulation(
  paused.session.clock.completedStepCount,
);

if (stepped.result.code === 'STEPPED') {
  console.log(stepped.session.lastCompletedStep?.stateDigest);
}
```

Point-light changes use a complete versioned framework command. Keep a command ID stable when
retrying the same request. Generate a new command ID for a new request.

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

Call `getPointLight` again after an accepted result to read the new published state.

## Follow source changes

Antiky watches source, shader, asset, and config files under the configured working directory. It
accepts a revision only after the changed build reaches a newer ready game process. A browser reload
can change the runtime-instance ID without changing the development-session ID.

For a shader change, Antiky waits for the matching generated shader before it accepts a ready
runtime. A failed update leaves the accepted revision and generated shader unchanged and adds a
structured diagnostic. Fixing the file clears the active diagnostic after the next ready runtime.

## Stop the session

Press `Ctrl-C` in the `antiky dev` terminal. Antiky asks every owned process to stop, closes the
inspection and MCP listener, removes the session descriptor, and releases both ports. An owned
child failure performs the same cleanup and returns a nonzero status.

Antiky attempts every cleanup operation even when one operation fails. A failed operation sets the
cleanup state to `failed` and makes a normal stop return a nonzero status instead of reporting that
cleanup finished successfully.

Antiky stores the random session credential in `.antiky/dev-session.json` with mode `0600`.
It does not print the credential or put it in the game URL, diagnostics, or inspection results.
Antiky removes the descriptor when the session stops.

## Stable errors

The CLI writes a stable error code before its message:

- `ANTIKY_ARGUMENT_INVALID`: the command, option, JSON tool input, or development action input is
  not supported.
- `ANTIKY_CONFIG_NOT_FOUND`: the selected config file does not exist.
- `ANTIKY_CONFIG_INVALID`: JSON, fields, paths, commands, URLs, or ports are invalid.
- `ANTIKY_PORT_BUSY`: a configured port cannot be reserved. No child starts.
- `ANTIKY_CHILD_START_FAILED`: an owned process could not start. Any partial start is cleaned up.
- `ANTIKY_SESSION_UNAVAILABLE`: `antiky inspect` cannot find or reach the selected session.
- `ANTIKY_UNAUTHORIZED`: the inspection service rejected the session credential.
- `ANTIKY_RUNTIME_UNAVAILABLE`: a runtime-backed read or action needs a connected game process.
- `ANTIKY_ACTION_BUSY`: another controlled development action is still active.
- `ANTIKY_ACTION_TIMEOUT`: the connected game process did not finish the action in time.
- `ANTIKY_ACTION_STALE`: an action result belongs to an inactive request or game process.
- `ANTIKY_CAPTURE_INVALID`: the game returned invalid or oversized PNG data.
- `ANTIKY_CAPTURE_SAVE_FAILED`: Antiky could not save a valid frame capture.

Fix a config or port error and run the command again. Do not edit the local session descriptor.

To connect an agent, use the [MCP overview](../mcp/overview.md). It covers the Streamable HTTP
endpoint, the `antiky mcp` standard-input/output adapter, and the local security boundary.
