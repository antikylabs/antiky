export const ENEMY_COUNT = 9;
export const PROJECTILE_CAPACITY = 28;
export const PARTICLE_CAPACITY = 120;
const ARENA_RADIUS = 7.8;

export type CombatInput = Readonly<{
  movement: Readonly<{ x: number; z: number; active: boolean }>;
  aim: Readonly<{ x: number; z: number }>;
  attack: boolean;
}>;

export type CombatEvent = Readonly<{
  type: 'combat.projectile-fired' | 'combat.enemy-hit' | 'combat.enemy-defeated' | 'combat.dash';
  enemyIndex?: number;
  value: number;
}>;

export type CombatPlayer = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  facingX: number;
  facingZ: number;
  dash: number;
  dashCooldown: number;
};

export type CombatEnemy = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  health: number;
  hit: number;
  respawn: number;
  phase: number;
  kind: number;
  revision: number;
};

export type CombatProjectile = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  enemy: boolean;
};

export type CombatParticle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  color: number;
};

export type CombatSnapshot = Readonly<{
  time: number;
  revision: number;
  score: number;
  wave: number;
  shotsFired: number;
  dashes: number;
  player: Readonly<CombatPlayer>;
  enemies: readonly Readonly<CombatEnemy>[];
  projectiles: readonly Readonly<CombatProjectile>[];
  particles: readonly Readonly<CombatParticle>[];
}>;

export type CombatSimulation = Readonly<{
  update(deltaSeconds: number, input: CombatInput): void;
  view(): CombatSnapshot;
  read(): CombatSnapshot;
  digest(): string;
}>;

function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 91.71 + salt * 37.13) * 43758.5453;
  return value - Math.floor(value);
}

function clampToArena(point: { x: number; z: number }, radius = ARENA_RADIUS): void {
  const distance = Math.hypot(point.x, point.z);
  if (distance <= radius) return;
  const scale = radius / distance;
  point.x *= scale;
  point.z *= scale;
}

