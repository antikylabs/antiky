import assert from 'node:assert/strict';
import test from 'node:test';

// Node 22's strip-types test runner requires the source extension. The demos
// tsconfig intentionally uses extensionless bundler imports.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import {
  CharacterQueryWorld,
  KinematicCharacterMotor,
  StaticCharacterWorldAdapter,
  type CharacterCollider,
  type CharacterMotorConfig,
  type CharacterWorldAdapter,
  type GroundSurface,
} from './character-motor.ts';

const TEST_CONFIG: Partial<CharacterMotorConfig> = {
  fixedDeltaSeconds: 1 / 60,
  maxCatchUpSteps: 120,
  maxFrameDeltaSeconds: 1,
  radius: 0.25,
  height: 1.7,
  skinWidth: 0.02,
  maxSpeed: 3,
  acceleration: 10_000,
  brakingDeceleration: 10_000,
  maxStepUp: 0.3,
  maxStepDown: 0.3,
  groundSnapDistance: 0.1,
  maxWalkableSlopeDegrees: 42,
  groundProbeRadius: 0.12,
  maxHorizontalSubstep: 0.1,
};

type GroundFunction = (x: number, z: number) => Readonly<GroundSurface> | null;

function makeWorld(
  colliders: readonly Readonly<CharacterCollider>[] = [],
  ground: GroundFunction = () => ({ id: 'ground', height: 0 }),
) {
  const sampleGround: NonNullable<CharacterWorldAdapter['sampleGround']> = (request) => (
    ground(request.x, request.z)
  );
  return new CharacterQueryWorld(new StaticCharacterWorldAdapter({ colliders, sampleGround }));
}

function makeMotor(
  colliders: readonly Readonly<CharacterCollider>[] = [],
  ground?: GroundFunction,
  config: Partial<CharacterMotorConfig> = {},
  initial = { x: 0, y: 0, z: 0 },
) {
  return new KinematicCharacterMotor(makeWorld(colliders, ground), initial, {
    ...TEST_CONFIG,
    ...config,
  });
}

function runTicks(
  motor: KinematicCharacterMotor,
  count: number,
  input = { x: 1, z: 0 },
) {
  for (let tick = 0; tick < count; tick += 1) motor.stepFixed(input);
}

