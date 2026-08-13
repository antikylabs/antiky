import { mat4, type Mat4Array } from 'brometal';

import { ARENA_RADIUS } from './combat-state.ts';

/**
 * The arena's one directional key light, and the shadow map it casts through.
 *
 * Copied by hand from `point-light-expo/src/sun.ts`, which goal 07 names as the reference
 * implementation. The derivation is identical; only the direction and the bounds are this demo's.
 *
 * Everything is derived from `ARENA_RADIUS` rather than typed as constants, so resizing the arena
 * moves the shadow map with it.
 */

/**
 * The direction light arrives *from*, normalised — the `L` in `dot(N, L)`.
 *
 * **Not a new value.** This is the key light the demo's four shaders already agree on, lifted out of
 * `ship-model.shader.ts` where it was declared, so the shadow map and the shading read it from one
 * place instead of two. `pipeline-invariants.test.mjs` asserts a demo has only one key direction and
 * that is the assertion this must not break.
 *
 * **Lowered from 59 degrees to 35 and moved behind the arena** by W B.3, on measurement. At the
 * original angle only 1.63% of the deck came back darkened by 25% or more — a high sun drops each
 * caster's shadow underneath the caster, exactly as it did in the reference. The camera sits at
 * `+z`, so a sun on that side also threw what shadow there was away from the viewer.
 */
export const SUN_DIRECTION: readonly [number, number, number] = Object.freeze(
  normalise([-0.52, 0.58, -0.63]),
);

/** Warm and low-intensity: this is a key light, not a second sun over the relays. */
export const SUN_COLOR: readonly [number, number, number] = Object.freeze([1, 0.94, 0.82] as const);

export const SUN_STRENGTH = 0.75;

/**
 * Square, because the virtual light looks down the middle of a bounding sphere and a rectangular
 * map would waste the difference. 2048 across an arena this size is about 1 cm of world space per
 * texel, finer than the contact detail the probes measure.
 */
export const SHADOW_MAP_SIZE = 2048;

/**
 * How far behind the scene the virtual light sits, as a multiple of the scene's bounding radius.
 *
 * `shadowFactor` is radial — its depth is `distance(worldPos, lightPos) / range` — so a sun, which
 * has no position, needs a stand-in placed far enough away that its rays are nearly parallel across
 * the scene. Far enough, and no further: `range` grows with this number, and the depth is stored as
 * a fraction of `range` in a 16-bit float. Push it to 400 "to be safe" and the quantum reaches 0.2
 * world units, which detaches every contact shadow from the thing casting it.
 *
 * At 2.2 the quantum is about 0.016 world units and the far/near ratio is 2.7, which is comfortably
 * inside what `pipeline-invariants.test.mjs` allows a camera to waste on depth precision.
 */
const LIGHT_DISTANCE_IN_RADII = 2.2;

/** A little slack so the bounding sphere does not touch the frustum wall. */
const FRUSTUM_MARGIN = 1.05;

function normalise(v: readonly [number, number, number]): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * A perspective projection whose clip depth runs 0 to 1, written here rather than taken from
 * `mat4.perspective`.
 *
 * **BroMetal's `mat4.perspective` is OpenGL convention.** Its `m[10] = (far + near) / (near - far)`
 * and `m[14] = 2 · far · near / (near - far)` put the near plane at `z = -w` and the far plane at
 * `z = +w`. WebGPU clips at `0 ≤ z ≤ w`, so everything in the near half of the frustum is thrown
 * away before it is drawn.
 *
 * Nobody has noticed because the demo cameras run near 0.1 and far 1000: depth crosses zero at
 * 0.2 world units, so the lost slice is a fingernail in front of the lens. A shadow frustum is
 * tight by design — 12.0 to 32.1 here — and the same mismatch swallows **27% of it**, starting with
 * whatever is closest to the light. That is every tall prop's own shadow.
 *
 * Only the two depth terms change. `m[0]`, `m[5]` and `m[11]` are convention-independent.
 *
 * This is a BroMetal defect and belongs upstream, but goal 06-04 is scoped to this demo, so it is
 * fixed here and registered in `execute-goal-99.md` with the measurement above. It also means every
 * BroMetal camera is currently spending half its depth range on clipped geometry.
 */
