export const COURSE_LENGTH = 36;
export const RUNNER_RADIUS = 0.43;
export const TRAIL_CAPACITY = 72;

export type TraversalInput = Readonly<{
  horizontal: number;
  active: boolean;
  jump: boolean;
}>;

export type TraversalEvent = Readonly<{
  type: 'traversal.jump' | 'traversal.land' | 'traversal.fall' | 'traversal.checkpoint';
  value: number;
  platformIndex?: number;
}>;

export type PlatformDefinition = Readonly<{
  x: number;
  top: number;
  width: number;
  amplitude: number;
  speed: number;
  phase: number;
  accent: number;
}>;

export const COURSE_PLATFORMS: readonly PlatformDefinition[] = Object.freeze([
  { x: 0, top: 0, width: 7, amplitude: 0, speed: 0, phase: 0, accent: 0 },
  { x: 6.1, top: 0.85, width: 3.2, amplitude: 0, speed: 0, phase: 0.4, accent: 1 },
  { x: 10.4, top: 1.7, width: 3, amplitude: 0.48, speed: 1.15, phase: 1.1, accent: 2 },
  { x: 14.8, top: 1.05, width: 3.6, amplitude: 0, speed: 0, phase: 2.2, accent: 0 },
  { x: 19.6, top: 2.25, width: 3.15, amplitude: 0, speed: 0, phase: 0.8, accent: 1 },
  { x: 24.1, top: 1.35, width: 4, amplitude: 0.62, speed: 0.9, phase: 2.6, accent: 2 },
  { x: 29.1, top: 2.8, width: 3.2, amplitude: 0, speed: 0, phase: 1.7, accent: 0 },
  { x: 34.1, top: 1.1, width: 5, amplitude: 0, speed: 0, phase: 0.1, accent: 1 },
]);

export const COURSE_HAZARDS = Object.freeze([
  { x: 7.25, top: 0.85 },
  { x: 20.8, top: 2.25 },
  { x: 30.05, top: 2.8 },
]);

