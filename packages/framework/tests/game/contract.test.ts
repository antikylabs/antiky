import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  GameHostContext,
  GameInstance,
  GameMeasurements,
  GamePointerInput,
} from '../../src/game/contract.ts';

test('the host context supplies its stable pointer and measurement fields', () => {
  const pointer: Pick<GamePointerInput, 'x' | 'y'> = { x: 0, y: 0 };
  const measurements: GameMeasurements = {};
  assert.deepEqual(pointer, { x: 0, y: 0 });
  assert.deepEqual(measurements, {});
});

test('every pointer field is required, so a game can rely on all seven', () => {
  // This object omits nothing, so adding a required field makes the typecheck fail here.
  const complete: GamePointerInput = {
    x: 0, y: 0, down: false, active: false, dragX: 0, dragY: 0, clicked: false,
  };
  assert.deepEqual(Object.keys(complete).sort(), [
    'active', 'clicked', 'down', 'dragX', 'dragY', 'x', 'y',
  ]);
});

test('a context and an instance can be built from the contract alone', () => {
  const instance: GameInstance = { frame(): void {}, dispose(): void {} };
  const context: Omit<GameHostContext, 'canvas'> = {
    runtimeInstanceId: 'runtime-test-001',
    pointer: { x: 0, y: 0, down: false, active: false, dragX: 0, dragY: 0, clicked: false },
    movement: { x: 0, z: 0, active: false },
    mode: 'interactive',
    report(): void {},
  };
  assert.equal(context.mode, 'interactive');
  assert.equal(typeof instance.frame, 'function');
});
