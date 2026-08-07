/**
 * Deterministic, fixed-step character movement for height-field / voxel worlds.
 *
 * Positions are expressed in metres. `position.y` is always the character's
 * foot height; the collision shape extends upward by `height`. Horizontal
 * collision is a continuous swept circle, which is the XZ projection of a
 * vertical capsule/cylinder.
 */

export type ColliderId = string | number;

export type Vec2 = {
  x: number;
  z: number;
};

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type QueryBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

/** Axis-aligned world collider. Omit Y bounds for an infinitely tall blocker. */
export type CharacterCollider = {
  id: ColliderId;
  minX: number;
  maxX: number;
  minY?: number;
  maxY?: number;
  minZ: number;
  maxZ: number;
  enabled?: boolean;
  /** Collision bit. Defaults to all bits. */
  layer?: number;
  /** Whether the finite top face can be returned by ground probes. */
  supportsGround?: boolean;
  /** Velocity of a moving support, in metres per fixed second. */
  velocity?: Readonly<Vec3>;
  userData?: unknown;
};

export type GroundSampleRequest = {
  x: number;
  z: number;
  radius: number;
  minHeight: number;
  maxHeight: number;
  mask: number;
};

export type GroundSurface = {
  id: ColliderId;
  height: number;
  normal?: Readonly<Vec3>;
  velocity?: Readonly<Vec3>;
  userData?: unknown;
};

/**
 * Broadphase / terrain adapter supplied by the game. Results may be in any
 * order: CharacterQueryWorld applies stable ordering before resolving them.
 */
export interface CharacterWorldAdapter {
  queryColliders(bounds: Readonly<QueryBounds>): Iterable<Readonly<CharacterCollider>>;
  sampleGround?(
    request: Readonly<GroundSampleRequest>,
  ): Readonly<GroundSurface> | readonly Readonly<GroundSurface>[] | null;
}

export type CapsuleSweep = {
  start: Readonly<Vec3>;
  delta: Readonly<Vec2>;
  radius: number;
  height: number;
  mask?: number;
};

export type CapsuleOverlap = {
  position: Readonly<Vec3>;
  radius: number;
  height: number;
  mask?: number;
};

export type GroundProbe = {
  position: Readonly<Vec3>;
  radius: number;
  upDistance: number;
  downDistance: number;
  mask?: number;
};

export type SweepHit = {
  time: number;
  distance: number;
  position: Vec3;
  point: Vec3;
  normal: Vec3;
  colliderId: ColliderId;
  collider: Readonly<CharacterCollider>;
  startPenetrating: boolean;
};

export type PenetrationHit = {
  depth: number;
  normal: Vec3;
  colliderId: ColliderId;
  collider: Readonly<CharacterCollider>;
};

export type GroundHit = {
  height: number;
  distance: number;
  normal: Vec3;
  supportId: ColliderId;
  velocity: Vec3;
  userData?: unknown;
};

/** The motor depends only on this interface, not on a particular world layout. */
export interface CharacterPhysicsWorld {
  sweepCapsule(query: Readonly<CapsuleSweep>): SweepHit | null;
  overlapCapsule(query: Readonly<CapsuleOverlap>): readonly PenetrationHit[];
  probeGround(query: Readonly<GroundProbe>): GroundHit | null;
}

const EPSILON = 1e-9;
const CONTACT_EPSILON = 1e-7;
const ALL_LAYERS = 0xffff_ffff;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function length2(x: number, z: number): number {
  return Math.hypot(x, z);
}

function colliderMinY(collider: Readonly<CharacterCollider>): number {
  return collider.minY ?? Number.NEGATIVE_INFINITY;
}

function colliderMaxY(collider: Readonly<CharacterCollider>): number {
  return collider.maxY ?? Number.POSITIVE_INFINITY;
}

function colliderLayer(collider: Readonly<CharacterCollider>): number {
  return collider.layer ?? ALL_LAYERS;
}

function layersOverlap(layer: number, mask: number): boolean {
  return ((layer >>> 0) & (mask >>> 0)) !== 0;
}

function stableId(id: ColliderId): string {
  return `${typeof id === 'number' ? '0' : '1'}:${String(id)}`;
}

