# Antiky projects

An Antiky project is a game directory with one visible `<name>.antiky` manifest. The manifest gives
Studio and the CLI the same project name, development commands, network ports, and build command.

## Create the project manifest

Run this command from the top level of an existing game directory:

```sh
antiky init
```

The command uses the folder name for the display name and safe lowercase file slug. You can supply
both values explicitly from another directory:

```sh
antiky init "Harbor Lights" --directory path/to/harbor-lights
```

Initialization creates one `.antiky` manifest. It does not install dependencies, run scripts, or
create source files. It does not initialize Git or contact a remote service.

The command does not overwrite a project. It rejects a directory that contains any `.antiky` file.
It also removes temporary files after a failed or interrupted write.

The generated `harbor-lights.antiky` file has these defaults:

```json
{
  "schemaVersion": 1,
  "name": "Harbor Lights",
  "development": {
    "command": ["npm", "run", "dev"],
    "shaderCommand": ["npm", "run", "shaders:watch"],
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
    "command": ["npm", "run", "build"],
    "workingDirectory": "."
  }
}
```

The directory that contains the manifest is the project root. The development and build working
directories are relative to that root. Keep those paths inside the project.

Edit the development and build commands when your package scripts use different names. Projects
that do not compile BroMetal shaders, such as Three.js projects, set `shaderCommand` to `[]` so
Studio does not start a shader watcher. The initializer does not inspect or run `package.json`.

The manifest is strict JSON. Every field in the example is required, unknown fields are rejected,
and only schema version 1 is supported. The maximum file size is 64 KiB.

## Open the project in Studio

Start Antiky Studio and use either launcher path:

- Enter a name and select **Create project**. Choose an existing game folder. Studio creates the
  same manifest as `antiky init`, opens it, and does not install dependencies or create game source.
- Select **Open project**, then select an existing `.antiky` manifest.

After the first successful open, the launcher lists the project under **Recent projects**. Select a
recent project to open it without using the file picker. Studio keeps at most 20 recent project
paths and last-opened times on this device, outside every project directory. A moved or deleted
manifest stays visible as missing so the list does not hide what happened.

Studio validates a selected or created file before it opens the workspace and shows the project
name, manifest path, schema version, and project root. Studio then starts the CLI package's project
service and development game host directly. It does not run an `antiky dev` shell command.

Select **Open project** in the workspace to choose a different project. You can also double-click a
`.antiky` file in Finder after Antiky Studio is installed. Finder opens the same Studio window when
Studio is already running.

On macOS, you can open the project from a terminal instead:

```sh
antiky studio path/to/harbor-lights
```

The path can be a project directory or its `.antiky` manifest. You can also use `--project path` for
the same explicit selection. Run `antiky studio` without a path from a directory that contains
exactly one `.antiky` file. The CLI validates the manifest before it asks macOS to open Antiky
Studio. It does not start the game compiler, development host, or project service; Studio starts
them after it accepts the project.

If a replacement manifest is invalid, Studio reports the error and leaves the current project
unchanged. Canceling the file picker also leaves the current project unchanged. Studio does not run
project commands while it validates a manifest.

## Select the project from the CLI

Run a command from a directory that contains exactly one `.antiky` file:

```sh
antiky dev
```

Use `--project` when the manifest is elsewhere or the current directory contains more than one:

```sh
antiky dev --project path/to/harbor-lights.antiky
```

The CLI checks only the current directory when `--project` is absent. It does not search parent
directories. Zero or multiple `.antiky` files produce an error instead of selecting one implicitly.

## Understand the manifest fields

| Field | Purpose |
| --- | --- |
| `schemaVersion` | Selects the manifest format. The current value is `1`. |
| `name` | Supplies the project name shown in Studio and development output. |
| `development.command` | Watches and compiles the game to `dist/antiky.game.js`. |
| `development.shaderCommand` | Starts the shader watcher, or skips it when the array is empty. |
| `development.workingDirectory` | Selects the working directory for both development commands. |
| `development.url` | Supplies the loopback page that Studio displays as the live game. |
| `development.viewport` | Supplies the requested game width and height. |
| `network` | Selects the loopback host and the game and inspection ports. |
| `build.command` | Builds the game. |
| `build.workingDirectory` | Selects the working directory for the build command. |

Commands are arrays so each argument stays distinct. Antiky does not pass the command through a
shell. Manifest paths use forward slashes so the same project remains portable.

## Keep runtime files separate

Track the visible `.antiky` manifest with the rest of your project input. The `.antiky/` directory
contains local runtime state, including the current development-session descriptor. Its ignore file
is created before Antiky writes a session credential, so local state does not enter normal Git
history.

Do not edit `.antiky/dev-session.json`. Antiky creates it when a development session starts and
removes it during cleanup.

## Migrate an older project

If the project still has `antiky.config.json`, run this command from the project root:

```sh
antiky migrate --name "Harbor Lights" --output harbor-lights.antiky
```

Review and commit the new manifest. Normal Studio and CLI commands no longer read
`antiky.config.json` after migration.

See [Inspect a running game in Studio](getting-started.md) to use the workspace after the project
opens. See [Run a local development session](../cli/development.md) for the complete CLI workflow.
