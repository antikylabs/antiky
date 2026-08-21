import type { PipelineProgram } from '@antiky/framework/render-driver';

import { TOWN_VEGETATION_ATLAS, tileRect } from '../atlas-layout.ts';
import type { TownVegetation, TownVegetationType } from '../town.ts';

/** Static local-space geometry consumed by both visible and shadow programs. */
export type TownFoliageGeometry = {
  positions: Float32Array;
  /** xyz normal, w root-to-tip wind deformation weight. */
  normalWinds: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
};

/**
 * Shared instance stream for crossed cards and organic trunks.
 *
 * - shape: width, height, yaw, wind phase
 * - kind: 0 alpha-tested atlas card, 1 opaque procedural-bark trunk
 * - wind: world-space bend amplitude, bottom-anchor mix (0 top, 1 bottom)
 */
export type TownFoliageInstances = {
  centers: Float32Array;
  shapes: Float32Array;
  uvRects: Float32Array;
  tints: Float32Array;
  /** xy bend/anchor controls, z card(0)/trunk(1) kind. */
  windKinds: Float32Array;
  count: number;
};

export type TownFoliageRenderData = {
  cardGeometry: TownFoliageGeometry;
  trunkGeometry: TownFoliageGeometry;
  cards: TownFoliageInstances;
  trunks: TownFoliageInstances;
  sourceCount: number;
  /** Includes the two branch silhouettes expanded from each tree crown. */
  expandedCardCount: number;
};

type MutableInstances = {
  centers: number[];
  shapes: number[];
  uvRects: number[];
  tints: number[];
  kinds: number[];
  winds: number[];
};

type CardStyle = {
  tile: number;
  width: number;
  height: number;
  tint: readonly [number, number, number];
  bend: number;
  bottomAnchored: boolean;
  verticalPivot: number;
};

const ATLAS_TILES = {
  grass: 0,
  wildflower: 1,
  reeds: 2,
  fern: 3,
  ivy: 4,
  shrub: 5,
  crown: 6,
  branch: 7,
} as const;

/** Build immutable geometry and deterministic instance buffers for one town. */
export function buildTownFoliageRenderData(
  vegetation: readonly TownVegetation[],
): TownFoliageRenderData {
  const cards = createMutableInstances();
  const trunks = createMutableInstances();

  for (let index = 0; index < vegetation.length; index += 1) {
    const plant = vegetation[index]!;
    assertVegetation(plant, index);
    if (plant.type === 'tree-trunk') {
      pushTrunk(trunks, plant);
      continue;
    }

    const style = cardStyle(plant);
    pushCard(cards, plant, style);

    // One offset companion turns isolated atlas cutouts into a continuous
    // meadow edge while staying inside the same instanced GPU draw. The second
    // clump is smaller, rotated and phase-shifted so it never reads as a stamp.
    if (plant.type === 'grass' || plant.type === 'flower') {
      const companionYaw = plant.yaw + 1.07 + plant.phase * 0.58;
      const companionOffset = plant.scale * (plant.type === 'grass' ? 0.24 : 0.18);
      pushRawInstance(cards, {
        x: plant.x + Math.cos(companionYaw) * companionOffset,
        y: plant.y,
        z: plant.z + Math.sin(companionYaw) * companionOffset,
        width: style.width * 0.78,
        height: style.height * 0.86,
        yaw: companionYaw,
        phase: wrap01(plant.phase + 0.347),
        tile: style.tile,
        tint: tintVariation(style.tint, plant.phase + 0.21, 0.035),
        kind: 0,
        bend: style.bend * 0.86,
        bottomAnchorMix: 1,
      });
    }

    if (plant.type === 'tree-crown') {
      // The crown tile supplies the broad mass. Two thinner branch silhouettes
      // expose recognizable limbs and stop the tree reading as one flat card.
      const branchScale = plant.scale * 0.92;
      const branchHeight = branchScale * 1.18;
      const offset = plant.scale * 0.12;
      const cosine = Math.cos(plant.yaw);
      const sine = Math.sin(plant.yaw);
      for (const side of [-1, 1] as const) {
        pushRawInstance(cards, {
          x: plant.x + cosine * offset * side,
          y: plant.y - branchHeight * 0.42,
          z: plant.z + sine * offset * side,
          width: branchScale * 1.48,
          height: branchHeight,
          yaw: plant.yaw + side * 0.46,
          phase: wrap01(plant.phase + side * 0.173),
          tile: ATLAS_TILES.branch,
          tint: tintVariation([0.76, 0.88, 0.64], plant.phase + side * 0.11, 0.065),
          kind: 0,
          bend: plant.scale * 0.095,
          bottomAnchorMix: 1,
        });
      }
    }
  }

  const cardInstances = compileInstances(cards);
  return {
    cardGeometry: createCrossedCardGeometry(),
    trunkGeometry: createOrganicTrunkGeometry(),
    cards: cardInstances,
    trunks: compileInstances(trunks),
    sourceCount: vegetation.length,
    expandedCardCount: cardInstances.count,
  };
}

