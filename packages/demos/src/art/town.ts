import {
  VoxelSurfaceGrid,
  compileVoxelSurfaceSource,
  validateVoxelSurfaceMesh,
  type VoxelMeshValidation,
  type VoxelSurfaceCell,
  type VoxelSurfaceMesh,
} from './voxel-surface-mesh';

export const VOXEL_SIZE = 0.62;
/** 0.2067 m surface cells: fine enough for trim without desktop-scale density. */
export const TOWN_DETAIL_RESOLUTION = 3;
const DETAIL = 1 / TOWN_DETAIL_RESOLUTION;
export const FAR_DEPTH = 180;
export const WATER_LEVEL = -1.25;

type Color = readonly [number, number, number];

export type TownProp = {
  x: number;
  y: number;
  z: number;
  size: number;
  tile: number;
  tint: Color;
};

export type TownWalker = {
  row: number;
  speed: number;
  phase: number;
  scale: number;
  tint: Color;
  path: readonly (readonly [number, number])[];
};

export type TownCollider = {
  id: string;
  minX: number;
  maxX: number;
  minY?: number;
  maxY?: number;
  minZ: number;
  maxZ: number;
  supportsGround?: boolean;
};

export type TownWorld = {
  /** Legacy cube instances retained until the renderer switches to `mesh`. */
  voxels: {
    offsets: Float32Array;
    colors: Float32Array;
    glow: Float32Array;
    count: number;
  };
  /** Static, surface-only triangle mesh. See VoxelSurfaceMesh for buffer layout. */
  mesh: VoxelSurfaceMesh;
  /** Stable material lookup used by materialIds and authoring/debug tooling. */
  materials: readonly TownMaterial[];
  geometryValidation: VoxelMeshValidation;
  props: TownProp[];
  walkers: TownWalker[];
  heroPath: readonly (readonly [number, number])[];
  spawn: readonly [number, number];
  waterBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  extent: number;
  physicsColliders: readonly TownCollider[];
  walkSurfaceHeight(x: number, z: number): number;
  walkSurfaceNormal(x: number, z: number): readonly [number, number, number];
  /** @deprecated Use walkSurfaceHeight; retained for the current renderer. */
  surfaceHeight(x: number, z: number): number;
  canWalk(x: number, z: number): boolean;
};

const PALETTE = {
  grass: [0.19, 0.27, 0.13],
  grassLight: [0.29, 0.37, 0.17],
  soil: [0.25, 0.18, 0.12],
  cobble: [0.37, 0.35, 0.34],
  cobbleLight: [0.48, 0.44, 0.39],
  cobbleDark: [0.29, 0.29, 0.31],
  cobbleMoss: [0.31, 0.35, 0.24],
  stone: [0.43, 0.42, 0.43],
  stoneLight: [0.58, 0.54, 0.49],
  stoneDark: [0.24, 0.25, 0.29],
  plaster: [0.66, 0.56, 0.43],
  plasterPale: [0.76, 0.68, 0.54],
  plasterWarm: [0.7, 0.58, 0.42],
  plasterCool: [0.62, 0.56, 0.49],
  timber: [0.24, 0.14, 0.09],
  roofRed: [0.48, 0.17, 0.1],
  roofRedDark: [0.35, 0.105, 0.065],
  roofRedLight: [0.59, 0.225, 0.12],
  roofGold: [0.52, 0.31, 0.1],
  roofGoldDark: [0.39, 0.225, 0.07],
  roofGoldLight: [0.66, 0.43, 0.14],
  roofSlate: [0.2, 0.23, 0.29],
  roofSlateDark: [0.135, 0.155, 0.205],
  roofSlateLight: [0.29, 0.32, 0.39],
  clothRed: [0.62, 0.2, 0.13],
  clothBlue: [0.19, 0.31, 0.49],
  clothGold: [0.64, 0.4, 0.12],
  clothCream: [0.72, 0.61, 0.42],
  leaf: [0.18, 0.34, 0.14],
  leafLight: [0.32, 0.47, 0.18],
  leafGold: [0.51, 0.44, 0.15],
  waterBed: [0.08, 0.15, 0.17],
  waterTile: [0.09, 0.31, 0.34],
  shadow: [0.11, 0.11, 0.15],
  window: [0.64, 0.3, 0.08],
  lantern: [0.58, 0.28, 0.08],
  flowerViolet: [0.43, 0.28, 0.66],
  flowerCream: [0.88, 0.78, 0.58],
  mortar: [0.31, 0.3, 0.31],
  iron: [0.17, 0.19, 0.22],
  timberLight: [0.37, 0.22, 0.12],
  roofEdge: [0.34, 0.12, 0.08],
  glassCool: [0.18, 0.34, 0.42],
  waterFoam: [0.38, 0.66, 0.66],
  produceRed: [0.58, 0.16, 0.1],
  produceGold: [0.72, 0.48, 0.12],
  produceGreen: [0.3, 0.46, 0.16],
  terracotta: [0.53, 0.235, 0.115],
  rope: [0.48, 0.37, 0.22],
} as const satisfies Record<string, Color>;

type PaletteName = keyof typeof PALETTE;

const PALETTE_ORDER = [
  'grass', 'grassLight', 'soil', 'cobble', 'cobbleLight', 'cobbleDark', 'cobbleMoss',
  'stone', 'stoneLight', 'stoneDark', 'plaster', 'plasterPale', 'plasterWarm',
  'plasterCool', 'timber', 'roofRed', 'roofRedDark', 'roofRedLight', 'roofGold',
  'roofGoldDark', 'roofGoldLight', 'roofSlate', 'roofSlateDark', 'roofSlateLight',
  'clothRed', 'clothBlue', 'clothGold', 'clothCream', 'leaf',
  'leafLight', 'leafGold', 'waterBed', 'waterTile', 'shadow', 'window',
  'lantern', 'flowerViolet', 'flowerCream', 'mortar', 'iron', 'timberLight',
  'roofEdge', 'glassCool', 'waterFoam', 'produceRed', 'produceGold', 'produceGreen',
  'terracotta', 'rope',
] as const satisfies readonly PaletteName[];

export type TownMaterial = {
  id: number;
  name: PaletteName | 'custom';
  baseColor: Color;
  roughness: number;
  specular: number;
};

function materialResponse(name: PaletteName): readonly [roughness: number, specular: number] {
  if (name === 'window' || name === 'glassCool') return [0.2, 0.72];
  if (name === 'waterTile' || name === 'waterFoam') return [0.28, 0.58];
  if (name === 'iron') return [0.46, 0.52];
  if (name.startsWith('cloth')) return [0.94, 0.035];
  if (name.startsWith('leaf') || name.startsWith('flower') || name.startsWith('produce')) return [0.9, 0.04];
  if (name.startsWith('roof')) return [0.82, 0.075];
  if (name === 'timber' || name === 'timberLight') return [0.86, 0.055];
  if (name === 'lantern') return [0.52, 0.22];
  return [0.9, 0.055];
}

export const TOWN_MATERIALS: readonly TownMaterial[] = [
  ...PALETTE_ORDER.map((name, id): TownMaterial => {
    const [roughness, specular] = materialResponse(name);
    return { id, name, baseColor: PALETTE[name], roughness, specular };
  }),
  {
    id: PALETTE_ORDER.length,
    name: 'custom',
    baseColor: [1, 1, 1],
    roughness: 0.86,
    specular: 0.055,
  },
];

const MATERIAL_IDS = Object.fromEntries(
  PALETTE_ORDER.map((name, id) => [name, id]),
) as Record<PaletteName, number>;

type Cell = {
  x: number;
  y: number;
  z: number;
  color: Color;
  legacyColor?: Color;
  glow: number;
  materialId: number;
  roughness: number;
  specular: number;
};

