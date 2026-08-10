import assert from 'node:assert/strict';
import test from 'node:test';

import { combatCameraFrame } from '../src/presentation.ts';
import { combatSignalMode } from '../src/arena-signals.ts';
import { deriveCombatRendererMeasurements } from '../src/renderer.ts';
import { createCombatSimulation } from '../src/simulation.ts';

test('combat camera keeps the action framed for wide and portrait canvases', () => {
  const state = createCombatSimulation(() => {}).read();
  const wide = combatCameraFrame(16 / 9, state, { x: 0.5, y: 0.5 });
  const portrait = combatCameraFrame(9 / 16, state, { x: 0.5, y: 0.5 });

  assert.deepEqual(wide.position, [0, 13.4, 14.89]);
  assert.deepEqual(wide.target, [0, 0.3, 1.25]);
  assert.ok(portrait.position[1] > wide.position[1]);
  assert.ok(portrait.position[2] > wide.position[2]);
  assert.ok(portrait.target[2] > wide.target[2]);
});

test('combat camera pointer drift is clamped and deterministic', () => {
  const state = createCombatSimulation(() => {}).read();
  const first = combatCameraFrame(16 / 9, state, { x: 4, y: -3 });
  const second = combatCameraFrame(16 / 9, state, { x: 1, y: 0 });

  assert.deepEqual(first, second);
  assert.equal(first.position[0], 0.85);
  assert.equal(first.position[1], 13.075000000000001);
});

test('combat camera leads velocity and bounds player-action impact', () => {
  const state = createCombatSimulation(() => {}).read();
  const moving = {
    ...state,
    time: 0.031,
    impact: 50,
    player: { ...state.player, vx: 200, vz: -200, facingX: 1, facingZ: 0 },
  };
  const frame = combatCameraFrame(16 / 9, moving, { x: 0.5, y: 0.5 });

  assert.ok(frame.target[0] > 0.7);
  assert.ok(frame.target[2] < 1.25);
  assert.ok(Math.abs(frame.position[0]) < 0.6);
  assert.ok(frame.position[2] > 14.35);
});

test('renderer reporting is derived from its capacities and catalog asset set', () => {
  const measurements = deriveCombatRendererMeasurements();
  assert.equal(measurements.catalogAssets, 5);
  assert.equal(measurements.drawCalls, 10);
  assert.ok(measurements.instances > 300);
  assert.ok(measurements.uploadBytesPerFrame > 0);
  assert.equal(measurements.particlePacking, 'active-prefix');
});

test('canvas signals teach mark-to-dash during onboarding and communicate terminal retry', () => {
  const state = createCombatSimulation(() => {}).read();
  assert.equal(combatSignalMode(state), 'mark-then-dash');
  assert.equal(combatSignalMode({
    ...state,
    phase: 'combat',
    score: 1,
    dashes: 1,
  }), 'none');
  assert.equal(combatSignalMode({ ...state, phase: 'victory' }), 'victory-retry');
  assert.equal(combatSignalMode({ ...state, phase: 'defeat' }), 'defeat-retry');
});
