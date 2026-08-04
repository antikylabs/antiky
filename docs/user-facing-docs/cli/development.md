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
- Runtime connection and cleanup health.
- CLI-owned launch measurements and development diagnostics.
- The latest framework `InspectionSnapshot`, or `null` before a runtime connects.

Framework measurements and CLI development measurements remain separate. Each measurement record
has its owner.

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

Fix a config or port error and run the command again. Do not edit the local session descriptor.
