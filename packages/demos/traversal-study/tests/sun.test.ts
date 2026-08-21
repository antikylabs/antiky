import assert from 'node:assert/strict';
import test from 'node:test';

import { SHADOW_MAP_SIZE, createCourseSunShadow } from '../src/sun.ts';

/**
 * The course shadow map's geometry, checked as arithmetic rather than by looking at a frame.
 *
 * The property that matters here and does not arise in the other two demos: the map **follows the
 * camera**. A 190-unit course under one fixed map would give nine centimetres per texel, so the
 * slice has to move and its texel density has to stay put while it does.
 */

type Vector = readonly [number, number, number];

function project(matrix: Float32Array, point: Vector): [number, number, number, number] {
  const [x, y, z] = point;
  return [
    matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!,
    matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!,
    matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!,
    matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!,
  ];
}

test('the visible slice lands inside the light frustum wherever the camera is', () => {
  let checked = 0;
  for (const cameraX of [0, 25, 90, 150, 190]) {
    const shadow = createCourseSunShadow(cameraX);
    for (const dx of [-12, 0, 12]) {
      for (const dy of [-6, 0, 6]) {
        for (const dz of [-5, 0, 5]) {
          const [x, y, z, w] = project(shadow.viewProjection, [cameraX + dx, 0.5 + dy, dz]);
          assert.ok(w > 0, `slice point at camera ${cameraX} is behind the light`);
          assert.ok(Math.abs(x / w) <= 1 && Math.abs(y / w) <= 1, `off the map at camera ${cameraX}`);
          assert.ok(z / w >= 0 && z / w <= 1, `outside near/far at camera ${cameraX}: ${z / w}`);
          checked += 1;
        }
      }
    }
  }
  assert.equal(checked, 5 * 27);
});

test('the map follows the camera instead of covering the whole course', () => {
  // The reason this demo cannot copy the reference. A fixed map over 190 units would be nine
  // centimetres per texel; a slice keeps it near one.
  const near = createCourseSunShadow(20);
  const far = createCourseSunShadow(140);
  assert.ok(
    Math.abs(far.position[0] - near.position[0] - 120) < 1e-4,
    'the light did not travel with the camera',
  );
  // And nothing else moved: the same slice, re-aimed.
  assert.ok(Math.abs(far.range - near.range) < 1e-6, 'the range changed as the camera moved');
  assert.ok(Math.abs(far.radius - near.radius) < 1e-6, 'the slice changed size as the camera moved');
});

test('the texel density stays close to the reference rather than to the course', () => {
  const shadow = createCourseSunShadow(90);
  const worldPerTexel = (2 * shadow.radius) / SHADOW_MAP_SIZE;
  assert.ok(worldPerTexel < 0.025, `each texel covers ${worldPerTexel.toFixed(4)} world units`);
  // The number a whole-course map would have given, stated so the comparison is not lost: 190 units
  // of span across 2048 texels is 0.093, nearly four times coarser than the bound above.
  assert.ok(190 / SHADOW_MAP_SIZE > 0.09, 'the whole-course figure this design avoids');
});

test('the depth quantum stays small enough to keep a shadow attached to its caster', () => {
  const shadow = createCourseSunShadow(90);
  assert.ok(shadow.range / 2048 < 0.03, `one depth step is ${(shadow.range / 2048).toFixed(4)} units`);
  assert.ok(shadow.range <= 4 * shadow.radius, 'the range exceeds four times the slice radius');
});

test('the light projection uses WebGPU depth, not OpenGL depth', () => {
  // The BroMetal defect goal 06-04 found, carried here: `mat4.perspective` maps near to z = -w, and
  // WebGPU clips at 0, so the near half of the frustum would be discarded before it is drawn.
  const shadow = createCourseSunShadow(90);
  const axis = [
    (shadow.centre[0] - shadow.position[0]),
    (shadow.centre[1] - shadow.position[1]),
    (shadow.centre[2] - shadow.position[2]),
  ];
  const length = Math.hypot(axis[0]!, axis[1]!, axis[2]!);
  const depthAt = (distance: number) => {
    const point: Vector = [
      shadow.position[0] + (axis[0]! / length) * distance,
      shadow.position[1] + (axis[1]! / length) * distance,
      shadow.position[2] + (axis[2]! / length) * distance,
    ];
    const [, , z, w] = project(shadow.viewProjection, point);
    return z / w;
  };
  const near = shadow.range - 2 * shadow.radius;
  assert.ok(Math.abs(depthAt(near)) < 1e-3, `the near plane maps to ${depthAt(near)}, not 0`);
  assert.ok(Math.abs(depthAt(shadow.range) - 1) < 1e-3, `the far plane maps to ${depthAt(shadow.range)}`);
});
