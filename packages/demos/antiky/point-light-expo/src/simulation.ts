import { hashUnit } from '@antiky/framework';
import { EXPO_LIGHT_DEFINITIONS } from './lights.ts';
import {
  CHARGE_FIELD_THRESHOLD,
  SAFE_FIELD_THRESHOLD,
  sampleAuthoritativeRelayField,
  strongestAuthoritativeRelayField,
} from './relay-field.ts';

export {
  CHARGE_FIELD_THRESHOLD,
  SAFE_FIELD_THRESHOLD,
  authoritativeRelayRegionRadii,
  sampleAuthoritativeRelayField,
} from './relay-field.ts';

export const FORGE_POSITION = [0, 0] as const;
export const DEFAULT_PLAYER_POSITION = [0, 2.15] as const;
export const SHADE_COUNT = 4;
export const RELAY_PARTICLE_CAPACITY = 64;
export const ARENA_HALF_EXTENTS = [8.25, 5.65] as const;
const PLAYER_SPEED = 4.8;
const CHARGE_RATE = 0.62;
const CHARGE_DECAY = 0.16;
const DEPOSIT_MINIMUM = 0.68;
const FORGE_RADIUS = 1.05;
const SHADE_SEPARATION = 0.62;
const CONTACT_DAMAGE = 0.11;
const CONTACT_INVULNERABILITY_SECONDS = 0.62;

export type RelayStatus = 'playing' | 'won' | 'lost';
export type ShadeMode = 'threaten' | 'retreat';
export type RelayInput = Readonly<{
  movement: Readonly<{ x: number; z: number; active: boolean }>;
  interact: boolean;
  lightPowers: readonly [number, number, number];
}>;
export type RelayEvent = Readonly<{
  type:
    | 'relay.charge-started'
    | 'relay.charge-ready'
    | 'relay.charge-lost'
    | 'relay.deposited'
    | 'relay.deposit-rejected'
    | 'relay.integrity-hit'
    | 'relay.victory'
    | 'relay.failure'
    | 'relay.restarted';
  value: number;
  relayIndex?: number;
  shadeIndex?: number;
}>;
export type RelayPlayer = {
  x: number;
  z: number;
  spawnX: number;
  spawnZ: number;
  facingX: number;
  facingZ: number;
  irradiance: number;
  safe: boolean;
  contactInvulnerability: number;
  charge: {
    relayIndex: number | null;
    value: number;
  };
};
export type RelayShade = {
  x: number;
  z: number;
  mode: ShadeMode;
  irradiance: number;
  phase: number;
};
export type RelayParticle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  relayIndex: number;
  kind: number;
};

export type RelaySnapshot = Readonly<{
  time: number;
  revision: number;
  run: number;
  status: RelayStatus;
  integrity: number;
  deposits: readonly [boolean, boolean, boolean];
  player: Readonly<RelayPlayer>;
  shades: readonly Readonly<RelayShade>[];
  particles: readonly Readonly<RelayParticle>[];
  forgePulse: number;
  rejectPulse: number;
  dangerPulse: number;
}>;

export type RelaySimulationOptions = Readonly<{
  initialPlayer?: readonly [number, number];
  initialShades?: readonly (readonly [number, number])[];
  initialIntegrity?: number;
}>;

export type RelaySimulation = Readonly<{
  update(deltaSeconds: number, input: RelayInput): void;
  view(): RelaySnapshot;
  read(): RelaySnapshot;
  digest(): string;
}>;

const DEFAULT_SHADE_POSITIONS = Object.freeze([
  [-7.2, 4.65],
  [7.25, -4.65],
  [-1.8, 4.9],
  [6.9, 4.6],
] as const);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
function clampArenaX(value: number): number {
  return clamp(value, -ARENA_HALF_EXTENTS[0], ARENA_HALF_EXTENTS[0]);
}
function clampArenaZ(value: number): number {
  return clamp(value, -ARENA_HALF_EXTENTS[1], ARENA_HALF_EXTENTS[1]);
}

