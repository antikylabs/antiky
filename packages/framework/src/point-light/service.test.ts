import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { parseEntityId, parseWorldId } from '../identity/ids.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  MAX_POINT_LIGHTS,
  PointLightServiceValidationError,
  createPointLightAuthoringService,
} from './service.ts';

const WORLD_ID = parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc');
const WEST_ID = parseEntityId('018f0f3a-7b2c-7a1d-8e2f-123456789abd');
const HEADLESS_ID = parseEntityId('018f0f3a-7b2c-7a1d-8e2f-123456789abe');

function pointLight(entityId: string, label: string, power: number) {
  return {
    entityId,
    label,
    revision: 1,
    transform: { schemaVersion: 1, position: [0, 1, 2] },
    pointLight: { schemaVersion: 1, color: [1, 0.5, 0.25], radius: 4, power },
  };
}

test('one private service stores and reads two independent point lights by stable ID', () => {
  const input = {
    worldId: WORLD_ID,
    pointLights: [
      pointLight(HEADLESS_ID, 'Headless Test Lamp', 0.5),
      pointLight(WEST_ID, 'Market Lamp West 01', 1.05),
    ],
  };
  const service = createPointLightAuthoringService(input);

  input.pointLights[1]!.label = 'Caller mutation';
  input.pointLights[1]!.pointLight.power = 4;

  assert.equal(service.worldId, WORLD_ID);
  assert.deepEqual(service.listPointLights().map((record) => record.entityId), [WEST_ID, HEADLESS_ID]);
  assert.equal(service.getPointLight(WEST_ID)?.label, 'Market Lamp West 01');
  assert.equal(service.getPointLight(WEST_ID)?.pointLight.power, 1.05);
  assert.equal(service.getPointLight(HEADLESS_ID)?.pointLight.power, 0.5);
  assert.equal(service.getPointLight(parseEntityId('018f0f3a-7b2c-7a1d-8e2f-123456789abf')), undefined);
  assert.ok(Object.isFrozen(service.listPointLights()));
  assert.ok(Object.isFrozen(service.getPointLight(WEST_ID)));
});

test('service construction rejects duplicate IDs and invalid entity data', () => {
  assert.throws(
    () => createPointLightAuthoringService({
      worldId: WORLD_ID,
      pointLights: [pointLight(WEST_ID, 'One', 1), pointLight(WEST_ID, 'Two', 2)],
    }),
    (error: unknown) => (
      error instanceof PointLightServiceValidationError
      && error.code === 'DUPLICATE_ENTITY_ID'
      && error.path === '$.pointLights[1].entityId'
    ),
  );
  assert.throws(
    () => createPointLightAuthoringService({
      worldId: WORLD_ID,
      pointLights: [pointLight(WEST_ID, '   ', 1)],
    }),
    (error: unknown) => (
      error instanceof PointLightServiceValidationError
      && error.path === '$.pointLights[0].label'
    ),
  );
});

test('service records are bounded and do not expose mutable maps or writer functions', () => {
  const service = createPointLightAuthoringService({
    worldId: WORLD_ID,
    pointLights: [pointLight(WEST_ID, 'One', 1)],
  });
  const publicKeys = Object.keys(service).sort();

  assert.deepEqual(publicKeys, ['getPointLight', 'listPointLights', 'worldId']);
  assert.throws(
    () => createPointLightAuthoringService({
      worldId: WORLD_ID,
      pointLights: Array.from({ length: MAX_POINT_LIGHTS + 1 }, (_, index) => (
        pointLight(`018f0f3a-7b2c-7a1d-8e2f-${index.toString(16).padStart(12, '0')}`, `Lamp ${index}`, 1)
      )),
    }),
    /at most 256 point lights/i,
  );
});
