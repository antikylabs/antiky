/**
 * Bake per-vertex ambient occlusion for a static mesh.
 *
 * **Why this exists at all, when two of the three catalog models already have occlusion.**
 * `tree-stump` and `dead-tree` ship a proper ORM texture — red is occlusion, green roughness — and
 * texture occlusion at 1K beats per-vertex occlusion on any mesh. `rock-moss` does not: its
 * `catalog_material` image is a single greyscale channel replicated across RGB, which is roughness
 * with no occlusion anywhere in it. The shader has been reading `mix(…, 1, uMaterialLayout)` — that
 * is, *no occlusion at all* — for the rocks, which are the largest props in the scene.
 *
 * So this fills the gap rather than replacing what is already better. The shader keeps texture
 * occlusion where a texture has it and takes the baked value only where it does not.
 *
 * **Why not SSAO.** It needs sampled depth, and BroMetal depth attachments are never sampleable.
 * An offline bake is also both cheaper and more accurate for geometry that never moves.
 *
 * **Determinism.** No randomness anywhere: ray directions come from a Fibonacci hemisphere, which is
 * a closed-form sequence. Run twice on the same mesh and the bytes are identical, which
 * `tests/vertex-occlusion.test.mjs` asserts by running it twice.
 *
 * Usage:
 *   node packages/demos/scripts/bake-vertex-occlusion.mjs <input.glb> <output.gen.ts>
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseGlb } from 'brometal';

/** Rays per vertex. 64 is where the noise stops being visible on a mesh of this density. */
const RAY_COUNT = 64;

/**
 * How far a ray looks for an occluder, as a fraction of the mesh's bounding radius.
 *
 * Local rather than global on purpose: occlusion is a statement about the crevice a vertex sits in,
 * not about whether some distant part of the model happens to be in the way. Tracing to infinity on
 * a concave mesh darkens whole faces that are simply pointing at the rest of the object.
 */
const RAY_REACH = 0.22;

/** Never fully black. A crevice that reaches zero reads as a hole punched in the model. */
const MINIMUM_OPENNESS = 0.35;

/**
 * `count` directions spread evenly over the hemisphere around +Z, cosine-weighted.
 *
 * Cosine-weighted because that is how a surface actually gathers ambient light: a ray arriving
 * edge-on contributes almost nothing, so spending equal samples on it wastes them. The golden-angle
 * spiral gives an even spread with no random numbers and therefore no run-to-run drift.
 */
function hemisphereDirections(count) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const directions = [];
  for (let index = 0; index < count; index += 1) {
    // sqrt distributes the samples by cosine rather than uniformly over solid angle.
    const z = Math.sqrt((index + 0.5) / count);
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    const angle = index * golden;
    directions.push([Math.cos(angle) * radius, Math.sin(angle) * radius, z]);
  }
  return directions;
}

