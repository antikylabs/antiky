import { mat4, type Mat4Array } from 'brometal';

/**
 * The course's one directional key light, and the shadow map it casts through.
 *
 * **This diverges from `point-light-expo`, the reference goal 07 names, and the divergence is
 * required rather than preferred.** The reference and `combat-arena` are single-room scenes: one map
 * over fixed bounds serves the whole demo, and `createSunShadow(minimum, maximum)` is called once at
 * construction.
 *
 * This course is 190 units long (`src/course.ts`). A single map over those bounds at 2048² gives
 * about **0.09 world units per texel** — nine centimetres, against the reference's one — so contact
 * shadows would be a texel wide and would crawl as the camera moves. Most of that map would also be
 * spent on geometry the camera cannot see, because a side-scroller only ever shows a slice.
 *
 * So the map **follows the camera**: its bounds come from the visible slice, not from the course, and
 * the matrix is rebuilt every frame. The same 2048² then covers about 30 units and lands back near
 * the reference's texel density. This is not cascades, which goal 07 lists as a non-goal — it is one
 * map, re-aimed.
 */

/**
 * The direction light arrives *from*, normalised.
 *
 * Not a new value: this is the key the demo's two material shaders already agree on, lifted out of
 * `traversal-model.shader.ts` so the shadow map and the shading read it from one place.
 * `pipeline-invariants.test.mjs` asserts a demo has one key direction.
 */
export const SUN_DIRECTION: readonly [number, number, number] = Object.freeze(
  normalise([-0.38, 0.84, 0.48]),
);

/** 2048 across a ~30-unit slice is about 1.5 cm per texel, close to the reference's density. */
export const SHADOW_MAP_SIZE = 2048;

/**
 * How much of the course the map covers, in world units.
 *
 * Wide enough that a caster just off the left edge still shadows into frame, narrow enough to keep
 * the texel density useful. The camera shows roughly 24 units at this framing.
 */
const SLICE_HALF_WIDTH = 14;

/**
 * Vertical reach. Platforms sit near y = 0 and the runner jumps a few units above them.
 *
 * These three extents are what set the depth quantum, and they are tighter than they first look for
 * that reason: at 16 x 9 x 8 the slice radius reaches 20.1 and one depth step is 0.031 world units,
 * just past the 0.03 the reference holds. Trimming to 14 x 8 x 8 brings it to 0.028 without costing
 * any of the visible slice — the camera shows about 24 units, so a caster still has two units of
 * margin beyond frame on each side.
 */
const SLICE_HALF_HEIGHT = 8;

/** Depth reach along z, which barely varies in a 2.5D course. */
const SLICE_HALF_DEPTH = 8;

function normalise(v: readonly [number, number, number]): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * A perspective projection whose clip depth runs 0 to 1.
 *
 * BroMetal's `mat4.perspective` is OpenGL convention — near maps to `z = -w` — and WebGPU clips at
 * `0 <= z <= w`, so the near half of any frustum built with it is discarded before it is drawn. The
 * reference found this in goal 06-04 and it is registered as row A11 of `execute-goal-99.md`; the
 * same fix is copied here rather than waiting for the upstream patch.
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
  position: readonly [number, number, number];
  range: number;
  viewProjection: Mat4Array;
  texel: number;
  centre: readonly [number, number, number];
  radius: number;
}>;

/**
 * Aim the map at a slice of the course centred on `cameraX`.
 *
 * Takes the centre rather than reading a camera, so a test can ask for a slice the demo never shows
 * and check the arithmetic rather than the numbers it happens to produce today.
 */
export function createCourseSunShadow(cameraX: number): SunShadow {
  const centre: [number, number, number] = [cameraX, 0.5, 0];
  const radius = Math.hypot(SLICE_HALF_WIDTH, SLICE_HALF_HEIGHT, SLICE_HALF_DEPTH);

  // 2.2 radii back, the same rule the reference derives: far enough that the rays are near parallel
  // across the slice, near enough that `range` stays small and the stored depth keeps its precision.
  const distance = radius * 2.2;
  const position: [number, number, number] = [
    centre[0] + SUN_DIRECTION[0] * distance,
    centre[1] + SUN_DIRECTION[1] * distance,
    centre[2] + SUN_DIRECTION[2] * distance,
  ];

  const near = distance - radius;
  const far = distance + radius;
  // asin, not atan: the half-angle to a sphere. atan bounds a plane at the centre and clips the
  // near side.
  const fieldOfView = 2 * Math.asin(Math.min(0.99, (radius * 1.05) / distance));

  return Object.freeze({
    position: Object.freeze(position),
    range: far,
    viewProjection: mat4.multiply(perspectiveZeroToOne(fieldOfView, 1, near, far), mat4.lookAt(position, centre)),
    texel: 1 / SHADOW_MAP_SIZE,
    centre: Object.freeze(centre),
    radius,
  });
}