/**
 * Two perpendicular cards with explicit front and back vertices. BroMetal's
 * renderer can keep global back-face culling enabled: every visible side has
 * its own outward normal and counter-wound triangles.
 */
export function createCrossedCardGeometry(): TownFoliageGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const windWeights: number[] = [];
  const indices: number[] = [];

  for (const angle of [0, Math.PI / 2]) {
    const rightX = Math.cos(angle);
    const rightZ = Math.sin(angle);
    const normalX = -rightZ;
    const normalZ = rightX;
    const plane = [
      [-0.5, 0, 0, 0],
      [0.5, 0, 1, 0],
      [0.5, 1, 1, 1],
      [-0.5, 1, 0, 1],
    ] as const;

    const front = positions.length / 3;
    for (const [x, y, u, v] of plane) {
      positions.push(rightX * x, y, rightZ * x);
      normals.push(normalX, 0, normalZ);
      uvs.push(u, v);
      windWeights.push(y);
    }
    indices.push(front, front + 1, front + 2, front, front + 2, front + 3);

    const back = positions.length / 3;
    for (const [x, y, u, v] of plane) {
      positions.push(rightX * x, y, rightZ * x);
      normals.push(-normalX, 0, -normalZ);
      uvs.push(u, v);
      windWeights.push(y);
    }
    indices.push(back, back + 2, back + 1, back, back + 3, back + 2);
  }

  return compileGeometry(positions, normals, uvs, windWeights, indices);
}

/**
 * Reusable low-poly tree: one tapered eight-sided trunk plus three tapered
 * eight-sided branches. It is deliberately not voxel geometry; silhouette,
 * normals, UV grain, and taper survive scene lighting at oblique angles.
 */
export function createOrganicTrunkGeometry(): TownFoliageGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const windWeights: number[] = [];
  const indices: number[] = [];

  appendTaperedCylinder(
    positions, normals, uvs, windWeights, indices,
    [0, 0, 0], [0, 1, 0], 0.5, 0.2, 8,
  );
  appendTaperedCylinder(
    positions, normals, uvs, windWeights, indices,
    [0, 0.43, 0], [0.9, 0.72, 0.18], 0.19, 0.045, 8,
  );
  appendTaperedCylinder(
    positions, normals, uvs, windWeights, indices,
    [0, 0.58, 0], [-0.72, 0.86, -0.28], 0.15, 0.038, 8,
  );
  appendTaperedCylinder(
    positions, normals, uvs, windWeights, indices,
    [0, 0.7, 0], [0.3, 1.02, -0.67], 0.11, 0.03, 8,
  );

  return compileGeometry(positions, normals, uvs, windWeights, indices);
}

/** Bind one geometry to a visible or shadow foliage pipeline. */
export function bindTownFoliageGeometry(
  program: PipelineProgram,
  geometry: TownFoliageGeometry,
): void {
  program.attributes.aPosition?.set(geometry.positions);
  program.attributes.aNormalWind?.set(geometry.normalWinds);
  program.attributes.aUv?.set(geometry.uvs);
  program.setIndices(geometry.indices);
}

