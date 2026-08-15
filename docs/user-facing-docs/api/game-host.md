---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:22a6c0d73a27da1f
---

# Game host API

Mount one portable game module with host-owned canvas, input, timing, measurements, inspection, and cleanup.

Use this entry to define a game module or a delivery host without importing CLI, Studio, website, or server code into the game.

For the task-first workflow, read [Build a game module](../framework/game-modules.md). Import every API on this page from `@antiky/framework/game`.

## Example

The host supplies platform services. The game returns one instance that accepts presentation time and supports cleanup.

```ts
import type { GameModuleEntry } from '@antiky/framework/game';

const mountGame: GameModuleEntry = ({ canvas, movement, pointer }) => ({
  frame(platformTimeSeconds) {
    updateGame({ movement, pointer, platformTimeSeconds });
    drawGame(canvas);
  },
  dispose() {
    disposeGame();
  },
});

export default mountGame;
```

## Game contract, import-free

Re-exported here so the game entry stays one import. `@antiky/framework/contract` is the same types with nothing behind them.

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

## Game module and host contract

Keep platform work in the host and expose only semantic game input, measurements, inspection, presentation, and cleanup.

### `GameHostInspectionState`

Host-owned lifecycle, canvas, frame, measurement, and error state used for one inspection snapshot.

```ts
type GameHostInspectionState = Readonly<{
    runtimeInstanceId: string;
    lifecycle: RuntimeLifecycle;
    frameCount: number;
    framesPerSecond: number;
    canvasWidth: number;
    canvasHeight: number;
    measurements: GameMeasurements;
    error?: Readonly<{
        code: string;
        message: string;
    }>;
}>;
```

### `GameInspectionDetails`

Optional game-owned session and point-light state added to a host inspection snapshot.

```ts
type GameInspectionDetails = Readonly<{
    session?: EngineSessionStatus;
    pointLights?: PointLightInspection;
}>;
```

### `GameSessionControlResult`

One session-control result paired with the current serializable session status.

```ts
type GameSessionControlResult = Readonly<{
    result: EngineControlResult;
    session: EngineSessionStatus;
}>;
```

### `GameInspectionPort`

Optional semantic inspection and control operations supplied by a mounted game.

```ts
type GameInspectionPort = Readonly<{
    snapshot(state: GameHostInspectionState): InspectionSnapshot;
    setPointLightPower?(command: SetPointLightPowerCommand, context: PointLightCommandContext): PointLightCommandResult | Promise<PointLightCommandResult>;
    correctPointLightPower?(request: CorrectPointLightPowerRequest, context: PointLightCommandContext): PointLightCommandResult | Promise<PointLightCommandResult>;
    pauseSimulation?(): GameSessionControlResult | Promise<GameSessionControlResult>;
    resumeSimulation?(): GameSessionControlResult | Promise<GameSessionControlResult>;
    stepSimulation?(expectedCompletedStepCount: number): GameSessionControlResult | Promise<GameSessionControlResult>;
}>;
```

### `createGameInspectionSnapshot`

Combines validated host state with optional game state in one Framework inspection snapshot.

```ts
function createGameInspectionSnapshot(state: GameHostInspectionState, details: GameInspectionDetails = {}): InspectionSnapshot;
```

### `GameInstance`

One mounted game with presentation, cleanup, and optional inspection operations.

```ts
type GameInstance = GameInstanceCore<GameInspectionPort>;
```

### `GameModuleEntry`

The default game-module function that creates one game instance from a host context.

```ts
type GameModuleEntry = (context: GameHostContext) => GameInstance | Promise<GameInstance>;
```
