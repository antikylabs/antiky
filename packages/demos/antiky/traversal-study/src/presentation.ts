import type { TraversalSnapshot } from './simulation.ts';

export type TraversalCameraFrame = Readonly<{
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}>;

export function traversalCameraFrame(
  aspect: number,
  state: Pick<TraversalSnapshot, 'player'>,
  pointer: Readonly<{ x: number; y: number }>,
): TraversalCameraFrame {
  const mobile = aspect < 0.9;
  const pointerY = Number.isFinite(pointer.y) ? Math.max(0, Math.min(1, pointer.y)) : 0.5;
  const lift = (pointerY - 0.5) * (mobile ? 0.35 : 0.5);

  return Object.freeze({
    position: Object.freeze([
      state.player.x + (mobile ? 1.8 : 3.15),
      (mobile ? 6.15 : 4.65) + lift,
      mobile ? 15.8 : 10.9,
    ] as const),
    target: Object.freeze([
      state.player.x + (mobile ? 0.35 : 1.55),
      Math.max(1.25, state.player.y * 0.34 + 1.08),
      -0.25,
    ] as const),
  });
}
