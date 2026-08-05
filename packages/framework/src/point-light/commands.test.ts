import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  MAX_POINT_LIGHT_COMMAND_BYTES,
  PointLightCommandValidationError,
  SET_POINT_LIGHT_POWER_COMMAND_TYPE,
  encodedJsonByteLength,
  parseSetPointLightPowerCommand,
} from './commands.ts';

const command = {
  protocolVersion: 1,
  commandVersion: 1,
  type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
  commandId: '018f0f3a-7b2c-7a1d-8e2f-123456789ac0',
  worldId: '018f0f3a-7b2c-7a1d-8e2f-123456789abc',
  entityId: '018f0f3a-7b2c-7a1d-8e2f-123456789abd',
  expectedRevision: 1,
  data: { power: 2 },
};

test('set-point-light-power parsing validates, clones, and freezes the command', () => {
  const parsed = parseSetPointLightPowerCommand(command);

  command.data.power = 3;
  assert.equal(parsed.data.power, 2);
  assert.equal(parsed.type, 'antiky.authoring.set-point-light-power');
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.data));
  assert.ok((encodedJsonByteLength(parsed) ?? Number.POSITIVE_INFINITY) < MAX_POINT_LIGHT_COMMAND_BYTES);
});

test('command parsing keeps value-range decisions separate from structural validation', () => {
  assert.equal(parseSetPointLightPowerCommand({
    ...command,
    data: { power: Number.NaN },
  }).data.power, Number.NaN);
  assert.equal(parseSetPointLightPowerCommand({
    ...command,
    data: { power: 5 },
  }).data.power, 5);
});

test('command parsing rejects unknown fields, invalid IDs, and malformed revisions', () => {
  const invalid = [
    { ...command, commandVersion: 2 },
    { ...command, commandId: 'not-an-id' },
    { ...command, expectedRevision: -1 },
    { ...command, extra: true },
    { ...command, data: { power: 2, extra: true } },
  ];

  for (const value of invalid) {
    assert.throws(
      () => parseSetPointLightPowerCommand(value),
      (error: unknown) => error instanceof PointLightCommandValidationError,
    );
  }
});

test('encoded command size measures UTF-8 bytes and rejects cyclic values', () => {
  assert.equal(encodedJsonByteLength('plain'), 7);
  assert.equal(encodedJsonByteLength('🔥'), 6);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.equal(encodedJsonByteLength(cyclic), null);
});
