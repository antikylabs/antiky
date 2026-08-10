import type { TraversalSnapshot } from './simulation.ts';

export type TraversalCameraFrame = Readonly<{
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}>;

export type TraversalCameraRig = Readonly<{
  update(
    aspect: number,
    state: Pick<TraversalSnapshot, 'player' | 'resetSerial'>,
    pointer: Readonly<{ x: number; y: number }>,
    deltaSeconds: number,
  ): TraversalCameraFrame;
}>;

export function traversalCameraFrame(
  aspect: number,
  state: Pick<TraversalSnapshot, 'player'>,
  pointer: Readonly<{ x: number; y: number }>,
): TraversalCameraFrame {
  const mobile = aspect < 0.9;
  const pointerY = Number.isFinite(pointer.y) ? Math.max(0, Math.min(1, pointer.y)) : 0.5;
  const pointerLift = (pointerY - 0.5) * (mobile ? 0.28 : 0.42);
  const speedLookAhead = Math.max(-1.2, Math.min(2.4, state.player.vx * 0.48));
  const verticalAnticipation = Math.max(-0.45, Math.min(0.9, state.player.vy * 0.1));
  const lead = (mobile ? 0.65 : 1.9) + speedLookAhead;
  const targetY = Math.max(1.2, state.player.y * 0.45 + 1.05 + verticalAnticipation);

  return Object.freeze({
    position: Object.freeze([
      state.player.x + lead + (mobile ? 1.2 : 1.7),
      targetY + (mobile ? 5.2 : 3.55) + pointerLift,
      mobile ? 16 : 11.2,
    ] as const),
    target: Object.freeze([state.player.x + lead, targetY, -0.25] as const),
  });
}

export function createTraversalCameraRig(): TraversalCameraRig {
  const position = [0, 0, 0];
  const target = [0, 0, 0];
  let initialized = false;
  let resetSerial = -1;

  return Object.freeze({
    update(aspect, state, pointer, deltaSeconds) {
      const desired = traversalCameraFrame(aspect, state, pointer);
      const reset = !initialized || state.resetSerial !== resetSerial;
      const easing = reset ? 1 : 1 - Math.exp(-Math.max(0, deltaSeconds) * 5.4);
      for (let index = 0; index < 3; index += 1) {
        const previousPosition = position[index]!;
        const previousTarget = target[index]!;
        position[index] = previousPosition + (desired.position[index]! - previousPosition) * easing;
        target[index] = previousTarget + (desired.target[index]! - previousTarget) * easing;
      }
      initialized = true;
      resetSerial = state.resetSerial;
      return Object.freeze({
        position: Object.freeze([...position] as [number, number, number]),
        target: Object.freeze([...target] as [number, number, number]),
      });
    },
  });
}
