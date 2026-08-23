import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  SET_POINT_LIGHT_POWER_COMMAND_TYPE,
  type PointLightCommandContextInput,
} from '../../src/point-light/commands.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  PointLightReplayError,
  createPointLightAuthoringService,
} from '../../src/point-light/service.ts';

const WORLD_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';
const WEST_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';
const HEADLESS_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abe';
const UNKNOWN_ENTITY_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abf';
const UNKNOWN_WORLD_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789bbb';

const trustedContext: PointLightCommandContextInput = {
  principalId: 'developer-001',
  permissions: ['world.light.edit'],
  receivedAt: '2026-08-05T02:00:00.000Z',
  runtimeInstanceId: 'runtime-001',
};

function commandId(index: number): string {
  return `018f0f3a-7b2c-7a1d-8e2f-${(0xac0 + index).toString(16).padStart(12, '0')}`;
}

function pointLight(entityId: string, label: string, power: number) {
  return {
    entityId,
    label,
    revision: 1,
    transform: { schemaVersion: 1, position: [0, 1, 2] },
    pointLight: { schemaVersion: 1, color: [1, 0.5, 0.25], radius: 4, power },
  };
}

function createService() {
  return createPointLightAuthoringService({
    worldId: WORLD_ID,
    pointLights: [
      pointLight(WEST_ID, 'Visible Lamp', 1.05),
      pointLight(HEADLESS_ID, 'Headless Lamp', 0.5),
    ],
    runtimeInstanceId: 'runtime-001',
    renderBindings: [{ entityId: WEST_ID, renderSlot: 0 }],
  });
}

function setPower(
  id: string,
  power: number,
  expectedRevision = 1,
  overrides: Record<string, unknown> = {},
) {
  return {
    protocolVersion: 1,
    commandVersion: 1,
    type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
    commandId: id,
    worldId: WORLD_ID,
    entityId: WEST_ID,
    expectedRevision,
    data: { power },
    ...overrides,
  };
}

function sixStateValues(service: ReturnType<typeof createService>) {
  const authoring = service.getPointLight(WEST_ID)!;
  const state = service.readPointLightState();
  const runtime = state.runtime.pointLights.find((light) => light.entityId === WEST_ID)!;
  const render = state.render.pointLights.find((light) => light.entityId === WEST_ID)!;
  return {
    value: authoring.pointLight.power,
    revision: authoring.revision,
    factCount: service.listPointLightPowerFacts().length,
    runtimeValue: runtime.power,
    renderValue: render.power,
    dirtyCount: state.render.dirtySlots.length,
  };
}

function observableState(service: ReturnType<typeof createService>) {
  return {
    pointLights: service.listPointLights(),
    facts: service.listPointLightPowerFacts(),
    commandResults: service.listPointLightCommandResults(),
    state: service.readPointLightState(),
    renderChanges: service.readPointLightRenderChanges(),
  };
}

test('an accepted command reaches authoring, runtime, render, and one dirty slot exactly once', () => {
  const service = createService();
  const result = service.submitPointLightPower(setPower(commandId(0), 2), trustedContext);
  const state = service.readPointLightState();

  assert.equal(result.code, 'ACCEPTED');
  assert.equal(result.resultingRevision, 2);
  assert.equal(result.eventSequence, 1);
  assert.equal(result.fact?.oldPower, 1.05);
  assert.equal(result.fact?.newPower, 2);
  assert.equal(service.getPointLight(WEST_ID)?.pointLight.power, 2);
  assert.equal(service.getPointLight(HEADLESS_ID)?.pointLight.power, 0.5);
  assert.equal(state.runtime.pointLights.find((light) => light.entityId === WEST_ID)?.power, 2);
  assert.equal(state.render.pointLights[0]?.power, 2);
  assert.deepEqual(state.render.dirtySlots, [0]);
  assert.equal(service.listPointLightPowerFacts().length, 1);

  const duplicateBefore = sixStateValues(service);
  const duplicate = service.submitPointLightPower(setPower(commandId(0), 2), trustedContext);
  assert.equal(duplicate.code, 'DUPLICATE_COMMAND');
  assert.deepEqual(sixStateValues(service), duplicateBefore);
});