function compareColliderIds(a: ColliderId, b: ColliderId): number {
  const left = stableId(a);
  const right = stableId(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

function isColliderValid(collider: Readonly<CharacterCollider>): boolean {
  return collider.enabled !== false
    && Number.isFinite(collider.minX)
    && Number.isFinite(collider.maxX)
    && Number.isFinite(collider.minZ)
    && Number.isFinite(collider.maxZ)
    && collider.minX <= collider.maxX
    && collider.minZ <= collider.maxZ
    && colliderMinY(collider) <= colliderMaxY(collider);
}

function overlapsVertical(
  footY: number,
  height: number,
  collider: Readonly<CharacterCollider>,
): boolean {
  const minY = colliderMinY(collider);
  const maxY = colliderMaxY(collider);
  // Exact contact with a top face is support, not horizontal penetration.
  return footY < maxY - CONTACT_EPSILON && footY + height > minY + CONTACT_EPSILON;
}

function circleTouchesRect(
  x: number,
  z: number,
  radius: number,
  collider: Readonly<CharacterCollider>,
): boolean {
  const closestX = clamp(x, collider.minX, collider.maxX);
  const closestZ = clamp(z, collider.minZ, collider.maxZ);
  const dx = x - closestX;
  const dz = z - closestZ;
  return dx * dx + dz * dz <= radius * radius + EPSILON;
}

function circlePenetration(
  x: number,
  z: number,
  radius: number,
  collider: Readonly<CharacterCollider>,
): { depth: number; normalX: number; normalZ: number } | null {
  const closestX = clamp(x, collider.minX, collider.maxX);
  const closestZ = clamp(z, collider.minZ, collider.maxZ);
  const dx = x - closestX;
  const dz = z - closestZ;
  const distanceSquared = dx * dx + dz * dz;

  if (distanceSquared > EPSILON) {
    const distance = Math.sqrt(distanceSquared);
    const depth = radius - distance;
    if (depth <= CONTACT_EPSILON) return null;
    return { depth, normalX: dx / distance, normalZ: dz / distance };
  }

  // The centre lies inside/on the rectangle. Select the nearest face with a
  // fixed tie order so recovery never depends on container iteration order.
  const faces = [
    { distance: x - collider.minX, normalX: -1, normalZ: 0 },
    { distance: collider.maxX - x, normalX: 1, normalZ: 0 },
    { distance: z - collider.minZ, normalX: 0, normalZ: -1 },
    { distance: collider.maxZ - z, normalX: 0, normalZ: 1 },
  ];
  let nearest = faces[0]!;
  for (let index = 1; index < faces.length; index += 1) {
    const face = faces[index]!;
    if (face.distance < nearest.distance) nearest = face;
  }
  return {
    depth: radius + Math.max(0, nearest.distance),
    normalX: nearest.normalX,
    normalZ: nearest.normalZ,
  };
}

type HorizontalSweep = {
  time: number;
  normalX: number;
  normalZ: number;
  startPenetrating: boolean;
};

function sweepCircleAgainstRect(
  startX: number,
  startZ: number,
  deltaX: number,
  deltaZ: number,
  radius: number,
  collider: Readonly<CharacterCollider>,
): HorizontalSweep | null {
  const penetration = circlePenetration(startX, startZ, radius, collider);
  if (penetration) {
    return {
      time: 0,
      normalX: penetration.normalX,
      normalZ: penetration.normalZ,
      startPenetrating: true,
    };
  }

  const candidates: HorizontalSweep[] = [];
  const addFace = (time: number, normalX: number, normalZ: number, along: number, min: number, max: number) => {
    if (time < -CONTACT_EPSILON || time > 1 + CONTACT_EPSILON) return;
    if (along < min - CONTACT_EPSILON || along > max + CONTACT_EPSILON) return;
    if (deltaX * normalX + deltaZ * normalZ >= -EPSILON) return;
    candidates.push({ time: clamp(time, 0, 1), normalX, normalZ, startPenetrating: false });
  };

  if (deltaX > EPSILON) {
    const time = (collider.minX - radius - startX) / deltaX;
    addFace(time, -1, 0, startZ + deltaZ * time, collider.minZ, collider.maxZ);
  } else if (deltaX < -EPSILON) {
    const time = (collider.maxX + radius - startX) / deltaX;
    addFace(time, 1, 0, startZ + deltaZ * time, collider.minZ, collider.maxZ);
  }

  if (deltaZ > EPSILON) {
    const time = (collider.minZ - radius - startZ) / deltaZ;
    addFace(time, 0, -1, startX + deltaX * time, collider.minX, collider.maxX);
  } else if (deltaZ < -EPSILON) {
    const time = (collider.maxZ + radius - startZ) / deltaZ;
    addFace(time, 0, 1, startX + deltaX * time, collider.minX, collider.maxX);
  }

  const a = deltaX * deltaX + deltaZ * deltaZ;
  if (a > EPSILON) {
    const corners = [
      { x: collider.minX, z: collider.minZ, sideX: -1, sideZ: -1 },
      { x: collider.minX, z: collider.maxZ, sideX: -1, sideZ: 1 },
      { x: collider.maxX, z: collider.minZ, sideX: 1, sideZ: -1 },
      { x: collider.maxX, z: collider.maxZ, sideX: 1, sideZ: 1 },
    ];

    for (const corner of corners) {
      const offsetX = startX - corner.x;
      const offsetZ = startZ - corner.z;
      const b = 2 * (offsetX * deltaX + offsetZ * deltaZ);
      const c = offsetX * offsetX + offsetZ * offsetZ - radius * radius;
      const discriminant = b * b - 4 * a * c;
      if (discriminant < -EPSILON) continue;
      const root = (-b - Math.sqrt(Math.max(0, discriminant))) / (2 * a);
      if (root < -CONTACT_EPSILON || root > 1 + CONTACT_EPSILON) continue;
      const time = clamp(root, 0, 1);
      const x = startX + deltaX * time;
      const z = startZ + deltaZ * time;
      if (corner.sideX < 0 ? x > corner.x + CONTACT_EPSILON : x < corner.x - CONTACT_EPSILON) continue;
      if (corner.sideZ < 0 ? z > corner.z + CONTACT_EPSILON : z < corner.z - CONTACT_EPSILON) continue;
      const normalLength = length2(x - corner.x, z - corner.z);
      if (normalLength <= EPSILON) continue;
      const normalX = (x - corner.x) / normalLength;
      const normalZ = (z - corner.z) / normalLength;
      if (deltaX * normalX + deltaZ * normalZ >= -EPSILON) continue;
      candidates.push({ time, normalX, normalZ, startPenetrating: false });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((left, right) => {
    if (Math.abs(left.time - right.time) > EPSILON) return left.time - right.time;
    if (left.normalX !== right.normalX) return left.normalX - right.normalX;
    return left.normalZ - right.normalZ;
  });
  return candidates[0]!;
}

function normaliseGroundNormal(normal: Readonly<Vec3> | undefined): Vec3 {
  if (!normal) return { x: 0, y: 1, z: 0 };
  const magnitude = Math.hypot(normal.x, normal.y, normal.z);
  if (!Number.isFinite(magnitude) || magnitude <= EPSILON) return { x: 0, y: 1, z: 0 };
  return { x: normal.x / magnitude, y: normal.y / magnitude, z: normal.z / magnitude };
}

function normaliseVelocity(velocity: Readonly<Vec3> | undefined): Vec3 {
  if (!velocity) return { x: 0, y: 0, z: 0 };
  return {
    x: Number.isFinite(velocity.x) ? velocity.x : 0,
    y: Number.isFinite(velocity.y) ? velocity.y : 0,
    z: Number.isFinite(velocity.z) ? velocity.z : 0,
  };
}

/**
 * Narrowphase implementation for adapters that expose AABBs and ground
 * samples. Sweeps use face + rounded-corner tests, so diagonal motion does not
 * get the false corner hits produced by merely expanding an AABB.
 */
export class CharacterQueryWorld implements CharacterPhysicsWorld {
  readonly adapter: CharacterWorldAdapter;

  constructor(adapter: CharacterWorldAdapter) {
    this.adapter = adapter;
  }

  sweepCapsule(query: Readonly<CapsuleSweep>): SweepHit | null {
    const mask = query.mask ?? ALL_LAYERS;
    const endX = query.start.x + query.delta.x;
    const endZ = query.start.z + query.delta.z;
    const bounds: QueryBounds = {
      minX: Math.min(query.start.x, endX) - query.radius,
      maxX: Math.max(query.start.x, endX) + query.radius,
      minY: query.start.y,
      maxY: query.start.y + query.height,
      minZ: Math.min(query.start.z, endZ) - query.radius,
      maxZ: Math.max(query.start.z, endZ) + query.radius,
    };
    const distance = length2(query.delta.x, query.delta.z);
    const hits: SweepHit[] = [];

    for (const collider of this.adapter.queryColliders(bounds)) {
      if (!isColliderValid(collider) || !layersOverlap(colliderLayer(collider), mask)) continue;
      if (!overlapsVertical(query.start.y, query.height, collider)) continue;
      const hit = sweepCircleAgainstRect(
        query.start.x,
        query.start.z,
        query.delta.x,
        query.delta.z,
        query.radius,
        collider,
      );
      if (!hit) continue;
      const x = query.start.x + query.delta.x * hit.time;
      const z = query.start.z + query.delta.z * hit.time;
      hits.push({
        time: hit.time,
        distance: distance * hit.time,
        position: { x, y: query.start.y, z },
        point: {
          x: x - hit.normalX * query.radius,
          y: query.start.y,
          z: z - hit.normalZ * query.radius,
        },
        normal: { x: hit.normalX, y: 0, z: hit.normalZ },
        colliderId: collider.id,
        collider,
        startPenetrating: hit.startPenetrating,
      });
    }

    hits.sort((left, right) => {
      if (Math.abs(left.distance - right.distance) > EPSILON) return left.distance - right.distance;
      return compareColliderIds(left.colliderId, right.colliderId);
    });
    return hits[0] ?? null;
  }

  overlapCapsule(query: Readonly<CapsuleOverlap>): readonly PenetrationHit[] {
    const mask = query.mask ?? ALL_LAYERS;
    const bounds: QueryBounds = {
      minX: query.position.x - query.radius,
      maxX: query.position.x + query.radius,
      minY: query.position.y,
      maxY: query.position.y + query.height,
      minZ: query.position.z - query.radius,
      maxZ: query.position.z + query.radius,
    };
    const hits: PenetrationHit[] = [];
    for (const collider of this.adapter.queryColliders(bounds)) {
      if (!isColliderValid(collider) || !layersOverlap(colliderLayer(collider), mask)) continue;
      if (!overlapsVertical(query.position.y, query.height, collider)) continue;
      const penetration = circlePenetration(query.position.x, query.position.z, query.radius, collider);
      if (!penetration) continue;
      hits.push({
        depth: penetration.depth,
        normal: { x: penetration.normalX, y: 0, z: penetration.normalZ },
        colliderId: collider.id,
        collider,
      });
    }
    hits.sort((left, right) => {
      if (Math.abs(left.depth - right.depth) > EPSILON) return right.depth - left.depth;
      return compareColliderIds(left.colliderId, right.colliderId);
    });
    return hits;
  }

  probeGround(query: Readonly<GroundProbe>): GroundHit | null {
    const mask = query.mask ?? ALL_LAYERS;
    const minHeight = query.position.y - query.downDistance;
    const maxHeight = query.position.y + query.upDistance;
    const bounds: QueryBounds = {
      minX: query.position.x - query.radius,
      maxX: query.position.x + query.radius,
      minY: minHeight,
      maxY: maxHeight,
      minZ: query.position.z - query.radius,
      maxZ: query.position.z + query.radius,
    };
    const candidates: GroundSurface[] = [];

    for (const collider of this.adapter.queryColliders(bounds)) {
      if (!isColliderValid(collider) || collider.supportsGround === false) continue;
      if (!layersOverlap(colliderLayer(collider), mask)) continue;
      const top = colliderMaxY(collider);
      if (!Number.isFinite(top) || top < minHeight - CONTACT_EPSILON || top > maxHeight + CONTACT_EPSILON) continue;
      if (!circleTouchesRect(query.position.x, query.position.z, query.radius, collider)) continue;
      candidates.push({
        id: collider.id,
        height: top,
        normal: { x: 0, y: 1, z: 0 },
        velocity: collider.velocity,
        userData: collider.userData,
      });
    }

    const sampled = this.adapter.sampleGround?.({
      x: query.position.x,
      z: query.position.z,
      radius: query.radius,
      minHeight,
      maxHeight,
      mask,
    });
    if (sampled) {
      const surfaces = Array.isArray(sampled) ? sampled : [sampled];
      for (const surface of surfaces) {
        if (!Number.isFinite(surface.height)) continue;
        if (surface.height < minHeight - CONTACT_EPSILON || surface.height > maxHeight + CONTACT_EPSILON) continue;
        candidates.push({ ...surface });
      }
    }

    candidates.sort((left, right) => {
      if (Math.abs(left.height - right.height) > EPSILON) return right.height - left.height;
      return compareColliderIds(left.id, right.id);
    });
    const best = candidates[0];
    if (!best) return null;
    return {
      height: best.height,
      distance: query.position.y - best.height,
      normal: normaliseGroundNormal(best.normal),
      supportId: best.id,
      velocity: normaliseVelocity(best.velocity),
      userData: best.userData,
    };
  }
}

export type StaticWorldOptions = {
  colliders?: readonly Readonly<CharacterCollider>[];
  sampleGround?: CharacterWorldAdapter['sampleGround'];
};

/** Small-list adapter used by the project's authored obstacle boxes. */
export class StaticCharacterWorldAdapter implements CharacterWorldAdapter {
  readonly colliders: readonly Readonly<CharacterCollider>[];
  readonly sampleGround?: CharacterWorldAdapter['sampleGround'];

  constructor(options: Readonly<StaticWorldOptions>) {
    this.colliders = [...(options.colliders ?? [])];
    this.sampleGround = options.sampleGround;
  }

  queryColliders(bounds: Readonly<QueryBounds>): Iterable<Readonly<CharacterCollider>> {
    return this.colliders.filter((collider) => {
      if (collider.maxX < bounds.minX || collider.minX > bounds.maxX) return false;
      if (collider.maxZ < bounds.minZ || collider.minZ > bounds.maxZ) return false;
      const minY = colliderMinY(collider);
      const maxY = colliderMaxY(collider);
      return maxY >= bounds.minY && minY <= bounds.maxY;
    });
  }
}

export type VoxelAdapterOptions = {
  cellSize: number;
  /** World-space centre of voxel index (0, 0, 0). */
  origin?: Readonly<Vec3>;
  isSolid(x: number, y: number, z: number): boolean;
  layer?: number;
  supportsGround?: boolean;
  idForCell?(x: number, y: number, z: number): ColliderId;
  velocityForCell?(x: number, y: number, z: number): Readonly<Vec3> | undefined;
  sampleGround?: CharacterWorldAdapter['sampleGround'];
};

/**
 * Lazy voxel broadphase. Only cells touched by a query are inspected, so a
 * dense or procedurally generated town does not need a second collider array.
 */
export class VoxelCharacterWorldAdapter implements CharacterWorldAdapter {
  readonly options: VoxelAdapterOptions;

  constructor(options: VoxelAdapterOptions) {
    if (!Number.isFinite(options.cellSize) || options.cellSize <= 0) {
      throw new Error('VoxelCharacterWorldAdapter cellSize must be positive.');
    }
    this.options = options;
  }

  queryColliders(bounds: Readonly<QueryBounds>): Iterable<Readonly<CharacterCollider>> {
    const cellSize = this.options.cellSize;
    const half = cellSize * 0.5;
    const origin = this.options.origin ?? { x: 0, y: 0, z: 0 };
    const minX = Math.ceil((bounds.minX - half - origin.x) / cellSize);
    const maxX = Math.floor((bounds.maxX + half - origin.x) / cellSize);
    const minY = Math.ceil((bounds.minY - half - origin.y) / cellSize);
    const maxY = Math.floor((bounds.maxY + half - origin.y) / cellSize);
    const minZ = Math.ceil((bounds.minZ - half - origin.z) / cellSize);
    const maxZ = Math.floor((bounds.maxZ + half - origin.z) / cellSize);
    const colliders: CharacterCollider[] = [];

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          if (!this.options.isSolid(x, y, z)) continue;
          const centerX = origin.x + x * cellSize;
          const centerY = origin.y + y * cellSize;
          const centerZ = origin.z + z * cellSize;
          colliders.push({
            id: this.options.idForCell?.(x, y, z) ?? `voxel:${x},${y},${z}`,
            minX: centerX - half,
            maxX: centerX + half,
            minY: centerY - half,
            maxY: centerY + half,
            minZ: centerZ - half,
            maxZ: centerZ + half,
            layer: this.options.layer,
            supportsGround: this.options.supportsGround,
            velocity: this.options.velocityForCell?.(x, y, z),
          });
        }
      }
    }
    return colliders;
  }

  sampleGround(request: Readonly<GroundSampleRequest>) {
    return this.options.sampleGround?.(request) ?? null;
  }
}

export type CharacterMoveInput = Readonly<Vec2>;

export type CharacterMotorConfig = {
  fixedDeltaSeconds: number;
  maxCatchUpSteps: number;
  maxFrameDeltaSeconds: number;
  radius: number;
  height: number;
  skinWidth: number;
  maxSpeed: number;
  acceleration: number;
  brakingDeceleration: number;
  inputDeadZone: number;
  maxSlideIterations: number;
  maxPenetrationIterations: number;
  penetrationRecoveryEpsilon: number;
  maxStepUp: number;
  maxStepDown: number;
  groundSnapDistance: number;
  maxWalkableSlopeDegrees: number;
  groundProbeRadius: number;
  maxHorizontalSubstep: number;
  groundSweepIterations: number;
  collisionMask: number;
};

export const DEFAULT_CHARACTER_MOTOR_CONFIG: Readonly<CharacterMotorConfig> = Object.freeze({
  fixedDeltaSeconds: 1 / 60,
  maxCatchUpSteps: 16,
  maxFrameDeltaSeconds: 0.25,
  radius: 0.3,
  height: 1.7,
  skinWidth: 0.02,
  maxSpeed: 6,
  acceleration: 20.48,
  brakingDeceleration: 20.48,
  inputDeadZone: 0.001,
  maxSlideIterations: 4,
  maxPenetrationIterations: 6,
  penetrationRecoveryEpsilon: 1e-5,
  maxStepUp: 0.3,
  maxStepDown: 0.3,
  groundSnapDistance: 0.12,
  maxWalkableSlopeDegrees: 42,
  // Probe the full effective footprint so the leading edge can establish
  // support while stepping onto a block. Overrides may widen this footprint;
  // the runtime never allows it to become narrower than radius + skin.
  groundProbeRadius: 0.32,
  maxHorizontalSubstep: 0.15,
  groundSweepIterations: 14,
  collisionMask: ALL_LAYERS,
});

export type CharacterSupportState = {
  id: ColliderId;
  height: number;
  normal: Vec3;
  velocity: Vec3;
  userData?: unknown;
};

export type CharacterMotorState = {
  tick: number;
  position: Vec3;
  previousPosition: Vec3;
  velocity: Vec2;
  desiredVelocity: Vec2;
  facing: Vec2;
  grounded: boolean;
  support: CharacterSupportState | null;
};

export type CharacterContactKind = 'wall' | 'penetration' | 'step' | 'ledge' | 'slope';

export type CharacterContact = {
  kind: CharacterContactKind;
  position: Vec3;
  normal: Vec3;
  colliderId?: ColliderId;
  time?: number;
  depth?: number;
  height?: number;
  reason?: 'no-ground' | 'step-up' | 'step-down' | 'unwalkable-slope' | 'occupied';
};

export type CharacterMotorDebug = {
  tick: number;
  attemptedDisplacement: Vec2;
  actualDisplacement: Vec2;
  supportDisplacement: Vec2;
  contacts: CharacterContact[];
  slideIterations: number;
  penetrationIterations: number;
  unresolvedPenetration: boolean;
  ground: GroundHit | null;
};

export type CharacterAdvanceResult = {
  fixedSteps: number;
  interpolationAlpha: number;
  droppedSeconds: number;
  /** Interpolated render position; simulation state remains on the fixed tick. */
  renderPosition: Vec3;
};

type GroundTransition = {
  valid: boolean;
  hit: GroundHit | null;
  reason?: CharacterContact['reason'];
};

type GroundTravelResult = {
  fraction: number;
  blocked: boolean;
  normal: Vec2;
  reason?: CharacterContact['reason'];
  hit: GroundHit | null;
};

function validateConfig(config: CharacterMotorConfig): CharacterMotorConfig {
  const positive: (keyof CharacterMotorConfig)[] = [
    'fixedDeltaSeconds',
    'maxCatchUpSteps',
    'maxFrameDeltaSeconds',
    'radius',
    'height',
    'maxSlideIterations',
    'maxPenetrationIterations',
    'groundSweepIterations',
  ];
  for (const key of positive) {
    if (!Number.isFinite(config[key]) || config[key] <= 0) {
      throw new Error(`CharacterMotor ${key} must be positive.`);
    }
  }
  const nonNegative: (keyof CharacterMotorConfig)[] = [
    'skinWidth',
    'maxSpeed',
    'acceleration',
    'brakingDeceleration',
    'inputDeadZone',
    'penetrationRecoveryEpsilon',
    'maxStepUp',
    'maxStepDown',
    'groundSnapDistance',
    'groundProbeRadius',
    'maxHorizontalSubstep',
  ];
  for (const key of nonNegative) {
    if (!Number.isFinite(config[key]) || config[key] < 0) {
      throw new Error(`CharacterMotor ${key} must be non-negative.`);
    }
  }
  if (config.maxWalkableSlopeDegrees < 0 || config.maxWalkableSlopeDegrees >= 90) {
    throw new Error('CharacterMotor maxWalkableSlopeDegrees must be in [0, 90).');
  }
  config.maxCatchUpSteps = Math.max(1, Math.floor(config.maxCatchUpSteps));
  config.maxSlideIterations = Math.max(1, Math.floor(config.maxSlideIterations));
  config.maxPenetrationIterations = Math.max(1, Math.floor(config.maxPenetrationIterations));
  config.groundSweepIterations = Math.max(1, Math.floor(config.groundSweepIterations));
  return config;
}

function copyVec3(value: Readonly<Vec3>): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}

