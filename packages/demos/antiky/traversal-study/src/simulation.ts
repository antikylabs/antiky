import { canonicalAttractCommand } from './attract-controller.ts';
import {
  COURSE_CHECKPOINTS,
  COURSE_COLLECTIBLES,
  COURSE_HAZARDS,
  COURSE_LENGTH,
  COURSE_PLATFORMS,
  DELIVERY_X,
  actAt,
  platformTop,
  type PlatformDefinition,
  type TraversalAct,
} from './course.ts';

export { COURSE_LENGTH, COURSE_HAZARDS, COURSE_PLATFORMS, platformTop } from './course.ts';

export const RUNNER_RADIUS = 0.43;
export const TRAIL_CAPACITY = 72;
export const MAX_PARCEL_SEALS = 3;
export const STORM_DURATION_SECONDS = 64;
export const ATTRACT_DELAY_SECONDS = 2.5;
export const COYOTE_SECONDS = 0.11;
export const JUMP_BUFFER_SECONDS = 0.13;

const ATTRACT_SPEED = 3.25;
const MANUAL_CRUISE_SPEED = 3.35;
const MANUAL_SPRINT_BONUS = 1.35;
const JUMP_VELOCITY = 7.05;
const GRAVITY = 16.2;

export type TraversalInput = Readonly<{
  horizontal: number;
  active: boolean;
  jump: boolean;
  brake?: boolean;
  retry?: boolean;
}>;

export type TraversalOutcome = 'running' | 'delivered' | 'failed';
export type TraversalControlMode = 'idle' | 'attract' | 'manual';
export type TraversalFailureReason = 'parcel-seals' | 'storm' | null;

export type TraversalEvent = Readonly<{
  type:
    | 'traversal.mode-change'
    | 'traversal.jump'
    | 'traversal.land'
    | 'traversal.fall'
    | 'traversal.hazard'
    | 'traversal.seal-lost'
    | 'traversal.seal-collected'
    | 'traversal.checkpoint'
    | 'traversal.storm-warning'
    | 'traversal.failure'
    | 'traversal.retry'
    | 'traversal.delivery';
  value: number;
  platformIndex?: number;
  hazardIndex?: number;
  checkpointIndex?: number;
  collectibleIndex?: number;
  act?: TraversalAct;
  reason?: Exclude<TraversalFailureReason, null>;
  controlMode?: TraversalControlMode;
}>;

export type PlatformInstance = Readonly<{
  definition: PlatformDefinition;
  definitionIndex: number;
  lap: 0;
  x: number;
  top: number;
}>;

export type TrailParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
};

export type TraversalSnapshot = Readonly<{
  time: number;
  attemptTime: number;
  remainingTime: number;
  storm: number;
  revision: number;
  resetSerial: number;
  attempt: number;
  distance: number;
  progress: number;
  act: TraversalAct;
  controlMode: TraversalControlMode;
  outcome: TraversalOutcome;
  failureReason: TraversalFailureReason;
  checkpointIndex: number;
  parcelSeals: number;
  collectedSeal: boolean;
  jumps: number;
  falls: number;
  effects: Readonly<{
    checkpoint: number;
    damage: number;
    delivery: number;
  }>;
  player: Readonly<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    grounded: boolean;
    facing: number;
    squash: number;
  }>;
  trail: readonly Readonly<TrailParticle>[];
}>;

export type TraversalSimulation = Readonly<{
  update(deltaSeconds: number, input: TraversalInput): void;
  view(): TraversalSnapshot;
  read(): TraversalSnapshot;
  digest(): string;
}>;

export function platformInstancesNear(_x: number, time: number): readonly PlatformInstance[] {
  return Object.freeze(COURSE_PLATFORMS.map((definition, definitionIndex) => Object.freeze({
    definition,
    definitionIndex,
    lap: 0 as const,
    x: definition.x,
    top: platformTop(definition, time),
  })));
}

function supportAt(x: number, y: number, time: number): PlatformInstance | null {
  let support: PlatformInstance | null = null;
  for (const platform of platformInstancesNear(x, time)) {
    const within = Math.abs(x - platform.x) <= platform.definition.width * 0.5 - 0.05;
    if (!within || platform.top > y + 0.14) continue;
    if (support === null || platform.top > support.top) support = platform;
  }
  return support;
}

