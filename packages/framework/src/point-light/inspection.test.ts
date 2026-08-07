import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createInspectionSnapshot } from '../inspection/snapshot.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  PointLightInspectionValidationError,
  createPointLightInspection,
  inspectPointLightService,
} from './inspection.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createPointLightAuthoringService } from './service.ts';

const WORLD_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';
const VISIBLE_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';
const HEADLESS_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abe';
const COMMAND_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789ac0';

function createService() {
  return createPointLightAuthoringService({
    worldId: WORLD_ID,
    pointLights: [
      {
        entityId: VISIBLE_ID,
        label: 'Harbor Lamp',
        revision: 1,
        transform: { schemaVersion: 1, position: [-3.5, 4.25, 6.75] },
        pointLight: {
          schemaVersion: 1,
          color: [1, 0.52, 0.22],
          radius: 4,
          power: 1.05,
        },
      },
      {
        entityId: HEADLESS_ID,
        label: 'Gate Lamp',
        revision: 1,
        transform: { schemaVersion: 1 },
        pointLight: { schemaVersion: 1, power: 0.5 },
      },
    ],
    runtimeInstanceId: 'runtime-inspection-001',
    renderBindings: [{ entityId: VISIBLE_ID, renderSlot: 0 }],
  });
}

test('point-light inspection exposes one immutable authoring, runtime, render, and fact view', () => {
  const service = createService();
  const result = service.submitPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    type: 'antiky.authoring.set-point-light-power',
    commandId: COMMAND_ID,
    worldId: WORLD_ID,
    entityId: VISIBLE_ID,
    expectedRevision: 1,
    data: { power: 2 },
  }, {
    principalId: 'local-developer',
    permissions: ['world.light.edit'],
    receivedAt: '2026-08-05T03:00:00.000Z',
    runtimeInstanceId: 'runtime-inspection-001',
  });
  assert.equal(result.code, 'ACCEPTED');

  const inspection = inspectPointLightService(service);
  assert.equal(inspection.owner, 'framework');
  assert.equal(inspection.worldId, WORLD_ID);
  assert.equal(inspection.eventSequence, 1);
  assert.deepEqual(inspection.authoring.map((light) => light.entityId), [
    VISIBLE_ID,
    HEADLESS_ID,
  ]);
  assert.equal(inspection.authoring[0]?.pointLight.power, 2);
  assert.equal(inspection.runtime.instanceId, 'runtime-inspection-001');
  assert.equal(inspection.runtime.pointLights[0]?.revision, 2);
  assert.deepEqual(inspection.render.pointLights[0], {
    entityId: VISIBLE_ID,
    renderSlot: 0,
    revision: 2,
    power: 2,
  });
  assert.deepEqual(inspection.render.dirtySlots, [0]);
  assert.deepEqual(inspection.facts, [result.fact]);
  assert.ok(Object.isFrozen(inspection));
  assert.ok(Object.isFrozen(inspection.authoring));
  assert.ok(Object.isFrozen(inspection.runtime.pointLights));
  assert.ok(Object.isFrozen(inspection.render.pointLights));
  assert.ok(Object.isFrozen(inspection.facts));

  const shared = createInspectionSnapshot({
    schemaVersion: 1,
    runtime: { instanceId: 'runtime-inspection-001', lifecycle: 'running' },
    diagnostics: [],
    measurements: {
      runtime: { owner: 'framework', frameCount: 4 },
      render: { owner: 'framework', drawCalls: 16 },
    },
    pointLights: inspection,
  });
  assert.deepEqual(shared.pointLights, inspection);
  assert.ok(Object.isFrozen(shared.pointLights));
});

test('point-light inspection validates transport input and cross-projection identity', () => {
  const service = createService();
  const source = structuredClone(inspectPointLightService(service)) as unknown as {
    authoring: Array<{ label: string }>;
    runtime: { pointLights: Array<{ power: number }> };
  };
  const recreated = createPointLightInspection(source);

  source.authoring[0]!.label = 'Caller mutation';
  source.runtime.pointLights[0]!.power = 4;
  assert.equal(recreated.authoring[0]?.label, 'Harbor Lamp');
  assert.equal(recreated.runtime.pointLights[0]?.power, 1.05);

  const mismatch = structuredClone(recreated) as unknown as {
    render: { pointLights: Array<{ revision: number }> };
  };
  mismatch.render.pointLights[0]!.revision = 99;
  assert.throws(
    () => createPointLightInspection(mismatch),
    (error: unknown) => (
      error instanceof PointLightInspectionValidationError
      && error.path === '$.render.pointLights[0].revision'
    ),
  );

  assert.throws(
    () => createInspectionSnapshot({
      schemaVersion: 1,
      runtime: { instanceId: 'another-runtime', lifecycle: 'running' },
      diagnostics: [],
      measurements: {
        runtime: { owner: 'framework', frameCount: 0 },
        render: { owner: 'framework' },
      },
      pointLights: recreated,
    }),
    (error: unknown) => (
      error instanceof PointLightInspectionValidationError
      && error.path === '$.pointLights.runtime.instanceId'
    ),
  );
});