class VoxelBuilder {
  private readonly cells = new Map<string, Cell>();
  private readonly surfaceCarves = new Set<string>();
  private readonly surfaceDetailCarves = new Map<string, readonly [number, number, number]>();
  private readonly surface = new VoxelSurfaceGrid(
    VOXEL_SIZE / TOWN_DETAIL_RESOLUTION,
    [
      -VOXEL_SIZE / 2 + VOXEL_SIZE / TOWN_DETAIL_RESOLUTION / 2,
      -VOXEL_SIZE / 2 + VOXEL_SIZE / TOWN_DETAIL_RESOLUTION / 2,
      -VOXEL_SIZE / 2 + VOXEL_SIZE / TOWN_DETAIL_RESOLUTION / 2,
    ],
  );

  private resolveMaterial(color: PaletteName | Color): Omit<Cell, 'x' | 'y' | 'z' | 'glow'> {
    if (typeof color === 'string') {
      const material = TOWN_MATERIALS[MATERIAL_IDS[color]]!;
      return {
        color: material.baseColor,
        materialId: material.id,
        roughness: material.roughness,
        specular: material.specular,
      };
    }
    const material = TOWN_MATERIALS[TOWN_MATERIALS.length - 1]!;
    return {
      color,
      materialId: material.id,
      roughness: material.roughness,
      specular: material.specular,
    };
  }

  private surfaceCell(cell: Cell): VoxelSurfaceCell {
    return {
      color: cell.color,
      materialId: cell.materialId,
      roughness: cell.roughness,
      specular: cell.specular,
      emissive: cell.glow,
    };
  }

  private detailRange(center: number, size: number): readonly [number, number] {
    const start = Math.round((center - size / 2 + 0.5) * TOWN_DETAIL_RESOLUTION);
    const end = Math.max(
      start + 1,
      Math.round((center + size / 2 + 0.5) * TOWN_DETAIL_RESOLUTION),
    );
    return [start, end];
  }

  set(x: number, y: number, z: number, color: PaletteName | Color, glow = 0): void {
    const cell = { x, y, z, glow, ...this.resolveMaterial(color) };
    this.cells.set(`${x},${y},${z}`, cell);
  }

  shade(x: number, y: number, z: number, amount: number): void {
    const key = `${x},${y},${z}`;
    const current = this.cells.get(key);
    if (!current) return;
    const factor = Math.max(0.28, 1 - amount);
    const shaded: Color = [
      current.color[0] * factor,
      current.color[1] * factor,
      current.color[2] * factor * 1.06,
    ];
    // Legacy cube instances keep the old art-directed ground stain. The new
    // surface mesh deliberately does not: real lighting owns cast shadows,
    // while only local cavity AO is baked into mesh.localAo.
    current.legacyColor = shaded;
  }

  /** Removes one macro voxel from the visual mesh without changing legacy collision/data. */
  carveSurfaceCell(x: number, y: number, z: number): void {
    this.surfaceCarves.add(`${x},${y},${z}`);
    for (let ix = 0; ix < TOWN_DETAIL_RESOLUTION; ix += 1) {
      for (let iy = 0; iy < TOWN_DETAIL_RESOLUTION; iy += 1) {
        for (let iz = 0; iz < TOWN_DETAIL_RESOLUTION; iz += 1) {
          this.surface.delete(
            x * TOWN_DETAIL_RESOLUTION + ix,
            y * TOWN_DETAIL_RESOLUTION + iy,
            z * TOWN_DETAIL_RESOLUTION + iz,
          );
        }
      }
    }
  }

  /** Carves only the requested fine-grid volume from the visual union. */
  carveSurfaceBox(
    centerX: number,
    centerY: number,
    centerZ: number,
    width: number,
    height: number,
    depth: number,
  ): void {
    const [minX, maxX] = this.detailRange(centerX, width);
    const [minY, maxY] = this.detailRange(centerY, height);
    const [minZ, maxZ] = this.detailRange(centerZ, depth);
    for (let x = minX; x < maxX; x += 1) {
      for (let y = minY; y < maxY; y += 1) {
        for (let z = minZ; z < maxZ; z += 1) {
          const detailKey = `${x},${y},${z}`;
          this.surface.delete(x, y, z);
          this.surfaceDetailCarves.set(detailKey, [x, y, z]);
        }
      }
    }
  }

  /**
   * Adds an axis-aligned detail box snapped to the 0.2067 m visual lattice.
   * Coordinates remain in macro-voxel units; the rasterized union makes trim,
   * recesses, and the parent volume share boundaries without coplanar faces.
   */
  surfaceBox(
    centerX: number,
    centerY: number,
    centerZ: number,
    width: number,
    height: number,
    depth: number,
    color: PaletteName | Color,
    glow = 0,
  ): void {
    const [minX, maxX] = this.detailRange(centerX, width);
    const [minY, maxY] = this.detailRange(centerY, height);
    const [minZ, maxZ] = this.detailRange(centerZ, depth);
    const resolved = this.resolveMaterial(color);
    for (let x = minX; x < maxX; x += 1)
      for (let y = minY; y < maxY; y += 1)
        for (let z = minZ; z < maxZ; z += 1)
          this.surfaceDetailCarves.delete(`${x},${y},${z}`);
    this.surface.fill(minX, minY, minZ, maxX - minX, maxY - minY, maxZ - minZ, {
      color: resolved.color,
      materialId: resolved.materialId,
      roughness: resolved.roughness,
      specular: resolved.specular,
      emissive: glow,
    });
  }

  fillBox(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: PaletteName | Color,
    glow = 0,
  ): void {
    for (let ix = 0; ix < width; ix += 1)
      for (let iy = 0; iy < height; iy += 1)
        for (let iz = 0; iz < depth; iz += 1)
          this.set(x + ix, y + iy, z + iz, color, glow);
  }

  shell(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: PaletteName | Color,
  ): void {
    for (let ix = 0; ix < width; ix += 1)
      for (let iy = 0; iy < height; iy += 1)
        for (let iz = 0; iz < depth; iz += 1) {
          const edge = ix === 0 || ix === width - 1 || iy === 0 || iy === height - 1 || iz === 0 || iz === depth - 1;
          if (edge) this.set(x + ix, y + iy, z + iz, color);
        }
  }

  compile() {
    const cells = [...this.cells.values()].sort((left, right) => (
      left.x - right.x || left.y - right.y || left.z - right.z
    ));
    const offsets = new Float32Array(cells.length * 3);
    const colors = new Float32Array(cells.length * 3);
    const glow = new Float32Array(cells.length);
    cells.forEach((cell, index) => {
      offsets.set([cell.x * VOXEL_SIZE, cell.y * VOXEL_SIZE, cell.z * VOXEL_SIZE], index * 3);
      colors.set(cell.legacyColor ?? cell.color, index * 3);
      glow[index] = cell.glow;
    });
    return { offsets, colors, glow, count: cells.length };
  }

