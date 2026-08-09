# Run Antiky locally

Run `antiky dev` to start everything you need for local game development: your game compiler,
shader watcher, host canvas, runtime inspection, and MCP server. The command keeps those services
in one development session and stops them together.

## Initialize an existing game directory

Use this command shape to add Antiky project data to an existing game directory:

```text
antiky init [name] [--directory path]
```

Run `antiky init` in the game directory to use its folder name. A folder named `harbor-lights`
gets the display name `Harbor Lights` and the file `harbor-lights.antiky`.

Supply a name and another existing directory when you need explicit values:

```sh
antiky init "Harbor Lights" --directory path/to/harbor-lights
```

The command creates only the manifest. It does not install dependencies, run package scripts,
create source files, initialize Git, or contact a remote service. It prints the created manifest
path and the next `antiky dev` and Studio actions.

## Install a catalog asset

Install a verified asset from the Antiky catalog into a project with its catalog ID:

```sh
antiky asset install poly-haven:forest-floor --project path/to/harbor-lights.antiky
```

The command validates the selected Antiky project, downloads the catalog's selected files, and
checks every byte count and upstream hash before it replaces an existing installation. It writes
the files beneath `assets/<provider>/<asset>/` and records their source URLs, upstream hashes,
SHA-256 hashes, license, API attribution, and installation time in `assets/antiky-assets.json`.
Track that registry with the project. It lets Studio, agents, builds, and reviewers identify the
exact source of installed files without relying on filenames.

The installer accepts only catalog records marked `verified`. A failed download or integrity check
leaves the prior installed asset unchanged. `ANTIKY_ASSET_NOT_FOUND` means the catalog ID is not
known. `ANTIKY_ASSET_INSTALL_FAILED` means project validation, download, integrity verification, or
the final filesystem update failed.

The name stays visible in the manifest. Antiky converts it to a safe lowercase file slug. It keeps
Unicode letters in the display name when they can produce a non-empty ASCII slug.

The target must be an existing writable directory and not a symbolic link. The command rejects a
directory that already contains any `.antiky` file. It never replaces that file. A failed or
interrupted command removes its temporary files.

## Start a development session

From the directory that contains exactly one `<name>.antiky` project manifest, run:

```sh
antiky dev
```

After startup, Antiky prints the project path, game URL, inspection URL, MCP URL, development-session
ID, and service names. Keep this terminal open while you work.

Select a project explicitly when you are outside its directory:

```sh
antiky dev --project path/to/harbor-lights.antiky
```

An explicit path takes priority. Without one, Antiky accepts exactly one `.antiky` file in the
current directory. It does not search parent directories. Antiky validates the complete manifest
and reserves both ports before it starts a child process. If validation fails or a port is busy,
nothing starts.

On macOS, open the same selected project in the installed desktop application with:

```sh
antiky studio path/to/harbor-lights
```

The positional path can select the project directory or its `.antiky` manifest. The older
`--project path` form selects the same target. You can omit the path under the same current-directory
discovery rule. The command validates the manifest before it opens Antiky Studio. It does not start
development services; Studio owns those services after it accepts the project.

## Configure your project

The initializer uses the following defaults. The filename identifies the project to Finder, Studio,
the CLI, and source control. Change the commands and game URL to match your project:

```json
{
  "schemaVersion": 1,
  "name": "Harbor Lights",
  "development": {
    "command": [
      "npm",
      "run",
      "dev"
    ],
    "shaderCommand": [
      "npm",
      "run",
      "shaders:watch"
    ],
    "workingDirectory": ".",
    "url": "http://127.0.0.1:3010/",
    "viewport": {
      "width": 1280,
      "height": 720
    }
  },
  "network": {
    "host": "127.0.0.1",
    "gamePort": 3010,
    "inspectionPort": 3011
  },
  "build": {
    "command": [
      "npm",
      "run",
      "build"
    ],
    "workingDirectory": "."
  }
}
```

All fields are required. `name` is the display name. Each `workingDirectory` uses forward slashes,
is relative to the project manifest, and must stay inside the project root. Command arguments can
use these placeholders:

| Placeholder | Value |
| --- | --- |
| `{host}` | The configured loopback host |
| `{gamePort}` | The port for your game |
| `{inspectionPort}` | The port for inspection and MCP |
| `{gameUrl}` | The configured game URL |
| `{gameWidth}` | The viewport width |
| `{gameHeight}` | The viewport height |

Antiky passes each expanded argument directly to the process without using a shell. The
development command is a compiler watcher. It must write `dist/antiky.game.js` relative to
`development.workingDirectory`; it must not run a web server or bind the game port. The process
also receives `ANTIKY_GAME_WIDTH` and `ANTIKY_GAME_HEIGHT`.

The compiled file exports the [game module entry](../framework/game-modules.md). Antiky owns the
development server, canvas, input listeners, presentation clock, inspection service, and MCP
endpoint. It serves emitted chunks and assets beside the game module from the same `dist` folder.

The game URL must use HTTP at the configured game address. Development services bind only to the
IPv4 loopback address `127.0.0.1`; Antiky rejects LAN and wildcard hosts.

The manifest is strict JSON with a 64 KiB limit. Antiky rejects unknown fields, unsupported schema
versions, invalid UTF-8, unsafe paths, symbolic-link escapes, and working directories that do not
exist. The canonical manifest path is project identity. Its SHA-256 content digest is the project
revision.

### Migrate an older project

If your project still has `antiky.config.json`, run this command once from the project root:

```sh
antiky migrate --name "Harbor Lights" --output harbor-lights.antiky
```

Use `--config path/to/antiky.config.json` only when the old file has another location. Migration
validates the old development settings, adds the required build command, and creates the new file
without overwriting an existing manifest. Check the new project with `antiky dev`, then remove the
old config from your project. Normal development commands do not read it.

## Inspect the running session

In another terminal, run:

```sh
antiky inspect
```

The command prints the current development snapshot as JSON. It includes:

- The development-session ID and accepted build revision.
- The validated project and local addresses.
- Game-compiler and shader process health.
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

You can use `--input '<json>'` instead of the positional object. Add `--project path` when the
project manifest is not in the current directory.

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

const client = await connectDevelopmentClient('harbor-lights.antiky');
const development = await client.readDevelopmentSnapshot();
const sessionStatus = await client.getSessionStatus();
const world = await client.getWorldInspection();
const events = await client.getEventHistory();
const lights = await client.listPointLights();
const harborLamp = await client.getPointLight(lights.pointLights[0].entityId);
```

The client also exposes `pauseSimulation`, `resumeSimulation`, `stepSimulation`,
`setPointLightPower`, `correctPointLightPower`, reload, and frame-capture operations. Studio uses
this boundary so it reads and changes the same development session instead of keeping a second
copy of game state.

`getWorldInspection` returns the complete bounded hierarchy and named store views published by the
Framework. `getEventHistory` returns accepted event-sourcing facts and the source's retention rule.
Both operations return `ANTIKY_RUNTIME_UNAVAILABLE` when the connected game does not publish that
view.

Browser and desktop-webview clients import `createDevelopmentClient` from
`@antiky/cli/development` and receive a bounded connection from their host. They do not import the
Node.js descriptor reader.

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

## Read MCP call history

The typed client can read the temporary history of MCP Tool calls handled by this development host:

```ts
const calls = await client.getMcpCallLog();