export type PlatformInstance = Readonly<{
  definition: PlatformDefinition;
  definitionIndex: number;
  lap: number;
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
  revision: number;
  distance: number;
  laps: number;
  jumps: number;
  falls: number;
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

export function platformTop(definition: PlatformDefinition, time: number): number {
  return definition.top + Math.sin(time * definition.speed + definition.phase) * definition.amplitude;
}

export function platformInstancesNear(x: number, time: number): readonly PlatformInstance[] {
  const lap = Math.floor(x / COURSE_LENGTH);
  const instances: PlatformInstance[] = [];
  for (let lapOffset = -1; lapOffset <= 1; lapOffset += 1) {
    COURSE_PLATFORMS.forEach((definition, definitionIndex) => {
      const instanceLap = lap + lapOffset;
      instances.push(Object.freeze({
        definition,
        definitionIndex,
        lap: instanceLap,
        x: definition.x + instanceLap * COURSE_LENGTH,
        top: platformTop(definition, time),
      }));
    });
  }
  return Object.freeze(instances);
}

function supportAt(x: number, y: number, time: number): PlatformInstance | null {
  let support: PlatformInstance | null = null;
  for (const platform of platformInstancesNear(x, time)) {
    const within = Math.abs(x - platform.x) <= platform.definition.width * 0.5 - 0.05;
    if (!within || platform.top > y + 0.12) continue;
    if (support === null || platform.top > support.top) support = platform;
  }
  return support;
}

function seed(index: number, salt: number): number {
  const value = Math.sin(index * 73.91 + salt * 19.37) * 41758.31;
  return value - Math.floor(value);
}

export function createTraversalSimulation(
  emit: (event: TraversalEvent) => void,
): TraversalSimulation {
  const player = {
    x: 0,
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
  let time = 0;
  let revision = 1;
  let jumps = 0;
  let falls = 0;
  let laps = 0;
  let trailCursor = 0;
  let previousLap = 0;
  let jumpWasDown = false;
  let coyoteTime = 0.1;

  const spawnTrail = (count: number, color: number, force: number): void => {
    for (let index = 0; index < count; index += 1) {
      const particle = trail[trailCursor]!;
      trailCursor = (trailCursor + 1) % trail.length;
      particle.x = player.x - player.facing * 0.3;
      particle.y = player.y - RUNNER_RADIUS * 0.7;
      particle.vx = -player.facing * (0.8 + seed(revision + index, 2) * force);
      particle.vy = 0.5 + seed(revision + index, 3) * force;
      particle.life = 0.32 + seed(revision + index, 4) * 0.38;
      particle.color = color;
    }
  };

  const resetAtCheckpoint = (): void => {
    const lap = Math.floor(player.x / COURSE_LENGTH);
    const local = player.x - lap * COURSE_LENGTH;
    const checkpoint = local >= 18 ? 19.6 : 0;
    player.x = lap * COURSE_LENGTH + checkpoint;
    const platform = supportAt(player.x, 10, time);
    player.y = (platform?.top ?? 0) + RUNNER_RADIUS;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.squash = 1;
    falls += 1;
    spawnTrail(24, 2, 4.5);
    emit({ type: 'traversal.fall', value: falls });
  };

  const shouldAutoJump = (): boolean => {
    if (!player.grounded || player.vx < 0.5) return false;
    const support = supportAt(player.x, player.y, time);
    if (support === null) return false;
    const rightEdge = support.x + support.definition.width * 0.5;
    return rightEdge - player.x < 1.2 + Math.min(0.45, player.vx * 0.05);
  };

  const update = (deltaSeconds: number, input: TraversalInput): void => {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
    time += dt;
    revision += 1;
    player.squash = Math.max(0, player.squash - dt * 5.5);
    coyoteTime = player.grounded ? 0.1 : Math.max(0, coyoteTime - dt);

    const requested = input.active ? Math.max(-1, Math.min(1, input.horizontal)) : 1;
    const targetSpeed = requested * (input.active ? 5.6 : 4.35);
    player.vx += (targetSpeed - player.vx) * Math.min(1, dt * (player.grounded ? 8.5 : 3.4));
    if (Math.abs(player.vx) > 0.12) player.facing = Math.sign(player.vx);

    const jumpPressed = input.jump && !jumpWasDown;
    jumpWasDown = input.jump;
    if ((jumpPressed || shouldAutoJump()) && coyoteTime > 0) {
      player.vy = 7.45;
      player.grounded = false;
      coyoteTime = 0;
      player.squash = 0.7;
      jumps += 1;
      spawnTrail(10, 0, 2.8);
      emit({ type: 'traversal.jump', value: jumps });
    }

    const previousY = player.y;
    player.x += player.vx * dt;
    player.vy -= 17.5 * dt;
    player.y += player.vy * dt;
    player.grounded = false;

    const previousBottom = previousY - RUNNER_RADIUS;
    const nextBottom = player.y - RUNNER_RADIUS;
    let landed: PlatformInstance | null = null;
    for (const platform of platformInstancesNear(player.x, time)) {
      const within = Math.abs(player.x - platform.x) <= platform.definition.width * 0.5 - 0.06;
      const crossed = previousBottom >= platform.top - 0.12 && nextBottom <= platform.top + 0.06;
      if (!within || !crossed || player.vy > 0) continue;
      if (landed === null || platform.top > landed.top) landed = platform;
    }
    if (landed !== null) {
      const impact = Math.min(1, Math.abs(player.vy) / 8);
      player.y = landed.top + RUNNER_RADIUS;
      player.vy = 0;
      player.grounded = true;
      player.squash = Math.max(player.squash, impact);
      if (impact > 0.18) {
        spawnTrail(6, landed.definition.accent, 1.8);
        emit({ type: 'traversal.land', platformIndex: landed.definitionIndex, value: jumps });
      }
    }

    const localX = ((player.x % COURSE_LENGTH) + COURSE_LENGTH) % COURSE_LENGTH;
    const touchingHazard = COURSE_HAZARDS.some((hazard) => (
      Math.abs(localX - hazard.x) < 0.42
      && player.y - RUNNER_RADIUS < hazard.top + 0.68
      && player.y + RUNNER_RADIUS > hazard.top - 0.08
    ));
    if (touchingHazard || player.y < -4.2) resetAtCheckpoint();

    const currentLap = Math.floor(player.x / COURSE_LENGTH);
    if (currentLap > previousLap) {
      laps = currentLap;
      previousLap = currentLap;
      spawnTrail(20, 1, 3.8);
      emit({ type: 'traversal.checkpoint', value: laps });
    }

    if (player.grounded && Math.abs(player.vx) > 1 && revision % 5 === 0) {
      spawnTrail(1, revision % 10 === 0 ? 1 : 0, 1.2);
    }
    trail.forEach((particle) => {
      if (particle.life <= 0) return;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy -= 2.8 * dt;
      if (particle.life <= 0) particle.y = -20;
    });
  };

  const liveView = Object.freeze({
    get time() { return time; },
    get revision() { return revision; },
    get distance() { return Math.max(0, player.x); },
    get laps() { return laps; },
    get jumps() { return jumps; },
    get falls() { return falls; },
    player,
    trail,
  });
  const read = (): TraversalSnapshot => Object.freeze({
    time,
    revision,
    distance: Math.max(0, player.x),
    laps,
    jumps,
    falls,
    player: Object.freeze({ ...player }),
    trail: Object.freeze(trail.map((particle) => Object.freeze({ ...particle }))),
  });

  return Object.freeze({
    update,
    view: () => liveView,
    read,
    digest: () => [
      revision,
      player.x.toFixed(3),
      player.y.toFixed(3),
      player.vx.toFixed(3),
      player.vy.toFixed(3),
      jumps,
      falls,
    ].join(':'),
  });
}