  compileSurface(): VoxelSurfaceMesh {
    const resolution = TOWN_DETAIL_RESOLUTION;
    const macroKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;
    const macroAt = (x: number, y: number, z: number): Cell | undefined => {
      const cellKey = macroKey(x, y, z);
      if (this.surfaceCarves.has(cellKey)) return undefined;
      return this.cells.get(cellKey);
    };
    const baseAtFine = (x: number, y: number, z: number): Cell | undefined => macroAt(
      Math.floor(x / resolution),
      Math.floor(y / resolution),
      Math.floor(z / resolution),
    );
    const get = (x: number, y: number, z: number): VoxelSurfaceCell | undefined => {
      if (this.surfaceDetailCarves.has(`${x},${y},${z}`)) return undefined;
      const detail = this.surface.get(x, y, z);
      if (detail) return detail;
      const macro = baseAtFine(x, y, z);
      return macro ? this.surfaceCell(macro) : undefined;
    };

    const sortedMacroCells = [...this.cells.values()].sort((left, right) => (
      left.x - right.x || left.y - right.y || left.z - right.z
    ));
    const detailEntries = [...this.surface.entries()].sort((left, right) => (
      left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
    ));
    const axes = [0, 1, 2] as const;
    const surfaceCandidates = function* (): IterableIterator<readonly [number, number, number]> {
      for (const cell of sortedMacroCells) {
        if (!macroAt(cell.x, cell.y, cell.z)) continue;
        for (const axis of axes) {
          for (const sign of [-1, 1] as const) {
            const neighbor = [cell.x, cell.y, cell.z];
            neighbor[axis] = neighbor[axis]! + sign;
            if (macroAt(neighbor[0]!, neighbor[1]!, neighbor[2]!)) continue;
            const normalFine = (
              (axis === 0 ? cell.x : axis === 1 ? cell.y : cell.z) * resolution
              + (sign > 0 ? resolution - 1 : 0)
            );
            const aAxis = (axis + 1) % 3;
            const bAxis = (axis + 2) % 3;
            for (let a = 0; a < resolution; a += 1) {
              for (let b = 0; b < resolution; b += 1) {
                const coordinate = [cell.x * resolution, cell.y * resolution, cell.z * resolution];
                coordinate[axis] = normalFine;
                coordinate[aAxis] = coordinate[aAxis]! + a;
                coordinate[bAxis] = coordinate[bAxis]! + b;
                yield [coordinate[0]!, coordinate[1]!, coordinate[2]!] as const;
              }
            }
          }
        }
      }
      for (const [x, y, z] of detailEntries) yield [x, y, z] as const;
      for (const [x, y, z] of this.surfaceDetailCarves.values()) {
        yield [x, y, z] as const;
        for (const axis of axes) {
          for (const sign of [-1, 1] as const) {
            const neighbor = [x, y, z];
            neighbor[axis] = neighbor[axis]! + sign;
            yield [neighbor[0]!, neighbor[1]!, neighbor[2]!] as const;
          }
        }
      }
    };

    let solidCellCount = (sortedMacroCells.length - this.surfaceCarves.size) * resolution ** 3;
    for (const [x, y, z] of this.surfaceDetailCarves.values()) {
      if (baseAtFine(x, y, z)) solidCellCount -= 1;
    }
    for (const [x, y, z] of detailEntries) {
      if (!baseAtFine(x, y, z)) solidCellCount += 1;
    }
    return compileVoxelSurfaceSource({
      cellSize: VOXEL_SIZE / resolution,
      origin: [
        -VOXEL_SIZE / 2 + VOXEL_SIZE / resolution / 2,
        -VOXEL_SIZE / 2 + VOXEL_SIZE / resolution / 2,
        -VOXEL_SIZE / 2 + VOXEL_SIZE / resolution / 2,
      ],
      solidCellCount,
      surfaceCandidates: surfaceCandidates(),
      get,
    });
  }
}

const CANAL_MIN_Z = 11;
const CANAL_MAX_Z = 18;
const BRIDGE_MIN_X = -5;
const BRIDGE_MAX_X = 5;
const WORLD_MIN_X = -46;
const WORLD_MAX_X = 46;
const WORLD_MIN_Z = -36;
const WORLD_MAX_Z = 34;
// The interactive camera sits behind the playable boundary. Continue the
// ground beneath it so no finite platform edge can enter the frame.
const VISUAL_MAX_Z = 72;

function isCanal(gx: number, gz: number): boolean {
  return gz >= CANAL_MIN_Z && gz <= CANAL_MAX_Z;
}

function isBridge(gx: number, gz: number): boolean {
  return isCanal(gx, gz) && gx >= BRIDGE_MIN_X && gx <= BRIDGE_MAX_X;
}

function bridgeHeight(gz: number): number {
  const heights = [1, 1, 2, 2, 3, 3, 2, 2];
  return heights[Math.max(0, Math.min(heights.length - 1, gz - CANAL_MIN_Z))]!;
}

/** Top of the authored bridge deck in macro-grid coordinates. */
function bridgeRampGridHeight(gz: number): number {
  const span = CANAL_MAX_Z - CANAL_MIN_Z + 1;
  const t = Math.max(0, Math.min(1, (gz - (CANAL_MIN_Z - 0.5)) / span));
  const bankSlope = 1.5 + (0.5 - 1.5) * t;
  return bankSlope + Math.sin(t * Math.PI) * 1.35;
}

function bridgeSurfaceGridHeight(gz: number): number {
  const span = CANAL_MAX_Z - CANAL_MIN_Z + 1;
  const fineStep = Math.max(
    0,
    Math.min(
      span * TOWN_DETAIL_RESOLUTION - 1,
      Math.floor((gz - (CANAL_MIN_Z - 0.5)) * TOWN_DETAIL_RESOLUTION),
    ),
  );
  const sampleZ = CANAL_MIN_Z - 0.5 + (fineStep + 0.5) / TOWN_DETAIL_RESOLUTION;
  const boundary = Math.round((bridgeRampGridHeight(sampleZ) + 0.5) * TOWN_DETAIL_RESOLUTION);
  return -0.5 + boundary / TOWN_DETAIL_RESOLUTION;
}

function groundHeightGrid(gx: number, gz: number): number {
  if (isBridge(gx, gz)) return bridgeHeight(gz);
  if (gz < -24) return 2;
  if (gz < CANAL_MIN_Z) return 1;
  return 0;
}

function worldPoint(gx: number, gz: number): readonly [number, number] {
  return [gx * VOXEL_SIZE, gz * VOXEL_SIZE];
}

function topSurfaceGrid(gx: number, gz: number): number {
  if (isBridge(gx, gz)) return bridgeSurfaceGridHeight(gz) * VOXEL_SIZE;
  return (groundHeightGrid(gx, gz) + 0.5) * VOXEL_SIZE;
}

function addCollider(
  colliders: TownCollider[],
  x: number,
  z: number,
  width: number,
  depth: number,
  margin = 0.35,
  id = `town.obstacle.${x}.${z}.${width}.${depth}`,
): void {
  colliders.push({
    id,
    minX: (x - 0.5) * VOXEL_SIZE - margin,
    maxX: (x + width - 0.5) * VOXEL_SIZE + margin,
    minZ: (z - 0.5) * VOXEL_SIZE - margin,
    maxZ: (z + depth - 0.5) * VOXEL_SIZE + margin,
  });
}

function addWaterColliders(colliders: TownCollider[]): void {
  const canalMinZ = (CANAL_MIN_Z - 0.5) * VOXEL_SIZE;
  const canalMaxZ = (CANAL_MAX_Z + 0.5) * VOXEL_SIZE;
  colliders.push(
    {
      id: 'town.water.canal.west',
      minX: (WORLD_MIN_X - 0.5) * VOXEL_SIZE,
      maxX: (BRIDGE_MIN_X - 0.5) * VOXEL_SIZE,
      minZ: canalMinZ,
      maxZ: canalMaxZ,
    },
    {
      id: 'town.water.canal.east',
      minX: (BRIDGE_MAX_X + 0.5) * VOXEL_SIZE,
      maxX: (WORLD_MAX_X + 0.5) * VOXEL_SIZE,
      minZ: canalMinZ,
      maxZ: canalMaxZ,
    },
  );
}