function moveTowardVelocity(current: Readonly<Vec2>, target: Readonly<Vec2>, maxDelta: number): Vec2 {
  const dx = target.x - current.x;
  const dz = target.z - current.z;
  const distance = length2(dx, dz);
  if (distance <= maxDelta || distance <= EPSILON) return { x: target.x, z: target.z };
  const scale = maxDelta / distance;
  return { x: current.x + dx * scale, z: current.z + dz * scale };
}

/** Fixed-step walking motor with continuous collision, sliding, and grounding. */
export class KinematicCharacterMotor {
  readonly world: CharacterPhysicsWorld;
  readonly config: CharacterMotorConfig;
  readonly state: CharacterMotorState;
  debug: CharacterMotorDebug;

  private accumulator = 0;
  private droppedSeconds = 0;
  private readonly minWalkableNormalY: number;

  constructor(
    world: CharacterPhysicsWorld,
    initialPosition: Readonly<Vec3>,
    overrides: Partial<CharacterMotorConfig> = {},
  ) {
    this.world = world;
    this.config = validateConfig({ ...DEFAULT_CHARACTER_MOTOR_CONFIG, ...overrides });
    this.minWalkableNormalY = Math.cos(this.config.maxWalkableSlopeDegrees * Math.PI / 180);
    this.state = {
      tick: 0,
      position: copyVec3(initialPosition),
      previousPosition: copyVec3(initialPosition),
      velocity: { x: 0, z: 0 },
      desiredVelocity: { x: 0, z: 0 },
      facing: { x: 0, z: 1 },
      grounded: false,
      support: null,
    };
    this.debug = this.createDebug();
    this.snapToGround(Math.max(this.config.maxStepUp, this.config.groundSnapDistance), this.config.maxStepDown);
  }