function near(actual: number, expected: number, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

test('continuous capsule sweep stops at a wall with skin width', () => {
  const wall: CharacterCollider = {
    id: 'wall', minX: 1, maxX: 1.05, minY: 0, maxY: 3, minZ: -5, maxZ: 5,
  };
  const motor = makeMotor([wall]);

  runTicks(motor, 90);

  near(motor.state.position.x, 1 - 0.25 - 0.02);
  near(motor.state.position.z, 0);
  assert.equal(motor.state.grounded, true);
  assert.ok(motor.debug.contacts.some((contact) => contact.kind === 'wall'));
  assert.equal(motor.debug.contacts.find((contact) => contact.kind === 'wall')?.colliderId, 'wall');
});

test('diagonal movement slides along a wall instead of axis-stopping', () => {
  const wall: CharacterCollider = {
    id: 'wall', minX: 1, maxX: 1.1, minY: 0, maxY: 3, minZ: -10, maxZ: 10,
  };
  const motor = makeMotor([wall]);

  runTicks(motor, 80, { x: 1, z: 1 });

  near(motor.state.position.x, 0.73);
  assert.ok(motor.state.position.z > 2.4, `expected slide travel, got z=${motor.state.position.z}`);
  near(motor.state.velocity.x, 0);
  assert.ok(motor.state.velocity.z > 1);
});

test('two simultaneous contacts settle deterministically in an inside corner', () => {
  const colliders: CharacterCollider[] = [
    { id: 'x-wall', minX: 1, maxX: 1.1, minY: 0, maxY: 3, minZ: -5, maxZ: 5 },
    { id: 'z-wall', minX: -5, maxX: 5, minY: 0, maxY: 3, minZ: 1, maxZ: 1.1 },
  ];
  const motor = makeMotor(colliders);

  runTicks(motor, 90, { x: 1, z: 1 });

  near(motor.state.position.x, 0.73);
  near(motor.state.position.z, 0.73);
  near(motor.state.velocity.x, 0);
  near(motor.state.velocity.z, 0);
  assert.equal(
    motor.world.overlapCapsule({
      position: motor.state.position,
      radius: 0.27,
      height: 1.7,
    }).length,
    0,
  );
});

test('thin walls cannot be tunneled through during a large render delta', () => {
  const wall: CharacterCollider = {
    id: 'thin-wall', minX: 1, maxX: 1.01, minY: 0, maxY: 3, minZ: -2, maxZ: 2,
  };
  const motor = makeMotor([wall], undefined, {
    maxSpeed: 40,
    acceleration: 100_000,
    maxHorizontalSubstep: 10,
  });

  const result = motor.advance(0.25, { x: 1, z: 0 });

  assert.equal(result.fixedSteps, 15);
  near(motor.state.position.x, 0.73);
  assert.ok(motor.state.position.x < wall.minX);
});

test('a low obstacle is stepped up and its top remains the exact foot height', () => {
  const step: CharacterCollider = {
    id: 'step', minX: 1, maxX: 3, minY: 0, maxY: 0.25, minZ: -1, maxZ: 1,
  };
  const motor = makeMotor([step], undefined, { maxSpeed: 2 });

  runTicks(motor, 55);

  assert.ok(motor.state.position.x > 1.3);
  near(motor.state.position.y, 0.25);
  assert.equal(motor.state.support?.id, 'step');
  assert.equal(motor.state.grounded, true);
});

test('a ledge above maxStepUp blocks movement', () => {
  const ground: GroundFunction = (x) => ({
    id: x < 1 ? 'lower' : 'upper',
    height: x < 1 ? 0 : 0.5,
  });
  const motor = makeMotor([], ground, { maxSpeed: 2 });

  runTicks(motor, 90);

  assert.ok(motor.state.position.x < 1 + 1e-4);
  near(motor.state.position.y, 0);
  assert.ok(motor.debug.contacts.some((contact) => contact.kind === 'ledge'));
});

test('missing ground and drops beyond maxStepDown are treated as blocked ledges', () => {
  const ground: GroundFunction = (x) => {
    if (x < 0.75) return { id: 'bank', height: 0 };
    if (x < 1.5) return null;
    return { id: 'far-bank', height: -0.1 };
  };
  const motor = makeMotor([], ground, { maxSpeed: 12, maxHorizontalSubstep: 0.08 });

  runTicks(motor, 30);

  assert.ok(motor.state.position.x < 0.751);
  assert.equal(motor.state.grounded, true);
});

test('walkable step-downs snap to a stable support height', () => {
  const ground: GroundFunction = (x) => ({
    id: x < 0.5 ? 'upper' : 'lower',
    height: x < 0.5 ? 0 : -0.2,
  });
  const motor = makeMotor([], ground, { maxSpeed: 1.5 });

  runTicks(motor, 35);

  assert.ok(motor.state.position.x > 0.5);
  near(motor.state.position.y, -0.2);
  near(motor.state.support?.height ?? Number.NaN, -0.2);
});

test('an unwalkable ground normal is rejected at the slope threshold', () => {
  const ground: GroundFunction = (x) => x < 0.6
    ? { id: 'flat', height: 0, normal: { x: 0, y: 1, z: 0 } }
    : { id: 'steep', height: 0, normal: { x: -0.9, y: 0.435, z: 0 } };
  const motor = makeMotor([], ground, { maxSpeed: 2 });

  runTicks(motor, 50);

  assert.ok(motor.state.position.x < 0.601);
  assert.ok(motor.debug.contacts.some((contact) => contact.kind === 'slope'));
});

test('penetration recovery pushes an embedded character out in bounded iterations', () => {
  const block: CharacterCollider = {
    id: 'block', minX: -0.1, maxX: 1, minY: 0, maxY: 2, minZ: -1, maxZ: 1,
  };
  const motor = makeMotor([block]);

  motor.stepFixed({ x: 0, z: 0 });

  assert.ok(motor.debug.penetrationIterations > 0);
  assert.equal(motor.debug.unresolvedPenetration, false);
  assert.ok(motor.state.position.x < block.minX);
  near(motor.state.velocity.x, 0);
  near(motor.state.velocity.z, 0);
  assert.equal(
    motor.world.overlapCapsule({ position: motor.state.position, radius: 0.27, height: 1.7 }).length,
    0,
  );
});

test('ground support velocity carries a stationary character like a platform', () => {
  const ground: GroundFunction = () => ({
    id: 'platform',
    height: 0.4,
    velocity: { x: 1, y: 0, z: 0 },
  });
  const motor = makeMotor([], ground, {}, { x: 0, y: 0.4, z: 0 });

  runTicks(motor, 60, { x: 0, z: 0 });

  near(motor.state.position.x, 1);
  near(motor.state.position.y, 0.4);
  near(motor.state.velocity.x, 0);
  assert.equal(motor.state.support?.id, 'platform');
  near(motor.debug.supportDisplacement.x, 1 / 60);
});

test('identical inputs produce bit-identical state and contact debug data', () => {
  const colliders: CharacterCollider[] = [
    { id: 'b-wall', minX: 1, maxX: 1.2, minY: 0, maxY: 3, minZ: -2, maxZ: 4 },
    { id: 'a-wall', minX: -3, maxX: 3, minY: 0, maxY: 3, minZ: 2, maxZ: 2.2 },
  ];
  const simulate = () => {
    const motor = makeMotor([...colliders].reverse());
    const frameDeltas = [1 / 120, 1 / 40, 1 / 60, 1 / 30, 1 / 75, 1 / 50];
    const contacts = [];
    for (let frame = 0; frame < 180; frame += 1) {
      motor.advance(frameDeltas[frame % frameDeltas.length]!, { x: 1, z: 0.55 });
      contacts.push(motor.debug.contacts.map((contact) => ({
        kind: contact.kind,
        colliderId: contact.colliderId,
        normal: contact.normal,
      })));
    }
    return { state: motor.snapshot(), contacts };
  };

  assert.deepEqual(simulate(), simulate());
});

test('one accumulated delta is equivalent to the same fixed ticks subdivided', () => {
  const wall: CharacterCollider = {
    id: 'wall', minX: 1, maxX: 1.1, minY: 0, maxY: 3, minZ: -4, maxZ: 4,
  };
  const combined = makeMotor([wall]);
  const subdivided = makeMotor([wall]);

  const combinedResult = combined.advance(1 / 30, { x: 1, z: 0.35 });
  subdivided.advance(1 / 60, { x: 1, z: 0.35 });
  const subdividedResult = subdivided.advance(1 / 60, { x: 1, z: 0.35 });

  assert.equal(combinedResult.fixedSteps, 2);
  assert.equal(subdividedResult.fixedSteps, 1);
  assert.deepEqual(combined.snapshot(), subdivided.snapshot());
});