function castShadow(builder: VoxelBuilder, x: number, z: number, width: number, depth: number, reach = 8): void {
  for (let step = 1; step <= reach; step += 1) {
    const alpha = 0.14 + (1 - step / reach) * 0.18;
    for (let ix = 0; ix < width; ix += 1)
      for (let iz = 0; iz < depth; iz += 1) {
        const sx = x + ix - step;
        const sz = z + iz - Math.floor(step * 0.55);
        if (!isCanal(sx, sz)) builder.shade(sx, groundHeightGrid(sx, sz), sz, alpha);
      }
  }
}

function house(
  builder: VoxelBuilder,
  colliders: TownCollider[],
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  wall: PaletteName,
  roof: PaletteName,
): void {
  const base = groundHeightGrid(x + Math.floor(width / 2), z + Math.floor(depth / 2));
  castShadow(builder, x, z, width, depth, Math.min(11, height));
  // Buildings are deliberately solid volumes: the surface compiler can then
  // discard the entire interior rather than retaining unseen inner shell faces.
  builder.fillBox(x, base + 1, z, width, 1, depth, 'stoneDark');
  builder.fillBox(x, base + 2, z, width, 1, depth, 'stone');
  builder.fillBox(x, base + 3, z, width, height - 2, depth, wall);

  // Timber corners and belts make the facades read at homepage scale.
  for (let y = base + 3; y <= base + height; y += 1) {
    builder.set(x, y, z, 'timber');
    builder.set(x + width - 1, y, z, 'timber');
    builder.set(x, y, z + depth - 1, 'timber');
    builder.set(x + width - 1, y, z + depth - 1, 'timber');
  }
  for (let xx = x; xx < x + width; xx += 1) {
    builder.set(xx, base + 5, z + depth - 1, 'timber');
    builder.set(xx, base + height - 1, z + depth - 1, 'timber');
  }

  const front = z + depth - 1;
  const doorX = x + Math.floor(width / 2);
  for (let y = base + 2; y <= base + 4; y += 1) {
    builder.set(doorX, y, front, 'timber');
    builder.carveSurfaceCell(doorX, y, front);
  }
  // The door and windows sit half a detail-cell behind the facade. Their
  // projecting frames occupy adjacent lattice cells, so no coplanar overlay
  // surfaces are introduced.
  builder.surfaceBox(doorX, base + 3, front - 0.25, 1, 2.5, 0.5, 'timber');
  builder.surfaceBox(doorX + 0.25, base + 3, front + 0.25, 0.5, 0.5, 0.5, 'iron');
  builder.surfaceBox(doorX, base + 1.75, front + 0.75, 2, 0.5, 1.5, 'stoneLight');
  for (const wx of [x + 3, x + width - 4]) {
    if (wx <= x + 1 || wx >= x + width - 1) continue;
    for (const windowBase of [base + 4, base + 7]) {
      for (let wy = windowBase; wy <= windowBase + 1; wy += 1) {
        builder.set(wx, wy, front, 'window', windowBase === base + 4 ? 0.52 : 0.42);
        builder.carveSurfaceCell(wx, wy, front);
      }
      const windowGlow = windowBase === base + 4 ? 0.52 : 0.42;
      builder.surfaceBox(wx, windowBase + 0.5, front - 0.25, 0.5, 1.5, 0.5, 'window', windowGlow);
      builder.surfaceBox(wx - 0.75, windowBase + 0.5, front + 0.75, 0.5, 2.5, 0.5, 'timber');
      builder.surfaceBox(wx + 0.75, windowBase + 0.5, front + 0.75, 0.5, 2.5, 0.5, 'timber');
      builder.surfaceBox(wx, windowBase - 0.75, front + 0.75, 1, 0.5, 0.5, 'timber');
      builder.surfaceBox(wx, windowBase + 1.75, front + 0.75, 1, 0.5, 0.5, 'timber');
      builder.surfaceBox(wx, windowBase + 0.5, front + 0.75, 0.5, 1.5, 0.5, 'timberLight');
    }
  }

  // Half-voxel projecting timber frame and a stone/mortar foundation course.
  builder.surfaceBox(x, base + (height + 3) / 2, front + 0.75, 0.5, height - 1, 0.5, 'timber');
  builder.surfaceBox(x + width - 1, base + (height + 3) / 2, front + 0.75, 0.5, height - 1, 0.5, 'timber');
  builder.surfaceBox(x + (width - 1) / 2, base + 5, front + 0.75, width, 0.5, 0.5, 'timber');
  builder.surfaceBox(x + (width - 1) / 2, base + height - 1, front + 0.75, width, 0.5, 0.5, 'timber');
  builder.surfaceBox(x + (width - 1) / 2, base + 2.25, front + 0.75, width, 0.5, 0.5, 'mortar');

  // A stepped gable made of true voxels, not a rotated slab.
  const half = Math.ceil(width / 2);
  for (let step = 0; step <= half; step += 1) {
    const left = x - 1 + step;
    const right = x + width - step;
    if (left > right) break;
    const y = base + height + step;
    for (let zz = z - 1; zz <= z + depth; zz += 1) {
      builder.set(left, y, zz, roof);
      builder.set(right, y, zz, roof);
    }
    for (let xx = left + 1; xx < right; xx += 1) {
      builder.set(xx, y, z, wall);
      builder.set(xx, y, z + depth - 1, wall);
    }
  }

  // Projecting stepped eaves, a continuous ridge cap, and front verge tiles
  // strengthen the silhouette at the fixed three-quarter camera angle.
  builder.surfaceBox(x - 1, base + height - 0.25, z + (depth - 1) / 2, 0.5, 0.5, depth + 2, 'roofEdge');
  builder.surfaceBox(x + width, base + height - 0.25, z + (depth - 1) / 2, 0.5, 0.5, depth + 2, 'roofEdge');
  const ridgeY = base + height + Math.ceil(width / 2);
  builder.surfaceBox(x + (width - 1) / 2, ridgeY + 0.75, z + (depth - 1) / 2, 0.5, 0.5, depth + 2, roof);
  for (let step = 0; step <= half; step += 2) {
    const left = x - 1 + step;
    const right = x + width - step;
    if (left > right) break;
    builder.surfaceBox(left, base + height + step, front + 1.25, 0.5, 0.5, 0.5, 'roofEdge');
    builder.surfaceBox(right, base + height + step, front + 1.25, 0.5, 0.5, 0.5, 'roofEdge');
  }

  const chimneyX = x + width - 3;
  builder.fillBox(chimneyX, base + height + 2, z + 2, 2, 5, 2, 'stoneDark');
  builder.surfaceBox(chimneyX + 0.5, base + height + 7.25, z + 2.5, 2.5, 0.5, 2.5, 'stoneLight');
  addCollider(colliders, x, z, width, depth);
}

