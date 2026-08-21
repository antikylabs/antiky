import assert from 'node:assert/strict';
import test from 'node:test';

import { cameraRelativeMovement, type PlanarMovement } from '../../src/town/camera-relative-movement.ts';

/** The interactive camera's offset from the hero, desktop and mobile. */
const DESKTOP: readonly [number, number] = [20, 20];
const MOBILE: readonly [number, number] = [12, 13];

/** W / A / S / D as the host reports them: `z` is negative up the screen. */
const FORWARD: PlanarMovement = { x: 0, z: -1 };
const BACK: PlanarMovement = { x: 0, z: 1 };
const LEFT: PlanarMovement = { x: -1, z: 0 };
const RIGHT: PlanarMovement = { x: 1, z: 0 };

function close(actual: number, expected: number, what: string): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-6,
    `${what}: expected ${expected.toFixed(6)}, got ${actual.toFixed(6)}`,
  );
}

/** How far a world direction points along the camera's view axis, and across it. */
function screenSpace(world: PlanarMovement, offsetX: number, offsetZ: number) {
  const length = Math.hypot(offsetX, offsetZ);
  const forwardX = -offsetX / length;
  const forwardZ = -offsetZ / length;
  return {
    up: world.x * forwardX + world.z * forwardZ,
    right: world.x * -forwardZ + world.z * forwardX,
  };
}

test('W walks the hero straight away from the camera, not diagonally', () => {
  // The reported bug. Raw `z = -1` moves along world −Z, which from a camera sitting at +X/+Z
  // decomposes into equal parts up-screen and right-screen — so W drifted right as it advanced.
  for (const [label, [offsetX, offsetZ]] of [['desktop', DESKTOP], ['mobile', MOBILE]] as const) {
    const world = cameraRelativeMovement(FORWARD, offsetX, offsetZ);
    const screen = screenSpace(world, offsetX, offsetZ);
    close(screen.up, 1, `${label}: W should be entirely up-screen`);
    close(screen.right, 0, `${label}: W should have no sideways drift`);
  }
});

test('S, A and D are the other three screen directions, exactly', () => {
  for (const [label, [offsetX, offsetZ]] of [['desktop', DESKTOP], ['mobile', MOBILE]] as const) {
    const back = screenSpace(cameraRelativeMovement(BACK, offsetX, offsetZ), offsetX, offsetZ);
    close(back.up, -1, `${label}: S is straight down-screen`);
    close(back.right, 0, `${label}: S does not drift`);

    const right = screenSpace(cameraRelativeMovement(RIGHT, offsetX, offsetZ), offsetX, offsetZ);
    close(right.right, 1, `${label}: D is straight right-screen`);
    close(right.up, 0, `${label}: D does not creep forward`);

    const left = screenSpace(cameraRelativeMovement(LEFT, offsetX, offsetZ), offsetX, offsetZ);
    close(left.right, -1, `${label}: A is straight left-screen`);
    close(left.up, 0, `${label}: A does not creep forward`);
  }
});

test('rotation preserves speed, so diagonals are not faster', () => {
  const diagonal: PlanarMovement = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
  for (const input of [FORWARD, BACK, LEFT, RIGHT, diagonal]) {
    const world = cameraRelativeMovement(input, DESKTOP[0], DESKTOP[1]);
    close(Math.hypot(world.x, world.z), Math.hypot(input.x, input.z), 'speed is unchanged');
  }
});

test('a still stick stays still', () => {
  const world = cameraRelativeMovement({ x: 0, z: 0 }, DESKTOP[0], DESKTOP[1]);
  close(world.x, 0, 'x');
  close(world.z, 0, 'z');
});

test('the two camera poses genuinely disagree, so the yaw cannot be hard-coded', () => {
  // Desktop is exactly 45°; mobile is about 42.7°. A single written-down angle would be wrong on
  // one of them, which is why the rotation is derived from the offset it is given.
  const desktop = cameraRelativeMovement(FORWARD, DESKTOP[0], DESKTOP[1]);
  const mobile = cameraRelativeMovement(FORWARD, MOBILE[0], MOBILE[1]);
  assert.ok(
    Math.abs(desktop.x - mobile.x) > 1e-3,
    'the desktop and mobile poses should rotate W differently',
  );
});

test('a camera directly overhead leaves the input alone', () => {
  // No horizontal offset means no yaw to apply, and normalising a zero-length vector would produce
  // NaN and freeze the hero.
  const world = cameraRelativeMovement(FORWARD, 0, 0);
  close(world.x, 0, 'x');
  close(world.z, -1, 'z');
});
