# Antiky Development CLI

The `antiky` command starts and inspects one local game development session. Slice 00 uses the
existing `town-study` route.

## Configure the session

Put `antiky.config.json` at the project root. The schema is versioned and strict. Antiky rejects an
unknown field before it starts a process.

```json
{
  "schemaVersion": 1,
  "game": {
    "command": [
      "npm",
      "run",
      "dev",
      "--workspace",
      "@antiky/website",
      "--",
      "--hostname",
      "{host}",
      "--port",
      "{gamePort}"
    ],
    "shaderCommand": [
      "npm",
      "run",
      "shaders:watch",
      "--workspace",
      "@antiky/demos"
    ],
    "workingDirectory": ".",
    "url": "http://127.0.0.1:3010/demos/town-study"
  },
  "network": {
    "host": "127.0.0.1",
    "gamePort": 3010,
    "inspectionPort": 3011
  }
}
```

`workingDirectory` is relative to the config file and must stay inside that directory. The command
can use `{host}`, `{gamePort}`, `{inspectionPort}`, and `{gameUrl}` placeholders. Antiky expands each
placeholder without a shell.

The game URL must use HTTP on the configured game address. Slice 00 accepts only `127.0.0.1`.

## Start the town

From the repository root, run:

```sh
antiky dev
```

The workspace-local executable is `./node_modules/.bin/antiky` after `npm install`.

To use another config path, run:

```sh
antiky dev --config path/to/antiky.config.json
```

Antiky validates the complete config and reserves the game and inspection ports before it starts a
child. It then starts the shader watcher, game host, and inspection service. The command prints the
resolved config path, game URL, inspection URL, development-session ID, and service names.

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

Framework measurements and CLI development measurements remain separate. Each measurement record
has its owner.

When `antiky dev` starts the website, its development-only browser adapter connects to the
loopback inspection service and publishes the stage's real lifecycle, frame count, canvas size, and
available render statistics. The adapter does not infer facts from terminal text or the DOM.

Code that needs the same service contract can use the exported typed client:

```ts
import { connectDevelopmentClient } from '@antiky/cli';

const client = await connectDevelopmentClient('antiky.config.json');
const development = await client.readDevelopmentSnapshot();
```

This is the Slice 00 Studio-compatible boundary. It does not create a Studio UI or a second engine
service.

## Track development updates

Antiky watches the selected project's existing source, shader, asset, and config files. A revision
is accepted only after a changed build reaches a newer ready browser runtime. A browser reload can
change the runtime-instance ID without changing the development-session ID.

For a shader change, Antiky waits for the matching generated shader before it accepts a ready
runtime. A failed update leaves the accepted revision and generated shader unchanged and adds a
structured CLI build diagnostic. Fixing the file clears that active diagnostic after the next ready
runtime.

## Connect an MCP client

Run the newline-delimited standard-input/output adapter while `antiky dev` is active:

```sh
antiky mcp
```

Use `--config path/to/antiky.config.json` when the development command used that config. The adapter
implements MCP protocol version `2025-11-25`. It writes protocol JSON only to standard output and
uses the same typed development client as `antiky inspect`.

The adapter publishes these JSON resources:

- `antiky://dev/status`
- `antiky://build/latest`
- `antiky://runtime/status`
- `antiky://render/stats`
- `antiky://diagnostics`

It publishes two controlled tools:

- `dev_reload` asks the connected browser to reload. The result relates the development session,
  build revision, old runtime instance, new runtime instance, and action ID.
- `capture_frame` captures the game canvas as a PNG under `.antiky/captures/`. The result contains
  the path, digest, byte count, capture ID, action ID, development session, runtime instance, and
  build revision.

Screenshots support visual review. Runtime and render facts still come from the framework inspection
snapshot, not from image analysis.

## Local bridge security

The inspection service accepts only the configured `127.0.0.1` host and exact game origin. Browser
messages are authenticated, versioned, field-checked, ordered, and size-bounded. A retired runtime
cannot replace a newer runtime's facts. The per-session credential remains inside the browser
adapter closure and the mode-`0600` session descriptor.

Production website builds replace the complete local browser adapter with a no-op module. The
production artifact test rejects local endpoints, the development environment key, and credential
bootstrap code in deployable server or client chunks.

## Stop and cleanup

Press `Ctrl-C` in the `antiky dev` terminal. Antiky sends a normal stop to every owned process,
waits for it, closes the inspection service, removes the session descriptor, and releases both
ports. An owned child failure performs the same cleanup and returns a nonzero status.

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