function bellTower(builder: VoxelBuilder, colliders: TownCollider[], x: number, z: number): void {
  const base = groundHeightGrid(x + 4, z + 4);
  castShadow(builder, x, z, 9, 9, 15);
  builder.fillBox(x, base + 1, z, 9, 18, 9, 'stoneLight');
  for (let y = base + 2; y < base + 18; y += 4) {
    for (let xx = x; xx < x + 9; xx += 1) builder.set(xx, y, z + 8, 'stoneDark');
  }
  for (const windowBase of [base + 5, base + 11]) {
    builder.fillBox(x + 3, windowBase, z + 8, 3, 3, 1, 'window', windowBase === base + 5 ? 0.46 : 0.36);
    for (let wx = x + 3; wx <= x + 5; wx += 1) {
      for (let wy = windowBase; wy <= windowBase + 2; wy += 1) {
        builder.carveSurfaceCell(wx, wy, z + 8);
      }
    }
    builder.surfaceBox(x + 4, windowBase + 1, z + 7.75, 2.5, 2.5, 0.5, 'window', windowBase === base + 5 ? 0.46 : 0.36);
    builder.surfaceBox(x + 2.75, windowBase + 1, z + 8.75, 0.5, 3.5, 0.5, 'stoneDark');
    builder.surfaceBox(x + 5.25, windowBase + 1, z + 8.75, 0.5, 3.5, 0.5, 'stoneDark');
    builder.surfaceBox(x + 4, windowBase - 0.75, z + 8.75, 3, 0.5, 0.5, 'stoneDark');
    builder.surfaceBox(x + 4, windowBase + 2.75, z + 8.75, 3, 0.5, 0.5, 'stoneDark');
  }

  // Tapered corner buttresses and projecting string courses prevent the tower
  // from reading as one unarticulated cuboid.
  for (const bx of [x, x + 8]) {
    for (const bz of [z, z + 8]) {
      builder.surfaceBox(bx, base + 5, bz, 1.5, 8, 1.5, 'stone');
      builder.surfaceBox(bx, base + 1.5, bz, 2, 1, 2, 'stoneDark');
    }
  }
  for (const courseY of [base + 6.75, base + 12.75, base + 18.75]) {
    builder.surfaceBox(x + 4, courseY, z + 8.75, 10, 0.5, 0.5, 'mortar');
  }

  // Open belfry: four stone corners with a dark bell floating between them.
  builder.fillBox(x, base + 19, z, 2, 6, 2, 'stone');
  builder.fillBox(x + 7, base + 19, z, 2, 6, 2, 'stone');
  builder.fillBox(x, base + 19, z + 7, 2, 6, 2, 'stone');
  builder.fillBox(x + 7, base + 19, z + 7, 2, 6, 2, 'stone');
  builder.fillBox(x + 3, base + 20, z + 4, 3, 3, 2, 'roofGold', 0.25);
  for (const bx of [x, x + 8]) {
    builder.surfaceBox(bx, base + 24.75, z + 8, 2.5, 0.5, 2.5, 'stoneLight');
  }
  for (let step = 0; step < 5; step += 1) {
    for (let xx = x - 1 + step; xx <= x + 9 - step; xx += 1)
      for (let zz = z - 1 + step; zz <= z + 9 - step; zz += 1)
        if (xx === x - 1 + step || xx === x + 9 - step || zz === z - 1 + step || zz === z + 9 - step)
          builder.set(xx, base + 25 + step, zz, 'roofSlate');
  }
  builder.surfaceBox(x + 4, base + 29.75, z + 4, 1.5, 0.5, 1.5, 'roofGold');
  builder.set(x + 4, base + 30, z + 4, 'roofGold', 0.4);
  addCollider(colliders, x, z, 9, 9);
}

function marketStall(
  builder: VoxelBuilder,
  colliders: TownCollider[],
  x: number,
  z: number,
  clothA: PaletteName,
  clothB: PaletteName,
): void {
  const base = groundHeightGrid(x + 3, z + 2);
  for (const [px, pz] of [[x, z], [x + 6, z], [x, z + 4], [x + 6, z + 4]] as const)
    builder.fillBox(px, base + 1, pz, 1, 6, 1, 'timber');
  builder.fillBox(x, base + 3, z + 1, 7, 1, 3, 'timber');
  builder.fillBox(x, base + 1, z + 1, 2, 2, 3, 'timber');
  builder.fillBox(x + 5, base + 1, z + 1, 2, 2, 3, 'timber');
  builder.surfaceBox(x + 3, base + 3.75, z + 2, 8, 0.5, 4, 'timberLight');
  for (let xx = 0; xx < 8; xx += 1) {
    for (let zz = 0; zz < 6; zz += 1) {
      builder.set(x - 1 + xx, base + 7, z - 1 + zz, xx % 2 === 0 ? clothA : clothB);
      builder.carveSurfaceCell(x - 1 + xx, base + 7, z - 1 + zz);
    }
    builder.surfaceBox(x - 1 + xx, base + 7, z + 1.5, 1, 0.5, 6, xx % 2 === 0 ? clothA : clothB);
    // Alternating hanging tabs make the canopy read as fabric rather than a slab.
    builder.surfaceBox(x - 1 + xx, base + 6.25 - (xx % 2) * 0.25, z + 4.75, 1, xx % 2 === 0 ? 1 : 0.5, 0.5, xx % 2 === 0 ? clothA : clothB);
  }
  builder.surfaceBox(x + 2.5, base + 7.5, z + 1.5, 9, 0.5, 0.5, 'timber');
  builder.surfaceBox(x + 2.5, base + 7.5, z - 1.25, 9, 0.5, 0.5, 'timber');

  for (let index = 0; index < 5; index += 1) {
    const produce = index % 3 === 0 ? 'produceRed' : index % 3 === 1 ? 'produceGold' : 'produceGreen';
    builder.surfaceBox(x + 1 + index, base + 4.25 + (index % 2) * 0.25, z + 3.75, 0.5, 0.5, 0.5, produce);
  }
  builder.set(x + 1, base + 4, z + 4, 'lantern', 0.38);
  builder.set(x + 5, base + 4, z + 4, 'lantern', 0.38);
  addCollider(colliders, x, z, 7, 4, 0.1);
}

function fountain(builder: VoxelBuilder, colliders: TownCollider[], cx: number, cz: number): void {
  const base = groundHeightGrid(cx, cz);
  for (let x = -4; x <= 4; x += 1)
    for (let z = -4; z <= 4; z += 1) {
      const radius = Math.hypot(x, z);
      if (radius > 3.2 && radius < 4.6) {
        builder.set(cx + x, base + 1, cz + z, radius > 4.1 ? 'stone' : 'stoneLight');
        builder.surfaceBox(cx + x, base + 1.75, cz + z, 1, 0.5, 1, 'stoneLight');
      } else if (radius <= 3.2) {
        builder.set(cx + x, base + 1, cz + z, 'waterTile', 0.1);
        builder.carveSurfaceCell(cx + x, base + 1, cz + z);
        builder.surfaceBox(cx + x, base + 0.75, cz + z, 1, 0.5, 1, 'waterTile', 0.1);
      }
    }
  builder.surfaceBox(cx, base + 1.5, cz, 3, 1, 3, 'stoneDark');
  builder.fillBox(cx, base + 2, cz, 1, 6, 1, 'stoneLight');
  builder.surfaceBox(cx, base + 4.5, cz, 1.5, 1, 1.5, 'stone');
  builder.fillBox(cx - 1, base + 7, cz - 1, 3, 2, 3, 'stone');
  builder.surfaceBox(cx, base + 9.25, cz, 2, 0.5, 2, 'stoneLight');
  builder.surfaceBox(cx, base + 10, cz, 0.5, 1, 0.5, 'waterFoam', 0.18);
  // Four thin streams fall from the upper bowl into the recessed pool.
  for (const [sx, sz] of [[-1.25, 0], [1.25, 0], [0, -1.25], [0, 1.25]] as const) {
    builder.surfaceBox(cx + sx, base + 5.5, cz + sz, 0.5, 4, 0.5, 'waterFoam', 0.12);
  }
  for (const [sx, sz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]] as const) {
    builder.surfaceBox(cx + sx, base + 2.25, cz + sz, 0.5, 0.5, 0.5, 'roofGold');
  }
  addCollider(colliders, cx - 3, cz - 3, 7, 7, -0.1);
}

