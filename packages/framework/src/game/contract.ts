/**
 * The game/host contract, with nothing behind it.
 *
 * This module imports nothing, and a test asserts that. It exists because `host.ts` pulls in the
 * inspection snapshot, the point-light commands, the point-light world views, the point-light
 * inspection and the engine-session contract — so a demo that wanted only the shape of a game
 * module had to drag the entire point-light service type graph in behind it.
 *
 * Keeping these platform-only types separate lets Antiky games depend on the host contract without
 * importing the inspection, point-light, or engine-session implementation graph.
 */

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
export type GameInstance<TInspection = unknown> = Readonly<{
  frame(platformTimeSeconds: number): void;
  dispose(): void;
  /**
   * Left open here on purpose. Typing it would import the inspection and point-light graph, which
   * is the exact cost this module exists to avoid. `host.ts` binds it to `GameInspectionPort`.
   */
  inspection?: TInspection;
}>;

/** The default export of a compiled Antiky game module. */
export type GameModuleEntry<TInspection = unknown> = (
  context: GameHostContext,
) => GameInstance<TInspection> | Promise<GameInstance<TInspection>>;