/**
 * Upload the live instance prefix. Call once per pipeline, when it is built.
 *
 * A plant's position, size and tint are decided when the town is generated and never change; only
 * the wind moves it, and the wind lives in a uniform. So these rows are as static as the geometry.
 */
export function uploadTownFoliageInstances(
  program: PipelineProgram,
  instances: TownFoliageInstances,
): number {
  if (instances.count === 0) return 0;
  program.instanceAttributes.iCenter?.set(instances.centers);
  program.instanceAttributes.iShape?.set(instances.shapes);
  program.instanceAttributes.iUvRect?.set(instances.uvRects);
  program.instanceAttributes.iTint?.set(instances.tints);
  program.instanceAttributes.iWindKind?.set(instances.windKinds);
  return instances.count;
}

function cardStyle(plant: TownVegetation): CardStyle {
  const variation = plant.phase - 0.5;
  switch (plant.type) {
    case 'grass':
      return {
        tile: plant.phase > 0.76 ? ATLAS_TILES.fern : ATLAS_TILES.grass,
        width: plant.scale * (0.82 + variation * 0.08),
        height: plant.scale * (0.72 + variation * 0.06),
        tint: tintVariation([0.79, 0.9, 0.62], plant.phase, 0.075),
        bend: plant.scale * 0.075,
        bottomAnchored: true,
        verticalPivot: 0,
      };
    case 'flower':
      return {
        tile: ATLAS_TILES.wildflower,
        width: plant.scale * 0.88,
        height: plant.scale * 0.78,
        tint: tintVariation([1, 0.96, 0.9], plant.phase, 0.04),
        bend: plant.scale * 0.055,
        bottomAnchored: true,
        verticalPivot: 0,
      };
    case 'reeds':
      return {
        tile: ATLAS_TILES.reeds,
        width: plant.scale * 0.9,
        height: plant.scale * 1.38,
        tint: tintVariation([0.93, 0.91, 0.69], plant.phase, 0.065),
        bend: plant.scale * 0.115,
        bottomAnchored: true,
        verticalPivot: 0,
      };
    case 'ivy':
      return {
        tile: ATLAS_TILES.ivy,
        width: plant.scale * 1.04,
        height: plant.scale * 1.5,
        tint: tintVariation([0.72, 0.84, 0.61], plant.phase, 0.055),
        bend: plant.scale * 0.045,
        bottomAnchored: false,
        // Town ivy positions denote the attachment height on a facade.
        verticalPivot: -1,
      };
    case 'shrub':
      return {
        tile: ATLAS_TILES.shrub,
        width: plant.scale * 1.35,
        height: plant.scale * 1.08,
        tint: tintVariation([0.78, 0.9, 0.66], plant.phase, 0.06),
        bend: plant.scale * 0.04,
        bottomAnchored: true,
        verticalPivot: 0,
      };
    case 'tree-crown':
      return {
        tile: ATLAS_TILES.crown,
        width: plant.scale * 1.94,
        height: plant.scale * 1.52,
        tint: tintVariation([0.74, 0.86, 0.61], plant.phase, 0.085),
        bend: plant.scale * 0.135,
        bottomAnchored: true,
        // Crown positions mark the trunk tip, not the bottom of the canopy.
        verticalPivot: -0.43,
      };
    case 'tree-trunk':
      throw new Error('tree-trunk must use the organic trunk batch');
  }
}

function pushCard(
  target: MutableInstances,
  plant: TownVegetation,
  style: CardStyle,
): void {
  pushRawInstance(target, {
    x: plant.x,
    y: plant.y + style.height * style.verticalPivot,
    z: plant.z,
    width: style.width,
    height: style.height,
    yaw: plant.yaw,
    phase: plant.phase,
    tile: style.tile,
    tint: style.tint,
    kind: 0,
    bend: style.bend,
    bottomAnchorMix: style.bottomAnchored ? 1 : 0,
  });
}