/** Any two axes perpendicular to `normal`, so the hemisphere can be rotated onto it. */
function basisFor(normal) {
  const [nx, ny, nz] = normal;
  // Picking the axis least aligned with the normal keeps the cross product well conditioned.
  const helper = Math.abs(nx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let tx = helper[1] * nz - helper[2] * ny;
  let ty = helper[2] * nx - helper[0] * nz;
  let tz = helper[0] * ny - helper[1] * nx;
  const length = Math.hypot(tx, ty, tz) || 1;
  tx /= length; ty /= length; tz /= length;
  return [[tx, ty, tz], [ny * tz - nz * ty, nz * tx - nx * tz, nx * ty - ny * tx]];
}

/**
 * A uniform grid over the triangles, so a ray tests a few dozen of them rather than all 101,802.
 *
 * A BVH would be faster still. This is a build step that runs when an asset changes, and a grid is
 * fifty lines against several hundred — `GOOD_ENGINEERING_H.md` on saying no to complexity that is
 * not paying for itself.
 */
function buildGrid(positions, indices, cells) {
  let minimum = [Infinity, Infinity, Infinity];
  let maximum = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], positions[i + axis]);
      maximum[axis] = Math.max(maximum[axis], positions[i + axis]);
    }
  }
  const size = [
    Math.max(1e-6, (maximum[0] - minimum[0]) / cells),
    Math.max(1e-6, (maximum[1] - minimum[1]) / cells),
    Math.max(1e-6, (maximum[2] - minimum[2]) / cells),
  ];
  const buckets = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  const cellOf = (point) => [
    Math.min(cells - 1, Math.max(0, Math.floor((point[0] - minimum[0]) / size[0]))),
    Math.min(cells - 1, Math.max(0, Math.floor((point[1] - minimum[1]) / size[1]))),
    Math.min(cells - 1, Math.max(0, Math.floor((point[2] - minimum[2]) / size[2]))),
  ];
  for (let t = 0; t < indices.length; t += 3) {
    const corners = [0, 1, 2].map((c) => {
      const v = indices[t + c] * 3;
      return [positions[v], positions[v + 1], positions[v + 2]];
    });
    const low = cellOf([
      Math.min(corners[0][0], corners[1][0], corners[2][0]),
      Math.min(corners[0][1], corners[1][1], corners[2][1]),
      Math.min(corners[0][2], corners[1][2], corners[2][2]),
    ]);
    const high = cellOf([
      Math.max(corners[0][0], corners[1][0], corners[2][0]),
      Math.max(corners[0][1], corners[1][1], corners[2][1]),
      Math.max(corners[0][2], corners[1][2], corners[2][2]),
    ]);
    for (let x = low[0]; x <= high[0]; x += 1) {
      for (let y = low[1]; y <= high[1]; y += 1) {
        for (let z = low[2]; z <= high[2]; z += 1) {
          const k = key(x, y, z);
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k).push(t);
        }
      }
    }
  }
  return { minimum, size, cells, buckets, cellOf, key };
}

/** Möller–Trumbore, front and back faces alike: a crevice occludes from either side. */
function hits(positions, indices, triangle, origin, direction, reach) {
  const a = indices[triangle] * 3;
  const b = indices[triangle + 1] * 3;
  const c = indices[triangle + 2] * 3;
  const e1 = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
  const e2 = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
  const p = [
    direction[1] * e2[2] - direction[2] * e2[1],
    direction[2] * e2[0] - direction[0] * e2[2],
    direction[0] * e2[1] - direction[1] * e2[0],
  ];
  const determinant = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(determinant) < 1e-12) return false;
  const inverse = 1 / determinant;
  const t0 = [origin[0] - positions[a], origin[1] - positions[a + 1], origin[2] - positions[a + 2]];
  const u = (t0[0] * p[0] + t0[1] * p[1] + t0[2] * p[2]) * inverse;
  if (u < 0 || u > 1) return false;
  const q = [
    t0[1] * e1[2] - t0[2] * e1[1],
    t0[2] * e1[0] - t0[0] * e1[2],
    t0[0] * e1[1] - t0[1] * e1[0],
  ];
  const v = (direction[0] * q[0] + direction[1] * q[1] + direction[2] * q[2]) * inverse;
  if (v < 0 || u + v > 1) return false;
  const distance = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inverse;
  return distance > 1e-4 && distance < reach;
}

/**
 * Openness per vertex, in 0..1. 1 is an open face, lower is a crevice.
 *
 * Exported so a test can bake a shape whose answer is known by inspection — a flat plane is open
 * everywhere, and the inside of a box is not — rather than only checking that two runs agree.
 */
