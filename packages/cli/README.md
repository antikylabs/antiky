# `@antiky/cli`

The Antiky CLI initializes game projects and runs the local compiler, game host, runtime inspection,
and MCP endpoint as one development session. Use it when you want one command to start and stop the
services behind an Antiky game.

## Install

Install the command globally with Node.js 22 or newer:

```sh
npm install --global @antiky/cli
```

Confirm the installed command and view the project initializer:

```sh
antiky init --help
```

To add Antiky to an existing game directory, run:

```sh
antiky init "Harbor Lights" --directory path/to/harbor-lights
```

The command creates one `.antiky` project manifest. It does not install project dependencies, run
package scripts, or initialize Git.

## Commands

| Command | Purpose |
| --- | --- |
| `antiky init` | Create an Antiky project manifest |
| `antiky dev` | Run the local game compiler, host, inspection service, and MCP endpoint |
| `antiky inspect` | Print the current development snapshot |
| `antiky asset install` | Install a verified asset from the hosted Antiky catalog |
| `antiky studio` | Open a project in the installed Antiky Studio application on macOS |
| `antiky mcp` | Bridge a running development session over standard input and output |

Read the [CLI development guide](https://github.com/antikylabs/antiky/blob/main/docs/user-facing-docs/cli/development.md)
for the project manifest, service lifecycle, asset fallback approval, and inspection commands.

## Library entry points

The package also exposes `@antiky/cli/development` for the browser-safe development client and
`@antiky/cli/project` for project manifest types and validation.

## License

MIT
