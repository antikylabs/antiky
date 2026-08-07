/** Semantic pointer state that a game reads from an Antiky host. */
export type GamePointerInput = Readonly<{
  x: number;
  y: number;
  down: boolean;
  active: boolean;
  dragX: number;
  dragY: number;
  clicked: boolean;
}>;

/** Semantic two-axis movement that a game reads from an Antiky host. */
export type GameMovementInput = Readonly<{
  x: number;
  z: number;
  active: boolean;
}>;

export type GameHostMode = 'ambient' | 'interactive' | 'thumbnail';

export type GameMeasurements = Readonly<{
  instances?: number;
  drawCalls?: number;
  uploadBytesPerFrame?: number;
  note?: string;
}>;

/** Platform data and services supplied when a host mounts one game module. */
export type GameHostContext = Readonly<{
  canvas: HTMLCanvasElement;
  runtimeInstanceId: string;
  pointer: GamePointerInput;
  movement: GameMovementInput;
  mode: GameHostMode;
  report(measurements: GameMeasurements): void;
}>;

/** One mounted game. The host owns presentation timing and disposal. */
export type GameInstance = Readonly<{
  frame(platformTimeSeconds: number): void;
  dispose(): void;
}>;

/** The default export of a compiled Antiky game module. */
export type GameModuleEntry = (
  context: GameHostContext,
) => GameInstance | Promise<GameInstance>;
