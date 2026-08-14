import type { TownFountain, TownWaterfall } from './town';

/**
 * Shared vertex layout for renderer-owned town water features.
 *
 * `featureData` is one vec4 per vertex:
 * - x: feature kind (surface, vertical fall, or jet)
 * - y: deterministic animation phase
 * - z: world-space displacement amplitude
 * - w: foam/layer weight
 *
 * The values are authored here rather than in the renderer so all animation can
 * remain in the vertex and fragment stages after the initial upload.
 */
export type TownWaterFeatureMesh = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  featureData: Float32Array;
  indices: Uint16Array | Uint32Array;
};

export type TownWaterFeatureBuildOptions = {
  channelColumns?: number;
  channelRows?: number;
  waterfallColumns?: number;
  waterfallRows?: number;
  waterfallLayers?: number;
  plungeRows?: number;
  basinRings?: number;
  basinSegments?: number;
  jetSegments?: number;
  jetSides?: number;
  splashSegments?: number;
};

/** Values consumed by town-water-features.shader.ts. */
export const TOWN_WATER_FEATURE_KIND = {
  surface: 0,
  waterfall: 1,
  jet: 2,
} as const;

const TAU = Math.PI * 2;

const DEFAULTS = {
  channelColumns: 10,
  channelRows: 18,
  waterfallColumns: 14,
  waterfallRows: 28,
  waterfallLayers: 3,
  plungeRows: 5,
  basinRings: 9,
  basinSegments: 40,
  jetSegments: 24,
  jetSides: 6,
  splashSegments: 24,
} as const;

type MeshWriter = {
  positions: number[];
  normals: number[];
  uvs: number[];
  featureData: number[];
  indices: number[];
};