  /** Consume render delta while advancing the simulation only in fixed ticks. */
  advance(deltaSeconds: number, input: CharacterMoveInput): CharacterAdvanceResult {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new Error('KinematicCharacterMotor.advance deltaSeconds must be finite and non-negative.');
    }
    const accepted = Math.min(deltaSeconds, this.config.maxFrameDeltaSeconds);
    this.droppedSeconds += deltaSeconds - accepted;
    this.accumulator += accepted;
    const fixedDelta = this.config.fixedDeltaSeconds;
    let availableSteps = Math.floor((this.accumulator + EPSILON) / fixedDelta);
    const fixedSteps = Math.min(availableSteps, this.config.maxCatchUpSteps);
    for (let step = 0; step < fixedSteps; step += 1) this.stepFixed(input);
    this.accumulator -= fixedSteps * fixedDelta;

    availableSteps -= fixedSteps;
    if (availableSteps > 0) {
      const droppedWholeTicks = availableSteps * fixedDelta;
      this.accumulator -= droppedWholeTicks;
      this.droppedSeconds += droppedWholeTicks;
    }
    if (Math.abs(this.accumulator) <= EPSILON) this.accumulator = 0;

    const interpolationAlpha = clamp(this.accumulator / fixedDelta, 0, 1);
    const previous = this.state.previousPosition;
    const current = this.state.position;
    const result: CharacterAdvanceResult = {
      fixedSteps,
      interpolationAlpha,
      droppedSeconds: this.droppedSeconds,
      renderPosition: {
        x: previous.x + (current.x - previous.x) * interpolationAlpha,
        y: previous.y + (current.y - previous.y) * interpolationAlpha,
        z: previous.z + (current.z - previous.z) * interpolationAlpha,
      },
    };
    this.droppedSeconds = 0;
    return result;
  }

  /** Advance exactly one configured fixed tick. */
  stepFixed(input: CharacterMoveInput): void {
    const dt = this.config.fixedDeltaSeconds;
    this.state.previousPosition = copyVec3(this.state.position);
    this.debug = this.createDebug();
    this.recoverPenetration();
    this.refreshGround();
    // Depenetration is a positional correction, not player velocity.
    const movementStart = copyVec3(this.state.position);

    const inputLength = length2(input.x, input.z);
    const hasInput = inputLength > this.config.inputDeadZone;
    const inputScale = inputLength > 1 ? 1 / inputLength : 1;
    const desired = hasInput
      ? { x: input.x * inputScale * this.config.maxSpeed, z: input.z * inputScale * this.config.maxSpeed }
      : { x: 0, z: 0 };
    this.state.desiredVelocity = desired;
    const rate = hasInput ? this.config.acceleration : this.config.brakingDeceleration;
    this.state.velocity = moveTowardVelocity(this.state.velocity, desired, rate * dt);

    const supportVelocity = this.state.grounded && this.state.support
      ? this.state.support.velocity
      : { x: 0, y: 0, z: 0 };
    const supportDisplacement = { x: supportVelocity.x * dt, z: supportVelocity.z * dt };
    const attempted = {
      x: this.state.velocity.x * dt + supportDisplacement.x,
      z: this.state.velocity.z * dt + supportDisplacement.z,
    };
    this.debug.attemptedDisplacement = { ...attempted };
    this.debug.supportDisplacement = { ...supportDisplacement };
    this.moveHorizontal(attempted);
    this.refreshGround();

    const actual = {
      x: this.state.position.x - movementStart.x,
      z: this.state.position.z - movementStart.z,
    };
    this.debug.actualDisplacement = actual;
    this.state.velocity = {
      x: (actual.x - supportDisplacement.x) / dt,
      z: (actual.z - supportDisplacement.z) / dt,
    };
    const facingLength = length2(this.state.velocity.x, this.state.velocity.z);
    if (facingLength > this.config.inputDeadZone) {
      this.state.facing = {
        x: this.state.velocity.x / facingLength,
        z: this.state.velocity.z / facingLength,
      };
    }
    this.state.tick += 1;
    this.debug.tick = this.state.tick;
  }

  teleport(position: Readonly<Vec3>, snapToGround = true): void {
    this.state.position = copyVec3(position);
    this.state.previousPosition = copyVec3(position);
    this.state.velocity = { x: 0, z: 0 };
    this.state.desiredVelocity = { x: 0, z: 0 };
    this.state.grounded = false;
    this.state.support = null;
    this.accumulator = 0;
    this.debug = this.createDebug();
    this.recoverPenetration();
    if (snapToGround) {
      this.snapToGround(Math.max(this.config.maxStepUp, this.config.groundSnapDistance), this.config.maxStepDown);
    }
    this.state.previousPosition = copyVec3(this.state.position);
  }

  snapshot(): CharacterMotorState {
    return {
      tick: this.state.tick,
      position: copyVec3(this.state.position),
      previousPosition: copyVec3(this.state.previousPosition),
      velocity: { ...this.state.velocity },
      desiredVelocity: { ...this.state.desiredVelocity },
      facing: { ...this.state.facing },
      grounded: this.state.grounded,
      support: this.state.support
        ? {
            ...this.state.support,
            normal: copyVec3(this.state.support.normal),
            velocity: copyVec3(this.state.support.velocity),
          }
        : null,
    };
  }

  private createDebug(): CharacterMotorDebug {
    return {
      tick: this.state?.tick ?? 0,
      attemptedDisplacement: { x: 0, z: 0 },
      actualDisplacement: { x: 0, z: 0 },
      supportDisplacement: { x: 0, z: 0 },
      contacts: [],
      slideIterations: 0,
      penetrationIterations: 0,
      unresolvedPenetration: false,
      ground: null,
    };
  }

  private recoverPenetration(): void {
    const effectiveRadius = this.config.radius + this.config.skinWidth;
    for (let iteration = 0; iteration < this.config.maxPenetrationIterations; iteration += 1) {
      const overlaps = this.world.overlapCapsule({
        position: this.state.position,
        radius: effectiveRadius,
        height: this.config.height,
        mask: this.config.collisionMask,
      });
      const overlap = overlaps[0];
      if (!overlap) return;
      const correction = overlap.depth + this.config.penetrationRecoveryEpsilon;
      this.state.position.x += overlap.normal.x * correction;
      this.state.position.z += overlap.normal.z * correction;
      this.debug.penetrationIterations += 1;
      this.debug.contacts.push({
        kind: 'penetration',
        position: copyVec3(this.state.position),
        normal: copyVec3(overlap.normal),
        colliderId: overlap.colliderId,
        depth: overlap.depth,
      });
    }
    this.debug.unresolvedPenetration = this.world.overlapCapsule({
      position: this.state.position,
      radius: effectiveRadius,
      height: this.config.height,
      mask: this.config.collisionMask,
    }).length > 0;
  }

  private probeGroundAt(
    x: number,
    z: number,
    referenceY: number,
    upDistance: number,
    downDistance: number,
    radius = Math.max(
      this.config.groundProbeRadius,
      this.config.radius + this.config.skinWidth,
    ),
  ): GroundHit | null {
    return this.world.probeGround({
      position: { x, y: referenceY, z },
      radius,
      upDistance,
      downDistance,
      mask: this.config.collisionMask,
    });
  }

  private applyGround(hit: GroundHit): void {
    this.state.position.y = hit.height;
    this.state.grounded = true;
    this.state.support = {
      id: hit.supportId,
      height: hit.height,
      normal: copyVec3(hit.normal),
      velocity: copyVec3(hit.velocity),
      userData: hit.userData,
    };
    this.debug.ground = {
      ...hit,
      normal: copyVec3(hit.normal),
      velocity: copyVec3(hit.velocity),
    };
  }

  private snapToGround(upDistance: number, downDistance: number): boolean {
    const hit = this.probeGroundAt(
      this.state.position.x,
      this.state.position.z,
      this.state.position.y,
      upDistance,
      downDistance,
    );
    if (!hit || hit.normal.y < this.minWalkableNormalY) return false;
    this.applyGround(hit);
    return true;
  }

  private refreshGround(): void {
    const wasGrounded = this.state.grounded;
    const hit = this.probeGroundAt(
      this.state.position.x,
      this.state.position.z,
      this.state.position.y,
      wasGrounded ? this.config.groundSnapDistance : this.config.maxStepUp,
      wasGrounded ? this.config.maxStepDown : this.config.groundSnapDistance,
    );
    if (hit && hit.normal.y >= this.minWalkableNormalY) {
      this.applyGround(hit);
    } else {
      this.state.grounded = false;
      this.state.support = null;
      this.debug.ground = null;
    }
  }

  private evaluateGroundTransition(x: number, z: number, referenceY: number): GroundTransition {
    const hit = this.probeGroundAt(
      x,
      z,
      referenceY,
      this.config.maxStepUp,
      this.config.maxStepDown,
    );
    if (!hit) return { valid: false, hit: null, reason: 'no-ground' };
    const heightDelta = hit.height - referenceY;
    if (heightDelta > this.config.maxStepUp + CONTACT_EPSILON) {
      return { valid: false, hit, reason: 'step-up' };
    }
    if (heightDelta < -this.config.maxStepDown - CONTACT_EPSILON) {
      return { valid: false, hit, reason: 'step-down' };
    }
    if (hit.normal.y < this.minWalkableNormalY) {
      return { valid: false, hit, reason: 'unwalkable-slope' };
    }
    const overlaps = this.world.overlapCapsule({
      position: { x, y: hit.height, z },
      radius: this.config.radius + this.config.skinWidth,
      height: this.config.height,
      mask: this.config.collisionMask,
    });
    if (overlaps.length > 0) return { valid: false, hit, reason: 'occupied' };
    return { valid: true, hit };
  }

  private groundBlockNormal(start: Readonly<Vec3>, delta: Readonly<Vec2>): Vec2 {
    const xOnly = Math.abs(delta.x) <= EPSILON
      ? { valid: true }
      : this.evaluateGroundTransition(start.x + delta.x, start.z, start.y);
    const zOnly = Math.abs(delta.z) <= EPSILON
      ? { valid: true }
      : this.evaluateGroundTransition(start.x, start.z + delta.z, start.y);
    if (!xOnly.valid && zOnly.valid) return { x: -Math.sign(delta.x), z: 0 };
    if (xOnly.valid && !zOnly.valid) return { x: 0, z: -Math.sign(delta.z) };
    const magnitude = length2(delta.x, delta.z);
    return magnitude > EPSILON
      ? { x: -delta.x / magnitude, z: -delta.z / magnitude }
      : { x: 0, z: 0 };
  }

  private travelGrounded(delta: Readonly<Vec2>): GroundTravelResult {
    const start = copyVec3(this.state.position);
    const end = this.evaluateGroundTransition(start.x + delta.x, start.z + delta.z, start.y);
    if (end.valid && end.hit) {
      this.state.position.x += delta.x;
      this.state.position.z += delta.z;
      const stepped = end.hit.height - start.y;
      this.applyGround(end.hit);
      if (stepped > CONTACT_EPSILON) {
        this.debug.contacts.push({
          kind: 'step',
          position: copyVec3(this.state.position),
          normal: copyVec3(end.hit.normal),
          colliderId: end.hit.supportId,
          height: stepped,
        });
      }
      return { fraction: 1, blocked: false, normal: { x: 0, z: 0 }, hit: end.hit };
    }

    let low = 0;
    let high = 1;
    let lowHit = this.probeGroundAt(start.x, start.z, start.y, this.config.groundSnapDistance, this.config.maxStepDown);
    for (let iteration = 0; iteration < this.config.groundSweepIterations; iteration += 1) {
      const middle = (low + high) * 0.5;
      const transition = this.evaluateGroundTransition(
        start.x + delta.x * middle,
        start.z + delta.z * middle,
        start.y,
      );
      if (transition.valid) {
        low = middle;
        lowHit = transition.hit;
      } else {
        high = middle;
      }
    }
    if (low > CONTACT_EPSILON && lowHit) {
      this.state.position.x = start.x + delta.x * low;
      this.state.position.z = start.z + delta.z * low;
      this.applyGround(lowHit);
    }
    const normal = this.groundBlockNormal(start, delta);
    const reason = end.reason;
    this.debug.contacts.push({
      kind: reason === 'unwalkable-slope' ? 'slope' : 'ledge',
      position: copyVec3(this.state.position),
      normal: { x: normal.x, y: 0, z: normal.z },
      height: end.hit?.height,
      reason,
    });
    return { fraction: low, blocked: true, normal, reason, hit: lowHit };
  }

  private tryStep(hit: SweepHit, remaining: Readonly<Vec2>): boolean {
    const remainingLength = length2(remaining.x, remaining.z);
    if (remainingLength <= EPSILON || this.config.maxStepUp <= 0) return false;
    const directionX = remaining.x / remainingLength;
    const directionZ = remaining.z / remainingLength;
    const lookAhead = Math.min(
      remainingLength,
      Math.max(this.config.skinWidth * 2, this.config.penetrationRecoveryEpsilon * 2),
    );
    const landing = this.probeGroundAt(
      this.state.position.x + directionX * lookAhead,
      this.state.position.z + directionZ * lookAhead,
      this.state.position.y,
      this.config.maxStepUp,
      0,
      this.config.radius + this.config.skinWidth,
    );
    if (!landing || landing.normal.y < this.minWalkableNormalY) return false;
    const rise = landing.height - this.state.position.y;
    if (rise <= CONTACT_EPSILON || rise > this.config.maxStepUp + CONTACT_EPSILON) return false;
    const overlaps = this.world.overlapCapsule({
      position: { x: this.state.position.x, y: landing.height, z: this.state.position.z },
      radius: this.config.radius + this.config.skinWidth,
      height: this.config.height,
      mask: this.config.collisionMask,
    });
    if (overlaps.length > 0) return false;
    this.state.position.y = landing.height;
    this.state.grounded = true;
    this.state.support = {
      id: landing.supportId,
      height: landing.height,
      normal: copyVec3(landing.normal),
      velocity: copyVec3(landing.velocity),
      userData: landing.userData,
    };
    this.debug.contacts.push({
      kind: 'step',
      position: copyVec3(this.state.position),
      normal: copyVec3(landing.normal),
      colliderId: hit.colliderId,
      height: rise,
    });
    return true;
  }

  private moveHorizontal(delta: Readonly<Vec2>): void {
    const distance = length2(delta.x, delta.z);
    if (distance <= EPSILON) return;
    const maxSubstep = this.config.maxHorizontalSubstep > EPSILON
      ? this.config.maxHorizontalSubstep
      : distance;
    const substeps = Math.max(1, Math.ceil(distance / maxSubstep));
    const segment = { x: delta.x / substeps, z: delta.z / substeps };
    for (let index = 0; index < substeps; index += 1) this.moveSegment(segment);
  }

  private moveSegment(segment: Readonly<Vec2>): void {
    let remaining = { ...segment };
    const effectiveRadius = this.config.radius + this.config.skinWidth;
    for (let iteration = 0; iteration < this.config.maxSlideIterations; iteration += 1) {
      const remainingLength = length2(remaining.x, remaining.z);
      if (remainingLength <= EPSILON) return;
      this.debug.slideIterations += 1;
      const sweep = this.world.sweepCapsule({
        start: this.state.position,
        delta: remaining,
        radius: effectiveRadius,
        height: this.config.height,
        mask: this.config.collisionMask,
      });
      const sweepTime = sweep?.time ?? 1;
      const beforeContact = { x: remaining.x * sweepTime, z: remaining.z * sweepTime };
      const groundTravel = this.travelGrounded(beforeContact);

      if (groundTravel.blocked) {
        const consumed = sweepTime * groundTravel.fraction;
        const postBlock = {
          x: remaining.x * (1 - consumed),
          z: remaining.z * (1 - consumed),
        };
        const into = postBlock.x * groundTravel.normal.x + postBlock.z * groundTravel.normal.z;
        if (into < 0) {
          postBlock.x -= groundTravel.normal.x * into;
          postBlock.z -= groundTravel.normal.z * into;
        }
        remaining = postBlock;
        continue;
      }

      if (!sweep) return;
      const afterContact = {
        x: remaining.x * (1 - sweep.time),
        z: remaining.z * (1 - sweep.time),
      };
      if (this.tryStep(sweep, afterContact)) {
        remaining = afterContact;
        continue;
      }

      this.debug.contacts.push({
        kind: 'wall',
        position: copyVec3(this.state.position),
        normal: copyVec3(sweep.normal),
        colliderId: sweep.colliderId,
        time: sweep.time,
      });
      const into = afterContact.x * sweep.normal.x + afterContact.z * sweep.normal.z;
      if (into < 0) {
        afterContact.x -= sweep.normal.x * into;
        afterContact.z -= sweep.normal.z * into;
      }
      remaining = afterContact;
    }
  }
}

/** Convenience sampler for authored height functions such as TownWorld.surfaceHeight. */
export function createHeightFieldGroundSampler(options: {
  heightAt(x: number, z: number): number | null;
  normalAt?(x: number, z: number): Readonly<Vec3>;
  id?: ColliderId;
  velocityAt?(x: number, z: number): Readonly<Vec3> | undefined;
}): NonNullable<CharacterWorldAdapter['sampleGround']> {
  return (request) => {
    const height = options.heightAt(request.x, request.z);
    if (height === null || !Number.isFinite(height)) return null;
    return {
      id: options.id ?? 'height-field',
      height,
      normal: options.normalAt?.(request.x, request.z) ?? { x: 0, y: 1, z: 0 },
      velocity: options.velocityAt?.(request.x, request.z),
    };
  };
}
