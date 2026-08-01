/**
 * A deterministic, sparse voxel grid and exposed-surface mesh compiler.
 *
 * Cells are authored on an integer lattice. The compiler greedily joins
 * adjacent faces that share material data, so a solid block produces six
 * quads rather than the internal and overlapping faces produced by cube
 * instancing. Vertex attributes intentionally stay Float32: BroMetal's shared
 * WebGL2/WebGPU attribute surface currently accepts float attributes only.
 */

export type VoxelColor = readonly [number, number, number];

export type VoxelSurfaceCell = {
  color: VoxelColor;
  materialId: number;
  roughness: number;
  specular: number;
  emissive: number;
};

export type VoxelMeshStats = {
  cellCount: number;
  exposedUnitFaceCount: number;
  culledInternalFaceCount: number;
  quadCount: number;
  triangleCount: number;
  vertexCount: number;
  indexCount: number;
  attributeBytes: number;
  coincidentUnitFaceCount: number;
};

export type VoxelSurfaceMesh = {
  /** xyz, three Float32 values per vertex, in world space. */
  positions: Float32Array;
  /** xyz, three Float32 values per vertex; axis-aligned unit normals. */
  normals: Float32Array;
  /** Linear RGB, three Float32 values per vertex. */
  baseColors: Float32Array;
  /** roughness, specular; two Float32 values per vertex. */
  materials: Float32Array;
  /** Material-table index, one Float32 value per vertex. */
  materialIds: Float32Array;
  /** Emissive mask/intensity, one Float32 value per vertex. */
  emissive: Float32Array;
  /** Baked local visibility, one Float32 value per vertex (1 = open). */
  localAo: Float32Array;
  /** Triangle-list indices. Uint32 is accepted by BroMetal on both backends. */
  indices: Uint32Array;
  bounds: {
    min: readonly [number, number, number];
    max: readonly [number, number, number];
  };
  stats: VoxelMeshStats;
};

type MutablePoint = [number, number, number];
type Axis = 0 | 1 | 2;

export type VoxelSurfaceSource = {
  cellSize: number;
  origin: readonly [number, number, number];
  /** Exact count of occupied fine-grid cells, including non-surface cells. */
  solidCellCount: number;
  /**
   * Candidate occupied cells that can touch exterior air. Interior cells may
   * be omitted; duplicate candidates are tolerated and removed deterministically.
   */
  surfaceCandidates: Iterable<readonly [number, number, number]>;
  get(x: number, y: number, z: number): VoxelSurfaceCell | undefined;
};

type FaceCell = {
  cell: VoxelSurfaceCell;
  x: number;
  y: number;
  z: number;
  a: number;
  b: number;
  signature: string;
};

type StoredCell = {
  x: number;
  y: number;
  z: number;
  cell: VoxelSurfaceCell;
};

const AXIS_A = [1, 2, 0] as const;
const AXIS_B = [2, 0, 1] as const;
const AXES = [0, 1, 2] as const;
const AO_VISIBILITY = [1, 0.82, 0.66, 0.5] as const;

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function cellSignature(cell: VoxelSurfaceCell): string {
  return `${cell.materialId}|${cell.roughness}|${cell.specular}|${cell.emissive}|${cell.color[0]}|${cell.color[1]}|${cell.color[2]}`;
}

function pointKey(point: readonly number[]): string {
  return `${point[0]},${point[1]},${point[2]}`;
}

/** Sparse authoring grid used by the town kit and reusable voxel assets. */
export class VoxelSurfaceGrid {
  private readonly cells = new Map<string, StoredCell>();

  constructor(
    readonly cellSize: number,
    readonly origin: readonly [number, number, number] = [0, 0, 0],
  ) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new Error(`Voxel cellSize must be finite and positive; received ${cellSize}`);
    }
  }

  set(x: number, y: number, z: number, cell: VoxelSurfaceCell): void {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
      throw new Error(`Voxel coordinates must be integers; received ${x},${y},${z}`);
    }
    this.cells.set(key(x, y, z), { x, y, z, cell });
  }

  delete(x: number, y: number, z: number): void {
    this.cells.delete(key(x, y, z));
  }

  get(x: number, y: number, z: number): VoxelSurfaceCell | undefined {
    return this.cells.get(key(x, y, z))?.cell;
  }

  has(x: number, y: number, z: number): boolean {
    return this.cells.has(key(x, y, z));
  }

  *entries(): IterableIterator<readonly [number, number, number, VoxelSurfaceCell]> {
    for (const { x, y, z, cell } of this.cells.values()) yield [x, y, z, cell] as const;
  }

  fill(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    cell: VoxelSurfaceCell,
  ): void {
    for (let ix = 0; ix < width; ix += 1) {
      for (let iy = 0; iy < height; iy += 1) {
        for (let iz = 0; iz < depth; iz += 1) {
          this.set(x + ix, y + iy, z + iz, cell);
        }
      }
    }
  }

  compile(): VoxelSurfaceMesh {
    return compileVoxelSurfaceSource({
      cellSize: this.cellSize,
      origin: this.origin,
      solidCellCount: this.cells.size,
      surfaceCandidates: [...this.cells.values()].map(({ x, y, z }) => [x, y, z] as const),
      get: (x, y, z) => this.get(x, y, z),
    });
  }
}

