export const ENEMY_COUNT = 6;
export const PROJECTILE_CAPACITY = 36;
export const PARTICLE_CAPACITY = 144;
export const ARENA_RADIUS = 7.8;
export const DASH_COST = 32;
export const MAX_ROUNDS = 3;
export const DASH_DURATION = 0.2;
export const INTRO_DURATION = 0.85;
export const CLEAR_DURATION = 1.05;

export type CombatPhase = 'intro' | 'combat' | 'clear' | 'victory' | 'defeat';
export type EnemyRole = 'rusher' | 'gunner' | 'shield-anchor' | 'warden';
export type EnemyState =
  | 'inactive'
  | 'entry'
  | 'tracking'
  | 'telegraph'
  | 'attack'
  | 'recovery'
  | 'staggered'
  | 'defeated';
export type ProjectileKind = 'cannon' | 'hostile' | 'deflected';

export type CombatInput = Readonly<{
  movement: Readonly<{ x: number; z: number; active: boolean }>;
  aim: Readonly<{ x: number; z: number }>;
  attack: boolean;
}>;

export type CombatEvent = Readonly<{
  type:
    | 'combat.phase'
    | 'combat.round-started'
    | 'combat.round-cleared'
    | 'combat.cannon-fired'
    | 'combat.enemy-marked'
    | 'combat.dash'
    | 'combat.dash-hit'
    | 'combat.projectile-deflected'
    | 'combat.enemy-damaged'
    | 'combat.enemy-defeated'
    | 'combat.player-damaged'
    | 'combat.defeat'
    | 'combat.retry'
    | 'combat.victory';
  enemyIndex?: number;
  value: number;
  round?: number;
  phase?: CombatPhase;
  role?: EnemyRole;
  source?: 'cannon' | 'blade' | 'bolt' | 'charge' | 'deflection';
  simulationTime: number;
  simulationRevision: number;
}>;

export type CombatPlayer = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  facingX: number;
  facingZ: number;
  hull: number;
  maxHull: number;
  drive: number;
  maxDrive: number;
  dash: number;
  dashCooldown: number;
  invulnerable: number;
  attackHeld: boolean;
  revision: number;
};

export type CombatEnemy = {
  active: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  hull: number;
  maxHull: number;
  shield: number;
  mark: number;
  stagger: number;
  hit: number;
  state: EnemyState;
  stateTime: number;
  cooldown: number;
  role: EnemyRole;
  kind: number;
  phase: number;
  pattern: number;
  lastDash: number;
  revision: number;
};

export type CombatProjectile = {
  x: number;
  z: number;
  previousX: number;
  previousZ: number;
  vx: number;
  vz: number;
  life: number;
  enemy: boolean;
  kind: ProjectileKind;
  ownerIndex: number;
};

export type CombatParticle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  /** What `life` started at, so presentation can compute age rather than guess it. */
  maxLife: number;
  color: number;
};

export type CombatSnapshot = Readonly<{
  time: number;
  revision: number;
  phase: CombatPhase;
  phaseTime: number;
  round: number;
  maxRounds: number;
  score: number;
  combo: number;
  shotsFired: number;
  dashes: number;
  deflections: number;
  damageTaken: number;
  impact: number;
  fireCooldown: number;
  dashSequence: number;
  pendingVictory: boolean;
  projectileCursor: number;
  particleCursor: number;
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

type RoundEnemy = Readonly<{
  role: EnemyRole;
  x: number;
  z: number;
  hull: number;
  shield?: number;
}>;

export const ROUND_DEFINITIONS: readonly (readonly RoundEnemy[])[] = Object.freeze([
  Object.freeze([
    Object.freeze({ role: 'rusher', x: 0, z: -4.3, hull: 1 }),
    Object.freeze({ role: 'rusher', x: 4.6, z: 0.2, hull: 1 }),
  ]),
  Object.freeze([
    Object.freeze({ role: 'rusher', x: -4.5, z: -0.5, hull: 1 }),
    Object.freeze({ role: 'gunner', x: 0.3, z: -5.5, hull: 1 }),
    Object.freeze({ role: 'shield-anchor', x: 4.7, z: 1.2, hull: 2, shield: 1 }),
  ]),
  Object.freeze([
    Object.freeze({ role: 'warden', x: 0, z: -4.8, hull: 4, shield: 1 }),
  ]),
]);

export function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 91.71 + salt * 37.13) * 43758.5453;
  return value - Math.floor(value);
}

export function clampToArena(point: { x: number; z: number }, radius = ARENA_RADIUS): void {
  const distance = Math.hypot(point.x, point.z);
  if (distance <= radius) return;
  const scale = radius / distance;
  point.x *= scale;
  point.z *= scale;
}

export function segmentDistanceSquared(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  px: number,
  pz: number,
): number {
  const abX = bx - ax;
  const abZ = bz - az;
  const denominator = abX * abX + abZ * abZ;
  const projection = denominator <= 0.000001
    ? 0
    : Math.max(0, Math.min(1, ((px - ax) * abX + (pz - az) * abZ) / denominator));
  const dx = ax + abX * projection - px;
  const dz = az + abZ * projection - pz;
  return dx * dx + dz * dz;
}

export function normalized(x: number, z: number, fallbackX = 0, fallbackZ = -1): [number, number] {
  const length = Math.hypot(x, z);
  return length > 0.001 ? [x / length, z / length] : [fallbackX, fallbackZ];
}

export function roleKind(role: EnemyRole): number {
  if (role === 'rusher') return 0;
  if (role === 'gunner') return 1;
  if (role === 'shield-anchor') return 2;
  return 3;
}

export function createCombatStatePools(): Readonly<{
  player: CombatPlayer;
  enemies: CombatEnemy[];
  projectiles: CombatProjectile[];
  particles: CombatParticle[];
}> {
  const player: CombatPlayer = {
    x: 0,
    z: 1.5,
    vx: 0,
    vz: 0,
    facingX: 0,
    facingZ: -1,
    hull: 3,
    maxHull: 3,
    drive: 100,
    maxDrive: 100,
    dash: 0,
    dashCooldown: 0,
    invulnerable: 0,
    attackHeld: false,
    revision: 1,
  };
  const enemies: CombatEnemy[] = Array.from({ length: ENEMY_COUNT }, (_, index) => ({
    active: false,
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    hull: 0,
    maxHull: 0,
    shield: 0,
    mark: 0,
    stagger: 0,
    hit: 0,
    state: 'inactive',
    stateTime: 0,
    cooldown: 0,
    role: 'rusher',
    kind: 0,
    phase: seeded(index, 2) * Math.PI * 2,
    pattern: 0,
    lastDash: -1,
    revision: 1,
  }));
  const projectiles: CombatProjectile[] = Array.from({ length: PROJECTILE_CAPACITY }, () => ({
    x: 0,
    z: 0,
    previousX: 0,
    previousZ: 0,
    vx: 0,
    vz: 0,
    life: 0,
    enemy: false,
    kind: 'cannon',
    ownerIndex: -1,
  }));
  const particles: CombatParticle[] = Array.from({ length: PARTICLE_CAPACITY }, () => ({
    x: 0,
    y: -20,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 0,
    color: 0,
  }));
  return Object.freeze({ player, enemies, projectiles, particles });
}