function bridge(builder: VoxelBuilder): void {
  // Deliberately authored crown profile: broad enough for the hero and two NPCs,
  // with a readable rise from both canal banks.
  for (let z = CANAL_MIN_Z; z <= CANAL_MAX_Z; z += 1) {
    const deck = bridgeHeight(z);
    for (let x = BRIDGE_MIN_X; x <= BRIDGE_MAX_X; x += 1) {
      const edgeCourse = x === BRIDGE_MIN_X || x === BRIDGE_MAX_X;
      const centerLine = x === 0 && z % 2 === 0;
      builder.set(x, deck, z, edgeCourse || centerLine ? 'stoneLight' : 'cobble');
      builder.carveSurfaceCell(x, deck, z);
    }
    // Thin parapet plinths replace the old full-cube side rails.
    const deckTop = bridgeSurfaceGridHeight(z);
    for (const sideX of [BRIDGE_MIN_X - 0.75, BRIDGE_MAX_X + 0.75]) {
      builder.surfaceBox(sideX, deckTop + 0.75, z, 0.5, 1.5, 1, 'stone');
      builder.surfaceBox(sideX, deckTop + 1.75, z, 0.75, 0.5, 1, 'stoneLight');
    }
  }

  // Three detail treads per macro tile keep every vertical rise to one 0.2067m
  // lattice step. The sampled walk height below uses this same profile.
  const fineStart = CANAL_MIN_Z * TOWN_DETAIL_RESOLUTION;
  const fineEnd = (CANAL_MAX_Z + 1) * TOWN_DETAIL_RESOLUTION;
  for (let fineZ = fineStart; fineZ < fineEnd; fineZ += 1) {
    const z = -0.5 + (fineZ + 0.5) / TOWN_DETAIL_RESOLUTION;
    const deckTop = bridgeSurfaceGridHeight(z);
    const material = fineZ % 5 === 0 ? 'cobbleLight' : 'cobble';
    builder.surfaceBox(
      0,
      deckTop - 0.5 / TOWN_DETAIL_RESOLUTION,
      z,
      BRIDGE_MAX_X - BRIDGE_MIN_X + 1,
      1 / TOWN_DETAIL_RESOLUTION,
      1 / TOWN_DETAIL_RESOLUTION,
      material,
    );
    for (const edgeX of [BRIDGE_MIN_X, BRIDGE_MAX_X]) {
      builder.surfaceBox(
        edgeX,
        deckTop - 0.5 / TOWN_DETAIL_RESOLUTION,
        z,
        1,
        1 / TOWN_DETAIL_RESOLUTION,
        1 / TOWN_DETAIL_RESOLUTION,
        'stoneLight',
      );
    }
  }

  // Side spandrels form a true arched silhouette rather than a rectangular
  // deck floating above the canal. The opening remains clear down to the water.
  for (const sideX of [BRIDGE_MIN_X, BRIDGE_MAX_X]) {
    for (let z = CANAL_MIN_Z; z <= CANAL_MAX_Z; z += 1) {
      const distance = Math.abs(z - (CANAL_MIN_Z + CANAL_MAX_Z) / 2);
      const archCeiling = Math.max(-1, 2 - Math.floor(distance * 0.8));
      for (let y = -2; y < bridgeHeight(z); y += 1) {
        const endPier = z === CANAL_MIN_Z || z === CANAL_MAX_Z;
        if (endPier || y > archCeiling) builder.set(sideX, y, z, y === bridgeHeight(z) - 1 ? 'stoneLight' : 'stoneDark');
      }
      if (z > CANAL_MIN_Z && z < CANAL_MAX_Z) {
        builder.surfaceBox(
          sideX + (sideX < 0 ? -0.75 : 0.75),
          archCeiling + 0.75,
          z,
          0.5,
          0.5,
          1,
          'stoneLight',
        );
      }
    }
  }

  // Four capped posts frame the crossing and carry warm guide lanterns.
  for (const z of [CANAL_MIN_Z, CANAL_MAX_Z]) {
    for (const x of [BRIDGE_MIN_X - 0.75, BRIDGE_MAX_X + 0.75]) {
      const deckTop = bridgeSurfaceGridHeight(z);
      builder.surfaceBox(x, deckTop + 2, z, 1, 4, 1, 'stone');
      builder.surfaceBox(x, deckTop + 4.25, z, 1.5, 0.5, 1.5, 'stoneLight');
      builder.surfaceBox(x, deckTop + 5, z, 0.5, 1, 0.5, 'lantern', 0.55);
      builder.surfaceBox(x, deckTop + 5.75, z, 1, 0.5, 1, 'roofGold');
    }
  }

  // Pier cutwaters stay visible in the oblique camera and visually seat the
  // bridge in the retaining walls.
  for (const x of [BRIDGE_MIN_X, BRIDGE_MAX_X]) {
    for (const z of [CANAL_MIN_Z, CANAL_MAX_Z]) {
      builder.fillBox(x, -2, z, 2, bridgeHeight(z) + 3, 2, 'stoneDark');
      builder.surfaceBox(x + 0.5, -0.25, z + (z === CANAL_MIN_Z ? -0.75 : 0.75), 2.5, 1.5, 0.5, 'stone');
    }
  }
}

function tree(builder: VoxelBuilder, colliders: TownCollider[], gx: number, gz: number, height: number, autumn = false): void {
  const base = groundHeightGrid(gx, gz);
  builder.fillBox(gx, base + 1, gz, 2, height, 2, 'timber');
  const crownY = base + height;
  const primary = autumn ? 'leafGold' : 'leaf';
  for (let x = -3; x <= 4; x += 1)
    for (let y = -2; y <= 3; y += 1)
      for (let z = -3; z <= 4; z += 1) {
        const shape = Math.abs(x - 0.5) + Math.abs(z - 0.5) + Math.abs(y) * 1.3;
        if (shape < 6.6 && hash(gx * 13 + gz * 31 + x * 7 + y * 17 + z * 23) > 0.12)
          builder.set(gx + x, crownY + y, gz + z, hash(x + z + gx) > 0.72 ? 'leafLight' : primary);
      }
  castShadow(builder, gx - 2, gz - 2, 6, 6, 9);
  addCollider(colliders, gx, gz, 2, 2, 0.08, `town.tree.${gx}.${gz}`);
}

function stoneBench(builder: VoxelBuilder, colliders: TownCollider[], x: number, z: number, facingZ = true): void {
  const base = groundHeightGrid(x, z);
  const width = facingZ ? 4 : 1;
  const depth = facingZ ? 1 : 4;
  builder.surfaceBox(x, base + 1, z, width, 0.5, depth, 'timberLight');
  builder.surfaceBox(
    x,
    base + 2,
    z + (facingZ ? -0.5 : 0),
    width,
    0.5,
    facingZ ? 0.5 : depth,
    'timber',
  );
  for (const offset of [-1.25, 1.25]) {
    builder.surfaceBox(
      x + (facingZ ? offset : 0),
      base + 0.5,
      z + (facingZ ? 0 : offset),
      0.5,
      1,
      0.5,
      'iron',
    );
  }
  addCollider(colliders, x - (facingZ ? 2 : 0), z - (facingZ ? 0 : 2), width, depth, 0.02);
}

function cargoCluster(builder: VoxelBuilder, colliders: TownCollider[], x: number, z: number): void {
  const base = groundHeightGrid(x, z);
  // Barrels use three stepped courses and narrow iron hoops rather than one cube.
  for (const [bx, bz, height] of [[x, z, 2], [x + 1.75, z + 0.5, 1.5]] as const) {
    builder.surfaceBox(bx, base + 0.75, bz, 1, 0.5, 1, 'timber');
    builder.surfaceBox(bx, base + 1.25, bz, 1.5, height - 0.5, 1.5, 'timberLight');
    builder.surfaceBox(bx, base + height, bz, 1, 0.5, 1, 'timber');
    builder.surfaceBox(bx, base + 0.75, bz, 1.75, 0.25, 1.75, 'iron');
    builder.surfaceBox(bx, base + height - 0.25, bz, 1.75, 0.25, 1.75, 'iron');
  }
  // Offset crates create a readable triangular cluster in the fixed camera.
  builder.surfaceBox(x - 1.5, base + 0.75, z + 0.5, 1.5, 1.5, 1.5, 'timber');
  builder.surfaceBox(x - 1.5, base + 1.5, z + 0.5, 1.75, 0.25, 1.75, 'timberLight');
  builder.surfaceBox(x - 1.5, base + 0.75, z + 1.25, 1.75, 0.25, 0.25, 'iron');
  addCollider(colliders, x - 2.25, z - 0.75, 5.25, 3, 0.05, `town.cargo.${x}.${z}`);
}

