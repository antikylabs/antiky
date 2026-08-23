# Run Antiky Town from source

Run a complete Antiky game and inspect its development session. At the end, Antiky Town will be
playable in your browser and the CLI will report its live runtime state.

Antiky is pre-release, so this tutorial uses the source repository. You need Git, Node.js 22 or
newer, npm, and a WebGPU-capable browser.

## Get the repository

Clone Antiky and install its workspace dependencies:

```sh
git clone https://github.com/antikylabs/antiky.git
cd antiky
npm install
```

Keep this repository root as your working directory for the rest of the tutorial.

## Start Antiky Town

Start the Antiky Town project and open its game page:

```sh
npm run antiky -- dev --open --project packages/demos/antiky-town/antiky-town.antiky
```

Keep this terminal open. Antiky starts the game compiler, shader watcher, game host, inspection
service, and MCP server together. The terminal prints the game and inspection addresses after the
first build succeeds.

The browser shows Antiky Town. Move through the market with WASD or the arrow keys. The page is a
live game module, not a video.

## Inspect the running game

Open a second terminal in the repository root and run:

```sh
npm run antiky -- inspect --project packages/demos/antiky-town/antiky-town.antiky
```

The command prints structured JSON for the same session. Confirm that the game process is running,
the latest build succeeded, and the runtime connection is current.

## Stop the session

Return to the first terminal and press `Ctrl-C`. Antiky stops every service that it started and
releases the local ports.

Continue with [Open Antiky Town in Studio](studio.md) to use the visual workspace with the same
project.