test('same-value and every rejected request preserve all six observable state values', () => {
  const cases: Array<readonly [string, (id: string) => unknown, PointLightCommandContextInput]> = [
    ['NO_OP', (id) => setPower(id, 1.05), trustedContext],
    ['INVALID_COMMAND', (id) => ({ ...setPower(id, 2), type: 'wrong' }), trustedContext],
    ['WORLD_NOT_FOUND', (id) => setPower(id, 2, 1, { worldId: UNKNOWN_WORLD_ID }), trustedContext],
    ['ENTITY_NOT_FOUND', (id) => setPower(id, 2, 1, { entityId: UNKNOWN_ENTITY_ID }), trustedContext],
    ['MISSING_PERMISSION', (id) => setPower(id, 2), { ...trustedContext, permissions: [] }],
    ['STALE_REVISION', (id) => setPower(id, 2, 0), trustedContext],
    ['VALUE_OUT_OF_RANGE', (id) => setPower(id, -0.01), trustedContext],
    ['VALUE_OUT_OF_RANGE', (id) => setPower(id, 4.01), trustedContext],
    ['VALUE_OUT_OF_RANGE', (id) => setPower(id, Number.NaN), trustedContext],
    ['INVALID_COMMAND', (id) => ({ ...setPower(id, 2), padding: 'x'.repeat(5_000) }), trustedContext],
  ];

  cases.forEach(([code, createCommand, context], index) => {
    const service = createService();
    const before = sixStateValues(service);
    const result = service.submitPointLightPower(createCommand(commandId(index + 10)), context);
    assert.equal(result.code, code);
    assert.deepEqual(sixStateValues(service), before, code);
  });
});

test('correction records a new fact and restores the prior value', () => {
  const service = createService();
  const original = service.submitPointLightPower(setPower(commandId(30), 2), trustedContext);
  const correction = service.correctPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    commandId: commandId(31),
    correctedCommandId: commandId(30),
    expectedRevision: 2,
  }, trustedContext);

  assert.equal(original.code, 'ACCEPTED');
  assert.equal(correction.code, 'ACCEPTED');
  assert.equal(correction.resultingRevision, 3);
  assert.equal(correction.eventSequence, 2);
  assert.equal(correction.fact?.correctionOf, commandId(30));
  assert.equal(correction.fact?.oldPower, 2);
  assert.equal(correction.fact?.newPower, 1.05);
  assert.equal(service.getPointLight(WEST_ID)?.pointLight.power, 1.05);
});

test('an unknown correction has no entity and duplicate retries do not grow history', () => {
  const service = createService();
  const request = {
    protocolVersion: 1,
    commandVersion: 1,
    commandId: commandId(32),
    correctedCommandId: commandId(999),
    expectedRevision: 1,
  };

  const first = service.correctPointLightPower(request, trustedContext);
  const duplicate = service.correctPointLightPower(request, trustedContext);

  assert.equal(first.code, 'INVALID_COMMAND');
  assert.equal(first.entityId, null);
  assert.equal(duplicate.code, 'DUPLICATE_COMMAND');
  assert.equal(duplicate.entityId, null);
  assert.equal(duplicate.duplicateOfCode, 'INVALID_COMMAND');
  assert.deepEqual(service.listPointLightCommandResults(), [first]);
});

test('render changes remain pending until the adapter acknowledges the current sequence', () => {
  const service = createService();
  service.submitPointLightPower(setPower(commandId(40), 2), trustedContext);

  assert.deepEqual(service.readPointLightRenderChanges(), {
    eventSequence: 1,
    pointLights: [{
      entityId: WEST_ID,
      renderSlot: 0,
      revision: 2,
      power: 2,
    }],
  });
  assert.equal(service.acknowledgePointLightRenderChanges(0), false);
  assert.equal(service.readPointLightState().render.dirtySlots.length, 1);
  assert.equal(service.acknowledgePointLightRenderChanges(1), true);
  assert.deepEqual(service.readPointLightRenderChanges().pointLights, []);
});

test('a headless light uses the same command and runtime path without a render special case', () => {
  const service = createService();
  const result = service.submitPointLightPower(setPower(commandId(50), 1.5, 1, {
    entityId: HEADLESS_ID,
  }), trustedContext);
  const state = service.readPointLightState();

  assert.equal(result.code, 'ACCEPTED');
  assert.equal(service.getPointLight(HEADLESS_ID)?.pointLight.power, 1.5);
  assert.equal(state.runtime.pointLights.find((light) => light.entityId === HEADLESS_ID)?.power, 1.5);
  assert.equal(state.render.pointLights.some((light) => light.entityId === HEADLESS_ID), false);
  assert.deepEqual(state.render.dirtySlots, []);
});

