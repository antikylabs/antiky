# Build a game module

An Antiky game module is a compiled JavaScript file that a host mounts on one canvas. The game
module contains your game rules, render code, shaders, assets, and systems. It does not create a
server, a canvas, a process supervisor, an inspection server, or an MCP endpoint.

Export one default entry function from the source entry for your game:

```ts
import type { GameModuleEntry } from '@antiky/framework/game';

const mountGame: GameModuleEntry = async ({ canvas, movement, pointer, report }) => {
  const renderer = await createGameRenderer(canvas);

  report({ drawCalls: 12, instances: 640 });

  return {
    frame(platformTimeSeconds) {
      updateGame({ movement, pointer, platformTimeSeconds });
      renderer.draw();
    },
    dispose() {
      renderer.dispose();
    },
  };
};

export default mountGame;
```

The host owns the canvas, device-event listeners, presentation clock, visibility behavior, and
cleanup call. It changes keyboard and pointer events into the semantic `movement` and `pointer`
values. The game reads those values and returns one instance with `frame` and `dispose` operations.

## Produce the development module

Configure `development.command` in your `.antiky` file to run your compiler in watch mode. The
compiler must write this browser-ready ESM file relative to `development.workingDirectory`:

```text
dist/antiky.game.js
```

The file must bundle or emit every runtime dependency that the browser needs. Put emitted chunks
and assets in the same `dist` directory. Antiky serves that directory only through the development
host's reserved build path.

`antiky dev` starts the compiler watcher, shader watcher, development game host, inspection
service, and MCP endpoint. The project command must not bind the configured game port. Studio uses
the same project service and host.

## Keep game code portable

Import the host types from `@antiky/framework/game`. Do not import CLI, Studio, website, Node.js, or
server modules from the game entry. A test host, the CLI host, Studio, and a delivery host can then
mount the same compiled entry.