export function createCombatSimulation(emit: (event: CombatEvent) => void): CombatSimulation {
  const player: CombatPlayer = {
    x: 0,
    z: 1.5,
    vx: 0,
    vz: 0,
    facingX: 0,
    facingZ: -1,
    dash: 0,
    dashCooldown: 0,
  };
  const enemies: CombatEnemy[] = Array.from({ length: ENEMY_COUNT }, (_, index) => {
    const angle = index / ENEMY_COUNT * Math.PI * 2 - Math.PI / 2;
    const radius = index === 0 ? 4 : 4.4 + seeded(index, 1) * 2.1;
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      vx: 0,
      vz: 0,
      health: index % 3 === 0 ? 3 : 2,
      hit: 0,
      respawn: 0,
      phase: seeded(index, 2) * Math.PI * 2,
      kind: index % 3,
      revision: 1,
    };
  });
  const projectiles: CombatProjectile[] = Array.from(
    { length: PROJECTILE_CAPACITY },
    () => ({ x: 0, z: 0, vx: 0, vz: 0, life: 0, enemy: false }),
  );
  const particles: CombatParticle[] = Array.from(
    { length: PARTICLE_CAPACITY },
    () => ({ x: 0, y: -20, z: 0, vx: 0, vy: 0, vz: 0, life: 0, color: 0 }),
  );
  let time = 0;
  let revision = 1;
  let fireCooldown = 0.08;
  let projectileCursor = 0;
  let particleCursor = 0;
  let shotsFired = 0;
  let dashes = 0;
  let score = 0;
  let wave = 1;
  let defeatedThisWave = 0;
  const liveView = Object.freeze({
    get time() { return time; },
    get revision() { return revision; },
    get score() { return score; },
    get wave() { return wave; },
    get shotsFired() { return shotsFired; },
    get dashes() { return dashes; },
    player,
    enemies,
    projectiles,
    particles,
  });

  const burst = (x: number, z: number, color: number, count: number, force: number): void => {
    for (let burstIndex = 0; burstIndex < count; burstIndex += 1) {
      const particle = particles[particleCursor]!;
      particleCursor = (particleCursor + 1) % particles.length;
      const angle = seeded(revision + burstIndex, color + 4) * Math.PI * 2;
      const speed = force * (0.45 + seeded(revision + burstIndex, color + 7));
      particle.x = x;
      particle.y = 0.42 + seeded(revision + burstIndex, color + 9) * 0.45;
      particle.z = z;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = 1.2 + seeded(revision + burstIndex, color + 11) * force;
      particle.vz = Math.sin(angle) * speed;
      particle.life = 0.48 + seeded(revision + burstIndex, color + 13) * 0.42;
      particle.color = color;
    }
  };

  const nearestEnemy = (): { enemy: CombatEnemy; index: number } | null => {
    let nearest: { enemy: CombatEnemy; index: number } | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    enemies.forEach((enemy, index) => {
      if (enemy.respawn > 0) return;
      const distance = Math.hypot(enemy.x - player.x, enemy.z - player.z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { enemy, index };
      }
    });
    return nearest;
  };

  const fire = (): void => {
    const target = nearestEnemy();
    if (target === null) return;
    const dx = target.enemy.x - player.x;
    const dz = target.enemy.z - player.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const projectile = projectiles[projectileCursor]!;
    projectileCursor = (projectileCursor + 1) % projectiles.length;
    projectile.x = player.x + dx / length * 0.65;
    projectile.z = player.z + dz / length * 0.65;
    projectile.vx = dx / length * 12.5;
    projectile.vz = dz / length * 12.5;
    projectile.life = 1.15;
    projectile.enemy = false;
    player.facingX = dx / length;
    player.facingZ = dz / length;
    shotsFired += 1;
    emit({ type: 'combat.projectile-fired', enemyIndex: target.index, value: shotsFired });
  };

  const respawnEnemy = (enemy: CombatEnemy, index: number): void => {
    const angle = time * 0.18 + index / ENEMY_COUNT * Math.PI * 2;
    const radius = 6.1 + seeded(revision, index + 30) * 0.9;
    enemy.x = Math.cos(angle) * radius;
    enemy.z = Math.sin(angle) * radius;
    enemy.vx = 0;
    enemy.vz = 0;
    enemy.health = 2 + (enemy.kind === 0 ? 1 : 0) + Math.min(2, Math.floor(wave / 3));
    enemy.hit = 0;
    enemy.respawn = 0;
    enemy.revision += 1;
  };

  const update = (deltaSeconds: number, input: CombatInput): void => {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
    time += dt;
    revision += 1;
    fireCooldown -= dt;
    player.dash = Math.max(0, player.dash - dt * 3.8);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);

    const moveX = input.movement.active && Number.isFinite(input.movement.x)
      ? input.movement.x
      : 0;
    const moveZ = input.movement.active && Number.isFinite(input.movement.z)
      ? input.movement.z
      : 0;
    const acceleration = player.dash > 0 ? 28 : 16;
    player.vx += moveX * acceleration * dt;
    player.vz += moveZ * acceleration * dt;
    const damping = Math.exp(-(player.dash > 0 ? 1.8 : 7.5) * dt);
    player.vx *= damping;
    player.vz *= damping;

    if (input.attack && player.dashCooldown <= 0) {
      const aimLength = Math.hypot(input.aim.x, input.aim.z);
      const dashX = aimLength > 0.01 ? input.aim.x / aimLength : player.facingX;
      const dashZ = aimLength > 0.01 ? input.aim.z / aimLength : player.facingZ;
      player.vx += dashX * 11.5;
      player.vz += dashZ * 11.5;
      player.facingX = dashX;
      player.facingZ = dashZ;
      player.dash = 1;
      player.dashCooldown = 0.72;
      dashes += 1;
      burst(player.x, player.z, 0, 18, 3.5);
      emit({ type: 'combat.dash', value: dashes });
    }

    player.x += player.vx * dt;
    player.z += player.vz * dt;
    clampToArena(player);

    if (fireCooldown <= 0) {
      fire();
      fireCooldown += 0.38;
    }

    enemies.forEach((enemy, index) => {
      enemy.hit = Math.max(0, enemy.hit - dt * 4.2);
      if (enemy.respawn > 0) {
        enemy.respawn -= dt;
        if (enemy.respawn <= 0) respawnEnemy(enemy, index);
        return;
      }
      const dx = player.x - enemy.x;
      const dz = player.z - enemy.z;
      const distance = Math.max(0.1, Math.hypot(dx, dz));
      const tangentX = -dz / distance;
      const tangentZ = dx / distance;
      const desiredRadius = 3.2 + enemy.kind * 0.65;
      const radial = (distance - desiredRadius) * 0.9;
      const orbit = 1.4 + enemy.kind * 0.35;
      enemy.vx += (dx / distance * radial + tangentX * orbit - enemy.vx * 2.8) * dt;
      enemy.vz += (dz / distance * radial + tangentZ * orbit - enemy.vz * 2.8) * dt;
      enemy.x += enemy.vx * dt;
      enemy.z += enemy.vz * dt;
      clampToArena(enemy, 7.25);
    });

    projectiles.forEach((projectile) => {
      if (projectile.life <= 0) return;
      projectile.life -= dt;
      projectile.x += projectile.vx * dt;
      projectile.z += projectile.vz * dt;
      if (projectile.life <= 0 || Math.hypot(projectile.x, projectile.z) > 9.5) {
        projectile.life = 0;
        return;
      }
      for (let enemyIndex = 0; enemyIndex < enemies.length; enemyIndex += 1) {
        const enemy = enemies[enemyIndex]!;
        if (enemy.respawn > 0) continue;
        const radius = 0.72 + enemy.kind * 0.08;
        if (Math.hypot(projectile.x - enemy.x, projectile.z - enemy.z) > radius) continue;
        projectile.life = 0;
        enemy.health -= 1;
        enemy.hit = 1;
        enemy.revision += 1;
        burst(enemy.x, enemy.z, enemy.kind + 1, enemy.health <= 0 ? 30 : 12, enemy.health <= 0 ? 5.5 : 3);
        emit({ type: 'combat.enemy-hit', enemyIndex, value: enemy.health });
        if (enemy.health <= 0) {
          enemy.respawn = 1.15;
          score += 100 * wave;
          defeatedThisWave += 1;
          emit({ type: 'combat.enemy-defeated', enemyIndex, value: score });
          if (defeatedThisWave >= ENEMY_COUNT) {
            wave += 1;
            defeatedThisWave = 0;
          }
        }
        break;
      }
    });

    particles.forEach((particle) => {
      if (particle.life <= 0) return;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      particle.vy -= 5.5 * dt;
      particle.vx *= Math.exp(-1.8 * dt);
      particle.vz *= Math.exp(-1.8 * dt);
      if (particle.life <= 0) particle.y = -20;
    });
  };

  const read = (): CombatSnapshot => Object.freeze({
    time,
    revision,
    score,
    wave,
    shotsFired,
    dashes,
    player: Object.freeze({ ...player }),
    enemies: Object.freeze(enemies.map((enemy) => Object.freeze({ ...enemy }))),
    projectiles: Object.freeze(projectiles.map((projectile) => Object.freeze({ ...projectile }))),
    particles: Object.freeze(particles.map((particle) => Object.freeze({ ...particle }))),
  });

  return Object.freeze({
    update,
    view: () => liveView,
    read,
    digest: () => [
      revision,
      player.x.toFixed(3),
      player.z.toFixed(3),
      score,
      wave,
      enemies.filter((enemy) => enemy.respawn <= 0).length,
      projectiles.filter((projectile) => projectile.life > 0).length,
    ].join(':'),
  });
}
