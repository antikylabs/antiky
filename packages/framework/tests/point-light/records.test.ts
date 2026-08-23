import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  POINT_LIGHT_SCHEMA_VERSION,
  PointLightValidationError,
  TRANSFORM_SCHEMA_VERSION,
  createPointLight,
  createTransform,
} from '../../src/point-light/records.ts';

test('versioned component creators apply documented defaults and freeze arrays', () => {
  const transform = createTransform({ schemaVersion: TRANSFORM_SCHEMA_VERSION });
  const pointLight = createPointLight({ schemaVersion: POINT_LIGHT_SCHEMA_VERSION });

  assert.deepEqual(transform, { schemaVersion: 1, position: [0, 0, 0] });
  assert.deepEqual(pointLight, {
    schemaVersion: 1,
    color: [1, 1, 1],
    radius: 1,
    power: 1,
  });
  assert.ok(Object.isFrozen(transform));
  assert.ok(Object.isFrozen(transform.position));
  assert.ok(Object.isFrozen(pointLight));
  assert.ok(Object.isFrozen(pointLight.color));
});

test('point-light records preserve finite world-unit and linear-RGB values', () => {
  const position = [-3.565, 4.237, 6.82];
  const color = [1, 0.52, 0.22];
  const transform = createTransform({ schemaVersion: 1, position });
  const pointLight = createPointLight({
    schemaVersion: 1,
    color,
    radius: 4,
    power: 1.05,
  });

  position[0] = 999;
  color[0] = 999;
  assert.deepEqual(transform.position, [-3.565, 4.237, 6.82]);
  assert.deepEqual(pointLight.color, [1, 0.52, 0.22]);
  assert.equal(pointLight.radius, 4);
  assert.equal(pointLight.power, 1.05);
});

test('component validation rejects unknown versions, fields, non-finite values, and bounds', () => {
  const invalidInputs: Array<readonly [() => unknown, string]> = [
    [() => createTransform({ schemaVersion: 2 }), '$.schemaVersion'],
    [() => createTransform({ schemaVersion: 1, position: [0, Number.NaN, 0] }), '$.position[1]'],
    [() => createTransform({ schemaVersion: 1, position: [0, 0] }), '$.position'],
    [() => createPointLight({ schemaVersion: 1, power: -0.01 }), '$.power'],
    [() => createPointLight({ schemaVersion: 1, power: 4.01 }), '$.power'],
    [() => createPointLight({ schemaVersion: 1, radius: 0 }), '$.radius'],
    [() => createPointLight({ schemaVersion: 1, color: [1, -0.1, 1] }), '$.color[1]'],
    [() => createPointLight({ schemaVersion: 1, browserObject: {} }), '$.browserObject'],
  ];

  for (const [operation, path] of invalidInputs) {
    assert.throws(operation, (error: unknown) => (
      error instanceof PointLightValidationError && error.path === path
    ));
  }
});
