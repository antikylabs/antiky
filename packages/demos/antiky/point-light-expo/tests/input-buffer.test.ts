import assert from 'node:assert/strict';
import test from 'node:test';

import { createEngineSession, createSessionId } from '@antiky/framework';

import { createRelayInteractionBuffer } from '../src/input-buffer.ts';
import { EXPO_LIGHT_DEFINITIONS, EXPO_WORLD_ID } from '../src/lights.ts';
import {
  FORGE_POSITION,
  createBlackoutRelaySimulation,
  type RelayInput,
  type RelaySimulation,
} from '../src/simulation.ts';

const DEFAULT_POWERS = EXPO_LIGHT_DEFINITIONS.map((light) => light.pointLight.power) as [
  number,
  number,
  number,
];

function input(interact = false, x = 0, z = 0): RelayInput {
  return Object.freeze({
    movement: Object.freeze({ x, z, active: Math.hypot(x, z) > 0.01 }),
    interact,
    lightPowers: Object.freeze([...DEFAULT_POWERS]) as readonly [number, number, number],
  });
}

function update(simulation: RelaySimulation, value: RelayInput, count = 1): void {
  for (let index = 0; index < count; index += 1) simulation.update(1 / 60, value);
}

function moveTo(simulation: RelaySimulation, target: readonly [number, number]): void {
  for (let count = 0; count < 360; count += 1) {
    const player = simulation.read().player;
    const dx = target[0] - player.x;
    const dz = target[1] - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.12) return;
    update(simulation, input(false, dx / distance, dz / distance));
  }
  assert.fail(`player did not reach ${target.join(', ')}`);
}

function prepareFinalDeposit(): RelaySimulation {
  const simulation = createBlackoutRelaySimulation(() => {}, { initialShades: [] });
  for (let relayIndex = 0; relayIndex < EXPO_LIGHT_DEFINITIONS.length; relayIndex += 1) {
    const light = EXPO_LIGHT_DEFINITIONS[relayIndex]!;
    moveTo(simulation, [light.transform.position[0], light.transform.position[2]]);
    update(simulation, input(), 150);
    moveTo(simulation, FORGE_POSITION);
    if (relayIndex < 2) {
      update(simulation, input(true));
      update(simulation, input());
    }
  }
  assert.deepEqual(simulation.read().deposits, [true, true, false]);
  return simulation;
}

test('sub-step click frames retain final deposit and terminal restart interactions', () => {
  const simulation = prepareFinalDeposit();

  const interaction = createRelayInteractionBuffer();
  const session = createEngineSession<RelayInput>({
    sessionId: createSessionId(),
    worldId: EXPO_WORLD_ID,
    runtimeInstanceId: 'relay-substep-input-test',
    systems: [{
      id: 'relay-substep-input-simulation',
      run(step) {
        simulation.update(step.fixedDeltaSeconds, step.input);
      },
    }],
    captureInput(value) {
      return value;
    },
  });
  const halfFrame = (clicked: boolean) => {
    interaction.capture(clicked);
    const result = session.advance(1 / 120, input(interaction.read()));
    interaction.consume(result.completedSteps);
    return result;
  };

  const depositClick = halfFrame(true);
  assert.equal(depositClick.completedSteps, 0);
  assert.equal(simulation.read().status, 'playing');
  assert.equal(interaction.read(), true);
  assert.equal(halfFrame(false).completedSteps, 1);
  assert.equal(simulation.read().status, 'won');
  assert.deepEqual(simulation.read().deposits, [true, true, true]);

  assert.equal(halfFrame(false).completedSteps, 0);
  assert.equal(halfFrame(false).completedSteps, 1);
  const restartClick = halfFrame(true);
  assert.equal(restartClick.completedSteps, 0);
  assert.equal(simulation.read().status, 'won');
  assert.equal(interaction.read(), true);
  assert.equal(halfFrame(false).completedSteps, 1);
  assert.equal(simulation.read().status, 'playing');
  assert.equal(simulation.read().run, 2);
  session.dispose();
});

test('one buffered click cannot both enter and retry a terminal state during catch-up', () => {
  const winning = prepareFinalDeposit();
  const winningInteraction = createRelayInteractionBuffer();
  const winningSession = createEngineSession<RelayInput>({
    sessionId: createSessionId(),
    worldId: EXPO_WORLD_ID,
    runtimeInstanceId: 'relay-catch-up-victory-test',
    systems: [{
      id: 'relay-catch-up-victory-simulation',
      run(step) {
        winning.update(step.fixedDeltaSeconds, step.input);
      },
    }],
    captureInput(value) {
      return value;
    },
  });
  winningInteraction.capture(true);
  const winningResult = winningSession.advance(1 / 30, input(winningInteraction.read()));
  winningInteraction.consume(winningResult.completedSteps);
  assert.equal(winningResult.completedSteps, 2);
  assert.equal(winning.read().status, 'won');
  assert.equal(winning.read().run, 1);
  winningSession.dispose();

  const darkPowers = Object.freeze([0, 0, 0]) as readonly [number, number, number];
  const simulation = createBlackoutRelaySimulation(() => {}, {
    initialPlayer: [0, 0],
    initialShades: [[0.2, 0]],
    initialIntegrity: 0.1,
  });
  const interaction = createRelayInteractionBuffer();
  const session = createEngineSession<RelayInput>({
    sessionId: createSessionId(),
    worldId: EXPO_WORLD_ID,
    runtimeInstanceId: 'relay-catch-up-terminal-test',
    systems: [{
      id: 'relay-catch-up-terminal-simulation',
      run(step) {
        simulation.update(step.fixedDeltaSeconds, step.input);
      },
    }],
    captureInput(value) {
      return value;
    },
  });
  const catchUp = (clicked: boolean) => {
    interaction.capture(clicked);
    const value = input(interaction.read());
    const result = session.advance(1 / 30, Object.freeze({ ...value, lightPowers: darkPowers }));
    interaction.consume(result.completedSteps);
    return result;
  };

  const terminalClick = catchUp(true);
  assert.equal(terminalClick.completedSteps, 2);
  assert.equal(simulation.read().status, 'lost');
  assert.equal(simulation.read().run, 1);

  catchUp(false);
  const retryClick = catchUp(true);
  assert.equal(retryClick.completedSteps, 2);
  assert.equal(simulation.read().status, 'playing');
  assert.equal(simulation.read().run, 2);
  session.dispose();
});
