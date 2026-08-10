import assert from 'node:assert/strict';
import test from 'node:test';

import { EXPO_LIGHT_DEFINITIONS } from '../src/lights.ts';
import {
  CHARGE_FIELD_THRESHOLD,
  FORGE_POSITION,
  SAFE_FIELD_THRESHOLD,
  createBlackoutRelaySimulation,
  authoritativeRelayRegionRadii,
  sampleAuthoritativeRelayField,
  type RelayEvent,
  type RelayInput,
  type RelaySimulation,
} from '../src/simulation.ts';

const DEFAULT_POWERS = EXPO_LIGHT_DEFINITIONS.map((light) => light.pointLight.power) as [
  number,
  number,
  number,
];

function input(
  x = 0,
  z = 0,
  interact = false,
  lightPowers: readonly [number, number, number] = DEFAULT_POWERS,
): RelayInput {
  return Object.freeze({
    movement: Object.freeze({ x, z, active: Math.hypot(x, z) > 0.01 }),
    interact,
    lightPowers,
  });
}

function step(simulation: RelaySimulation, value: RelayInput, count = 1): void {
  for (let index = 0; index < count; index += 1) simulation.update(1 / 60, value);
}

function moveTo(simulation: RelaySimulation, target: readonly [number, number]): void {
  for (let count = 0; count < 360; count += 1) {
    const player = simulation.view().player;
    const dx = target[0] - player.x;
    const dz = target[1] - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.12) return;
    step(simulation, input(dx / distance, dz / distance));
  }
  assert.fail(`player did not reach ${target.join(', ')}`);
}

test('fixed-step movement, lamp charging, and darkness decay are deterministic', () => {
  const start = EXPO_LIGHT_DEFINITIONS[0]!.transform.position;
  const eventsA: RelayEvent[] = [];
  const eventsB: RelayEvent[] = [];
  const simulationA = createBlackoutRelaySimulation((event) => eventsA.push(event), {
    initialPlayer: [start[0], start[2]],
    initialShades: [],
  });
  const simulationB = createBlackoutRelaySimulation((event) => eventsB.push(event), {
    initialPlayer: [start[0], start[2]],
    initialShades: [],
  });

  step(simulationA, input(), 150);
  step(simulationB, input(), 150);
  assert.equal(simulationA.digest(), simulationB.digest());
  assert.equal(simulationA.read().player.charge.relayIndex, 0);
  assert.equal(simulationA.read().player.charge.value, 1);
  assert.ok(eventsA.some((event) => event.type === 'relay.charge-ready'));

  moveTo(simulationA, [0, 5.25]);
  const carried = simulationA.read().player.charge.value;
  step(simulationA, input(), 90);
  assert.ok(simulationA.read().player.charge.value < carried);
  assert.ok(simulationA.read().player.charge.value > 0);
});

test('diegetic rings are the authoritative safe, retreat, and charge field', () => {
  const authoredPower = EXPO_LIGHT_DEFINITIONS[0]!.pointLight.power;
  const authored = authoritativeRelayRegionRadii(0, authoredPower);
  const dimmed = authoritativeRelayRegionRadii(0, authoredPower * 0.2);
  const extinguished = authoritativeRelayRegionRadii(0, 0);

  assert.ok(authored.safe > authored.charge);
  assert.ok(dimmed.safe < authored.safe);
  assert.equal(dimmed.charge, 0);
  assert.deepEqual(extinguished, { safe: 0, charge: 0 });

  const light = EXPO_LIGHT_DEFINITIONS[0]!;
  const isolatedPowers = [authoredPower, 0, 0] as const;
  const safeBoundary = sampleAuthoritativeRelayField(
    light.transform.position[0] - authored.safe,
    light.transform.position[2],
    isolatedPowers,
  )[0];
  const chargeBoundary = sampleAuthoritativeRelayField(
    light.transform.position[0] - authored.charge,
    light.transform.position[2],
    isolatedPowers,
  )[0];
  assert.ok(Math.abs(safeBoundary - SAFE_FIELD_THRESHOLD) < 1e-9);
  assert.ok(Math.abs(chargeBoundary - CHARGE_FIELD_THRESHOLD) < 1e-9);

  const boundaryShade = createBlackoutRelaySimulation(() => {}, {
    initialPlayer: [0, 0],
    initialShades: [[
      light.transform.position[0] - authored.safe,
      light.transform.position[2],
    ]],
  });
  boundaryShade.update(0, input(0, 0, false, isolatedPowers));
  assert.equal(boundaryShade.read().shades[0]?.mode, 'retreat');
});