function pushTrunk(target: MutableInstances, plant: TownVegetation): void {
  const height = plant.scale;
  const width = clamp(height * (0.095 + plant.phase * 0.018), 0.34, 0.76);
  pushRawInstance(target, {
    x: plant.x,
    y: plant.y,
    z: plant.z,
    width,
    height,
    yaw: plant.yaw,
    phase: plant.phase,
    tile: ATLAS_TILES.branch,
    tint: tintVariation([0.31, 0.19, 0.105], plant.phase, 0.09),
    kind: 1,
    bend: Math.min(0.115, height * 0.016),
    bottomAnchorMix: 1,
  });
}

function pushRawInstance(
  target: MutableInstances,
  input: {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    yaw: number;
    phase: number;
    tile: number;
    tint: readonly [number, number, number];
    kind: number;
    bend: number;
    bottomAnchorMix: number;
  },
): void {
  target.centers.push(input.x, input.y, input.z);
  target.shapes.push(input.width, input.height, input.yaw, input.phase);
  // The tile's published inner rectangle, edge to edge. The 1.5-texel inset this replaces kept the
  // sample off a tile boundary that the neighbouring plant sat directly against; the packed atlas
  // puts 64 pixels of extruded edge there instead.
  target.uvRects.push(...tileRect(TOWN_VEGETATION_ATLAS, input.tile));
  target.tints.push(input.tint[0], input.tint[1], input.tint[2]);
  target.kinds.push(input.kind);
  target.winds.push(input.bend, input.bottomAnchorMix);
}

function createMutableInstances(): MutableInstances {
  return { centers: [], shapes: [], uvRects: [], tints: [], kinds: [], winds: [] };
}

function compileInstances(source: MutableInstances): TownFoliageInstances {
  const count = source.kinds.length;
  if (
    source.centers.length !== count * 3
    || source.shapes.length !== count * 4
    || source.uvRects.length !== count * 4
    || source.tints.length !== count * 3
    || source.winds.length !== count * 2
  ) {
    throw new Error('Town foliage instance buffers have inconsistent cardinality');
  }
  const windKinds = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    windKinds.set([
      source.winds[index * 2]!,
      source.winds[index * 2 + 1]!,
      source.kinds[index]!,
    ], index * 3);
  }
  return {
    centers: new Float32Array(source.centers),
    shapes: new Float32Array(source.shapes),
    uvRects: new Float32Array(source.uvRects),
    tints: new Float32Array(source.tints),
    windKinds,
    count,
  };
}