export function createBlackoutRelaySimulation(
  emit: (event: RelayEvent) => void,
  options: RelaySimulationOptions = {},
): RelaySimulation {
  const initialPlayer = options.initialPlayer ?? DEFAULT_PLAYER_POSITION;
  const initialShadePositions = options.initialShades ?? DEFAULT_SHADE_POSITIONS;
  const initialIntegrity = clamp(options.initialIntegrity ?? 1, 0.01, 1);
  const player: RelayPlayer = {
    x: initialPlayer[0],
    z: initialPlayer[1],
    spawnX: initialPlayer[0],
    spawnZ: initialPlayer[1],
    facingX: 0,
    facingZ: -1,
    irradiance: 0,
    safe: false,
    contactInvulnerability: 0,
    charge: { relayIndex: null, value: 0 },
  };
  const shades: RelayShade[] = initialShadePositions.map(([x, z], index) => ({
    x,
    z,
    mode: 'threaten',
    irradiance: 0,
    phase: hashUnit(index, 2) * Math.PI * 2,
  }));
  const particles: RelayParticle[] = Array.from({ length: RELAY_PARTICLE_CAPACITY }, () => ({
    x: 0,
    y: -20,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    relayIndex: 0,
    kind: 0,
  }));
  const deposits: [boolean, boolean, boolean] = [false, false, false];
  let time = 0;
  let revision = 1;
  let run = 1;
  let status: RelayStatus = 'playing';
  let integrity = initialIntegrity;
  let particleCursor = 0;
  let forgePulse = 0;
  let rejectPulse = 0;
  let dangerPulse = 0;
  let interactLatched = false;

  const liveView = Object.freeze({
    get time() { return time; },
    get revision() { return revision; },
    get run() { return run; },
    get status() { return status; },
    get integrity() { return integrity; },
    deposits,
    player,
    shades,
    particles,
    get forgePulse() { return forgePulse; },
    get rejectPulse() { return rejectPulse; },
    get dangerPulse() { return dangerPulse; },
  });

  const burst = (
    x: number,
    z: number,
    relayIndex: number,
    count: number,
    force: number,
    kind: number,
  ): void => {
    for (let burstIndex = 0; burstIndex < count; burstIndex += 1) {
      const particle = particles[particleCursor]!;
      particleCursor = (particleCursor + 1) % particles.length;
      const angle = hashUnit(revision + burstIndex, relayIndex + kind * 5) * Math.PI * 2;
      const speed = force * (0.45 + hashUnit(revision + burstIndex, relayIndex + 11));
      particle.x = x;
      particle.y = 0.28 + hashUnit(revision + burstIndex, relayIndex + 13) * 0.42;
      particle.z = z;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = 0.75 + hashUnit(revision + burstIndex, relayIndex + 17) * force;
      particle.vz = Math.sin(angle) * speed;
      particle.life = 0.42 + hashUnit(revision + burstIndex, relayIndex + 19) * 0.44;
      particle.relayIndex = relayIndex;
      particle.kind = kind;
    }
  };

  const reset = (): void => {
    time = 0;
    revision += 1;
    run += 1;
    status = 'playing';
    integrity = 1;
    deposits.fill(false);
    player.x = initialPlayer[0];
    player.z = initialPlayer[1];
    player.facingX = 0;
    player.facingZ = -1;
    player.irradiance = 0;
    player.safe = false;
    player.contactInvulnerability = 0;
    player.charge.relayIndex = null;
    player.charge.value = 0;
    shades.forEach((shade, index) => {
      const position = initialShadePositions[index]!;
      shade.x = position[0];
      shade.z = position[1];
      shade.mode = 'threaten';
      shade.irradiance = 0;
    });
    particles.forEach((particle) => {
      particle.life = 0;
      particle.y = -20;
    });
    forgePulse = 0;
    rejectPulse = 0;
    dangerPulse = 0;
    interactLatched = true;
    emit({ type: 'relay.restarted', value: run });
  };

  const updateParticles = (dt: number): void => {
    particles.forEach((particle) => {
      if (particle.life <= 0) return;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      particle.vx *= Math.exp(-2.4 * dt);
      particle.vy -= 2.2 * dt;
      particle.vz *= Math.exp(-2.4 * dt);
      if (particle.life <= 0) particle.y = -20;
    });
  };

  const update = (deltaSeconds: number, input: RelayInput): void => {
    const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
    revision += 1;
    forgePulse = Math.max(0, forgePulse - dt * 1.65);
    rejectPulse = Math.max(0, rejectPulse - dt * 2.8);
    dangerPulse = Math.max(0, dangerPulse - dt * 2.4);
    player.contactInvulnerability = Math.max(0, player.contactInvulnerability - dt);
    updateParticles(dt);
    const interactPressed = input.interact && !interactLatched;
    interactLatched = input.interact;

    if (status !== 'playing') {
      if (interactPressed) reset();
      return;
    }

    time += dt;
    let moveX = input.movement.active && Number.isFinite(input.movement.x) ? input.movement.x : 0;
    let moveZ = input.movement.active && Number.isFinite(input.movement.z) ? input.movement.z : 0;
    const moveLength = Math.hypot(moveX, moveZ);
    if (moveLength > 1) {
      moveX /= moveLength;
      moveZ /= moveLength;
    }
    if (Math.hypot(moveX, moveZ) > 0.01) {
      player.facingX = moveX;
      player.facingZ = moveZ;
    }
    player.x = clampArenaX(player.x + moveX * PLAYER_SPEED * dt);
    player.z = clampArenaZ(player.z + moveZ * PLAYER_SPEED * dt);

    const authoritativeField = strongestAuthoritativeRelayField(sampleAuthoritativeRelayField(
      player.x,
      player.z,
      input.lightPowers,
    ));
    player.irradiance = authoritativeField.value;
    player.safe = authoritativeField.value >= SAFE_FIELD_THRESHOLD;
    if (
      authoritativeField.value >= CHARGE_FIELD_THRESHOLD
      && !deposits[authoritativeField.index]
    ) {
      if (player.charge.relayIndex === null || player.charge.value <= 0.001) {
        player.charge.relayIndex = authoritativeField.index;
        player.charge.value = 0;
        emit({ type: 'relay.charge-started', relayIndex: authoritativeField.index, value: run });
      }
      if (player.charge.relayIndex === authoritativeField.index) {
        const previousCharge = player.charge.value;
        player.charge.value = Math.min(1, player.charge.value + CHARGE_RATE * dt);
        if (previousCharge < 1 && player.charge.value === 1) {
          burst(player.x, player.z, authoritativeField.index, 12, 1.4, 0);
          emit({ type: 'relay.charge-ready', relayIndex: authoritativeField.index, value: 1 });
        }
      }
    } else if (
      authoritativeField.value < SAFE_FIELD_THRESHOLD
      && player.charge.relayIndex !== null
    ) {
      player.charge.value = Math.max(0, player.charge.value - CHARGE_DECAY * dt);
      if (player.charge.value === 0) {
        const relayIndex = player.charge.relayIndex;
        player.charge.relayIndex = null;
        emit({ type: 'relay.charge-lost', relayIndex, value: 0 });
      }
    }

    const atForge = Math.hypot(player.x - FORGE_POSITION[0], player.z - FORGE_POSITION[1])
      <= FORGE_RADIUS;
    if (interactPressed && atForge) {
      if (
        player.charge.relayIndex !== null
        && player.charge.value >= DEPOSIT_MINIMUM
        && !deposits[player.charge.relayIndex]
      ) {
        const relayIndex = player.charge.relayIndex;
        deposits[relayIndex] = true;
        player.charge.relayIndex = null;
        player.charge.value = 0;
        forgePulse = 1;
        burst(FORGE_POSITION[0], FORGE_POSITION[1], relayIndex, 20, 2.2, 1);
        emit({ type: 'relay.deposited', relayIndex, value: deposits.filter(Boolean).length });
        if (deposits.every(Boolean)) {
          status = 'won';
          forgePulse = 2;
          emit({ type: 'relay.victory', value: time });
        }
      } else {
        const relayIndex = player.charge.relayIndex;
        rejectPulse = 1;
        dangerPulse = Math.max(dangerPulse, 0.35);
        burst(FORGE_POSITION[0], FORGE_POSITION[1], relayIndex ?? 2, 7, 1.1, 2);
        emit({
          type: 'relay.deposit-rejected',
          ...(relayIndex === null ? {} : { relayIndex }),
          value: player.charge.value,
        });
      }
    }

    shades.forEach((shade) => {
      const shadeField = strongestAuthoritativeRelayField(sampleAuthoritativeRelayField(
        shade.x,
        shade.z,
        input.lightPowers,
      ));
      shade.irradiance = shadeField.value;
      shade.mode = shadeField.value >= SAFE_FIELD_THRESHOLD ? 'retreat' : 'threaten';
      let directionX: number;
      let directionZ: number;
      if (shade.mode === 'retreat') {
        const light = EXPO_LIGHT_DEFINITIONS[shadeField.index]!;
        directionX = shade.x - light.transform.position[0];
        directionZ = shade.z - light.transform.position[2];
      } else {
        directionX = player.x - shade.x;
        directionZ = player.z - shade.z;
      }
      const directionLength = Math.max(0.001, Math.hypot(directionX, directionZ));
      const speed = shade.mode === 'retreat'
        ? 2.3 + Math.min(1.2, shadeField.total)
        : 1.34 + deposits.filter(Boolean).length * 0.16;
      shade.x = clampArenaX(shade.x + directionX / directionLength * speed * dt);
      shade.z = clampArenaZ(shade.z + directionZ / directionLength * speed * dt);

    });

    for (let iteration = 0; iteration < 4; iteration += 1) {
      for (let leftIndex = 0; leftIndex < shades.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < shades.length; rightIndex += 1) {
          const left = shades[leftIndex]!;
          const right = shades[rightIndex]!;
          let dx = right.x - left.x;
          let dz = right.z - left.z;
          let distance = Math.hypot(dx, dz);
          if (distance >= SHADE_SEPARATION) continue;
          if (distance < 0.0001) {
            const angle = (leftIndex * 7 + rightIndex * 13) * 2.39996;
            dx = Math.cos(angle);
            dz = Math.sin(angle);
          }
          const push = (SHADE_SEPARATION - distance) * 0.5;
          const directionLength = Math.max(0.0001, Math.hypot(dx, dz));
          const pushX = dx / directionLength * push;
          const pushZ = dz / directionLength * push;
          left.x = clampArenaX(left.x - pushX);
          left.z = clampArenaZ(left.z - pushZ);
          right.x = clampArenaX(right.x + pushX);
          right.z = clampArenaZ(right.z + pushZ);
        }
      }
    }

    if (player.contactInvulnerability <= 0) {
      let contactIndex = -1;
      let contactDistance = Number.POSITIVE_INFINITY;
      shades.forEach((shade, index) => {
        if (shade.mode !== 'threaten') return;
        const distance = Math.hypot(player.x - shade.x, player.z - shade.z);
        if (distance < 0.76 && distance < contactDistance) {
          contactDistance = distance;
          contactIndex = index;
        }
      });
      if (contactIndex >= 0) {
        const shade = shades[contactIndex]!;
        integrity = Math.max(0, integrity - CONTACT_DAMAGE);
        player.contactInvulnerability = CONTACT_INVULNERABILITY_SECONDS;
        dangerPulse = Math.max(dangerPulse, 0.7);
        let awayX = shade.x - player.x;
        let awayZ = shade.z - player.z;
        let awayLength = Math.hypot(awayX, awayZ);
        if (awayLength < 0.001) {
          const angle = contactIndex * 2.39996;
          awayX = Math.cos(angle);
          awayZ = Math.sin(angle);
          awayLength = 1;
        }
        shade.x = clampArenaX(shade.x + awayX / awayLength * 0.28);
        shade.z = clampArenaZ(shade.z + awayZ / awayLength * 0.28);
        burst(player.x, player.z, 2, 7, 1.6, 2);
        emit({ type: 'relay.integrity-hit', shadeIndex: contactIndex, value: integrity });
      }
    }

    if (integrity <= 0 && status === 'playing') {
      integrity = 0;
      status = 'lost';
      dangerPulse = 2;
      emit({ type: 'relay.failure', value: time });
    }
  };

  const read = (): RelaySnapshot => Object.freeze({
    time,
    revision,
    run,
    status,
    integrity,
    deposits: Object.freeze([...deposits]) as readonly [boolean, boolean, boolean],
    player: Object.freeze({
      ...player,
      charge: Object.freeze({ ...player.charge }),
    }),
    shades: Object.freeze(shades.map((shade) => Object.freeze({ ...shade }))),
    particles: Object.freeze(particles.map((particle) => Object.freeze({ ...particle }))),
    forgePulse,
    rejectPulse,
    dangerPulse,
  });

  const digest = (): string => {
    const values = [
      revision,
      run,
      status,
      integrity.toFixed(6),
      player.x.toFixed(6),
      player.z.toFixed(6),
      player.charge.relayIndex ?? -1,
      player.charge.value.toFixed(6),
      player.contactInvulnerability.toFixed(6),
      rejectPulse.toFixed(6),
      deposits.map((value) => Number(value)).join(''),
      ...shades.flatMap((shade) => [shade.x.toFixed(5), shade.z.toFixed(5), shade.mode]),
    ];
    return values.join('|');
  };

  return Object.freeze({ update, view: () => liveView, read, digest });
}
