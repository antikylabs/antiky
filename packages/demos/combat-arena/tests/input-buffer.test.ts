import assert from 'node:assert/strict';
import test from 'node:test';

import { createEngineSession, createSessionId } from '@antiky/framework';

import { createCombatActionBuffer } from '../src/input-buffer.ts';
import { COMBAT_WORLD_ID } from '../src/inspection.ts';
import {
  createCombatSimulation,
  type CombatInput,
  type CombatSimulation,
} from '../src/simulation.ts';

const idle: CombatInput = Object.freeze({
  movement: Object.freeze({ x: 0, z: 0, active: false }),
  aim: Object.freeze({ x: 0, z: -1 }),
  attack: false,
});

function toward(x: number, z: number): Readonly<{ x: number; z: number }> {
  const length = Math.max(0.001, Math.hypot(x, z));
  return Object.freeze({ x: x / length, z: z / length });
}

function clearCircuit(simulation: CombatSimulation): void {
  for (let frame = 0; frame < 60 * 40; frame += 1) {
    const state = simulation.view();
    if (state.phase === 'clear' && state.round === 3) return;
    const target = state.enemies.find((enemy) => enemy.active && enemy.mark > 0)
      ?? state.enemies.find((enemy) => enemy.active);
    if (target === undefined) {
      simulation.update(1 / 60, idle);
      continue;
    }
    const aim = toward(target.x - state.player.x, target.z - state.player.z);
    simulation.update(1 / 60, Object.freeze({
      movement: Object.freeze({ ...aim, active: true }),
      aim,
      attack: target.mark > 0 && state.player.dashCooldown <= 0 && state.player.drive >= 32,
    }));
  }
  assert.fail('deterministic trace did not reach the finale clear phase');
}

function prepareImminentHeldDefeat(): CombatSimulation {
  const simulation = createCombatSimulation(() => {});
  const probe = createCombatSimulation(() => {});
  const heldAttack = Object.freeze({ ...idle, attack: true });
  for (let frame = 0; frame < 60 * 40; frame += 1) {
    probe.update(1 / 60, heldAttack);
    if (probe.read().phase === 'defeat') {
      assert.equal(simulation.read().phase, 'combat');
      assert.equal(simulation.read().player.hull, 1);
      return simulation;
    }
    simulation.update(1 / 60, heldAttack);
    assert.equal(simulation.digest(), probe.digest());
  }
  assert.fail('deterministic held-input trace did not reach an imminent defeat');
}

test('a click on a zero-step render frame is retained until one fixed step consumes it', () => {
  const simulation = createCombatSimulation(() => {});
  for (let frame = 0; frame < 60; frame += 1) simulation.update(1 / 60, idle);
  assert.equal(simulation.read().phase, 'combat');

  const action = createCombatActionBuffer();
  const session = createEngineSession<CombatInput>({
    sessionId: createSessionId(),
    worldId: COMBAT_WORLD_ID,
    runtimeInstanceId: 'combat-substep-input-test',
    systems: [{
      id: 'combat-substep-input-simulation',
      run(step) {
        simulation.update(step.fixedDeltaSeconds, step.input);
      },
    }],
    captureInput(value) {
      return value;
    },
  });
  const halfFrame = (clicked: boolean) => {
    action.capture(clicked);
    const result = session.advance(1 / 120, Object.freeze({ ...idle, attack: action.read() }));
    action.consume(result.completedSteps);
    return result;
  };

  const clickFrame = halfFrame(true);
  assert.equal(clickFrame.completedSteps, 0);
  assert.equal(simulation.read().dashes, 0);
  assert.equal(action.read(), true);

  const consumingFrame = halfFrame(false);
  assert.equal(consumingFrame.completedSteps, 1);
  assert.equal(simulation.read().dashes, 1);
  assert.equal(action.read(), false);

  assert.equal(halfFrame(false).completedSteps, 0);
  assert.equal(halfFrame(false).completedSteps, 1);
  assert.equal(simulation.read().dashes, 1);
  session.dispose();
});

test('one buffered click cannot skip victory across a two-step catch-up frame', () => {
  const simulation = createCombatSimulation(() => {});
  clearCircuit(simulation);
  while (simulation.read().phaseTime > 0.05) simulation.update(0.05, idle);
  const trim = simulation.read().phaseTime - 1 / 120;
  simulation.update(trim, idle);
  assert.equal(simulation.read().phase, 'clear');

  const action = createCombatActionBuffer();
  const session = createEngineSession<CombatInput>({
    sessionId: createSessionId(),
    worldId: COMBAT_WORLD_ID,
    runtimeInstanceId: 'combat-catch-up-victory-test',
    systems: [{
      id: 'combat-catch-up-victory-simulation',
      run(step) {
        simulation.update(step.fixedDeltaSeconds, step.input);
      },
    }],
    captureInput(value) {
      return value;
    },
  });

  action.capture(true);
  const result = session.advance(2 / 60, Object.freeze({ ...idle, attack: action.read() }));
  action.consume(result.completedSteps);

  assert.equal(result.completedSteps, 2);
  assert.equal(simulation.read().phase, 'victory');
  assert.equal(simulation.read().round, 3);
  session.dispose();
});

test('one held buffered click cannot enter defeat and retry during two-step catch-up', () => {
  const simulation = prepareImminentHeldDefeat();
  const action = createCombatActionBuffer();
  const session = createEngineSession<CombatInput>({
    sessionId: createSessionId(),
    worldId: COMBAT_WORLD_ID,
    runtimeInstanceId: 'combat-catch-up-defeat-test',
    systems: [{
      id: 'combat-catch-up-defeat-simulation',
      run(step) {
        simulation.update(step.fixedDeltaSeconds, step.input);
      },
    }],
    captureInput(value) {
      return value;
    },
  });

  action.capture(true);
  const catchUp = session.advance(2 / 60, Object.freeze({ ...idle, attack: action.read() }));
  action.consume(catchUp.completedSteps);
  assert.equal(catchUp.completedSteps, 2);
  assert.equal(simulation.read().phase, 'defeat');
  assert.equal(simulation.read().player.hull, 0);

  action.capture(true);
  const held = session.advance(1 / 60, Object.freeze({ ...idle, attack: action.read() }));
  action.consume(held.completedSteps);
  assert.equal(simulation.read().phase, 'defeat');

  action.capture(false);
  action.capture(true);
  const fresh = session.advance(1 / 60, Object.freeze({ ...idle, attack: action.read() }));
  action.consume(fresh.completedSteps);
  assert.equal(simulation.read().phase, 'intro');
  assert.equal(simulation.read().player.hull, 3);
  session.dispose();
});

test('the action buffer rearms only after release', () => {
  const action = createCombatActionBuffer();
  action.capture(true);
  assert.equal(action.read(), true);
  action.consume(1);

  action.capture(true);
  assert.equal(action.read(), false);
  action.capture(false);
  action.capture(true);
  assert.equal(action.read(), true);
});