function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 73.91 + salt * 19.37) * 41758.31;
  return value - Math.floor(value);
}

export function createTraversalSimulation(emit: (event: TraversalEvent) => void): TraversalSimulation {
  const player = {
    x: COURSE_CHECKPOINTS[0]!.x,
    y: RUNNER_RADIUS,
    vx: 0,
    vy: 0,
    grounded: true,
    facing: 1,
    squash: 0,
  };
  const trail: TrailParticle[] = Array.from(
    { length: TRAIL_CAPACITY },
    () => ({ x: 0, y: -20, vx: 0, vy: 0, life: 0, color: 0 }),
  );
  const effects = { checkpoint: 0, damage: 0, delivery: 0 };
  let time = 0;
  let attemptTime = 0;
  let revision = 1;
  let resetSerial = 0;
  let attempt = 1;
  let jumps = 0;
  let falls = 0;
  let parcelSeals = MAX_PARCEL_SEALS;
  let collectedSeal = false;
  let checkpointIndex = 0;
  let controlMode: TraversalControlMode = 'idle';
  let outcome: TraversalOutcome = 'running';
  let failureReason: TraversalFailureReason = null;
  let idleSeconds = 0;
  let trailCursor = 0;
  let jumpWasDown = false;
  let retryWasDown = false;
  let jumpBuffer = 0;
  let coyoteTime = COYOTE_SECONDS;
  let damageCooldown = 0;
  let stormWarningSent = false;

  const spawnTrail = (count: number, color: number, force: number): void => {
    for (let index = 0; index < count; index += 1) {
      const particle = trail[trailCursor]!;
      trailCursor = (trailCursor + 1) % trail.length;
      particle.x = player.x - player.facing * 0.28;
      particle.y = player.y - RUNNER_RADIUS * 0.7;
      particle.vx = -player.facing * (0.65 + seeded(revision + index, 2) * force);
      particle.vy = 0.4 + seeded(revision + index, 3) * force;
      particle.life = 0.28 + seeded(revision + index, 4) * 0.34;
      particle.color = color;
    }
  };

  const placeAtCheckpoint = (): void => {
    const checkpoint = COURSE_CHECKPOINTS[checkpointIndex]!;
    player.x = checkpoint.x;
    const platform = supportAt(player.x, 12, time);
    player.y = (platform?.top ?? 0) + RUNNER_RADIUS;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.squash = 1;
    coyoteTime = COYOTE_SECONDS;
    jumpBuffer = 0;
    jumpWasDown = false;
    damageCooldown = 0.8;
    resetSerial += 1;
  };

  const fail = (reason: Exclude<TraversalFailureReason, null>): void => {
    if (outcome !== 'running') return;
    outcome = 'failed';
    failureReason = reason;
    player.vx = 0;
    player.vy = 0;
    effects.damage = 1;
    emit({ type: 'traversal.failure', value: attempt, act: actAt(player.x), reason });
  };

  const loseSeal = (hazardIndex: number | null): void => {
    if (outcome !== 'running' || damageCooldown > 0) return;
    falls += 1;
    parcelSeals = Math.max(0, parcelSeals - 1);
    effects.damage = 1;
    spawnTrail(24, 2, 4.2);
    emit({ type: 'traversal.seal-lost', value: parcelSeals, hazardIndex: hazardIndex ?? undefined, act: actAt(player.x) });
    if (parcelSeals === 0) {
      fail('parcel-seals');
      return;
    }
    emit(hazardIndex === null
      ? { type: 'traversal.fall', value: falls, act: actAt(player.x) }
      : { type: 'traversal.hazard', value: falls, hazardIndex, act: actAt(player.x) });
    placeAtCheckpoint();
  };

  const beginManualControl = (): void => {
    if (controlMode === 'manual') return;
    controlMode = 'manual';
    emit({ type: 'traversal.mode-change', value: attempt, controlMode, act: actAt(player.x) });
  };

  const retry = (): void => {
    attempt += 1;
    attemptTime = 0;
    jumps = 0;
    falls = 0;
    parcelSeals = MAX_PARCEL_SEALS;
    collectedSeal = false;
    checkpointIndex = 0;
    outcome = 'running';
    failureReason = null;
    stormWarningSent = false;
    effects.checkpoint = 0;
    effects.damage = 0;
    effects.delivery = 0;
    controlMode = 'manual';
    placeAtCheckpoint();
    emit({ type: 'traversal.retry', value: attempt, controlMode, act: 1 });
  };

  const update = (deltaSeconds: number, input: TraversalInput): void => {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
    time += dt;
    revision += 1;
    effects.checkpoint = Math.max(0, effects.checkpoint - dt * 1.8);
    effects.damage = Math.max(0, effects.damage - dt * 2.2);
    effects.delivery = Math.max(0, effects.delivery - dt * 0.7);
    damageCooldown = Math.max(0, damageCooldown - dt);
    player.squash = Math.max(0, player.squash - dt * 5.5);

    const horizontal = Number.isFinite(input.horizontal)
      ? Math.max(-1, Math.min(1, input.horizontal))
      : 0;
    const retryDown = input.retry === true;
    const retryPressed = retryDown && !retryWasDown;
    retryWasDown = retryDown;
    const playerRequestedControl = input.active === true || input.jump === true || input.retry === true;
    if (outcome !== 'running') {
      if (retryPressed) retry();
      updateParticles(dt);
      return;
    }

    if (playerRequestedControl) beginManualControl();
    if (controlMode === 'idle') {
      idleSeconds += dt;
      if (idleSeconds >= ATTRACT_DELAY_SECONDS) {
        controlMode = 'attract';
        emit({ type: 'traversal.mode-change', value: attempt, controlMode, act: actAt(player.x) });
      }
    }

    const attract = controlMode === 'attract'
      ? canonicalAttractCommand({ time, player, outcome })
      : null;
    const requestedHorizontal = attract?.horizontal ?? horizontal;
    const requestedJump = attract?.jump ?? input.jump === true;
    const braking = controlMode === 'manual' && input.brake === true;

    if (controlMode !== 'idle') {
      attemptTime += dt;
      if (!stormWarningSent && STORM_DURATION_SECONDS - attemptTime <= 15) {
        stormWarningSent = true;
        emit({ type: 'traversal.storm-warning', value: 15, act: actAt(player.x) });
      }
      if (attemptTime >= STORM_DURATION_SECONDS) {
        fail('storm');
        updateParticles(dt);
        return;
      }
    }

    const wasGrounded = player.grounded;
    coyoteTime = wasGrounded ? COYOTE_SECONDS : Math.max(0, coyoteTime - dt);
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    const jumpPressed = requestedJump && !jumpWasDown;
    jumpWasDown = requestedJump;
    if (jumpPressed) jumpBuffer = JUMP_BUFFER_SECONDS;

    let targetSpeed = 0;
    if (controlMode === 'attract') targetSpeed = ATTRACT_SPEED;
    if (controlMode === 'manual' && !braking && Math.abs(requestedHorizontal) > 0.01) {
      targetSpeed = Math.sign(requestedHorizontal)
        * (MANUAL_CRUISE_SPEED + MANUAL_SPRINT_BONUS * Math.abs(requestedHorizontal));
    }
    const acceleration = player.grounded ? 8.2 : 3.25;
    player.vx += (targetSpeed - player.vx) * Math.min(1, dt * acceleration);
    if (Math.abs(player.vx) > 0.12) player.facing = Math.sign(player.vx);

    if (jumpBuffer > 0 && coyoteTime > 0) {
      player.vy = JUMP_VELOCITY;
      player.grounded = false;
      coyoteTime = 0;
      jumpBuffer = 0;
      player.squash = 0.65;
      jumps += 1;
      spawnTrail(10, 0, 2.6);
      emit({ type: 'traversal.jump', value: jumps, act: actAt(player.x) });
    }

    const previousY = player.y;
    player.x = Math.max(0.2, player.x + player.vx * dt);
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    player.grounded = false;

    const previousBottom = previousY - RUNNER_RADIUS;
    const nextBottom = player.y - RUNNER_RADIUS;
    let landed: PlatformInstance | null = null;
    for (const platform of platformInstancesNear(player.x, time)) {
      const within = Math.abs(player.x - platform.x) <= platform.definition.width * 0.5 - 0.06;
      const crossed = previousBottom >= platform.top - 0.14 && nextBottom <= platform.top + 0.08;
      if (!within || !crossed || player.vy > 0) continue;
      if (landed === null || platform.top > landed.top) landed = platform;
    }
    if (landed !== null) {
      const impact = Math.min(1, Math.abs(player.vy) / 8);
      player.y = landed.top + RUNNER_RADIUS;
      player.vy = 0;
      player.grounded = true;
      player.squash = Math.max(player.squash, impact);
      if (!wasGrounded && impact > 0.15) {
        spawnTrail(6, landed.definition.accent, 1.6);
        emit({ type: 'traversal.land', platformIndex: landed.definitionIndex, value: jumps, act: landed.definition.act });
      }
    }

    const hazardIndex = COURSE_HAZARDS.findIndex((hazard) => (
      Math.abs(player.x - hazard.x) < hazard.width * 0.5 + RUNNER_RADIUS * 0.55
      && player.y - RUNNER_RADIUS < hazard.top + 0.34
      && player.y + RUNNER_RADIUS > hazard.top - 0.06
    ));
    if (hazardIndex >= 0) loseSeal(hazardIndex);
    else if (player.y < -4.2) loseSeal(null);

    while (
      checkpointIndex + 1 < COURSE_CHECKPOINTS.length
      && player.x >= COURSE_CHECKPOINTS[checkpointIndex + 1]!.x
    ) {
      checkpointIndex += 1;
      effects.checkpoint = 1;
      spawnTrail(18, 1, 3.2);
      emit({ type: 'traversal.checkpoint', value: checkpointIndex, checkpointIndex, act: actAt(player.x) });
    }

    if (!collectedSeal) {
      const collectible = COURSE_COLLECTIBLES[0]!;
      if (Math.hypot(player.x - collectible.x, player.y - collectible.y) < 0.72) {
        collectedSeal = true;
        parcelSeals = Math.min(MAX_PARCEL_SEALS, parcelSeals + 1);
        effects.checkpoint = 1;
        spawnTrail(24, 1, 3.8);
        emit({ type: 'traversal.seal-collected', value: parcelSeals, collectibleIndex: 0, act: collectible.act });
      }
    }

    if (outcome === 'running' && player.x >= DELIVERY_X) {
      outcome = 'delivered';
      player.vx = 0;
      player.vy = 0;
      effects.delivery = 1;
      spawnTrail(36, 1, 4.6);
      emit({ type: 'traversal.delivery', value: Math.round(attemptTime * 1000), act: 3 });
    }

    if (player.grounded && Math.abs(player.vx) > 1 && revision % 7 === 0) {
      spawnTrail(1, revision % 14 === 0 ? 1 : 0, 1.1);
    }
    updateParticles(dt);
  };

  const updateParticles = (dt: number): void => {
    trail.forEach((particle) => {
      if (particle.life <= 0) return;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy -= 2.8 * dt;
      if (particle.life <= 0) particle.y = -20;
    });
  };

  const snapshot = (copy: boolean): TraversalSnapshot => {
    const remainingTime = Math.max(0, STORM_DURATION_SECONDS - attemptTime);
    const state = {
      time,
      attemptTime,
      remainingTime,
      storm: 1 - remainingTime / STORM_DURATION_SECONDS,
      revision,
      resetSerial,
      attempt,
      distance: Math.max(0, Math.min(COURSE_LENGTH, player.x)),
      progress: Math.max(0, Math.min(1, player.x / DELIVERY_X)),
      act: actAt(player.x),
      controlMode,
      outcome,
      failureReason,
      checkpointIndex,
      parcelSeals,
      collectedSeal,
      jumps,
      falls,
      effects,
      player,
      trail,
    };
    if (!copy) return state;
    return Object.freeze({
      ...state,
      effects: Object.freeze({ ...effects }),
      player: Object.freeze({ ...player }),
      trail: Object.freeze(trail.map((particle) => Object.freeze({ ...particle }))),
    });
  };

  return Object.freeze({
    update,
    view: () => snapshot(false),
    read: () => snapshot(true),
    digest: () => [
      revision,
      attempt,
      outcome,
      controlMode,
      actAt(player.x),
      player.x.toFixed(3),
      player.y.toFixed(3),
      player.vx.toFixed(3),
      player.vy.toFixed(3),
      checkpointIndex,
      parcelSeals,
      collectedSeal ? 1 : 0,
      Math.max(0, STORM_DURATION_SECONDS - attemptTime).toFixed(3),
      jumps,
      falls,
    ].join(':'),
  });
}