export function compileVoxelSurfaceSource(source: VoxelSurfaceSource): VoxelSurfaceMesh {
  const { cellSize, origin } = source;
  if (source.solidCellCount === 0) {
    return {
      positions: new Float32Array(),
      normals: new Float32Array(),
      baseColors: new Float32Array(),
      materials: new Float32Array(),
      materialIds: new Float32Array(),
      emissive: new Float32Array(),
      localAo: new Float32Array(),
      indices: new Uint32Array(),
      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
      stats: {
        cellCount: 0,
        exposedUnitFaceCount: 0,
        culledInternalFaceCount: 0,
        quadCount: 0,
        triangleCount: 0,
        vertexCount: 0,
        indexCount: 0,
        attributeBytes: 0,
        coincidentUnitFaceCount: 0,
      },
    };
  }

  let exposedUnitFaceCount = 0;
  let coincidentUnitFaceCount = 0;
  const unitFaces = new Set<string>();
  const visitedCandidates = new Set<string>();
  const min: MutablePoint = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: MutablePoint = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  const buckets = new Map<string, {
    axis: Axis;
    sign: -1 | 1;
    plane: number;
    faces: Map<string, FaceCell>;
  }>();

  for (const rawCoordinate of source.surfaceCandidates) {
    const coordinate: MutablePoint = [rawCoordinate[0], rawCoordinate[1], rawCoordinate[2]];
    const coordinateKey = key(coordinate[0], coordinate[1], coordinate[2]);
    if (visitedCandidates.has(coordinateKey)) continue;
    visitedCandidates.add(coordinateKey);
    const cell = source.get(coordinate[0], coordinate[1], coordinate[2]);
    if (!cell) continue;
    for (const axis of AXES) {
      min[axis] = Math.min(min[axis], coordinate[axis]);
      max[axis] = Math.max(max[axis], coordinate[axis]);
    }
    for (const axis of AXES) {
      for (const sign of [-1, 1] as const) {
        const neighbor = [...coordinate] as MutablePoint;
        neighbor[axis] += sign;
        if (source.get(neighbor[0], neighbor[1], neighbor[2])) continue;
        const boundary = coordinate[axis] + (sign > 0 ? 1 : 0);
        const a = AXIS_A[axis];
        const b = AXIS_B[axis];
        const faceKey = `${axis}:${boundary}:${coordinate[a]}:${coordinate[b]}`;
        if (unitFaces.has(faceKey)) {
          coincidentUnitFaceCount += 1;
          continue;
        }
        unitFaces.add(faceKey);
        exposedUnitFaceCount += 1;
        const bucketKey = `${axis}:${sign}:${coordinate[axis]}`;
        let bucket = buckets.get(bucketKey);
        if (!bucket) {
          bucket = { axis, sign, plane: coordinate[axis], faces: new Map() };
          buckets.set(bucketKey, bucket);
        }
        bucket.faces.set(`${coordinate[a]},${coordinate[b]}`, {
          cell,
          x: coordinate[0],
          y: coordinate[1],
          z: coordinate[2],
          a: coordinate[a],
          b: coordinate[b],
          signature: cellSignature(cell),
        });
      }
    }
  }

  if (!Number.isFinite(min[0])) {
    throw new Error('Voxel surface source declared solid cells but supplied no occupied surface candidates');
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const baseColors: number[] = [];
  const materials: number[] = [];
  const materialIds: number[] = [];
  const emissive: number[] = [];
  const localAo: number[] = [];
  const indices: number[] = [];

  const toWorld = (axis: Axis, latticePosition: number): number => (
    origin[axis] + latticePosition * cellSize
  );

  const isSolid = (point: MutablePoint): boolean => Boolean(source.get(point[0], point[1], point[2]));

  const cornerOcclusion = (
    faceCoordinate: MutablePoint,
    normalAxis: Axis,
    normalSign: -1 | 1,
    aAxis: Axis,
    aSign: -1 | 1,
    bAxis: Axis,
    bSign: -1 | 1,
  ): number => {
    const outside = [...faceCoordinate] as MutablePoint;
    outside[normalAxis] += normalSign;
    const sideA = [...outside] as MutablePoint;
    const sideB = [...outside] as MutablePoint;
    const diagonal = [...outside] as MutablePoint;
    sideA[aAxis] += aSign;
    sideB[bAxis] += bSign;
    diagonal[aAxis] += aSign;
    diagonal[bAxis] += bSign;
    const aBlocked = isSolid(sideA);
    const bBlocked = isSolid(sideB);
    const blocked = aBlocked && bBlocked
      ? 3
      : Number(aBlocked) + Number(bBlocked) + Number(isSolid(diagonal));
    return AO_VISIBILITY[blocked]!;
  };

  const emitQuad = (
    axis: Axis,
    sign: -1 | 1,
    plane: number,
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
    face: FaceCell,
  ): void => {
    const aAxis = AXIS_A[axis];
    const bAxis = AXIS_B[axis];
    const planeBoundary = plane + (sign > 0 ? 0.5 : -0.5);
    const point = (a: number, b: number): MutablePoint => {
      const result: MutablePoint = [0, 0, 0];
      result[axis] = toWorld(axis, planeBoundary);
      result[aAxis] = toWorld(aAxis, a);
      result[bAxis] = toWorld(bAxis, b);
      return result;
    };
    const p00 = point(aStart - 0.5, bStart - 0.5);
    const p10 = point(aEnd + 0.5, bStart - 0.5);
    const p11 = point(aEnd + 0.5, bEnd + 0.5);
    const p01 = point(aStart - 0.5, bEnd + 0.5);
    const corners = sign > 0 ? [p00, p10, p11, p01] : [p00, p01, p11, p10];
    const aoCoordinates: readonly (readonly [number, number, -1 | 1, -1 | 1])[] = sign > 0
      ? [
          [aStart, bStart, -1, -1],
          [aEnd, bStart, 1, -1],
          [aEnd, bEnd, 1, 1],
          [aStart, bEnd, -1, 1],
        ]
      : [
          [aStart, bStart, -1, -1],
          [aStart, bEnd, -1, 1],
          [aEnd, bEnd, 1, 1],
          [aEnd, bStart, 1, -1],
        ];

    const first = positions.length / 3;
    for (let cornerIndex = 0; cornerIndex < 4; cornerIndex += 1) {
      const corner = corners[cornerIndex]!;
      positions.push(corner[0], corner[1], corner[2]);
      const normal: MutablePoint = [0, 0, 0];
      normal[axis] = sign;
      normals.push(normal[0], normal[1], normal[2]);
      baseColors.push(face.cell.color[0], face.cell.color[1], face.cell.color[2]);
      materials.push(face.cell.roughness, face.cell.specular);
      materialIds.push(face.cell.materialId);
      emissive.push(face.cell.emissive);

      const ao = aoCoordinates[cornerIndex]!;
      const faceCoordinate: MutablePoint = [face.x, face.y, face.z];
      faceCoordinate[aAxis] = ao[0];
      faceCoordinate[bAxis] = ao[1];
      localAo.push(cornerOcclusion(faceCoordinate, axis, sign, aAxis, ao[2], bAxis, ao[3]));
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };

  const sortedBuckets = [...buckets.values()].sort((left, right) => (
    left.axis - right.axis || left.sign - right.sign || left.plane - right.plane
  ));
  for (const bucket of sortedBuckets) {
    const remaining = new Map(bucket.faces);
    const orderedFaces = [...bucket.faces.values()].sort((left, right) => (
      left.b - right.b || left.a - right.a || left.signature.localeCompare(right.signature)
    ));
    for (const face of orderedFaces) {
      if (!remaining.has(`${face.a},${face.b}`)) continue;
      let width = 1;
      while (remaining.get(`${face.a + width},${face.b}`)?.signature === face.signature) width += 1;
      let height = 1;
      heightLoop: while (true) {
        for (let span = 0; span < width; span += 1) {
          if (remaining.get(`${face.a + span},${face.b + height}`)?.signature !== face.signature) {
            break heightLoop;
          }
        }
        height += 1;
      }
      for (let b = 0; b < height; b += 1) {
        for (let a = 0; a < width; a += 1) {
          remaining.delete(`${face.a + a},${face.b + b}`);
        }
      }
      emitQuad(
        bucket.axis,
        bucket.sign,
        bucket.plane,
        face.a,
        face.a + width - 1,
        face.b,
        face.b + height - 1,
        face,
      );
    }
  }

  const positionArray = new Float32Array(positions);
  const normalArray = new Float32Array(normals);
  const baseColorArray = new Float32Array(baseColors);
  const materialPropertiesArray = new Float32Array(materials);
  const materialArray = new Float32Array(materialIds);
  const emissiveArray = new Float32Array(emissive);
  const localAoArray = new Float32Array(localAo);
  const indexArray = new Uint32Array(indices);
  const attributeBytes = positionArray.byteLength
    + normalArray.byteLength
    + baseColorArray.byteLength
    + materialPropertiesArray.byteLength
    + materialArray.byteLength
    + emissiveArray.byteLength
    + localAoArray.byteLength
    + indexArray.byteLength;

  const worldMin: MutablePoint = [0, 0, 0];
  const worldMax: MutablePoint = [0, 0, 0];
  for (const axis of AXES) {
    worldMin[axis] = toWorld(axis, min[axis] - 0.5);
    worldMax[axis] = toWorld(axis, max[axis] + 0.5);
  }
  const vertexCount = positionArray.length / 3;
  return {
    positions: positionArray,
    normals: normalArray,
    baseColors: baseColorArray,
    materials: materialPropertiesArray,
    materialIds: materialArray,
    emissive: emissiveArray,
    localAo: localAoArray,
    indices: indexArray,
    bounds: { min: worldMin, max: worldMax },
    stats: {
      cellCount: source.solidCellCount,
      exposedUnitFaceCount,
      culledInternalFaceCount: Math.max(0, source.solidCellCount * 6 - exposedUnitFaceCount),
      quadCount: vertexCount / 4,
      triangleCount: indexArray.length / 3,
      vertexCount,
      indexCount: indexArray.length,
      attributeBytes,
      coincidentUnitFaceCount,
    },
  };
}

export type VoxelMeshValidation = {
  valid: boolean;
  errors: string[];
  fingerprint: string;
};

/** Cheap load-time/offline integrity validation for authored surface meshes. */
export function validateVoxelSurfaceMesh(mesh: VoxelSurfaceMesh): VoxelMeshValidation {
  const errors: string[] = [];
  const vertexCount = mesh.positions.length / 3;
  const expect = (condition: boolean, message: string): void => {
    if (!condition) errors.push(message);
  };
  expect(Number.isInteger(vertexCount), 'positions must contain complete xyz vertices');
  expect(mesh.normals.length === vertexCount * 3, 'normal count does not match positions');
  expect(mesh.baseColors.length === vertexCount * 3, 'base-color count does not match positions');
  expect(mesh.materials.length === vertexCount * 2, 'material property count does not match positions');
  expect(mesh.materialIds.length === vertexCount, 'material-id count does not match positions');
  expect(mesh.emissive.length === vertexCount, 'emissive count does not match positions');
  expect(mesh.localAo.length === vertexCount, 'local-AO count does not match positions');
  expect(mesh.indices.length % 3 === 0, 'indices must describe complete triangles');
  expect(mesh.stats.coincidentUnitFaceCount === 0, 'source contains coincident unit faces');

  for (const [name, array] of [
    ['positions', mesh.positions],
    ['normals', mesh.normals],
    ['baseColors', mesh.baseColors],
    ['materials', mesh.materials],
    ['materialIds', mesh.materialIds],
    ['emissive', mesh.emissive],
    ['localAo', mesh.localAo],
  ] as const) {
    for (let index = 0; index < array.length; index += 1) {
      if (!Number.isFinite(array[index])) {
        errors.push(`${name}[${index}] is not finite`);
        break;
      }
    }
  }
  for (let index = 0; index < mesh.indices.length; index += 1) {
    if (mesh.indices[index]! >= vertexCount) {
      errors.push(`indices[${index}] is outside the vertex range`);
      break;
    }
  }
  for (let index = 0; index < mesh.localAo.length; index += 1) {
    const value = mesh.localAo[index]!;
    if (value < 0 || value > 1) {
      errors.push(`localAo[${index}] must be between zero and one`);
      break;
    }
  }

  // FNV-1a over every typed buffer. It is not cryptographic; it is a compact
  // deterministic-output regression key suitable for tests and build reports.
  let fingerprint = 0x811c9dc5;
  const hashBytes = (view: ArrayBufferView): void => {
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    for (const byte of bytes) {
      fingerprint ^= byte;
      fingerprint = Math.imul(fingerprint, 0x01000193) >>> 0;
    }
  };
  hashBytes(mesh.positions);
  hashBytes(mesh.normals);
  hashBytes(mesh.baseColors);
  hashBytes(mesh.materials);
  hashBytes(mesh.materialIds);
  hashBytes(mesh.emissive);
  hashBytes(mesh.localAo);
  hashBytes(mesh.indices);

  return {
    valid: errors.length === 0,
    errors,
    fingerprint: fingerprint.toString(16).padStart(8, '0'),
  };
}

/** Canonicalizes a quad for optional higher-level duplicate-face diagnostics. */
export function voxelQuadKey(mesh: VoxelSurfaceMesh, quadIndex: number): string {
  const start = quadIndex * 4;
  const points: string[] = [];
  for (let vertex = 0; vertex < 4; vertex += 1) {
    const offset = (start + vertex) * 3;
    points.push(pointKey([
      mesh.positions[offset]!,
      mesh.positions[offset + 1]!,
      mesh.positions[offset + 2]!,
    ]));
  }
  return points.sort().join('|');
}