for (const call of calls.calls) {
  console.log(call.sequence, call.toolName, call.outcome);
}
```

`getMcpCallLog` uses the protected `/v1/mcp-calls` development query. It is not an MCP Tool, so
reading the log does not add another entry to the same log.

The host keeps at most 100 complete calls in memory for one development session. It records source
sequence, time, duration, Tool name, bounded arguments, structured result or error, and available
correlation IDs. It drops the oldest complete entry at capacity and reports the dropped count.
Secret-named fields are redacted, and oversized values are marked as truncated. Do not treat this
log as an event store, terminal transcript, caller identity record, or durable audit log.

## Follow source changes

Antiky watches source, shader, asset, and project-manifest files under the development working
directory. It accepts a revision only after the changed build reaches a newer ready game process.
A browser reload can change the runtime-instance ID without changing the development-session ID.

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

The visible `<name>.antiky` manifest is tracked project input. The hidden `.antiky/` directory is
temporary development state. Antiky writes `.antiky/.gitignore` before it writes the random session
credential to `.antiky/dev-session.json` with mode `0600`. It does not print the credential or put
it in the game URL, diagnostics, or inspection results. Antiky removes the descriptor when the
session stops and keeps the ignore marker.

## Collect host diagnostics

Code that embeds the CLI can pass `diagnosticSink` to `startDevelopmentSession` or as the third
argument to `runCli`. The sink receives immutable structured events for session, component,
runtime, action, cleanup, and unexpected request transitions. Each event contains a stable code,
severity, component, and any available development-session, runtime, action, or request ID.

Diagnostic events do not contain error messages, credentials, authorization headers, command
payloads, or capture bytes. The `antiky` executable writes error-level events to standard error
with the prefix `[ANTIKY_DIAGNOSTIC]`; an injected sink can retain or filter other levels.

## Stable errors

The CLI writes a stable error code before its message:

- `ANTIKY_ARGUMENT_INVALID`: the command, option, JSON tool input, or development action input is
  not supported.
- `ANTIKY_PROJECT_NAME_INVALID`: `antiky init` cannot make a safe project name and file slug.
- `ANTIKY_PROJECT_DIRECTORY_INVALID`: the initialization target is missing, is not a directory,
  or is a symbolic link.
- `ANTIKY_PROJECT_CREATE_FAILED`: the initializer cannot write, commit, or clean its manifest files.
- `ANTIKY_PROJECT_INIT_INTERRUPTED`: a signal stopped initialization before the atomic commit.
- `ANTIKY_PROJECT_NOT_FOUND`: no selected project exists, or discovery found no `.antiky` file.
- `ANTIKY_PROJECT_AMBIGUOUS`: discovery found more than one `.antiky` file.
- `ANTIKY_PROJECT_NOT_FILE`: the selected path is not a regular file.
- `ANTIKY_PROJECT_TOO_LARGE`: the manifest is larger than 64 KiB.
- `ANTIKY_PROJECT_INCOMPATIBLE`: the schema version is not supported.
- `ANTIKY_PROJECT_INVALID`: JSON, fields, commands, URLs, ports, or portable paths are invalid.
- `ANTIKY_PROJECT_PATH_ESCAPE`: a manifest link or resolved working directory escapes the project.
- `ANTIKY_PROJECT_EXISTS`: initialization or migration would add a second project manifest.
- `ANTIKY_PORT_BUSY`: a configured port cannot be reserved. No child starts.
- `ANTIKY_CHILD_START_FAILED`: an owned process could not start. Any partial start is cleaned up.
- `ANTIKY_CHILD_STOP_FAILED`: an owned child process group remained active after shutdown attempts.
- `ANTIKY_INTERNAL_ERROR`: the CLI failed unexpectedly; use the correlated diagnostic event.
- `ANTIKY_SESSION_UNAVAILABLE`: `antiky inspect` cannot find or reach the selected session.
- `ANTIKY_STUDIO_UNAVAILABLE`: the platform is unsupported, or macOS could not open the installed
  Antiky Studio application.
- `ANTIKY_UNAUTHORIZED`: the inspection service rejected the session credential.
- `ANTIKY_RUNTIME_UNAVAILABLE`: a runtime-backed read or action needs a connected game process.
- `ANTIKY_ACTION_BUSY`: another controlled development action is still active.
- `ANTIKY_ACTION_TIMEOUT`: the connected game process did not finish the action in time.
- `ANTIKY_ACTION_STALE`: an action result belongs to an inactive request or game process.
- `ANTIKY_CAPTURE_INVALID`: the game returned invalid or oversized PNG data.
- `ANTIKY_CAPTURE_SAVE_FAILED`: Antiky could not save a valid frame capture.

Fix a project or port error and run the command again. Do not edit the local session descriptor.

To connect an agent, use the [MCP overview](../mcp/overview.md). It covers the Streamable HTTP
endpoint, the `antiky mcp` standard-input/output adapter, and the local security boundary.
