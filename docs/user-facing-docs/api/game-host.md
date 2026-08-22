---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:641549dc472c878c
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
    applyCaptureFixture?(request: CaptureFixtureRequest): CaptureFixtureResult | Promise<CaptureFixtureResult>;
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

## Capture fixture contract

Validate bounded game-owned presentation controls for deterministic visual evidence.

### `CaptureFixtureControl`

One declared scene-visibility, camera-translation, or named presentation-variant control.

```ts
type CaptureFixtureControl = CaptureFixtureSceneVisibilityControl | CaptureFixtureCameraTranslationControl | CaptureFixtureVariantControl;
```

### `CaptureFixtureRequest`

A bounded semantic fixture request addressed to one game-owned fixture surface.

```ts
type CaptureFixtureRequest = Readonly<{
    schemaVersion: typeof CAPTURE_FIXTURE_SCHEMA_VERSION;
    fixtureName: string;
    controls: readonly CaptureFixtureControl[];
}>;
```

### `CaptureFixtureResult`

The exact semantic controls a game accepted and applied for a capture.

```ts
type CaptureFixtureResult = Readonly<{
    schemaVersion: typeof CAPTURE_FIXTURE_SCHEMA_VERSION;
    fixtureName: string;
    appliedControls: readonly CaptureFixtureControl[];
}>;
```

### `CaptureFixtureState`

The current presentation-only scene, variant, and camera values owned by one game.

```ts
type CaptureFixtureState = Readonly<{
    sceneVisibility: Readonly<Record<string, boolean>>;
    variants: Readonly<Record<string, boolean>>;
    cameraTranslation: Readonly<{
        x: number;
        y: number;
        z: number;
    }>;
}>;
```

### `CaptureFixtureDeclaration`

The fixture name, semantic controls, defaults, and camera bound one game declares.

```ts
type CaptureFixtureDeclaration = Readonly<{
    fixtureName: string;
    sceneGroups?: Readonly<Record<string, boolean>>;
    variants?: Readonly<Record<string, boolean>>;
    maximumCameraTranslation?: number;
}>;
```

### `CaptureFixtureController`

Validates and applies a game declaration without exposing renderer or simulation objects.

```ts
type CaptureFixtureController = Readonly<{
    apply(request: CaptureFixtureRequest): CaptureFixtureResult;
    read(): CaptureFixtureState;
}>;
```

### `CaptureFixtureValidationError`

Thrown for invalid or undeclared capture controls with a stable code and path.

```ts
class CaptureFixtureValidationError extends Error {
    readonly code = 'INVALID_CAPTURE_FIXTURE';
    constructor(message: string, readonly path: string);
}
```

### `parseCaptureFixtureRequest`

Validates, copies, and freezes a bounded semantic capture-fixture request.

```ts
function parseCaptureFixtureRequest(value: unknown): CaptureFixtureRequest;
```

### `parseCaptureFixtureResult`

Validates an applied fixture result and can require an exact request echo.

```ts
function parseCaptureFixtureResult(value: unknown, expected?: CaptureFixtureRequest): CaptureFixtureResult;
```

### `createCaptureFixtureController`

Creates a presentation-only controller from one game-owned fixture declaration.

```ts
function createCaptureFixtureController(declaration: CaptureFixtureDeclaration): CaptureFixtureController;
```