function flowerPlanter(builder: VoxelBuilder, colliders: TownCollider[], x: number, z: number, violet: boolean): void {
  const base = groundHeightGrid(x, z);
  builder.surfaceBox(x, base + 0.75, z, 2, 1, 1, 'stone');
  builder.surfaceBox(x, base + 1.25, z, 1.5, 0.5, 0.5, 'soil');
  for (const offset of [-0.5, 0, 0.5]) {
    builder.surfaceBox(x + offset, base + 1.75 + Math.abs(offset) * 0.5, z, 0.25, 1, 0.25, 'leaf');
    builder.surfaceBox(x + offset, base + 2.25 + Math.abs(offset) * 0.5, z, 0.5, 0.5, 0.5, violet ? 'flowerViolet' : 'flowerCream');
  }
  addCollider(colliders, x - 1, z - 0.5, 2, 1, 0.02, `town.planter.${x}.${z}`);
}

function handCart(builder: VoxelBuilder, colliders: TownCollider[], x: number, z: number): void {
  const base = groundHeightGrid(x, z);
  builder.surfaceBox(x, base + 1.5, z, 5, 1.5, 2.5, 'timberLight');
  builder.surfaceBox(x, base + 2.5, z, 5.5, 0.5, 3, 'timber');
  for (const wheelX of [x - 1.75, x + 1.75]) {
    builder.surfaceBox(wheelX, base + 0.75, z + 1.5, 1.5, 1.5, 0.5, 'iron');
    builder.surfaceBox(wheelX, base + 0.75, z + 1.75, 0.5, 0.5, 0.5, 'timber');
  }
  builder.surfaceBox(x + 4, base + 1, z, 3, 0.5, 0.5, 'timber');
  for (let index = 0; index < 5; index += 1) {
    builder.surfaceBox(x - 1.5 + index * 0.75, base + 3, z, 0.5, 0.5, 0.5, index % 2 ? 'produceGold' : 'produceGreen');
  }
  addCollider(colliders, x - 2, z - 1, 5, 3, 0.08);
}

function canalMasonry(builder: VoxelBuilder): void {
  // Repeated buttresses and coping break the long retaining-wall strips into
  // a measured rhythm that leads the eye toward the hero bridge.
  for (const bankZ of [CANAL_MIN_Z - 1, CANAL_MAX_Z + 1]) {
    for (let x = WORLD_MIN_X + 3; x <= WORLD_MAX_X - 3; x += 6) {
      if (x >= BRIDGE_MIN_X - 3 && x <= BRIDGE_MAX_X + 3) continue;
      builder.surfaceBox(x, 0, bankZ + (bankZ < CANAL_MIN_Z ? 0.75 : -0.75), 1.5, 4, 1.5, 'stone');
      builder.surfaceBox(x, 2.25, bankZ + (bankZ < CANAL_MIN_Z ? 0.75 : -0.75), 2, 0.5, 2, 'stoneLight');
    }
    for (let x = WORLD_MIN_X; x <= WORLD_MAX_X; x += 2) {
      if (x >= BRIDGE_MIN_X - 2 && x <= BRIDGE_MAX_X + 2) continue;
      builder.surfaceBox(x, 2.25, bankZ, 2, 0.5, 1, x % 4 === 0 ? 'stoneLight' : 'stone');
    }
  }
}

function buildGround(builder: VoxelBuilder): void {
  for (let z = WORLD_MIN_Z; z <= VISUAL_MAX_Z; z += 1) {
    for (let x = WORLD_MIN_X; x <= WORLD_MAX_X; x += 1) {
      if (isCanal(x, z)) builder.set(x, -3, z, 'waterBed');
      if (isCanal(x, z) && !isBridge(x, z)) continue;
      const y = groundHeightGrid(x, z);
      const plazaDistance = Math.hypot(x * 0.82, (z + 6) * 1.08);
      const square = plazaDistance <= 19;
      const processionalPath = Math.abs(x) <= 4 && z >= -30 && z < CANAL_MIN_Z;
      const crossStreet = z >= -3 && z <= 2;
      const plazaRing = square && Math.abs(plazaDistance - 11) < 1.25;
      const paverAccent = (Math.abs(x) + Math.abs(z + 6) * 2) % 9 === 0;
      const grassPatch = (Math.floor((x + 48) / 7) + Math.floor((z + 39) / 6) * 2) % 5 === 0;
      const material = plazaRing
        ? 'stoneLight'
        : square || processionalPath || crossStreet || isBridge(x, z)
          ? (paverAccent ? 'cobbleLight' : 'cobble')
          : (grassPatch ? 'grassLight' : 'grass');
      builder.set(x, y, z, material);
    }
  }

  // Canal retaining walls and the rear terrace expose the town's verticality.
  for (let x = WORLD_MIN_X; x <= WORLD_MAX_X; x += 1) {
    for (let y = -2; y <= 1; y += 1) builder.set(x, y, CANAL_MIN_Z - 1, 'stoneDark');
    for (let y = -2; y <= 0; y += 1) builder.set(x, y, CANAL_MAX_Z + 1, 'stoneDark');
  }
  for (let x = WORLD_MIN_X; x <= WORLD_MAX_X; x += 1)
    for (let y = 0; y <= 2; y += 1) builder.set(x, y, -24, 'stoneDark');
}

function buildTownDetails(builder: VoxelBuilder, colliders: TownCollider[], props: TownProp[]): void {
  bridge(builder);
  canalMasonry(builder);
  fountain(builder, colliders, 0, -6);

  house(builder, colliders, -43, -17, 16, 13, 11, 'plaster', 'roofRed');
  house(builder, colliders, -41, -34, 14, 11, 12, 'plasterPale', 'roofSlate');
  house(builder, colliders, -45, 2, 14, 8, 9, 'plasterPale', 'roofGold');
  house(builder, colliders, 27, -16, 16, 13, 12, 'plasterPale', 'roofSlate');
  house(builder, colliders, 31, -34, 13, 11, 10, 'plaster', 'roofRed');
  house(builder, colliders, 32, 2, 13, 9, 9, 'plaster', 'roofGold');
  // The guildhall and bell tower terminate the bridge-to-fountain processional
  // axis, forming the deliberately authored focal cluster in the ambient shot.
  house(builder, colliders, -23, -35, 17, 10, 12, 'plasterPale', 'roofRed');
  bellTower(builder, colliders, 8, -35);

  marketStall(builder, colliders, -18, -1, 'clothRed', 'clothCream');
  marketStall(builder, colliders, 11, 0, 'clothBlue', 'clothCream');
  marketStall(builder, colliders, -15, -16, 'clothGold', 'clothCream');

  stoneBench(builder, colliders, -9, -11);
  stoneBench(builder, colliders, 9, -11);
  cargoCluster(builder, colliders, -10, 7);
  cargoCluster(builder, colliders, 12, 6);
  flowerPlanter(builder, colliders, -7, -6, true);
  flowerPlanter(builder, colliders, 7, -6, false);
  flowerPlanter(builder, colliders, -6, -13, false);
  flowerPlanter(builder, colliders, 6, -13, true);
  handCart(builder, colliders, 21, -7);

  for (const [x, z, height, autumn] of [
    [-34, 22, 8, false], [-24, 26, 7, true], [39, 22, 8, true],
    [-24, 8, 8, false], [24, 8, 7, false], [-25, -22, 9, true], [23, -23, 8, false],
    [-3, -29, 7, false], [44, -19, 8, true], [-45, -23, 9, false],
  ] as const) tree(builder, colliders, x, z, height, autumn);

  const TOWN = { fence: 82, barrel: 107, sack: 106, mushrooms: 29 } as const;
  for (const [gx, gz, tile, size] of [
    [-11, 5, TOWN.barrel, 0.75], [-9, 4, TOWN.sack, 0.7], [16, 5, TOWN.barrel, 0.75],
    [18, 5, TOWN.sack, 0.7], [-22, -5, TOWN.fence, 0.9], [22, -5, TOWN.fence, 0.9],
    [-27, 18, TOWN.mushrooms, 0.5], [29, 19, TOWN.mushrooms, 0.5],
  ] as const) {
    props.push({
      x: gx * VOXEL_SIZE,
      y: topSurfaceGrid(gx, gz),
      z: gz * VOXEL_SIZE,
      size,
      tile,
      tint: [1, 0.94, 0.84],
    });
  }
}