function perspectiveZeroToOne(
  fieldOfViewY: number,
  aspect: number,
  near: number,
  far: number,
): Mat4Array {
  const focal = 1 / Math.tan(fieldOfViewY / 2);
  const matrix = mat4.identity();
  matrix.fill(0);
  matrix[0] = focal / aspect;
  matrix[5] = focal;
  matrix[10] = far / (near - far);
  matrix[11] = -1;
  matrix[14] = (far * near) / (near - far);
  return matrix;
}

export type SunShadow = Readonly<{
  /** Where the stand-in light sits. `shadowFactor` measures distance from here. */
  position: readonly [number, number, number];
  /** The divisor that maps distance into the 0..1 a colour target can hold. */
  range: number;
  /** World to light clip, for both the depth pass and the lookup. */
  viewProjection: Mat4Array;
  /** One texel of the shadow map, for sizing the soft lookup's taps. */
  texel: number;
  /** Scene centre and radius, exposed because the tests assert the frustum contains the scene. */
  centre: readonly [number, number, number];
  radius: number;
}>;

/**
 * Place the virtual light and build its matrix from a set of world bounds.
 *
 * Takes the bounds rather than reading them, so a test can hand it a scene that is not this one and
 * check the arithmetic rather than the numbers it happens to produce today.
 */
export function createSunShadow(
  minimum: readonly [number, number, number],
  maximum: readonly [number, number, number],
  direction: readonly [number, number, number] = SUN_DIRECTION,
): SunShadow {
  const centre: [number, number, number] = [
    (minimum[0] + maximum[0]) / 2,
    (minimum[1] + maximum[1]) / 2,
    (minimum[2] + maximum[2]) / 2,
  ];
  // The bounding sphere, not the box. The light looks along an arbitrary axis, so a sphere is the
  // only bound that does not change size as the sun moves.
  const radius = Math.hypot(
    (maximum[0] - minimum[0]) / 2,
    (maximum[1] - minimum[1]) / 2,
    (maximum[2] - minimum[2]) / 2,
  );

  const distance = radius * LIGHT_DISTANCE_IN_RADII;
  const unit = normalise([direction[0], direction[1], direction[2]]);
  const position: [number, number, number] = [
    centre[0] + unit[0] * distance,
    centre[1] + unit[1] * distance,
    centre[2] + unit[2] * distance,
  ];

  // Perspective rather than orthographic, and that is the consistent choice rather than a
  // compromise: `shadowFactor` compares radial distance from a point, so the projection that
  // matches it is the one that also radiates from that point. BroMetal has no ortho helper either.
  const near = distance - radius;
  const far = distance + radius;
  // Half-angle to a sphere is asin(r / d), not atan — atan bounds a plane at the centre and clips
  // the near side of the sphere.
  const fieldOfView = 2 * Math.asin(Math.min(0.99, (radius * FRUSTUM_MARGIN) / distance));

  const view = mat4.lookAt(position, centre);
  const projection = perspectiveZeroToOne(fieldOfView, 1, near, far);

  return Object.freeze({
    position: Object.freeze(position),
    // `range` is the far plane: the largest distance the depth pass can be asked to write, so
    // dividing by it is what keeps every value inside the 0..1 the lookup expects.
    range: far,
    viewProjection: mat4.multiply(projection, view),
    texel: 1 / SHADOW_MAP_SIZE,
    centre: Object.freeze(centre),
    radius,
  });
}

/** The shadow for this demo's own bounds. */
/**
 * The shadow for the arena's own bounds.
 *
 * The arena is a square box of `ARENA_RADIUS` with walls, so the bounds are that radius in x and z.
 * The vertical span is generous on purpose: the ships fly, and a caster above the top of the box
 * would otherwise fall outside the frustum and stop casting entirely.
 */
export function createArenaSunShadow(): SunShadow {
  const wall = ARENA_RADIUS + 1.2;
  return createSunShadow([-wall, -0.6, -wall], [wall, 5.2, wall]);
}