function compileGeometry(
  positions: number[],
  normals: number[],
  uvs: number[],
  windWeights: number[],
  indices: number[],
): TownFoliageGeometry {
  const vertexCount = positions.length / 3;
  if (
    normals.length !== vertexCount * 3
    || uvs.length !== vertexCount * 2
    || windWeights.length !== vertexCount
  ) {
    throw new Error('Town foliage geometry buffers have inconsistent cardinality');
  }
  if (vertexCount > 65_535) throw new Error('Town foliage geometry exceeds Uint16 index capacity');
  const normalWinds = new Float32Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index += 1) {
    normalWinds.set([
      normals[index * 3]!,
      normals[index * 3 + 1]!,
      normals[index * 3 + 2]!,
      windWeights[index]!,
    ], index * 4);
  }
  return {
    positions: new Float32Array(positions),
    normalWinds,
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function appendTaperedCylinder(
  positions: number[],
  normals: number[],
  uvs: number[],
  windWeights: number[],
  indices: number[],
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  startRadius: number,
  endRadius: number,
  sides: number,
): void {
  const axis = normalize3(subtract3(end, start));
  const length = distance3(start, end);
  const reference: readonly [number, number, number] = Math.abs(axis[1]) > 0.92
    ? [1, 0, 0]
    : [0, 1, 0];
  const tangent = normalize3(cross3(reference, axis));
  const bitangent = normalize3(cross3(axis, tangent));
  const sideOffset = positions.length / 3;
  const slope = (startRadius - endRadius) / Math.max(length, 0.001);

  for (let side = 0; side <= sides; side += 1) {
    const fraction = side / sides;
    const angle = fraction * Math.PI * 2;
    const radial = add3(scale3(tangent, Math.cos(angle)), scale3(bitangent, Math.sin(angle)));
    const normal = normalize3(add3(radial, scale3(axis, slope)));
    for (const [point, radius, v] of [[start, startRadius, start[1]], [end, endRadius, end[1]]] as const) {
      const vertex = add3(point, scale3(radial, radius));
      positions.push(vertex[0], vertex[1], vertex[2]);
      normals.push(normal[0], normal[1], normal[2]);
      uvs.push(fraction, v);
      windWeights.push(clamp(vertex[1], 0, 1));
    }
  }

  for (let side = 0; side < sides; side += 1) {
    const bottom = sideOffset + side * 2;
    const top = bottom + 1;
    const nextBottom = bottom + 2;
    const nextTop = bottom + 3;
    indices.push(bottom, nextBottom, top, nextBottom, nextTop, top);
  }

  appendCylinderCap(
    positions, normals, uvs, windWeights, indices,
    start, tangent, bitangent, axis, startRadius, sides, false,
  );
  appendCylinderCap(
    positions, normals, uvs, windWeights, indices,
    end, tangent, bitangent, axis, endRadius, sides, true,
  );
}

function appendCylinderCap(
  positions: number[],
  normals: number[],
  uvs: number[],
  windWeights: number[],
  indices: number[],
  center: readonly [number, number, number],
  tangent: readonly [number, number, number],
  bitangent: readonly [number, number, number],
  axis: readonly [number, number, number],
  radius: number,
  sides: number,
  top: boolean,
): void {
  const normal = top ? axis : scale3(axis, -1);
  const centerIndex = positions.length / 3;
  positions.push(center[0], center[1], center[2]);
  normals.push(normal[0], normal[1], normal[2]);
  uvs.push(0.5, 0.5);
  windWeights.push(clamp(center[1], 0, 1));
  const ringOffset = positions.length / 3;

  for (let side = 0; side < sides; side += 1) {
    const angle = side / sides * Math.PI * 2;
    const radial = add3(scale3(tangent, Math.cos(angle)), scale3(bitangent, Math.sin(angle)));
    const point = add3(center, scale3(radial, radius));
    positions.push(point[0], point[1], point[2]);
    normals.push(normal[0], normal[1], normal[2]);
    uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
    windWeights.push(clamp(point[1], 0, 1));
  }

  for (let side = 0; side < sides; side += 1) {
    const current = ringOffset + side;
    const next = ringOffset + (side + 1) % sides;
    if (top) indices.push(centerIndex, current, next);
    else indices.push(centerIndex, next, current);
  }
}

function assertVegetation(plant: TownVegetation, index: number): void {
  const values = [plant.x, plant.y, plant.z, plant.scale, plant.yaw, plant.phase];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Town vegetation ${index} contains a non-finite value`);
  }
  if (plant.scale <= 0) throw new Error(`Town vegetation ${index} has non-positive scale`);
}

function tintVariation(
  base: readonly [number, number, number],
  phase: number,
  amount: number,
): readonly [number, number, number] {
  const wave = Math.sin(phase * Math.PI * 2) * amount;
  return [
    clamp(base[0] + wave * 0.7, 0, 1.2),
    clamp(base[1] + wave, 0, 1.2),
    clamp(base[2] - wave * 0.35, 0, 1.2),
  ];
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function subtract3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): readonly [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): readonly [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(
  value: readonly [number, number, number],
  scalar: number,
): readonly [number, number, number] {
  return [value[0] * scalar, value[1] * scalar, value[2] * scalar];
}

function cross3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(
  value: readonly [number, number, number],
): readonly [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length < 1e-8) throw new Error('Cannot normalize a zero-length foliage vector');
  return [value[0] / length, value[1] / length, value[2] / length];
}

function distance3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Exhaustive guard when TownVegetationType gains a new member. */
const _townVegetationTypeCoverage: Record<TownVegetationType, true> = {
  grass: true,
  flower: true,
  reeds: true,
  ivy: true,
  shrub: true,
  'tree-trunk': true,
  'tree-crown': true,
};
void _townVegetationTypeCoverage;