test('four shades separate deterministically and share one bounded player damage gate', () => {
  const darkPowers = [0, 0, 0] as const;
  const overlapping = [[0.2, 0], [0.2, 0], [0.2, 0], [0.2, 0]] as const;
  const first = createBlackoutRelaySimulation(() => {}, {
    initialPlayer: [0, 0],
    initialShades: overlapping,
  });
  const second = createBlackoutRelaySimulation(() => {}, {
    initialPlayer: [0, 0],
    initialShades: overlapping,
  });
  step(first, input(0, 0, false, darkPowers), 60);
  step(second, input(0, 0, false, darkPowers), 60);

  assert.equal(first.digest(), second.digest());
  assert.ok(first.read().integrity >= 0.7);
  assert.equal('hitCooldown' in first.read().shades[0]!, false);
  for (let left = 0; left < first.read().shades.length; left += 1) {
    for (let right = left + 1; right < first.read().shades.length; right += 1) {
      const a = first.read().shades[left]!;
      const b = first.read().shades[right]!;
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 0.5);
    }
  }
});

test('the default four-shade chamber has a survivable three-relay completion path', () => {
  const simulation = createBlackoutRelaySimulation(() => {});
  for (let relayIndex = 0; relayIndex < EXPO_LIGHT_DEFINITIONS.length; relayIndex += 1) {
    const light = EXPO_LIGHT_DEFINITIONS[relayIndex]!;
    moveTo(simulation, [light.transform.position[0], light.transform.position[2]]);
    step(simulation, input(), 150);
    moveTo(simulation, FORGE_POSITION);
    step(simulation, input(0, 0, true));
    step(simulation, input());
  }
  assert.equal(simulation.read().status, 'won');
  assert.ok(simulation.read().integrity >= 0.25);
});

test('clicking an empty forge produces bounded rejected-deposit feedback', () => {
  const events: RelayEvent[] = [];
  const simulation = createBlackoutRelaySimulation((event) => events.push(event), {
    initialShades: [],
  });
  step(simulation, input(0, 0, true));
  assert.equal(simulation.read().rejectPulse, 1);
  step(simulation, input(0, 0, true), 2);

  assert.equal(events.filter((event) => event.type === 'relay.deposit-rejected').length, 1);
  assert.equal(simulation.read().status, 'playing');
});

test('a player can charge and deposit all three relay colors to win', () => {
  const events: RelayEvent[] = [];
  const first = EXPO_LIGHT_DEFINITIONS[0]!.transform.position;
  const simulation = createBlackoutRelaySimulation((event) => events.push(event), {
    initialPlayer: [first[0], first[2]],
    initialShades: [],
  });

  for (let relayIndex = 0; relayIndex < EXPO_LIGHT_DEFINITIONS.length; relayIndex += 1) {
    const light = EXPO_LIGHT_DEFINITIONS[relayIndex]!;
    moveTo(simulation, [light.transform.position[0], light.transform.position[2]]);
    step(simulation, input(), 150);
    assert.equal(simulation.read().player.charge.relayIndex, relayIndex);
    assert.equal(simulation.read().player.charge.value, 1);
    moveTo(simulation, FORGE_POSITION);
    step(simulation, input(0, 0, true));
    assert.equal(simulation.read().deposits[relayIndex], true);
  }

  assert.equal(simulation.read().status, 'won');
  assert.equal(events.filter((event) => event.type === 'relay.deposited').length, 3);
  assert.ok(events.some((event) => event.type === 'relay.victory'));
  step(simulation, input(0, 0, true), 2);
  assert.equal(simulation.read().status, 'won');
  step(simulation, input());
  step(simulation, input(0, 0, true));
  assert.equal(simulation.read().status, 'playing');
});

test('shades retreat from irradiance, threaten darkness, and can end a run', () => {
  const lamp = EXPO_LIGHT_DEFINITIONS[1]!.transform.position;
  const lit = createBlackoutRelaySimulation(() => {}, {
    initialPlayer: [lamp[0] + 0.25, lamp[2]],
    initialShades: [[lamp[0] + 0.55, lamp[2]]],
  });
  const distanceBefore = Math.hypot(
    lit.read().shades[0]!.x - lamp[0],
    lit.read().shades[0]!.z - lamp[2],
  );
  step(lit, input(), 30);
  const litShade = lit.read().shades[0]!;
  assert.equal(litShade.mode, 'retreat');
  assert.ok(Math.hypot(litShade.x - lamp[0], litShade.z - lamp[2]) > distanceBefore);

  const darkPowers = [0, 0, 0] as const;
  const dark = createBlackoutRelaySimulation(() => {}, {
    initialPlayer: [0, 0],
    initialShades: [[0.2, 0]],
    initialIntegrity: 0.12,
  });
  for (let count = 0; count < 360 && dark.read().status === 'playing'; count += 1) {
    step(dark, input(0, 0, false, darkPowers));
  }
  assert.equal(dark.read().status, 'lost');
  assert.equal(dark.read().shades[0]!.mode, 'threaten');

  step(dark, input(0, 0, true, darkPowers));
  const restarted = dark.read();
  assert.equal(restarted.status, 'playing');
  assert.equal(restarted.run, 2);
  assert.equal(restarted.integrity, 1);
  assert.deepEqual(restarted.deposits, [false, false, false]);
});
