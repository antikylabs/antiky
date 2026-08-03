import type { Renderer } from 'brometal';

/* What a demo is allowed to know about the page it runs in.
 *
 * The stage owns the renderer, the frame loop, pausing off
 * screen, pointer state and teardown. A demo builds programs and draws. */

export type Pointer = {
  /** 0..1 across the canvas, y up. */
  x: number;
  y: number;
  down: boolean;
  /** False until the visitor points at the canvas, so demos can idle on an
   *  automatic path instead of sitting at a dead centred pointer. */
  active: boolean;
  /** Accumulated drag in canvas widths, for orbit controls. */
  dragX: number;
  dragY: number;
  /** Set by the stage when the visitor clicks; the demo clears it. */
  clicked: boolean;
};

/** Directional input normalized to one unit. Keyboard and touch controls write
 * the same state so a demo never needs to know which device produced it. */
export type MovementInput = {
  x: number;
  z: number;
  active: boolean;
};

export type DemoMode = 'ambient' | 'interactive' | 'thumbnail';

/** Numbers a demo wants shown in the HUD. Static facts, mostly — the stage
 *  measures frame rate itself. */
export type DemoStats = {
  instances?: number;
  drawCalls?: number;
  /** CPU→GPU bytes per frame after the first. The number the engine exists to
   *  keep small. */
  bytesPerFrame?: number;
  note?: string;
};

export type DemoSetup = {
  renderer: Renderer;
  pointer: Pointer;
  movement: MovementInput;
  mode: DemoMode;
  report(stats: DemoStats): void;
};

export type DemoInstance = {
  frame(elapsedSeconds: number): void;
  dispose(): void;
};

export type DemoFactory = (setup: DemoSetup) => DemoInstance | Promise<DemoInstance>;
