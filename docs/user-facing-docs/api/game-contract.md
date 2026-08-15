---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:c7502a803a4b9fae
---

# Game contract API

The shape of a game module and the context a host supplies it, with nothing imported behind it.

Use this entry when a module needs only the contract, so it does not pull in the inspection snapshot or the point-light type graph to learn what a game looks like.

For the task-first workflow, read [Build a game module](../framework/game-modules.md). Import every API on this page from `@antiky/framework/contract`.

## Example

The same contract as the game host entry, obtainable on its own. `mode` lets a game degrade for a thumbnail; the seven-field pointer carries press and drag state, not just a position.

```ts
import type { GameModuleEntry } from '@antiky/framework/contract';

const mountGame: GameModuleEntry = ({ canvas, pointer, mode }) => ({
  frame(platformTimeSeconds) {
    if (mode !== 'thumbnail') updateGame({ pointer, platformTimeSeconds });
    drawGame(canvas);
  },
  dispose() {
    disposeGame();
  },
});

export default mountGame;
```

## Game contract, import-free

The shape of a game module and the context a host supplies it, with zero imports so it can be taken on its own.

### `GamePointerInput`

Current semantic pointer position, button state, and wheel input supplied by a game host.

```ts
type GamePointerInput = Readonly<{
    x: number;
    y: number;
    down: boolean;
    active: boolean;
    dragX: number;
    dragY: number;
    clicked: boolean;
}>;
```

### `GameMovementInput`

Current normalized semantic movement input supplied by a game host.

```ts
type GameMovementInput = Readonly<{
    x: number;
    z: number;
    active: boolean;
}>;
```

### `GameHostMode`

The presentation purpose selected by the host for one mounted game.

```ts
type GameHostMode = 'ambient' | 'interactive' | 'thumbnail';
```

### `GameMeasurements`

Optional bounded render measurements that a game reports to its host.

```ts
type GameMeasurements = Readonly<{
    instances?: number;
    drawCalls?: number;
    uploadBytesPerFrame?: number;
    note?: string;
}>;
```

### `GameHostContext`

Canvas, runtime identity, semantic input, mode, and measurement callback supplied when a host mounts a game.

```ts
type GameHostContext = Readonly<{
    canvas: HTMLCanvasElement;
    runtimeInstanceId: string;
    pointer: GamePointerInput;
    movement: GameMovementInput;
    mode: GameHostMode;
    report(measurements: GameMeasurements): void;
}>;
```

### `GameInstance`

One mounted game with presentation, cleanup, and optional inspection operations.

```ts
type GameInstance<TInspection = unknown> = Readonly<{
    frame(platformTimeSeconds: number): void;
    dispose(): void;
    inspection?: TInspection;
}>;
```

### `GameModuleEntry`

The default game-module function that creates one game instance from a host context.

```ts
type GameModuleEntry<TInspection = unknown> = (context: GameHostContext) => GameInstance<TInspection> | Promise<GameInstance<TInspection>>;
```
