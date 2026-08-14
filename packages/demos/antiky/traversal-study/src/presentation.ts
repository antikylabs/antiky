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

type MutableCameraFrame = {
  position: [number, number, number];
  target: [number, number, number];
};

function createCameraFrame(): MutableCameraFrame {
  return { position: [0, 0, 0], target: [0, 0, 0] };
}

function writeTraversalCameraFrame(
  output: MutableCameraFrame,
  aspect: number,
  state: Pick<TraversalSnapshot, 'player'>,
  pointer: Readonly<{ x: number; y: number }>,
): TraversalCameraFrame {
  const mobile = aspect < 0.9;
  const pointerY = Number.isFinite(pointer.y) ? Math.max(0, Math.min(1, pointer.y)) : 0.5;
  const pointerLift = (pointerY - 0.5) * (mobile ? 0.28 : 0.42);
  const speed = Math.abs(state.player.vx);
  const speedLookAhead = mobile
    ? Math.max(-1.7, Math.min(2.15, state.player.vx * 0.34))
    : Math.max(-3.4, Math.min(4.4, state.player.vx * 0.78));
  const verticalAnticipation = Math.max(-0.7, Math.min(1.2, state.player.vy * 0.14));
  const speedPullback = mobile
    ? Math.min(3.1, speed * 0.38)
    : Math.min(1.3, speed * 0.16);
  const lead = (mobile ? 0.45 : 1.75) + speedLookAhead;
  const targetY = Math.max(1.15, state.player.y * 0.55 + 0.95 + verticalAnticipation);

  output.position[0] = state.player.x + lead + (mobile ? 0.8 : 1.7);
  // Goal 08's composition move: the camera rides higher and looks down at the same target, which
  // pulls the horizon up the frame. At the old 3.45 the horizon sat below centre and sixty percent
  // of every frame was one flat sky; from up here the course band owns the lower two-thirds.
  output.position[1] = targetY + (mobile ? 7.6 : 6.4) + pointerLift + speedPullback * 0.15;
  output.position[2] = (mobile ? 16.6 : 11) + speedPullback;
  output.target[0] = state.player.x + lead;
  output.target[1] = targetY;
  output.target[2] = -0.25;
  return output;
}

export function traversalCameraFrame(
  aspect: number,
  state: Pick<TraversalSnapshot, 'player'>,
  pointer: Readonly<{ x: number; y: number }>,
): TraversalCameraFrame {
  return writeTraversalCameraFrame(createCameraFrame(), aspect, state, pointer);
}

export function createTraversalCameraRig(): TraversalCameraRig {
  const desired = createCameraFrame();
  const frame = createCameraFrame();
  let initialized = false;
  let resetSerial = -1;

  return Object.freeze({
    update(aspect, state, pointer, deltaSeconds) {
      writeTraversalCameraFrame(desired, aspect, state, pointer);
      const reset = !initialized || state.resetSerial !== resetSerial;
      const easing = reset ? 1 : 1 - Math.exp(-Math.max(0, deltaSeconds) * 8.4);
      for (let index = 0; index < 3; index += 1) {
        const previousPosition = frame.position[index]!;
        const previousTarget = frame.target[index]!;
        frame.position[index] = previousPosition + (desired.position[index]! - previousPosition) * easing;
        frame.target[index] = previousTarget + (desired.target[index]! - previousTarget) * easing;
      }
      initialized = true;
      resetSerial = state.resetSerial;
      return frame;
    },
  });
}