test('history and results stop at 256 entries before another change is accepted', () => {
  const service = createService();
  for (let index = 0; index < 256; index += 1) {
    const power = index % 2 === 0 ? 2 : 1;
    const result = service.submitPointLightPower(
      setPower(commandId(100 + index), power, index + 1),
      trustedContext,
    );
    assert.equal(result.code, 'ACCEPTED', `command ${index}`);
  }
  const before = sixStateValues(service);
  const rejected = service.submitPointLightPower(
    setPower(commandId(400), 2, 257),
    trustedContext,
  );

  assert.equal(rejected.code, 'HISTORY_CAPACITY_REACHED');
  assert.equal(service.listPointLightPowerFacts().length, 256);
  assert.equal(service.listPointLightCommandResults().length, 256);
  assert.deepEqual(sixStateValues(service), before);
});

test('ordered replay and a complete rebuild match current state and reject sequence gaps', () => {
  const service = createService();
  service.submitPointLightPower(setPower(commandId(500), 2), trustedContext);
  service.correctPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    commandId: commandId(501),
    correctedCommandId: commandId(500),
    expectedRevision: 2,
  }, trustedContext);

  const current = service.readPointLightState();
  const rebuilt = service.rebuildPointLightState();
  assert.deepEqual(rebuilt.authoring, current.authoring);
  assert.deepEqual(rebuilt.runtime, current.runtime);
  assert.deepEqual(rebuilt.render.pointLights, current.render.pointLights);
  assert.equal(rebuilt.eventSequence, current.eventSequence);

  const [first, second] = service.listPointLightPowerFacts();
  const gap = Object.freeze({ ...second!, eventSequence: 3 });
  const before = sixStateValues(service);
  assert.throws(
    () => service.replayPointLightPowerFacts([first!, gap]),
    (error: unknown) => (
      error instanceof PointLightReplayError && error.code === 'EVENT_SEQUENCE_ERROR'
    ),
  );
  assert.deepEqual(sixStateValues(service), before);
});

test('runtime mismatch and every disposed command path preserve all observable state', () => {
  const service = createService();
  const before = sixStateValues(service);
  const mismatch = service.submitPointLightPower(setPower(commandId(600), 2), {
    ...trustedContext,
    runtimeInstanceId: 'runtime-old',
  });
  assert.equal(mismatch.code, 'INVALID_COMMAND');
  assert.deepEqual(sixStateValues(service), before);

  const acceptedCommand = setPower(commandId(601), 2);
  assert.equal(service.submitPointLightPower(acceptedCommand, trustedContext).code, 'ACCEPTED');
  const missingCorrection = {
    protocolVersion: 1,
    commandVersion: 1,
    commandId: commandId(602),
    correctedCommandId: commandId(998),
    expectedRevision: 2,
  };
  assert.equal(
    service.correctPointLightPower(missingCorrection, trustedContext).code,
    'INVALID_COMMAND',
  );
  service.dispose();
  const disposedState = observableState(service);
  const cases: readonly (() => ReturnType<typeof service.submitPointLightPower>)[] = [
    () => service.submitPointLightPower(setPower(commandId(603), 3, 2), trustedContext),
    () => service.submitPointLightPower(acceptedCommand, trustedContext),
    () => service.submitPointLightPower({ invalid: true }, trustedContext),
    () => service.correctPointLightPower({
      protocolVersion: 1,
      commandVersion: 1,
      commandId: commandId(604),
      correctedCommandId: commandId(601),
      expectedRevision: 2,
    }, trustedContext),
    () => service.correctPointLightPower({
      protocolVersion: 1,
      commandVersion: 1,
      commandId: commandId(605),
      correctedCommandId: commandId(997),
      expectedRevision: 2,
    }, trustedContext),
    () => service.correctPointLightPower(missingCorrection, trustedContext),
    () => service.correctPointLightPower({ invalid: true }, trustedContext),
  ];

  for (const submit of cases) {
    assert.equal(submit().code, 'INVALID_COMMAND');
    assert.deepEqual(observableState(service), disposedState);
  }
});