function writer(): MeshWriter {
  return { positions: [], normals: [], uvs: [], featureData: [], indices: [] };
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function positive(value: number, label: string): number {
  if (!(finite(value, label) > 0)) throw new Error(`${label} must be greater than zero`);
  return value;
}

function segmentCount(
  value: number | undefined,
  fallback: number,
  minimum: number,
  label: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}`);
  }
  return resolved;
}

function addVertex(
  mesh: MeshWriter,
  position: readonly [number, number, number],
  normal: readonly [number, number, number],
  uv: readonly [number, number],
  feature: readonly [number, number, number, number],
): number {
  const index = mesh.positions.length / 3;
  mesh.positions.push(position[0], position[1], position[2]);
  mesh.normals.push(normal[0], normal[1], normal[2]);
  mesh.uvs.push(uv[0], uv[1]);
  mesh.featureData.push(feature[0], feature[1], feature[2], feature[3]);
  return index;
}

function finish(mesh: MeshWriter): TownWaterFeatureMesh {
  const vertexCount = mesh.positions.length / 3;
  const indices = vertexCount <= 0xffff
    ? new Uint16Array(mesh.indices)
    : new Uint32Array(mesh.indices);
  return {
    positions: new Float32Array(mesh.positions),
    normals: new Float32Array(mesh.normals),
    uvs: new Float32Array(mesh.uvs),
    featureData: new Float32Array(mesh.featureData),
    indices,
  };
}

function addUpwardGridIndices(
  mesh: MeshWriter,
  start: number,
  columns: number,
  rows: number,
): void {
  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = start + row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      // x then +z points toward -y, so reverse the usual grid winding.
      mesh.indices.push(a, c, b, b, c, d);
    }
  }
}

function addFrontGridIndices(
  mesh: MeshWriter,
  start: number,
  columns: number,
  rows: number,
): void {
  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = start + row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      // Rows run downward; this winding faces +z toward the town camera.
      mesh.indices.push(a, c, b, b, c, d);
    }
  }
}

function addHorizontalPatch(
  mesh: MeshWriter,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  y: number,
  columns: number,
  rows: number,
  amplitude: number,
  foam: number,
  phaseOffset: number,
): void {
  const start = mesh.positions.length / 3;
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const z = bounds.minZ + (bounds.maxZ - bounds.minZ) * v;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const x = bounds.minX + (bounds.maxX - bounds.minX) * u;
      const phase = phaseOffset + u * 0.617 + v * 0.283;
      addVertex(
        mesh,
        [x, y, z],
        [0, 1, 0],
        [u, v],
        [TOWN_WATER_FEATURE_KIND.surface, phase, amplitude, foam],
      );
    }
  }
  addUpwardGridIndices(mesh, start, columns, rows);
}

/**
 * Builds the upper channel, three depth-separated falling sheets, and a small
 * plunge patch from the numeric TownWorld.waterfall contract.
 */
export function buildTownWaterfallMesh(
  waterfall: TownWaterfall,
  options: TownWaterFeatureBuildOptions = {},
): TownWaterFeatureMesh {
  const minX = finite(waterfall.minX, 'waterfall.minX');
  const maxX = finite(waterfall.maxX, 'waterfall.maxX');
  const z = finite(waterfall.z, 'waterfall.z');
  const topY = finite(waterfall.topY, 'waterfall.topY');
  const bottomY = finite(waterfall.bottomY, 'waterfall.bottomY');
  const channelMinZ = finite(waterfall.channelMinZ, 'waterfall.channelMinZ');
  const channelMaxZ = finite(waterfall.channelMaxZ, 'waterfall.channelMaxZ');
  const width = positive(maxX - minX, 'waterfall width');
  positive(topY - bottomY, 'waterfall height');
  positive(channelMaxZ - channelMinZ, 'waterfall channel length');

  const channelColumns = segmentCount(
    options.channelColumns,
    DEFAULTS.channelColumns,
    1,
    'channelColumns',
  );
  const channelRows = segmentCount(options.channelRows, DEFAULTS.channelRows, 1, 'channelRows');
  const waterfallColumns = segmentCount(
    options.waterfallColumns,
    DEFAULTS.waterfallColumns,
    2,
    'waterfallColumns',
  );
  const waterfallRows = segmentCount(
    options.waterfallRows,
    DEFAULTS.waterfallRows,
    2,
    'waterfallRows',
  );
  const waterfallLayers = segmentCount(
    options.waterfallLayers,
    DEFAULTS.waterfallLayers,
    1,
    'waterfallLayers',
  );
  const plungeRows = segmentCount(options.plungeRows, DEFAULTS.plungeRows, 1, 'plungeRows');
  const mesh = writer();

  const baseAmplitude = Math.min(0.026, Math.max(0.009, width * 0.008));
  addHorizontalPatch(
    mesh,
    { minX, maxX, minZ: channelMinZ, maxZ: channelMaxZ },
    topY,
    channelColumns,
    channelRows,
    baseAmplitude * 0.55,
    0.08,
    0.17,
  );

  const depthStep = Math.min(0.038, Math.max(0.018, width * 0.016));
  for (let layerIndex = 0; layerIndex < waterfallLayers; layerIndex += 1) {
    const layer = waterfallLayers === 1 ? 0 : layerIndex / (waterfallLayers - 1);
    const inset = width * 0.035 * layer;
    const layerMinX = minX + inset;
    const layerMaxX = maxX - inset;
    const start = mesh.positions.length / 3;
    for (let row = 0; row <= waterfallRows; row += 1) {
      const v = row / waterfallRows;
      const y = topY + (bottomY - topY) * v;
      for (let column = 0; column <= waterfallColumns; column += 1) {
        const u = column / waterfallColumns;
        const x = layerMinX + (layerMaxX - layerMinX) * u;
        const phase = layerIndex * 1.731 + u * 0.419;
        addVertex(
          mesh,
          [x, y, z + layerIndex * depthStep],
          [0, 0, 1],
          [u, v],
          [
            TOWN_WATER_FEATURE_KIND.waterfall,
            phase,
            baseAmplitude * (1 + layer * 0.42),
            layer,
          ],
        );
      }
    }
    addFrontGridIndices(mesh, start, waterfallColumns, waterfallRows);
  }

  const plungeDepth = width * 0.82;
  addHorizontalPatch(
    mesh,
    {
      minX: minX - width * 0.1,
      maxX: maxX + width * 0.1,
      minZ: z - width * 0.025,
      maxZ: z + plungeDepth,
    },
    bottomY + 0.014,
    waterfallColumns,
    plungeRows,
    baseAmplitude * 0.72,
    1,
    2.43,
  );

  return finish(mesh);
}

function addBasinSurface(
  mesh: MeshWriter,
  fountain: TownFountain,
  rings: number,
  segments: number,
): void {
  const radius = fountain.radius * 0.93;
  const amplitude = Math.min(0.026, Math.max(0.01, fountain.radius * 0.01));
  const center = addVertex(
    mesh,
    [fountain.x, fountain.waterY, fountain.z],
    [0, 1, 0],
    [0.5, 0.5],
    [TOWN_WATER_FEATURE_KIND.surface, 0.31, amplitude, 0.18],
  );

  const firstRing = mesh.positions.length / 3;
  for (let ring = 1; ring <= rings; ring += 1) {
    const radial = ring / rings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * TAU;
      const dx = Math.cos(angle) * radial;
      const dz = Math.sin(angle) * radial;
      addVertex(
        mesh,
        [fountain.x + dx * radius, fountain.waterY, fountain.z + dz * radius],
        [0, 1, 0],
        [0.5 + dx * 0.5, 0.5 + dz * 0.5],
        [
          TOWN_WATER_FEATURE_KIND.surface,
          radial * 0.271 + segment / segments * 0.613,
          amplitude,
          0.18,
        ],
      );
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    mesh.indices.push(center, firstRing + next, firstRing + segment);
  }
  for (let ring = 1; ring < rings; ring += 1) {
    const inner = firstRing + (ring - 1) * segments;
    const outer = inner + segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = inner + segment;
      const b = inner + next;
      const c = outer + segment;
      const d = outer + next;
      mesh.indices.push(a, d, c, a, b, d);
    }
  }
}

function normalize3(x: number, y: number, z: number): readonly [number, number, number] {
  const inverseLength = 1 / (Math.hypot(x, y, z) || 1);
  return [x * inverseLength, y * inverseLength, z * inverseLength];
}

function addJet(
  mesh: MeshWriter,
  fountain: TownFountain,
  outlet: TownFountain['outlets'][number],
  outletIndex: number,
  outletCount: number,
  pathSegments: number,
  sides: number,
  splashSegments: number,
): void {
  let radialX = outlet.x - fountain.x;
  let radialZ = outlet.z - fountain.z;
  const radialLength = Math.hypot(radialX, radialZ);
  if (radialLength < 1e-5) {
    const angle = outletIndex / Math.max(outletCount, 1) * TAU;
    radialX = Math.cos(angle);
    radialZ = Math.sin(angle);
  } else {
    radialX /= radialLength;
    radialZ /= radialLength;
  }

  const landingX = fountain.x + radialX * fountain.radius * 0.72;
  const landingZ = fountain.z + radialZ * fountain.radius * 0.72;
  const startY = outlet.y;
  const endY = fountain.waterY + 0.018;
  const apexY = Math.max(fountain.jetTopY, startY + 0.05, endY + 0.05);
  const riseFromStart = Math.sqrt(Math.max(apexY - startY, 1e-4));
  const riseFromEnd = Math.sqrt(Math.max(apexY - endY, 1e-4));
  const peakT = riseFromStart / (riseFromStart + riseFromEnd);
  const curvature = (apexY - startY) / Math.max(peakT * peakT, 1e-4);
  const streamRadius = Math.min(0.095, Math.max(0.04, fountain.radius * 0.033));
  const motion = streamRadius * 0.22;
  const start = mesh.positions.length / 3;

  for (let pathIndex = 0; pathIndex <= pathSegments; pathIndex += 1) {
    const t = pathIndex / pathSegments;
    const centerX = outlet.x + (landingX - outlet.x) * t;
    const centerY = apexY - curvature * (t - peakT) * (t - peakT);
    const centerZ = outlet.z + (landingZ - outlet.z) * t;
    const tangent = normalize3(
      landingX - outlet.x,
      -2 * curvature * (t - peakT),
      landingZ - outlet.z,
    );
    const side: readonly [number, number, number] = [-radialZ, 0, radialX];
    const ringUp = normalize3(
      tangent[1] * side[2] - tangent[2] * side[1],
      tangent[2] * side[0] - tangent[0] * side[2],
      tangent[0] * side[1] - tangent[1] * side[0],
    );
    const taper = 1 - t * 0.24;
    for (let sideIndex = 0; sideIndex <= sides; sideIndex += 1) {
      const u = sideIndex / sides;
      const angle = u * TAU;
      const cosAngle = Math.cos(angle);
      const sinAngle = Math.sin(angle);
      const normal = normalize3(
        side[0] * cosAngle + ringUp[0] * sinAngle,
        side[1] * cosAngle + ringUp[1] * sinAngle,
        side[2] * cosAngle + ringUp[2] * sinAngle,
      );
      addVertex(
        mesh,
        [
          centerX + normal[0] * streamRadius * taper,
          centerY + normal[1] * streamRadius * taper,
          centerZ + normal[2] * streamRadius * taper,
        ],
        normal,
        [u, t],
        [
          TOWN_WATER_FEATURE_KIND.jet,
          outletIndex * 1.271 + u * 0.173,
          motion,
          outletIndex / Math.max(outletCount - 1, 1),
        ],
      );
    }
  }

  const stride = sides + 1;
  for (let pathIndex = 0; pathIndex < pathSegments; pathIndex += 1) {
    for (let sideIndex = 0; sideIndex < sides; sideIndex += 1) {
      const a = start + pathIndex * stride + sideIndex;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      mesh.indices.push(a, b, c, b, d, c);
    }
  }

  // A thin cutout annulus makes each landing read as a splash without a
  // transparent blended pass (the scene alpha channel is reserved for depth).
  const splashStart = mesh.positions.length / 3;
  const splashInner = fountain.radius * 0.055;
  const splashOuter = fountain.radius * 0.13;
  for (let ring = 0; ring < 2; ring += 1) {
    const splashRadius = ring === 0 ? splashInner : splashOuter;
    for (let segment = 0; segment < splashSegments; segment += 1) {
      const angle = segment / splashSegments * TAU;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      addVertex(
        mesh,
        [landingX + dx * splashRadius, fountain.waterY + 0.025, landingZ + dz * splashRadius],
        [0, 1, 0],
        [0.5 + dx * 0.5, 0.5 + dz * 0.5],
        [
          TOWN_WATER_FEATURE_KIND.surface,
          outletIndex * 0.743 + segment / splashSegments,
          motion * 0.55,
          1,
        ],
      );
    }
  }
  for (let segment = 0; segment < splashSegments; segment += 1) {
    const next = (segment + 1) % splashSegments;
    const a = splashStart + segment;
    const b = splashStart + next;
    const c = splashStart + splashSegments + segment;
    const d = splashStart + splashSegments + next;
    mesh.indices.push(a, d, c, a, b, d);
  }
}

/** Builds the circular basin skin, one arcing tube per outlet, and landing splashes. */
export function buildTownFountainMesh(
  fountain: TownFountain,
  options: TownWaterFeatureBuildOptions = {},
): TownWaterFeatureMesh {
  finite(fountain.x, 'fountain.x');
  finite(fountain.z, 'fountain.z');
  finite(fountain.basinY, 'fountain.basinY');
  finite(fountain.waterY, 'fountain.waterY');
  positive(fountain.radius, 'fountain.radius');
  finite(fountain.jetTopY, 'fountain.jetTopY');
  if (fountain.waterY < fountain.basinY) {
    throw new Error('fountain.waterY must be at or above fountain.basinY');
  }

  const basinRings = segmentCount(options.basinRings, DEFAULTS.basinRings, 1, 'basinRings');
  const basinSegments = segmentCount(
    options.basinSegments,
    DEFAULTS.basinSegments,
    3,
    'basinSegments',
  );
  const jetSegments = segmentCount(options.jetSegments, DEFAULTS.jetSegments, 3, 'jetSegments');
  const jetSides = segmentCount(options.jetSides, DEFAULTS.jetSides, 3, 'jetSides');
  const splashSegments = segmentCount(
    options.splashSegments,
    DEFAULTS.splashSegments,
    3,
    'splashSegments',
  );
  const mesh = writer();
  addBasinSurface(mesh, fountain, basinRings, basinSegments);

  for (let index = 0; index < fountain.outlets.length; index += 1) {
    const outlet = fountain.outlets[index]!;
    finite(outlet.x, `fountain.outlets[${index}].x`);
    finite(outlet.y, `fountain.outlets[${index}].y`);
    finite(outlet.z, `fountain.outlets[${index}].z`);
    addJet(
      mesh,
      fountain,
      outlet,
      index,
      fountain.outlets.length,
      jetSegments,
      jetSides,
      splashSegments,
    );
  }
  return finish(mesh);
}

/** Concatenates compatible water feature meshes while preserving index width. */
export function mergeTownWaterFeatureMeshes(
  meshes: readonly TownWaterFeatureMesh[],
): TownWaterFeatureMesh {
  const merged = writer();
  for (const mesh of meshes) {
    const vertexCount = mesh.positions.length / 3;
    if (
      mesh.normals.length !== vertexCount * 3 ||
      mesh.uvs.length !== vertexCount * 2 ||
      mesh.featureData.length !== vertexCount * 4
    ) {
      throw new Error('Water feature mesh attributes must have matching vertex counts');
    }
    const vertexOffset = merged.positions.length / 3;
    for (const value of mesh.positions) merged.positions.push(value);
    for (const value of mesh.normals) merged.normals.push(value);
    for (const value of mesh.uvs) merged.uvs.push(value);
    for (const value of mesh.featureData) merged.featureData.push(value);
    for (const index of mesh.indices) {
      if (index >= vertexCount) throw new Error('Water feature mesh index is out of range');
      merged.indices.push(index + vertexOffset);
    }
  }
  return finish(merged);
}

/** One-upload convenience used by `town/index.ts`. */
export function buildTownWaterFeatures(
  waterfall: TownWaterfall,
  fountain: TownFountain,
  options: TownWaterFeatureBuildOptions = {},
): TownWaterFeatureMesh {
  return mergeTownWaterFeatureMeshes([
    buildTownWaterfallMesh(waterfall, options),
    buildTownFountainMesh(fountain, options),
  ]);
}