export function bakeVertexOcclusion(positions, normals, indices) {
  const directions = hemisphereDirections(RAY_COUNT);
  // Half the bounding-box diagonal, not the distance from the world origin — a mesh authored away
  // from the origin would otherwise get a reach set by where it happens to sit.
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      low[axis] = Math.min(low[axis], positions[i + axis]);
      high[axis] = Math.max(high[axis], positions[i + axis]);
    }
  }
  const radius = Math.hypot(high[0] - low[0], high[1] - low[1], high[2] - low[2]) / 2;
  const reach = Math.max(1e-4, radius * RAY_REACH);
  const grid = buildGrid(positions, indices, 24);
  const openness = new Float32Array(positions.length / 3);

  for (let v = 0; v < openness.length; v += 1) {
    const origin = [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]];
    const normal = [normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]];
    const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    const unit = [normal[0] / length, normal[1] / length, normal[2] / length];
    const [tangent, bitangent] = basisFor(unit);
    // Lifted off the surface so a vertex does not hit the triangles it belongs to.
    const start = [
      origin[0] + unit[0] * 1e-3,
      origin[1] + unit[1] * 1e-3,
      origin[2] + unit[2] * 1e-3,
    ];

    let clear = 0;
    for (const direction of directions) {
      const world = [
        tangent[0] * direction[0] + bitangent[0] * direction[1] + unit[0] * direction[2],
        tangent[1] * direction[0] + bitangent[1] * direction[1] + unit[1] * direction[2],
        tangent[2] * direction[0] + bitangent[2] * direction[1] + unit[2] * direction[2],
      ];
      // Every cell the ray can actually reach, taken from the segment's own bounding box.
      //
      // This was a fixed box of two cells around the origin, and it found nothing: the grid is built
      // over the mesh bounds, so a flat model has cells that are wide in x and z and paper-thin in
      // y, and an occluder a fifth of a unit overhead sat twenty-four cells away. A neighbourhood
      // measured in cells cannot bound a distance measured in world units.
      const end = [start[0] + world[0] * reach, start[1] + world[1] * reach, start[2] + world[2] * reach];
      const from = grid.cellOf([
        Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.min(start[2], end[2]),
      ]);
      const to = grid.cellOf([
        Math.max(start[0], end[0]), Math.max(start[1], end[1]), Math.max(start[2], end[2]),
      ]);
      let blocked = false;
      for (let x = from[0]; x <= to[0] && !blocked; x += 1) {
        for (let y = from[1]; y <= to[1] && !blocked; y += 1) {
          for (let z = from[2]; z <= to[2] && !blocked; z += 1) {
            const bucket = grid.buckets.get(grid.key(x, y, z));
            if (bucket === undefined) continue;
            for (const triangle of bucket) {
              if (hits(positions, indices, triangle, start, world, reach)) { blocked = true; break; }
            }
          }
        }
      }
      if (!blocked) clear += 1;
    }
    openness[v] = MINIMUM_OPENNESS + (1 - MINIMUM_OPENNESS) * (clear / RAY_COUNT);
  }
  return openness;
}

/** Quantised to a byte. The shader multiplies an ambient term by it; 1/255 is far below visible. */
export function encodeOpenness(openness) {
  const bytes = Buffer.alloc(openness.length);
  for (let i = 0; i < openness.length; i += 1) {
    bytes[i] = Math.max(0, Math.min(255, Math.round(openness[i] * 255)));
  }
  return bytes;
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (input === undefined || output === undefined) {
    throw new Error('Usage: bake-vertex-occlusion.mjs <input.glb> <output.gen.ts>');
  }
  const source = await readFile(input);
  const model = parseGlb(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
  const mesh = model.meshes?.[0] ?? model;
  const openness = bakeVertexOcclusion(mesh.positions, mesh.normals, mesh.indices);
  const encoded = encodeOpenness(openness).toString('base64');
  // A fixed export name and no TypeScript-only syntax. The first version generated a name from the
  // filename and wrapped the decode in an IIFE with a non-null assertion; node's type stripping
  // rejected it, and a generated file only some tools can read is worse than a plain one.
  await writeFile(output, `// Generated by packages/demos/scripts/bake-vertex-occlusion.mjs. Do not edit.
//
// Per-vertex openness for ${path.basename(input)}: 1 is an open face, lower is a crevice. Applied to
// the ambient term only — occlusion that dims direct light makes shadowed areas flat and grey.
//
// One byte per vertex, base64. ${openness.length} vertices.
const PACKED = '${encoded}';

const bytes = Uint8Array.from(atob(PACKED), (character) => character.charCodeAt(0));

export const VERTEX_OPENNESS = new Float32Array(bytes.length);
for (let index = 0; index < bytes.length; index += 1) {
  VERTEX_OPENNESS[index] = (bytes[index] ?? 0) / 255;
}
`);
  process.stdout.write(`${openness.length} vertices -> ${output}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
