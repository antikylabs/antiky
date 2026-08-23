/**
 * Turning "the player pressed W" into "the character walks away from the camera".
 *
 * The town is viewed down a diagonal — the interactive camera sits at the hero plus `[20, 14, 20]`,
 * so its line of sight runs at roughly 45° to the world axes. Feeding raw `movement.x` / `movement.z`
 * straight to the motor therefore walks the hero along the *map's* axes, not the screen's: W moved
 * along −Z, which from that camera reads as up **and to the right**, and every key was off by the
 * camera's yaw.
 *
 * The yaw is derived from the camera offset rather than written down as 45°, because the two poses
 * disagree: desktop is `[20, 14, 20]` (exactly 45°) and mobile is `[12, 9.5, 13]` (about 42.7°).
 * A hard-coded angle would be right on one device and subtly wrong on the other.
 */

export type PlanarMovement = Readonly<{ x: number; z: number }>;

/**
 * Rotate stick/WASD input from screen space into world space.
 *
 * `input.z` is negative for "up the screen", matching the host's mapping of W and ArrowUp.
 * `cameraOffsetX` / `cameraOffsetZ` are the camera's position *relative to the character* — the
 * camera looks back down that offset toward them.
 */
export function cameraRelativeMovement(
  input: PlanarMovement,
  cameraOffsetX: number,
  cameraOffsetZ: number,
): PlanarMovement {
  const distance = Math.hypot(cameraOffsetX, cameraOffsetZ);
  // A camera directly overhead has no yaw to apply, and normalising a zero-length offset would
  // produce NaN and freeze the character rather than merely aim them wrongly.
  if (distance < 1e-6) return { x: input.x, z: input.z };

  // The camera looks back down its own offset, so "into the screen" is the offset reversed.
  const forwardX = -cameraOffsetX / distance;
  const forwardZ = -cameraOffsetZ / distance;
  // Screen-right is forward turned a quarter-turn about the world up axis: cross(forward, up).
  const rightX = -forwardZ;
  const rightZ = forwardX;

  // `-input.z` because the host reports W as negative, and W means forward.
  const forwardAmount = -input.z;
  return {
    x: rightX * input.x + forwardX * forwardAmount,
    z: rightZ * input.x + forwardZ * forwardAmount,
  };
}
