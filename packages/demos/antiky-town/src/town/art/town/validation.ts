import type { TownWorld } from '../town.ts';
import {
  validateVoxelSurfaceMesh,
  voxelQuadKey,
  type VoxelMeshStats,
} from '../voxel-surface-mesh.ts';

export const TOWN_MESH_BUDGET = {
  // The fine façade/roof/paver pass trades a modest static-mesh increase for
  // 3x linear detail while remaining an ~8 MB browser upload.
  maxVertices: 135_000,
  maxTriangles: 66_000,
  maxBytes: 8 * 1024 * 1024,
} as const;

export type TownValidationReport = {
  valid: boolean;
  errors: string[];
  fingerprint: string;
  duplicateQuadCount: number;
  stats: VoxelMeshStats;
};

/** Full authored-town validation, intended for focused tests and build tooling. */
export function validateTownWorld(world: TownWorld): TownValidationReport {
  const meshValidation = validateVoxelSurfaceMesh(world.mesh);
  const errors = [...meshValidation.errors];
  const { mesh } = world;
  const { stats } = mesh;

  if (stats.vertexCount > TOWN_MESH_BUDGET.maxVertices) {
    errors.push(`vertex budget exceeded: ${stats.vertexCount} > ${TOWN_MESH_BUDGET.maxVertices}`);
  }
  if (stats.triangleCount > TOWN_MESH_BUDGET.maxTriangles) {
    errors.push(`triangle budget exceeded: ${stats.triangleCount} > ${TOWN_MESH_BUDGET.maxTriangles}`);
  }
  if (stats.attributeBytes > TOWN_MESH_BUDGET.maxBytes) {
    errors.push(`static-buffer budget exceeded: ${stats.attributeBytes} > ${TOWN_MESH_BUDGET.maxBytes}`);
  }
  if (stats.vertexCount !== mesh.positions.length / 3) errors.push('mesh stats vertex count is stale');
  if (stats.indexCount !== mesh.indices.length) errors.push('mesh stats index count is stale');
  if (stats.triangleCount !== mesh.indices.length / 3) errors.push('mesh stats triangle count is stale');
  if (stats.quadCount * 4 !== stats.vertexCount) errors.push('surface mesh must contain four vertices per greedy quad');

  let duplicateQuadCount = 0;
  const quads = new Set<string>();
  for (let quad = 0; quad < stats.quadCount; quad += 1) {
    const key = voxelQuadKey(mesh, quad);
    if (quads.has(key)) duplicateQuadCount += 1;
    else quads.add(key);

    const offset = quad * 12;
    const ax = mesh.positions[offset + 3]! - mesh.positions[offset]!;
    const ay = mesh.positions[offset + 4]! - mesh.positions[offset + 1]!;
    const az = mesh.positions[offset + 5]! - mesh.positions[offset + 2]!;
    const bx = mesh.positions[offset + 6]! - mesh.positions[offset]!;
    const by = mesh.positions[offset + 7]! - mesh.positions[offset + 1]!;
    const bz = mesh.positions[offset + 8]! - mesh.positions[offset + 2]!;
    const crossX = ay * bz - az * by;
    const crossY = az * bx - ax * bz;
    const crossZ = ax * by - ay * bx;
    const normalOffset = quad * 12;
    const facing = crossX * mesh.normals[normalOffset]!
      + crossY * mesh.normals[normalOffset + 1]!
      + crossZ * mesh.normals[normalOffset + 2]!;
    if (!(facing > 0)) {
      errors.push(`quad ${quad} has degenerate or normal-opposed winding`);
      break;
    }
  }
  if (duplicateQuadCount > 0) errors.push(`${duplicateQuadCount} coincident duplicate quads found`);

  for (let vertex = 0; vertex < stats.vertexCount; vertex += 1) {
    const id = mesh.materialIds[vertex]!;
    if (!Number.isInteger(id) || id < 0 || id >= world.materials.length) {
      errors.push(`materialIds[${vertex}] is outside the town material table`);
      break;
    }
    const tableMaterial = world.materials[id]!;
    const roughness = mesh.materials[vertex * 2]!;
    const specular = mesh.materials[vertex * 2 + 1]!;
    if (roughness < 0 || roughness > 1 || specular < 0 || specular > 1) {
      errors.push(`materials[${vertex}] is outside the zero-to-one response range`);
      break;
    }
    const colorOffset = vertex * 3;
    const colorMatches = tableMaterial.baseColor.every((channel, index) => (
      Math.abs(mesh.baseColors[colorOffset + index]! - channel) < 1e-6
    ));
    const responseMatches = Math.abs(roughness - tableMaterial.roughness) < 1e-6
      && Math.abs(specular - tableMaterial.specular) < 1e-6;
    if (!colorMatches || !responseMatches) {
      errors.push(`vertex ${vertex} contains material data outside its palette entry`);
      break;
    }
  }

  const forbiddenVoxelVegetation = new Set(['leaf', 'leafLight', 'leafGold', 'flowerViolet', 'flowerCream']);
  for (const id of mesh.materialIds) {
    const material = world.materials[id];
    if (material && forbiddenVoxelVegetation.has(material.name)) {
      errors.push(`voxel mesh contains renderer-owned vegetation material: ${material.name}`);
      break;
    }
  }

  for (let index = 0; index < world.vegetation.length; index += 1) {
    const item = world.vegetation[index]!;
    if (![item.x, item.y, item.z, item.scale, item.yaw, item.phase].every(Number.isFinite)) {
      errors.push(`vegetation[${index}] contains a non-finite value`);
      break;
    }
    if (item.scale <= 0 || item.phase < 0 || item.phase >= 1) {
      errors.push(`vegetation[${index}] contains an invalid scale or phase`);
      break;
    }
  }

  for (let index = 0; index < world.awnings.length; index += 1) {
    const awning = world.awnings[index]!;
    if (![awning.x, awning.y, awning.z, awning.width, awning.depth, awning.yaw, awning.slope, awning.phase].every(Number.isFinite)) {
      errors.push(`awnings[${index}] contains a non-finite value`);
      break;
    }
    if (awning.width <= 0 || awning.depth <= 0 || awning.phase < 0 || awning.phase >= 1) {
      errors.push(`awnings[${index}] contains invalid dimensions or phase`);
      break;
    }
  }

  for (let index = 0; index < world.spriteProps.length; index += 1) {
    const prop = world.spriteProps[index]!;
    if (![prop.x, prop.y, prop.z, prop.scale, prop.yaw, prop.curvature].every(Number.isFinite)) {
      errors.push(`spriteProps[${index}] contains a non-finite value`);
      break;
    }
    if (prop.scale <= 0 || prop.curvature < 0 || prop.curvature > 1) {
      errors.push(`spriteProps[${index}] contains an invalid scale or curvature`);
      break;
    }
  }

  const waterfallValues = Object.values(world.waterfall);
  if (!waterfallValues.every(Number.isFinite) || world.waterfall.minX >= world.waterfall.maxX) {
    errors.push('waterfall contains non-finite or inverted horizontal bounds');
  }
  if (world.waterfall.bottomY >= world.waterfall.topY) {
    errors.push('waterfall drop must have topY above bottomY');
  }

  const colliderIds = new Set<string>();
  for (const collider of world.physicsColliders) {
    const values = [collider.minX, collider.maxX, collider.minZ, collider.maxZ];
    if (collider.minY !== undefined) values.push(collider.minY);
    if (collider.maxY !== undefined) values.push(collider.maxY);
    if (!values.every(Number.isFinite) || collider.minX >= collider.maxX || collider.minZ >= collider.maxZ) {
      errors.push('physicsColliders contains a non-finite or inverted box');
      break;
    }
    if (!collider.id || colliderIds.has(collider.id)) {
      errors.push(`physicsColliders contains a missing or duplicate stable id: ${collider.id}`);
      break;
    }
    colliderIds.add(collider.id);
  }

  const paths = [world.heroPath, ...new Set(world.walkers.map((walker) => walker.path))];
  for (let pathIndex = 0; pathIndex < paths.length; pathIndex += 1) {
    const path = paths[pathIndex]!;
    for (let segment = 0; segment < path.length; segment += 1) {
      const from = path[segment]!;
      const to = path[(segment + 1) % path.length]!;
      for (let sample = 0; sample <= 24; sample += 1) {
        const t = sample / 24;
        const x = from[0] + (to[0] - from[0]) * t;
        const z = from[1] + (to[1] - from[1]) * t;
        if (!world.canWalk(x, z)) {
          errors.push(`path ${pathIndex}, segment ${segment} crosses blocked space`);
          break;
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    fingerprint: meshValidation.fingerprint,
    duplicateQuadCount,
    stats,
  };
}

export function validateTownDeterminism(first: TownWorld, second: TownWorld): string[] {
  const errors: string[] = [];
  if (first.geometryValidation.fingerprint !== second.geometryValidation.fingerprint) {
    errors.push(
      `mesh fingerprint changed across identical builds: ${first.geometryValidation.fingerprint} != ${second.geometryValidation.fingerprint}`,
    );
  }
  if (first.mesh.stats.vertexCount !== second.mesh.stats.vertexCount) {
    errors.push('mesh vertex count changed across identical builds');
  }
  if (first.mesh.stats.triangleCount !== second.mesh.stats.triangleCount) {
    errors.push('mesh triangle count changed across identical builds');
  }
  if (first.voxels.count !== second.voxels.count) {
    errors.push('legacy compatibility instance count changed across identical builds');
  }
  if (JSON.stringify(first.vegetation) !== JSON.stringify(second.vegetation)) {
    errors.push('vegetation metadata changed across identical builds');
  }
  if (JSON.stringify(first.awnings) !== JSON.stringify(second.awnings)) {
    errors.push('awning metadata changed across identical builds');
  }
  if (JSON.stringify(first.spriteProps) !== JSON.stringify(second.spriteProps)) {
    errors.push('sprite-prop metadata changed across identical builds');
  }
  return errors;
}