export function buildTownWorld(): TownWorld {
  const builder = new VoxelBuilder();
  const colliders: TownCollider[] = [];
  const props: TownProp[] = [];
  buildGround(builder);
  addWaterColliders(colliders);
  buildTownDetails(builder, colliders, props);
  const voxels = builder.compile();
  const mesh = builder.compileSurface();
  const geometryValidation = validateVoxelSurfaceMesh(mesh);
  if (!geometryValidation.valid) {
    throw new Error(`Invalid town surface mesh: ${geometryValidation.errors.join('; ')}`);
  }

  const heroPath = [
    worldPoint(0, 29),
    worldPoint(0, 21),
    worldPoint(0, 16),
    worldPoint(0, 11),
    worldPoint(-2, 4),
    worldPoint(5, -1),
    worldPoint(5, -10),
    worldPoint(9, -9),
    worldPoint(5, -10),
    worldPoint(5, -1),
    worldPoint(-2, 4),
    worldPoint(0, 11),
    worldPoint(0, 16),
    worldPoint(0, 21),
  ] as const;

  const paths = [
    [
      worldPoint(-5, 4), worldPoint(5, 4), worldPoint(5, -1), worldPoint(-5, -1),
    ],
    [worldPoint(-7, 9), worldPoint(7, 9), worldPoint(7, 4), worldPoint(-7, 4)],
    [
      worldPoint(-2, 28), worldPoint(-2, 20), worldPoint(-2, 12), worldPoint(-7, 5),
      worldPoint(-9, -4), worldPoint(-9, 1), worldPoint(-7, 5), worldPoint(-2, 12), worldPoint(-2, 20),
    ],
    [
      worldPoint(4, -18), worldPoint(17, -18), worldPoint(17, -11), worldPoint(12, -10),
      worldPoint(12, -2), worldPoint(8, -2), worldPoint(12, -10), worldPoint(12, -17),
    ],
    [
      worldPoint(-18, -19), worldPoint(-5, -19), worldPoint(-4, -14), worldPoint(-5, -10),
      worldPoint(-10, -10), worldPoint(-10, -4), worldPoint(-18, -6),
    ],
  ] as const;

  // Rows in Eldiran's CC0 32x32 sheet. Row zero is the blank character
  // template; the remaining rows are finished fantasy cast members.
  const ACTOR_ROWS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const walkers: TownWalker[] = Array.from({ length: 18 }, (_, index) => ({
    row: ACTOR_ROWS[index % ACTOR_ROWS.length]!,
    speed: 0.025 + (index % 5) * 0.004,
    phase: (index * 0.173) % 1,
    scale: 1.32 + (index % 3) * 0.09,
    tint: index % 4 === 0 ? [1.08, 0.88, 0.76] : index % 4 === 1 ? [0.84, 0.92, 1.06] : [1, 0.97, 0.9],
    path: paths[index % paths.length]!,
  }));

  const walkSurfaceHeight = (x: number, z: number): number => {
    const continuousX = x / VOXEL_SIZE;
    const continuousZ = z / VOXEL_SIZE;
    if (
      continuousX >= BRIDGE_MIN_X - 0.5
      && continuousX <= BRIDGE_MAX_X + 0.5
      && continuousZ >= CANAL_MIN_Z - 0.5
      && continuousZ <= CANAL_MAX_Z + 0.5
    ) return bridgeSurfaceGridHeight(continuousZ) * VOXEL_SIZE;
    const gx = Math.round(continuousX);
    const gz = Math.round(continuousZ);
    return topSurfaceGrid(gx, gz);
  };

  const walkSurfaceNormal = (x: number, z: number): readonly [number, number, number] => {
    const continuousX = x / VOXEL_SIZE;
    const continuousZ = z / VOXEL_SIZE;
    if (
      continuousX >= BRIDGE_MIN_X - 0.5
      && continuousX <= BRIDGE_MAX_X + 0.5
      && continuousZ >= CANAL_MIN_Z - 0.5
      && continuousZ <= CANAL_MAX_Z + 0.5
    ) {
      const span = CANAL_MAX_Z - CANAL_MIN_Z + 1;
      const t = Math.max(0, Math.min(1, (continuousZ - (CANAL_MIN_Z - 0.5)) / span));
      const slope = -1 / span + 1.35 * Math.PI / span * Math.cos(t * Math.PI);
      const length = Math.hypot(1, slope);
      return [0, 1 / length, -slope / length];
    }
    return [0, 1, 0];
  };
  const surfaceHeight = walkSurfaceHeight;

  const canWalk = (x: number, z: number): boolean => {
    const gx = x / VOXEL_SIZE;
    const gz = z / VOXEL_SIZE;
    if (gx < WORLD_MIN_X + 2 || gx > WORLD_MAX_X - 2 || gz < WORLD_MIN_Z + 2 || gz > WORLD_MAX_Z - 2) return false;
    if (gz >= CANAL_MIN_Z - 0.5 && gz <= CANAL_MAX_Z + 0.5 && (gx < BRIDGE_MIN_X || gx > BRIDGE_MAX_X)) return false;
    return !colliders.some((box) => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ);
  };

  return {
    voxels,
    mesh,
    materials: TOWN_MATERIALS,
    geometryValidation,
    props,
    walkers,
    heroPath,
    spawn: worldPoint(0, 21),
    waterBounds: {
      minX: WORLD_MIN_X * VOXEL_SIZE,
      maxX: WORLD_MAX_X * VOXEL_SIZE,
      minZ: (CANAL_MIN_Z - 0.5) * VOXEL_SIZE,
      maxZ: (CANAL_MAX_Z + 0.5) * VOXEL_SIZE,
    },
    extent: WORLD_MAX_X * VOXEL_SIZE,
    physicsColliders: colliders,
    walkSurfaceHeight,
    walkSurfaceNormal,
    surfaceHeight,
    canWalk,
  };
}

/** Equal-time interpolation around a closed polyline. */
export function samplePath(
  path: readonly (readonly [number, number])[],
  progress: number,
): { x: number; z: number; facing: number; dx: number; dz: number } {
  const wrapped = ((progress % 1) + 1) % 1;
  const scaled = wrapped * path.length;
  const index = Math.floor(scaled) % path.length;
  const nextIndex = (index + 1) % path.length;
  const local = scaled - Math.floor(scaled);
  const from = path[index]!;
  const to = path[nextIndex]!;
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  return {
    x: from[0] + dx * local,
    z: from[1] + dz * local,
    facing: Math.sign(dx) || 1,
    dx,
    dz,
  };
}

function hash(value: number): number {
  const wave = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return wave - Math.floor(wave);
}
