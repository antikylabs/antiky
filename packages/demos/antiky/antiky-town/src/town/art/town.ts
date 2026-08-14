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

export type TownWaterfall = {
  minX: number;
  maxX: number;
  z: number;
  topY: number;
  bottomY: number;
  channelMinZ: number;
  channelMaxZ: number;
};

export type TownVegetationType =
  | 'grass'
  | 'flower'
  | 'reeds'
  | 'ivy'
  | 'shrub'
  | 'tree-trunk'
  | 'tree-crown';

export type TownVegetation = {
  x: number;
  y: number;
  z: number;
  type: TownVegetationType;
  scale: number;
  yaw: number;
  phase: number;
};

export type TownFountain = {
  x: number;
  z: number;
  basinY: number;
  waterY: number;
  radius: number;
  jetTopY: number;
  outlets: readonly { x: number; y: number; z: number }[];
};

export type TownAwningStyle = 'red-cream' | 'blue-cream' | 'gold-cream';

export type TownAwning = {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  yaw: number;
  slope: number;
  style: TownAwningStyle;
  phase: number;
};

export type TownSpritePropType =
  | 'barrel'
  | 'open-chest'
  | 'closed-chest'
  | 'open-book'
  | 'book-stack'
  | 'map-kit'
  | 'produce-basket'
  | 'crate';

export type TownSpriteProp = {
  x: number;
  y: number;
  z: number;
  type: TownSpritePropType;
  scale: number;
  yaw: number;
  curvature: number;
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
  awnings: TownAwning[];
  spriteProps: TownSpriteProp[];
  /** Deterministic non-voxel vegetation instances for renderer batching. */
  vegetation: TownVegetation[];
  walkers: TownWalker[];
  heroPath: readonly (readonly [number, number])[];
  spawn: readonly [number, number];
  waterBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Numeric placement contract for the renderer's non-voxel waterfall ribbon. */
  waterfall: TownWaterfall;
  /** Placement contract for stylized non-voxel basin water and fountain jets. */
  fountain: TownFountain;
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
    const detailCarves = [...this.surfaceDetailCarves.values()].sort((left, right) => (
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
      for (const [x, y, z] of detailCarves) {
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
    for (const [x, y, z] of detailCarves) {
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
const VISUAL_MIN_Z = -54;
// The interactive camera sits behind the playable boundary. Continue the
// ground beneath it so no finite platform edge can enter the frame.
const VISUAL_MAX_Z = 72;
const WATERFALL_GRID = {
  minX: -27.5,
  maxX: -23.5,
  z: -23.5,
  topY: 9,
  bottomY: 0.5,
  channelMinZ: -33.5,
  channelMaxZ: -23.5,
} as const;

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

function addVegetation(
  vegetation: TownVegetation[],
  gx: number,
  gy: number,
  gz: number,
  type: TownVegetationType,
  scale: number,
  seed: number,
): void {
  vegetation.push({
    x: gx * VOXEL_SIZE,
    y: gy * VOXEL_SIZE,
    z: gz * VOXEL_SIZE,
    type,
    scale,
    yaw: hash(seed * 17) * Math.PI * 2,
    phase: hash(seed * 29),
  });
}

function addSpriteProp(
  spriteProps: TownSpriteProp[],
  gx: number,
  gy: number,
  gz: number,
  type: TownSpritePropType,
  scale: number,
  seed: number,
  curvature = 0.22,
): void {
  spriteProps.push({
    x: gx * VOXEL_SIZE,
    y: gy * VOXEL_SIZE,
    z: gz * VOXEL_SIZE,
    type,
    scale,
    yaw: hash(seed * 23) * Math.PI * 2,
    curvature,
  });
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

function fineCenter(macroStart: number, detailIndex: number): number {
  return macroStart - 0.5 + (detailIndex + 0.5) * DETAIL;
}

function masonryMaterial(xIndex: number, yIndex: number, seed: number): PaletteName {
  const courseOffset = yIndex % 2;
  const brick = Math.floor((xIndex + courseOffset) / 2);
  const variation = Math.abs(brick * 5 + yIndex * 3 + seed) % 13;
  if (variation === 0 || variation === 8) return 'stoneLight';
  if (variation === 4) return 'stoneDark';
  if (variation === 10) return 'cobbleMoss';
  return 'stone';
}

function plasterMaterial(wall: PaletteName, xIndex: number, yIndex: number, seed: number): PaletteName {
  const patchX = Math.floor(xIndex / 3);
  const patchY = Math.floor(yIndex / 3);
  const variation = hash(seed + patchX * 19 + patchY * 47);
  if (variation > 0.91) return 'plasterCool';
  if (variation > 0.82) return 'plasterWarm';
  if (variation < 0.075 && wall === 'plasterPale') return 'plaster';
  return wall;
}

/** Re-materializes visible wall layers as 0.2067 m courses and repair patches. */
function detailHouseFacades(
  builder: VoxelBuilder,
  x: number,
  z: number,
  width: number,
  depth: number,
  base: number,
  height: number,
  wall: PaletteName,
): void {
  const front = z + depth - 1;
  const right = x + width - 1;
  const xCells = width * TOWN_DETAIL_RESOLUTION;
  const zCells = depth * TOWN_DETAIL_RESOLUTION;
  const yCells = height * TOWN_DETAIL_RESOLUTION;
  const seed = x * 37 + z * 71 + width * 11;

  for (let ix = 0; ix < xCells; ix += 1) {
    for (let iy = 0; iy < yCells; iy += 1) {
      const material = iy < 6
        ? masonryMaterial(ix, iy, seed)
        : plasterMaterial(wall, ix, iy - 6, seed);
      builder.surfaceBox(
        fineCenter(x, ix),
        fineCenter(base + 1, iy),
        front + DETAIL,
        DETAIL,
        DETAIL,
        DETAIL,
        material,
      );
    }
  }
  for (let iz = 0; iz < zCells; iz += 1) {
    for (let iy = 0; iy < yCells; iy += 1) {
      const material = iy < 6
        ? masonryMaterial(iz, iy, seed + 17)
        : plasterMaterial(wall, iz, iy - 6, seed + 17);
      builder.surfaceBox(
        right + DETAIL,
        fineCenter(base + 1, iy),
        fineCenter(z, iz),
        DETAIL,
        DETAIL,
        DETAIL,
        material,
      );
    }
  }
}

function frontBrace(
  builder: VoxelBuilder,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  front: number,
): void {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / DETAIL));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    builder.surfaceBox(
      x0 + (x1 - x0) * t,
      y0 + (y1 - y0) * t,
      front + 2 * DETAIL,
      DETAIL,
      DETAIL,
      DETAIL,
      'timber',
    );
  }
}

function sideBrace(
  builder: VoxelBuilder,
  z0: number,
  y0: number,
  z1: number,
  y1: number,
  right: number,
): void {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(z1 - z0), Math.abs(y1 - y0)) / DETAIL));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    builder.surfaceBox(
      right + 2 * DETAIL,
      y0 + (y1 - y0) * t,
      z0 + (z1 - z0) * t,
      DETAIL,
      DETAIL,
      DETAIL,
      'timber',
    );
  }
}

function detailHouseTimber(
  builder: VoxelBuilder,
  x: number,
  z: number,
  width: number,
  depth: number,
  base: number,
  height: number,
): void {
  const front = z + depth - 1;
  const right = x + width - 1;
  const facadeCenterY = base + (height + 3) / 2;
  const facadeHeight = height - 2;
  for (const beamX of [fineCenter(x, 0), fineCenter(x, width * TOWN_DETAIL_RESOLUTION - 1)]) {
    builder.surfaceBox(beamX, facadeCenterY, front + 2 * DETAIL, DETAIL, facadeHeight, DETAIL, 'timber');
  }
  for (const beamY of [base + 5, base + height - 1]) {
    builder.surfaceBox(x + (width - 1) / 2, beamY, front + 2 * DETAIL, width, DETAIL, DETAIL, 'timber');
  }
  builder.surfaceBox(x + (width - 1) / 2, base + 2.25, front + 2 * DETAIL, width, DETAIL, DETAIL, 'mortar');

  frontBrace(builder, x + 0.5, base + 5.5, x + 2.5, base + 7.5, front);
  frontBrace(builder, x + width - 1.5, base + 5.5, x + width - 3.5, base + 7.5, front);

  for (const beamZ of [fineCenter(z, 0), fineCenter(z, depth * TOWN_DETAIL_RESOLUTION - 1)]) {
    builder.surfaceBox(right + 2 * DETAIL, facadeCenterY, beamZ, DETAIL, facadeHeight, DETAIL, 'timber');
  }
  for (const beamY of [base + 5, base + height - 1]) {
    builder.surfaceBox(right + 2 * DETAIL, beamY, z + (depth - 1) / 2, DETAIL, DETAIL, depth, 'timber');
  }
  sideBrace(builder, z + 0.5, base + 5.5, z + 2.5, base + 7.5, right);
  sideBrace(builder, z + depth - 1.5, base + 5.5, z + depth - 3.5, base + 7.5, right);
}

function recessedFrontOpening(
  builder: VoxelBuilder,
  centerX: number,
  centerY: number,
  front: number,
  width: number,
  height: number,
  material: PaletteName,
  glow: number,
  mullion: boolean,
  frameMaterial: PaletteName = 'timber',
  mullionMaterial: PaletteName = 'timberLight',
): void {
  builder.carveSurfaceBox(centerX, centerY, front + DETAIL, width, height, DETAIL);
  builder.surfaceBox(centerX, centerY, front, width, height, DETAIL, material, glow);
  const frameZ = front + 2 * DETAIL;
  for (const frameX of [centerX - width / 2 - DETAIL / 2, centerX + width / 2 + DETAIL / 2]) {
    builder.surfaceBox(frameX, centerY, frameZ, DETAIL, height + 2 * DETAIL, DETAIL, frameMaterial);
  }
  for (const frameY of [centerY - height / 2 - DETAIL / 2, centerY + height / 2 + DETAIL / 2]) {
    builder.surfaceBox(centerX, frameY, frameZ, width + 2 * DETAIL, DETAIL, DETAIL, frameMaterial);
  }
  if (mullion) {
    builder.surfaceBox(centerX, centerY, frameZ, DETAIL, height, DETAIL, mullionMaterial);
    builder.surfaceBox(centerX, centerY, frameZ, width, DETAIL, DETAIL, mullionMaterial);
  }
}

function recessedSideWindow(
  builder: VoxelBuilder,
  centerZ: number,
  centerY: number,
  right: number,
  glow: number,
  width = 3 * DETAIL,
  height = 6 * DETAIL,
  frameMaterial: PaletteName = 'timber',
  mullionMaterial: PaletteName = 'timberLight',
): void {
  builder.carveSurfaceBox(right + DETAIL, centerY, centerZ, DETAIL, height, width);
  builder.surfaceBox(right, centerY, centerZ, DETAIL, height, width, 'window', glow);
  const frameX = right + 2 * DETAIL;
  for (const frameZ of [centerZ - width / 2 - DETAIL / 2, centerZ + width / 2 + DETAIL / 2]) {
    builder.surfaceBox(frameX, centerY, frameZ, DETAIL, height + 2 * DETAIL, DETAIL, frameMaterial);
  }
  for (const frameY of [centerY - height / 2 - DETAIL / 2, centerY + height / 2 + DETAIL / 2]) {
    builder.surfaceBox(frameX, frameY, centerZ, DETAIL, DETAIL, width + 2 * DETAIL, frameMaterial);
  }
  builder.surfaceBox(frameX, centerY, centerZ, DETAIL, DETAIL, width, mullionMaterial);
}

function windowFlowerBox(
  builder: VoxelBuilder,
  vegetation: TownVegetation[],
  centerX: number,
  windowBottom: number,
  front: number,
  violet: boolean,
): void {
  const boxWidth = 5 * DETAIL;
  builder.surfaceBox(
    centerX,
    windowBottom - DETAIL / 2,
    front + 0.5 + DETAIL,
    boxWidth,
    DETAIL,
    2 * DETAIL,
    'terracotta',
  );
  for (const offset of [-DETAIL, 0, DETAIL]) {
    addVegetation(
      vegetation,
      centerX + offset,
      windowBottom,
      front + 0.5 + DETAIL,
      'flower',
      0.48 + Math.abs(offset) * 0.12,
      centerX * 31 + front * 17 + offset * 101 + (violet ? 7 : 19),
    );
  }
}

function hangingHouseSign(builder: VoxelBuilder, x: number, y: number, front: number, red: boolean): void {
  builder.surfaceBox(x, y + 1.5 * DETAIL, front + 0.5 + 2 * DETAIL, DETAIL, DETAIL, 4 * DETAIL, 'iron');
  builder.surfaceBox(x, y, front + 0.5 + 4 * DETAIL, 3 * DETAIL, 3 * DETAIL, DETAIL, red ? 'clothRed' : 'clothGold');
  builder.surfaceBox(x, y + 2 * DETAIL, front + 0.5 + 4 * DETAIL, DETAIL, DETAIL, DETAIL, 'rope');
  builder.surfaceBox(x, y - 2 * DETAIL, front + 0.5 + 4 * DETAIL, 4 * DETAIL, DETAIL, DETAIL, 'timber');
}

function roofMaterials(roof: PaletteName): readonly [PaletteName, PaletteName, PaletteName] {
  if (roof === 'roofSlate') return ['roofSlate', 'roofSlateDark', 'roofSlateLight'];
  if (roof === 'roofGold') return ['roofGold', 'roofGoldDark', 'roofGoldLight'];
  return ['roofRed', 'roofRedDark', 'roofRedLight'];
}

function detailedGableRoof(
  builder: VoxelBuilder,
  x: number,
  z: number,
  width: number,
  depth: number,
  base: number,
  height: number,
  roof: PaletteName,
): void {
  // Two fine cells beyond each wall plane produce a 0.413 m eave, inside the
  // requested 0.30–0.45 m depth hierarchy without a coarse full-voxel ledge.
  const xCells = width * TOWN_DETAIL_RESOLUTION + 4;
  const zCells = depth * TOWN_DETAIL_RESOLUTION + 4;
  const [main, dark, light] = roofMaterials(roof);
  let highestY = Number.NEGATIVE_INFINITY;
  for (let ix = 0; ix < xCells; ix += 1) {
    const rise = Math.min(ix, xCells - 1 - ix);
    const roofY = base + height - DETAIL + rise * DETAIL;
    highestY = Math.max(highestY, roofY + DETAIL / 2);
    for (let iz = 0; iz < zCells; iz += 1) {
      const edge = ix === 0 || ix === xCells - 1 || iz === 0 || iz === zCells - 1;
      const phase = Math.abs(iz + Math.floor(rise / 3) * 3) % 18;
      const material = edge ? 'roofEdge' : phase < 3 ? dark : phase >= 9 && phase < 11 ? light : main;
      builder.surfaceBox(
        fineCenter(x, ix - 2),
        roofY,
        fineCenter(z, iz - 2),
        DETAIL,
        DETAIL,
        DETAIL,
        material,
      );
    }
  }
  const leftPeak = fineCenter(x, xCells / 2 - 3);
  const rightPeak = fineCenter(x, xCells / 2 - 2);
  builder.surfaceBox(
    (leftPeak + rightPeak) / 2,
    highestY + DETAIL / 2,
    z + (depth - 1) / 2,
    2 * DETAIL,
    DETAIL,
    depth + 4 * DETAIL,
    dark,
  );
}

function house(
  builder: VoxelBuilder,
  colliders: TownCollider[],
  vegetation: TownVegetation[],
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
  detailHouseFacades(builder, x, z, width, depth, base, height, wall);
  detailHouseTimber(builder, x, z, width, depth, base, height);

  const front = z + depth - 1;
  const right = x + width - 1;
  const doorX = x + Math.floor(width / 2);
  for (let y = base + 2; y <= base + 4; y += 1) {
    builder.set(doorX, y, front, 'timber');
  }
  const doorHeight = 8 * DETAIL;
  const doorCenterY = base + 0.5 + doorHeight / 2;
  recessedFrontOpening(builder, doorX, doorCenterY, front, 4 * DETAIL, doorHeight, 'timberLight', 0, false);
  builder.surfaceBox(doorX + DETAIL, doorCenterY, front + 3 * DETAIL, DETAIL, DETAIL, DETAIL, 'iron');
  builder.surfaceBox(doorX, base + 0.5 + DETAIL / 2, front + 0.5 + DETAIL, 6 * DETAIL, DETAIL, 2 * DETAIL, 'stoneLight');

  for (const wx of [x + 3, x + width - 4]) {
    if (wx <= x + 1 || wx >= x + width - 1) continue;
    for (const windowBase of [base + 4, base + 7]) {
      if (windowBase + 1 > base + height) continue;
      for (let wy = windowBase; wy <= windowBase + 1; wy += 1) {
        builder.set(wx, wy, front, 'window', windowBase === base + 4 ? 0.52 : 0.42);
      }
      const windowGlow = windowBase === base + 4 ? 0.52 : 0.42;
      recessedFrontOpening(builder, wx, windowBase + 0.5, front, 3 * DETAIL, 6 * DETAIL, 'window', windowGlow, true);
      if (windowBase === base + 4 && ((wx + x) & 1) === 0) {
        windowFlowerBox(builder, vegetation, wx, windowBase - 0.5, front, ((x + z) & 1) === 0);
      }
    }
  }

  for (const wz of [z + 3, z + depth - 4]) {
    if (wz <= z + 1 || wz >= front - 1) continue;
    for (const windowBase of [base + 4, base + 7]) {
      if (windowBase + 1 > base + height) continue;
      for (let wy = windowBase; wy <= windowBase + 1; wy += 1) builder.set(right, wy, wz, 'window', 0.36);
      recessedSideWindow(builder, wz, windowBase + 0.5, right, 0.36);
    }
  }

  if (width >= 15) {
    const balconyY = base + 6.5;
    const balconyZ = front + 0.5 + 1.5 * DETAIL;
    builder.surfaceBox(doorX, balconyY - DETAIL / 2, balconyZ, 7 * DETAIL, DETAIL, 3 * DETAIL, 'timberLight');
    builder.surfaceBox(doorX, balconyY + 2 * DETAIL, front + 0.5 + 3 * DETAIL, 7 * DETAIL, DETAIL, DETAIL, 'timber');
    for (const railX of [doorX - 3 * DETAIL, doorX, doorX + 3 * DETAIL]) {
      builder.surfaceBox(railX, balconyY + DETAIL, front + 0.5 + 3 * DETAIL, DETAIL, 3 * DETAIL, DETAIL, 'timber');
    }
  }
  hangingHouseSign(builder, doorX + 2.5, base + 5.5, front, roof === 'roofRed');
  addVegetation(
    vegetation,
    x + 0.25,
    base + 2.5,
    front + 0.52,
    'ivy',
    0.9 + hash(x * 13 + z * 37) * 0.45,
    x * 53 + z * 89,
  );

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
      builder.carveSurfaceCell(left, y, zz);
      builder.carveSurfaceCell(right, y, zz);
    }
    for (let xx = left + 1; xx < right; xx += 1) {
      builder.set(xx, y, z, wall);
      builder.set(xx, y, z + depth - 1, wall);
    }
  }
  detailedGableRoof(builder, x, z, width, depth, base, height, roof);

  const chimneyX = x + width - 3;
  builder.fillBox(chimneyX, base + height + 2, z + 2, 2, 5, 2, 'stoneDark');
  for (let course = 0; course < 15; course += 1) {
    const material = masonryMaterial(course, course % 3, chimneyX + z);
    builder.surfaceBox(
      chimneyX + (course % 6 < 3 ? -DETAIL : 1 + DETAIL),
      fineCenter(base + height + 2, course),
      z + 2 + DETAIL,
      DETAIL,
      DETAIL,
      2,
      material,
    );
  }
  builder.surfaceBox(chimneyX + 0.5, base + height + 7.25, z + 2.5, 2 + 2 * DETAIL, DETAIL, 2 + 2 * DETAIL, 'stoneLight');
  addCollider(colliders, x, z, width, depth);
}

function detailTowerFacades(builder: VoxelBuilder, x: number, z: number, base: number): void {
  const faceCells = 9 * TOWN_DETAIL_RESOLUTION;
  const yCells = 18 * TOWN_DETAIL_RESOLUTION;
  for (let horizontal = 0; horizontal < faceCells; horizontal += 1) {
    for (let vertical = 0; vertical < yCells; vertical += 1) {
      const course = Math.floor(vertical / 2);
      const material = masonryMaterial(horizontal, course, x * 31 + z * 17);
      builder.surfaceBox(
        fineCenter(x, horizontal),
        fineCenter(base + 1, vertical),
        z + 8 + DETAIL,
        DETAIL,
        DETAIL,
        DETAIL,
        material,
      );
      builder.surfaceBox(
        x + 8 + DETAIL,
        fineCenter(base + 1, vertical),
        fineCenter(z, horizontal),
        DETAIL,
        DETAIL,
        DETAIL,
        material,
      );
    }
  }
}

function bellTower(builder: VoxelBuilder, colliders: TownCollider[], x: number, z: number): void {
  const base = groundHeightGrid(x + 4, z + 4);
  castShadow(builder, x, z, 9, 9, 15);
  builder.fillBox(x, base + 1, z, 9, 18, 9, 'stoneLight');
  for (let y = base + 2; y < base + 18; y += 4) {
    for (let xx = x; xx < x + 9; xx += 1) builder.set(xx, y, z + 8, 'stoneDark');
  }
  detailTowerFacades(builder, x, z, base);
  for (const windowBase of [base + 5, base + 11]) {
    builder.fillBox(x + 3, windowBase, z + 8, 3, 3, 1, 'window', windowBase === base + 5 ? 0.46 : 0.36);
    recessedFrontOpening(
      builder,
      x + 4,
      windowBase + 1,
      z + 8,
      5 * DETAIL,
      8 * DETAIL,
      'glassCool',
      windowBase === base + 5 ? 0.46 : 0.36,
      true,
      'stoneDark',
      'mortar',
    );
    builder.fillBox(x + 8, windowBase, z + 3, 1, 3, 3, 'window', windowBase === base + 5 ? 0.4 : 0.32);
    recessedSideWindow(
      builder,
      z + 4,
      windowBase + 1,
      x + 8,
      windowBase === base + 5 ? 0.4 : 0.32,
      5 * DETAIL,
      8 * DETAIL,
      'stoneDark',
      'mortar',
    );
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
  awnings: TownAwning[],
  x: number,
  z: number,
  style: TownAwningStyle,
): void {
  const base = groundHeightGrid(x + 3, z + 2);
  for (const [px, pz] of [[x, z], [x + 6, z], [x, z + 4], [x + 6, z + 4]] as const) {
    builder.fillBox(px, base + 1, pz, 1, 6, 1, 'timber');
    for (let py = base + 1; py <= base + 6; py += 1) builder.carveSurfaceCell(px, py, pz);
    builder.surfaceBox(px, base + 3.5, pz, 2 * DETAIL, 6, 2 * DETAIL, 'timber');
    for (const bandY of [base + 1.5, base + 5.5]) {
      builder.surfaceBox(px, bandY, pz, 3 * DETAIL, DETAIL, 3 * DETAIL, 'iron');
    }
  }
  builder.fillBox(x, base + 3, z + 1, 7, 1, 3, 'timber');
  builder.fillBox(x, base + 1, z + 1, 2, 2, 3, 'timber');
  builder.fillBox(x + 5, base + 1, z + 1, 2, 2, 3, 'timber');
  builder.surfaceBox(x + 3, base + 3.75, z + 2, 8, 0.5, 4, 'timberLight');
  builder.surfaceBox(x + 2.5, base + 7.5, z + 4.5 + DETAIL / 2, 9, DETAIL, DETAIL, 'timber');
  builder.surfaceBox(x + 2.5, base + 7.5, z - 1.5 - DETAIL / 2, 9, DETAIL, DETAIL, 'timber');
  builder.surfaceBox(x - 1.5 - DETAIL / 2, base + 7.5, z + 1.5, DETAIL, DETAIL, 6 + DETAIL, 'timber');
  builder.surfaceBox(x + 6.5 + DETAIL / 2, base + 7.5, z + 1.5, DETAIL, DETAIL, 6 + DETAIL, 'timber');
  awnings.push({
    x: (x + 2.5) * VOXEL_SIZE,
    y: (base + 7.15) * VOXEL_SIZE,
    z: (z + 1.5) * VOXEL_SIZE,
    width: 8 * VOXEL_SIZE,
    depth: 6 * VOXEL_SIZE,
    yaw: 0,
    slope: 0.14,
    style,
    phase: hash(x * 59 + z * 83),
  });

  // Narrow counter slats and many small produce piles match the reference's
  // lived-in market density while keeping the path collider unchanged.
  for (let slat = 0; slat < 11; slat += 1) {
    builder.surfaceBox(
      x + 0.5 + slat * 2 * DETAIL,
      base + 3.75,
      z + 4 + DETAIL,
      DETAIL,
      2 * DETAIL,
      DETAIL,
      slat % 3 === 0 ? 'timber' : 'timberLight',
    );
  }

  for (let index = 0; index < 11; index += 1) {
    const produce = index % 3 === 0 ? 'produceRed' : index % 3 === 1 ? 'produceGold' : 'produceGreen';
    builder.surfaceBox(
      x + 0.25 + index * 2 * DETAIL,
      base + 4.25 + (index % 2) * DETAIL,
      z + 3.75,
      DETAIL,
      DETAIL,
      DETAIL,
      produce,
    );
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
        builder.carveSurfaceCell(cx + x, base + 1, cz + z);
      } else if (radius <= 3.2) {
        builder.set(cx + x, base + 1, cz + z, 'waterTile', 0.1);
        builder.carveSurfaceCell(cx + x, base + 1, cz + z);
      }
    }
  for (let fineX = -13; fineX <= 13; fineX += 1) {
    for (let fineZ = -13; fineZ <= 13; fineZ += 1) {
      const dx = fineX * DETAIL;
      const dz = fineZ * DETAIL;
      const radius = Math.hypot(dx, dz);
      if (radius >= 3.25 && radius <= 4.35) {
        const course = Math.round(radius / DETAIL);
        builder.surfaceBox(
          cx + dx,
          base + 0.5 + DETAIL,
          cz + dz,
          DETAIL,
          2 * DETAIL,
          DETAIL,
          masonryMaterial(fineX, fineZ, course),
        );
      } else if (radius < 3.25) {
        builder.surfaceBox(
          cx + dx,
          base + 0.5 + DETAIL / 2,
          cz + dz,
          DETAIL,
          DETAIL,
          DETAIL,
          'stoneDark',
        );
      }
    }
  }
  builder.surfaceBox(cx, base + 1.5, cz, 3, 1, 3, 'stoneDark');
  builder.fillBox(cx, base + 2, cz, 1, 6, 1, 'stoneLight');
  builder.surfaceBox(cx, base + 4.5, cz, 1.5, 1, 1.5, 'stone');
  builder.fillBox(cx - 1, base + 7, cz - 1, 3, 2, 3, 'stone');
  builder.surfaceBox(cx, base + 9.25, cz, 2, 0.5, 2, 'stoneLight');
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
  const fineStartX = BRIDGE_MIN_X * TOWN_DETAIL_RESOLUTION;
  const fineEndX = (BRIDGE_MAX_X + 1) * TOWN_DETAIL_RESOLUTION;
  for (let fineZ = fineStart; fineZ < fineEnd; fineZ += 1) {
    const z = -0.5 + (fineZ + 0.5) / TOWN_DETAIL_RESOLUTION;
    const deckTop = bridgeSurfaceGridHeight(z);
    for (let fineX = fineStartX; fineX < fineEndX; fineX += 1) {
      const gx = Math.floor(fineX / TOWN_DETAIL_RESOLUTION);
      const edge = fineX < fineStartX + 2 || fineX >= fineEndX - 2;
      builder.surfaceBox(
        fineCenter(0, fineX),
        deckTop - DETAIL / 2,
        z,
        DETAIL,
        DETAIL,
        DETAIL,
        edge ? 'stoneLight' : detailedGroundMaterial(fineX, fineZ, gx, Math.floor(fineZ / TOWN_DETAIL_RESOLUTION)),
      );
    }
  }

  // Side spandrels form a true arched silhouette rather than a rectangular
  // deck floating above the canal. The opening remains clear down to the water.
  for (const sideX of [BRIDGE_MIN_X, BRIDGE_MAX_X]) {
    const outward = sideX < 0 ? -1 : 1;
    for (let z = CANAL_MIN_Z; z <= CANAL_MAX_Z; z += 1) {
      const distance = Math.abs(z - (CANAL_MIN_Z + CANAL_MAX_Z) / 2);
      const archCeiling = Math.max(-1, 2 - Math.floor(distance * 0.8));
      for (let y = -2; y < bridgeHeight(z); y += 1) {
        const endPier = z === CANAL_MIN_Z || z === CANAL_MAX_Z;
        if (endPier || y > archCeiling) {
          builder.set(sideX, y, z, y === bridgeHeight(z) - 1 ? 'stoneLight' : 'stoneDark');
          for (let iz = 0; iz < TOWN_DETAIL_RESOLUTION; iz += 1) {
            for (let iy = 0; iy < TOWN_DETAIL_RESOLUTION; iy += 1) {
              builder.surfaceBox(
                sideX + outward * DETAIL,
                fineCenter(y, iy),
                fineCenter(z, iz),
                DETAIL,
                DETAIL,
                DETAIL,
                masonryMaterial(iz + z * 3, iy + (y + 3) * 3, sideX * 19),
              );
            }
          }
        }
      }
      if (z > CANAL_MIN_Z && z < CANAL_MAX_Z) {
        for (let iz = 0; iz < TOWN_DETAIL_RESOLUTION; iz += 1) {
          builder.surfaceBox(
            sideX + outward * 2 * DETAIL,
            fineCenter(archCeiling + 1, 0),
            fineCenter(z, iz),
            DETAIL,
            DETAIL,
            DETAIL,
            iz === 1 ? 'stoneLight' : 'mortar',
          );
        }
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

  // Crown banners make the crossing a civic landmark and provide motion-ready
  // cloth geometry without changing the walkable deck or collider envelope.
  const crownZ = (CANAL_MIN_Z + CANAL_MAX_Z) / 2;
  const crownTop = bridgeSurfaceGridHeight(crownZ);
  for (const sideX of [BRIDGE_MIN_X - 1, BRIDGE_MAX_X + 1]) {
    builder.surfaceBox(sideX, crownTop + 3, crownZ, DETAIL, 6, DETAIL, 'iron');
    builder.surfaceBox(
      sideX + (sideX < 0 ? -DETAIL : DETAIL),
      crownTop + 4.25,
      crownZ + DETAIL,
      3 * DETAIL,
      3 * DETAIL,
      DETAIL,
      sideX < 0 ? 'clothRed' : 'clothGold',
    );
    builder.surfaceBox(sideX, crownTop + 6.25, crownZ, 2 * DETAIL, DETAIL, 2 * DETAIL, 'roofGold');
  }
}

/**
 * The town's tree species, in one committed table — goal 08's species coherence. The capture
 * showed "tall thin ones at left" and "a lollipop on the right ridge" reading as different
 * plants by accident; now every placement resolves to a row here and the distribution test
 * counts exactly these.
 */
export const TOWN_TREE_SPECIES = Object.freeze({
  /** The town broadleaf in summer dress: round crown on a stout trunk. */
  'green-round': Object.freeze({ crownScale: 1.75, crownPerHeight: 0.09, trunkPerHeight: 0.62, autumn: false }),
  /** The same broadleaf turned: identical silhouette, autumn palette. */
  'autumn-round': Object.freeze({ crownScale: 1.75, crownPerHeight: 0.09, trunkPerHeight: 0.62, autumn: true }),
  /** The ridge sentinel behind the skyline: taller, sparser crown, only ever on the far hills. */
  'ridge-sentinel': Object.freeze({ crownScale: 1.5, crownPerHeight: 0.08, trunkPerHeight: 0.56, autumn: false }),
});

export type TownTreeSpecies = keyof typeof TOWN_TREE_SPECIES;

/**
 * Every near tree the town plants, authored here so the placement is data the tests can read.
 * Goal 08 added the grove pairs: trees were sparse singles, and the same clustering logic the
 * grass follows says company reads as landscape while singles read as markers.
 */
export const TOWN_TREE_PLACEMENTS: readonly (readonly [number, number, number, TownTreeSpecies])[] = Object.freeze([
  [-34, 22, 8, 'green-round'], [-24, 26, 7, 'autumn-round'], [39, 22, 8, 'autumn-round'],
  [-24, 8, 8, 'green-round'], [24, 8, 7, 'green-round'], [-17, -22, 9, 'autumn-round'],
  [23, -23, 8, 'green-round'], [-3, -29, 7, 'green-round'], [44, -19, 8, 'autumn-round'],
  [-45, -23, 9, 'green-round'],
  // The goal-08 groves: partners beside the existing singles, and two new stands.
  [-30, 19, 7, 'green-round'], [-28, 25, 6, 'autumn-round'],
  [36, 25, 7, 'green-round'], [42, 17, 6, 'autumn-round'],
  [-21, -18, 7, 'green-round'], [27, -19, 6, 'autumn-round'],
  [-40, -20, 7, 'autumn-round'], [40, 6, 6, 'autumn-round'],
]);

function tree(
  colliders: TownCollider[],
  vegetation: TownVegetation[],
  gx: number,
  gz: number,
  height: number,
  species: TownTreeSpecies = 'green-round',
): void {
  const base = groundHeightGrid(gx, gz);
  const seed = gx * 101 + gz * 211;
  const row = TOWN_TREE_SPECIES[species];
  addVegetation(vegetation, gx + 0.5, base + 0.5, gz + 0.5, 'tree-trunk', height * row.trunkPerHeight, seed);
  addVegetation(
    vegetation,
    gx + 0.5,
    base + height,
    gz + 0.5,
    'tree-crown',
    row.crownScale + height * row.crownPerHeight,
    seed + (row.autumn ? 991 : 0),
  );
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

function cargoCluster(
  builder: VoxelBuilder,
  colliders: TownCollider[],
  spriteProps: TownSpriteProp[],
  x: number,
  z: number,
): void {
  const base = groundHeightGrid(x, z);
  for (const [index, bx, bz, scale] of [
    [0, x, z, 0.92],
    [1, x + 1.75, z + 0.5, 0.78],
  ] as const) {
    addSpriteProp(spriteProps, bx, base + 0.5, bz, 'barrel', scale, x * 67 + z * 41 + index, 0.31);
  }
  // The structural crate stays voxel-authored and retains the cluster's
  // original blocking envelope; curved barrels are bent sprite geometry.
  builder.surfaceBox(x - 1.5, base + 0.75, z + 0.5, 1.5, 1.5, 1.5, 'timber');
  builder.surfaceBox(x - 1.5, base + 1.5, z + 0.5, 1.75, 0.25, 1.75, 'timberLight');
  builder.surfaceBox(x - 1.5, base + 0.75, z + 1.25, 1.75, 0.25, 0.25, 'iron');
  addCollider(colliders, x - 2.25, z - 0.75, 5.25, 3, 0.05, `town.cargo.${x}.${z}`);
}

function flowerPlanter(
  builder: VoxelBuilder,
  colliders: TownCollider[],
  vegetation: TownVegetation[],
  x: number,
  z: number,
  violet: boolean,
): void {
  const base = groundHeightGrid(x, z);
  builder.surfaceBox(x, base + 0.75, z, 2, 1, 1, 'stone');
  builder.surfaceBox(x, base + 1.25, z, 1.5, 0.5, 0.5, 'soil');
  for (const offset of [-0.5, 0, 0.5]) {
    addVegetation(
      vegetation,
      x + offset,
      base + 1.5,
      z,
      'flower',
      0.62 + Math.abs(offset) * 0.16,
      x * 31 + z * 47 + offset * 101 + (violet ? 7 : 17),
    );
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

function occupiedByCollider(colliders: readonly TownCollider[], gx: number, gz: number, margin = 0.25): boolean {
  const wx = gx * VOXEL_SIZE;
  const wz = gz * VOXEL_SIZE;
  return colliders.some((box) => (
    wx > box.minX - margin
    && wx < box.maxX + margin
    && wz > box.minZ - margin
    && wz < box.maxZ + margin
  ));
}

function terracottaPot(
  builder: VoxelBuilder,
  vegetation: TownVegetation[],
  gx: number,
  gz: number,
  violet: boolean,
): void {
  const groundTop = groundHeightGrid(Math.round(gx), Math.round(gz)) + 0.5;
  builder.surfaceBox(gx, groundTop + DETAIL, gz, 2 * DETAIL, 2 * DETAIL, 2 * DETAIL, 'terracotta');
  addVegetation(
    vegetation,
    gx,
    groundTop + 2 * DETAIL,
    gz,
    violet ? 'flower' : 'shrub',
    violet ? 0.68 : 0.82,
    gx * 31 + gz * 67 + (violet ? 3 : 11),
  );
}

function smallCrate(builder: VoxelBuilder, gx: number, gz: number, produce: PaletteName): void {
  const groundTop = groundHeightGrid(Math.round(gx), Math.round(gz)) + 0.5;
  builder.surfaceBox(gx, groundTop + DETAIL, gz, 3 * DETAIL, 2 * DETAIL, 3 * DETAIL, 'timberLight');
  builder.surfaceBox(gx, groundTop + 2.5 * DETAIL, gz, 3 * DETAIL, DETAIL, 3 * DETAIL, 'timber');
  for (const offset of [-DETAIL, 0, DETAIL]) {
    builder.surfaceBox(gx + offset, groundTop + 3.5 * DETAIL, gz, DETAIL, DETAIL, DETAIL, produce);
  }
}

function scatterTownClutter(
  builder: VoxelBuilder,
  colliders: readonly TownCollider[],
  vegetation: TownVegetation[],
): void {
  // Patch-clustered meadow — goal 08, replacing a 2 m parity lattice with 16% dropout. A uniform
  // lattice reads as a lattice: the capture showed one tuft stamped in rows, and the eye finds the
  // rhythm immediately. Patches with radial falloff, continuous jitter, scale and blade variety,
  // slope awareness, a soft feather at paved edges, and distance falloff are each one rule here,
  // and each is measured by `town-grass-distribution.test.ts` rather than trusted.
  //
  // Everything stays deterministic — same hash, same seeds — so `buildTownWorld` remains a pure
  // function of nothing, which the validation suite depends on.
  const PATCH_COUNT = 74;
  const PLAZA_X = 0;
  const PLAZA_Z = 4;
  for (let patch = 0; patch < PATCH_COUNT; patch += 1) {
    const patchSeed = patch * 733 + 91;
    const patchX = WORLD_MIN_X + 3 + hash(patchSeed) * (WORLD_MAX_X - WORLD_MIN_X - 6);
    const patchZ = WORLD_MIN_Z + 3 + hash(patchSeed * 3 + 1) * (WORLD_MAX_Z - WORLD_MIN_Z - 6);
    const patchRadius = 2.0 + hash(patchSeed * 7 + 2) * 2.8;
    const bladeCount = Math.floor(26 + hash(patchSeed * 11 + 3) * 38);
    for (let blade = 0; blade < bladeCount; blade += 1) {
      const bladeSeed = patchSeed + blade * 517 + 5;
      const angle = hash(bladeSeed) * Math.PI * 2;
      // sqrt keeps the disc filled rather than ringed; the falloff gate below thins the rim.
      const radial = Math.sqrt(hash(bladeSeed * 3 + 1)) * patchRadius;
      const gx = patchX + Math.cos(angle) * radial;
      const gz = patchZ + Math.sin(angle) * radial;
      if (gx < WORLD_MIN_X + 2 || gx > WORLD_MAX_X - 2 || gz < WORLD_MIN_Z + 2 || gz > WORLD_MAX_Z - 1) continue;
      const cellX = Math.round(gx);
      const cellZ = Math.round(gz);
      if (isCanal(cellX, cellZ) || pavedGroundAt(cellX, cellZ) || occupiedByCollider(colliders, gx, gz)) continue;
      // Patch falloff: the rim keeps fewer blades than the core, so a patch feathers into the
      // field instead of stopping at its radius.
      if (hash(bladeSeed * 5 + 2) < (radial / patchRadius) * 0.45) continue;
      // Slope gate: grass collects in flats and hollows, not on berm faces.
      const here = groundHeightGrid(cellX, cellZ);
      const neighbourhood = [
        groundHeightGrid(cellX + 1, cellZ), groundHeightGrid(cellX - 1, cellZ),
        groundHeightGrid(cellX, cellZ + 1), groundHeightGrid(cellX, cellZ - 1),
      ];
      let steepest = 0;
      let neighbourSum = 0;
      for (const height of neighbourhood) {
        steepest = Math.max(steepest, Math.abs(height - here));
        neighbourSum += height;
      }
      if (steepest > 0.9) continue;
      // Concave collectors keep everything; open flats thin slightly.
      const hollow = neighbourSum / 4 - here > 0.2;
      if (!hollow && hash(bladeSeed * 13 + 4) < 0.12) continue;
      // Soft exclusion feather: the field thins over two cells approaching pavement or a wall
      // instead of stopping on the boundary line.
      const pavedRing1 = pavedGroundAt(cellX + 1, cellZ) || pavedGroundAt(cellX - 1, cellZ)
        || pavedGroundAt(cellX, cellZ + 1) || pavedGroundAt(cellX, cellZ - 1);
      const pavedRing2 = pavedGroundAt(cellX + 2, cellZ) || pavedGroundAt(cellX - 2, cellZ)
        || pavedGroundAt(cellX, cellZ + 2) || pavedGroundAt(cellX, cellZ - 2);
      const feather = pavedRing1 ? 0.2 : pavedRing2 ? 0.6 : 1;
      if (hash(bladeSeed * 17 + 5) > feather) continue;
      // Distance falloff from the plaza the camera lives over.
      const plazaDistance = Math.hypot(gx - PLAZA_X, gz - PLAZA_Z);
      if (plazaDistance > 24 && hash(bladeSeed * 19 + 6) < (plazaDistance - 24) / 30) continue;
      const groundTop = here + 0.5;
      // A taller blade among the short, so the meadow has a profile rather than one height.
      const tall = hash(bladeSeed * 23 + 7) > 0.85;
      const scale = tall
        ? 1.2 + hash(bladeSeed * 31 + 8) * 0.6
        : 0.5 + hash(bladeSeed * 31 + 8) * 0.85;
      addVegetation(vegetation, gx, groundTop, gz, tall ? 'reeds' : 'grass', scale, bladeSeed);
      if (!tall && hash(bladeSeed * 37 + 9) > 0.86) {
        addVegetation(vegetation, gx + 0.4, groundTop, gz - 0.3, 'flower', 0.42 + hash(bladeSeed * 41 + 10) * 0.35, bladeSeed + 409);
      }
    }
  }

  for (let gx = WORLD_MIN_X + 3; gx <= WORLD_MAX_X - 3; gx += 3) {
    if (gx >= BRIDGE_MIN_X - 2 && gx <= BRIDGE_MAX_X + 2) continue;
    const nearBank = CANAL_MIN_Z - 0.35;
    const farBank = CANAL_MAX_Z + 0.35;
    addVegetation(vegetation, gx, 0.5, nearBank, 'reeds', 0.72 + hash(gx * 37) * 0.45, gx * 97 + 11);
    addVegetation(vegetation, gx + 0.5, 0.5, farBank, 'reeds', 0.72 + hash(gx * 43) * 0.45, gx * 101 + 17);
  }

  for (const [gx, gz, violet] of [
    [-27, -5, true], [-24, -4, false], [24, -4, true], [27, -5, false],
    [-31, -22, false], [27, -23, true], [-21, 5, true], [22, 5, false],
    [-8, 8, false], [9, 8, true], [-7, 20, true], [8, 20, false],
  ] as const) terracottaPot(builder, vegetation, gx, gz, violet);

  for (const [gx, gz, produce] of [
    [-20, 4, 'produceRed'], [-16, 5, 'produceGold'], [10, 5, 'produceGreen'],
    [16, 6, 'produceRed'], [-18, -12, 'produceGold'], [-12, -11, 'produceGreen'],
    [20, -7, 'produceRed'], [24, -8, 'produceGold'],
  ] as const) smallCrate(builder, gx, gz, produce);
}

function canalMasonry(builder: VoxelBuilder): void {
  // The canal-facing layers are running-bond stone rather than long flat
  // retaining-wall strips. These cells replace the outer layer in the union.
  for (const [bankZ, outward, minY, maxY] of [
    [CANAL_MIN_Z - 1, 1, -2, 1],
    [CANAL_MAX_Z + 1, -1, -2, 0],
  ] as const) {
    for (let fineX = WORLD_MIN_X * TOWN_DETAIL_RESOLUTION; fineX < (WORLD_MAX_X + 1) * TOWN_DETAIL_RESOLUTION; fineX += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (let iy = 0; iy < TOWN_DETAIL_RESOLUTION; iy += 1) {
          builder.surfaceBox(
            fineCenter(0, fineX),
            fineCenter(y, iy),
            bankZ + outward * DETAIL,
            DETAIL,
            DETAIL,
            DETAIL,
            masonryMaterial(fineX, iy + (y + 3) * 3, bankZ * 13),
          );
        }
      }
    }
  }

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

function waterfallChannel(builder: VoxelBuilder, colliders: TownCollider[]): void {
  const channelCenterX = (WATERFALL_GRID.minX + WATERFALL_GRID.maxX) / 2;
  const frontZ = WATERFALL_GRID.z - 0.5;

  // An elevated, open stone leat carries the renderer-owned water forward
  // between two rear buildings. The trough is deliberately dark so the thin
  // animated channel has strong material contrast from the southeast camera.
  for (let z = -33; z <= -25; z += 1) {
    builder.surfaceBox(channelCenterX, 8.5 + DETAIL / 2, z, 4, DETAIL, 1, 'stoneDark');
    for (const bankX of [WATERFALL_GRID.minX - DETAIL / 2, WATERFALL_GRID.maxX + DETAIL / 2]) {
      builder.surfaceBox(
        bankX,
        9 + DETAIL / 2,
        z,
        DETAIL,
        3 * DETAIL,
        1,
        z % 3 === 0 ? 'stoneLight' : 'stone',
      );
    }
  }

  // Twin solid piers anchor the 5.27 m drop to the rear terrace. They occupy
  // the otherwise empty gap between the west house and guildhall, keeping the
  // primary processional route and all existing building colliders untouched.
  for (const pierX of [-29, -23]) {
    builder.fillBox(pierX, 0, -25, 2, 10, 2, 'stoneDark');
    for (let ix = 0; ix < 2 * TOWN_DETAIL_RESOLUTION; ix += 1) {
      for (let iy = 0; iy < 10 * TOWN_DETAIL_RESOLUTION; iy += 1) {
        builder.surfaceBox(
          fineCenter(pierX, ix),
          fineCenter(0, iy),
          -24 + DETAIL,
          DETAIL,
          DETAIL,
          DETAIL,
          masonryMaterial(ix, iy, pierX * 17),
        );
      }
    }
    builder.surfaceBox(pierX + 0.5, 1, -23.5 + DETAIL, 2 + 2 * DETAIL, 2, 2 + DETAIL, 'stoneDark');
    builder.surfaceBox(pierX + 0.5, 9.75, -24.5, 2 + 2 * DETAIL, DETAIL, 2 + 2 * DETAIL, 'stoneLight');
  }

  // A recessed backplate makes the translucent fall readable in both bright
  // sun and shadow; projecting voussoirs and spill lip give it architectural
  // weight without inserting voxel water into the opening.
  builder.surfaceBox(channelCenterX, 4.75, frontZ - DETAIL, 4, 8.5, DETAIL, 'stoneDark');
  builder.surfaceBox(channelCenterX, 9.5, -24.5, 6, 1, 2, 'stone');
  builder.surfaceBox(channelCenterX, 9 + DETAIL / 2, frontZ + DETAIL, 5, DETAIL, 2 * DETAIL, 'stoneLight');
  for (const [offset, height] of [[-2.5, 8], [2.5, 8], [-2, 8.5], [2, 8.5]] as const) {
    builder.surfaceBox(
      channelCenterX + offset,
      height,
      frontZ + 2 * DETAIL,
      DETAIL,
      DETAIL,
      DETAIL,
      'stoneLight',
    );
  }

  // The foreground basin terminates the vertical ribbon with a broad stone
  // silhouette and dark floor that the water renderer can cover with foam.
  for (let x = -30; x <= -21; x += 1) {
    for (let z = -23; z <= -19; z += 1) {
      const edge = x === -30 || x === -21 || z === -19;
      if (edge) {
        builder.surfaceBox(x, 0.5 + DETAIL, z, 1, 2 * DETAIL, 1, (x + z) % 3 === 0 ? 'stoneLight' : 'stone');
      } else {
        builder.surfaceBox(x, 0 + DETAIL, z, 1, DETAIL, 1, 'stoneDark');
      }
    }
  }
  colliders.push({
    id: 'town.water.waterfall-basin',
    minX: -30.5 * VOXEL_SIZE,
    maxX: -20.5 * VOXEL_SIZE,
    minZ: -25 * VOXEL_SIZE,
    maxZ: -18.5 * VOXEL_SIZE,
  });
}

function distantTree(vegetation: TownVegetation[], gx: number, gy: number, gz: number, height: number): void {
  const seed = gx * 79 + gz * 137;
  addVegetation(vegetation, gx, gy, gz, 'tree-trunk', height * 0.56, seed);
  addVegetation(vegetation, gx, gy + height, gz, 'tree-crown', 1.5 + height * 0.08, seed + 53);
}

function distantTerrain(builder: VoxelBuilder, vegetation: TownVegetation[]): void {
  const hills = [
    [-36, -49, 34, 13, 8],
    [-4, -52, 30, 10, 7],
    [29, -49, 40, 14, 10],
  ] as const;
  for (const [centerX, startZ, width, depth, height] of hills) {
    for (let layer = 0; layer < height; layer += 1) {
      const insetX = Math.floor(layer * 1.45);
      const insetZ = Math.floor(layer * 0.45);
      const layerWidth = Math.max(3, width - insetX * 2);
      const layerDepth = Math.max(2, depth - insetZ * 2);
      const material = layer === height - 1 ? 'grassLight' : layer % 4 === 0 ? 'stoneDark' : 'grass';
      builder.fillBox(
        centerX - Math.floor(width / 2) + insetX,
        3 + layer,
        startZ + insetZ,
        layerWidth,
        1,
        layerDepth,
        material,
      );
    }
  }

  // Sparse towers and tree masses extend the skyline well beyond the playable
  // boundary without adding physics or navigation work to the distant set.
  builder.fillBox(-18, 4, -48, 5, 12, 5, 'stoneDark');
  builder.fillBox(-19, 16, -49, 7, 1, 7, 'stoneLight');
  for (let step = 0; step < 4; step += 1) {
    builder.fillBox(-19 + step, 17 + step, -49 + step, 7 - step * 2, 1, 7 - step * 2, 'roofSlateDark');
  }
  builder.fillBox(20, 4, -47, 6, 9, 5, 'stone');
  for (let step = 0; step < 3; step += 1) {
    builder.fillBox(19 + step, 13 + step, -48 + step, 8 - step * 2, 1, 7 - step * 2, 'roofRedDark');
  }
  for (const [x, y, z, height] of [
    [-45, 10, -46, 7], [-32, 9, -48, 6], [-8, 9, -50, 7],
    [3, 9, -50, 6], [33, 11, -47, 8], [45, 9, -45, 7],
  ] as const) distantTree(vegetation, x, y, z, height);
}

/**
 * What kind of ground a grid cell is, for the grass-distribution tests. The placement rules below
 * consume the same predicates, so the tests measure the exact contract the generator enforces.
 */
export function townGroundKindAt(gx: number, gz: number): 'canal' | 'paved' | 'open' {
  if (isCanal(gx, gz)) return 'canal';
  if (pavedGroundAt(gx, gz)) return 'paved';
  return 'open';
}

/** Ground height for the same tests: slope and collector rules are measured, not trusted. */
export function townGroundHeightAt(gx: number, gz: number): number {
  return groundHeightGrid(Math.round(gx), Math.round(gz));
}

function pavedGroundAt(gx: number, gz: number): boolean {
  const plazaDistance = Math.hypot(gx * 0.82, (gz + 6) * 1.08);
  const square = plazaDistance <= 19;
  const southProcessional = Math.abs(gx) <= 4 && gz >= -30 && gz < CANAL_MIN_Z;
  const northProcessional = Math.abs(gx) <= 4 && gz > CANAL_MAX_Z && gz <= 32;
  const crossStreet = gz >= -3 && gz <= 2;
  return square || southProcessional || northProcessional || crossStreet || isBridge(gx, gz);
}

function detailedGroundMaterial(fineX: number, fineZ: number, gx: number, gz: number): PaletteName {
  const plazaDistance = Math.hypot(gx * 0.82, (gz + 6) * 1.08);
  if (Math.abs(plazaDistance - 11) < 0.8) return 'stoneLight';
  const rowOffset = Math.abs(fineZ) % 2;
  const brick = Math.floor((fineX + rowOffset) / 2);
  const variation = Math.abs(brick * 7 + fineZ * 3) % 17;
  if (variation === 0 || variation === 11) return 'cobbleLight';
  if (variation === 5) return 'cobbleDark';
  if (variation === 14) return 'cobbleMoss';
  return 'cobble';
}

function detailPavedGround(builder: VoxelBuilder): void {
  const minFineX = WORLD_MIN_X * TOWN_DETAIL_RESOLUTION;
  const maxFineX = (WORLD_MAX_X + 1) * TOWN_DETAIL_RESOLUTION;
  const minFineZ = WORLD_MIN_Z * TOWN_DETAIL_RESOLUTION;
  const maxFineZ = (WORLD_MAX_Z + 1) * TOWN_DETAIL_RESOLUTION;
  for (let fineZ = minFineZ; fineZ < maxFineZ; fineZ += 1) {
    const gz = Math.floor(fineZ / TOWN_DETAIL_RESOLUTION);
    for (let fineX = minFineX; fineX < maxFineX; fineX += 1) {
      const gx = Math.floor(fineX / TOWN_DETAIL_RESOLUTION);
      if (!pavedGroundAt(gx, gz) || (isCanal(gx, gz) && !isBridge(gx, gz))) continue;
      const y = groundHeightGrid(gx, gz);
      builder.surfaceBox(
        fineCenter(0, fineX),
        y + DETAIL,
        fineCenter(0, fineZ),
        DETAIL,
        DETAIL,
        DETAIL,
        detailedGroundMaterial(fineX, fineZ, gx, gz),
      );
    }
  }
}

function buildGround(builder: VoxelBuilder): void {
  for (let z = VISUAL_MIN_Z; z <= VISUAL_MAX_Z; z += 1) {
    for (let x = WORLD_MIN_X; x <= WORLD_MAX_X; x += 1) {
      if (isCanal(x, z)) builder.set(x, -3, z, 'waterBed');
      if (isCanal(x, z) && !isBridge(x, z)) continue;
      const y = groundHeightGrid(x, z);
      const plazaDistance = Math.hypot(x * 0.82, (z + 6) * 1.08);
      const square = plazaDistance <= 19;
      const plazaRing = square && Math.abs(plazaDistance - 11) < 1.25;
      const paverAccent = (Math.abs(x) + Math.abs(z + 6) * 2) % 9 === 0;
      const grassPatch = (Math.floor((x + 48) / 7) + Math.floor((z + 39) / 6) * 2) % 5 === 0;
      const material = plazaRing
        ? 'stoneLight'
        : pavedGroundAt(x, z)
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

  detailPavedGround(builder);
}

function buildTownDetails(
  builder: VoxelBuilder,
  colliders: TownCollider[],
  props: TownProp[],
  vegetation: TownVegetation[],
  awnings: TownAwning[],
  spriteProps: TownSpriteProp[],
): void {
  distantTerrain(builder, vegetation);
  bridge(builder);
  canalMasonry(builder);
  waterfallChannel(builder, colliders);
  fountain(builder, colliders, 0, -6);

  house(builder, colliders, vegetation, -43, -17, 16, 13, 11, 'plaster', 'roofRed');
  house(builder, colliders, vegetation, -41, -34, 14, 11, 12, 'plasterPale', 'roofSlate');
  house(builder, colliders, vegetation, -45, 2, 14, 8, 9, 'plasterPale', 'roofGold');
  house(builder, colliders, vegetation, 27, -16, 16, 13, 12, 'plasterPale', 'roofSlate');
  house(builder, colliders, vegetation, 31, -34, 13, 11, 10, 'plaster', 'roofRed');
  house(builder, colliders, vegetation, 32, 2, 13, 9, 9, 'plaster', 'roofGold');
  // The guildhall and bell tower terminate the bridge-to-fountain processional
  // axis, forming the deliberately authored focal cluster in the ambient shot.
  house(builder, colliders, vegetation, -23, -35, 17, 10, 12, 'plasterPale', 'roofRed');
  bellTower(builder, colliders, 8, -35);

  marketStall(builder, colliders, awnings, -18, -1, 'red-cream');
  marketStall(builder, colliders, awnings, 11, 0, 'blue-cream');
  marketStall(builder, colliders, awnings, -15, -16, 'gold-cream');

  stoneBench(builder, colliders, -9, -11);
  stoneBench(builder, colliders, 9, -11);
  cargoCluster(builder, colliders, spriteProps, -10, 7);
  cargoCluster(builder, colliders, spriteProps, 12, 6);
  flowerPlanter(builder, colliders, vegetation, -7, -6, true);
  flowerPlanter(builder, colliders, vegetation, 7, -6, false);
  flowerPlanter(builder, colliders, vegetation, -6, -13, false);
  flowerPlanter(builder, colliders, vegetation, 6, -13, true);
  handCart(builder, colliders, 21, -7);

  for (const [x, z, height, species] of TOWN_TREE_PLACEMENTS) tree(colliders, vegetation, x, z, height, species);

  scatterTownClutter(builder, colliders, vegetation);

  const TOWN = { fence: 82 } as const;
  for (const [gx, gz, tile, size] of [
    [-22, -5, TOWN.fence, 0.9], [22, -5, TOWN.fence, 0.9],
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

  for (const [gx, gz, type, scale, curvature] of [
    [-11, 5, 'barrel', 0.82, 0.31], [-9, 4, 'produce-basket', 0.72, 0.2],
    [16, 5, 'barrel', 0.82, 0.31], [18, 5, 'produce-basket', 0.72, 0.2],
    [-27, 18, 'map-kit', 0.56, 0.12], [29, 19, 'crate', 0.68, 0.18],
    [-11, -9, 'open-chest', 0.82, 0.24], [13, -9, 'closed-chest', 0.82, 0.24],
    [-17, 4, 'open-book', 0.46, 0.1], [15, 5, 'book-stack', 0.5, 0.12],
  ] as const) {
    addSpriteProp(
      spriteProps,
      gx,
      groundHeightGrid(gx, gz) + 0.5,
      gz,
      type,
      scale,
      gx * 71 + gz * 43,
      curvature,
    );
  }
}

export function buildTownWorld(): TownWorld {
  const builder = new VoxelBuilder();
  const colliders: TownCollider[] = [];
  const props: TownProp[] = [];
  const vegetation: TownVegetation[] = [];
  const awnings: TownAwning[] = [];
  const spriteProps: TownSpriteProp[] = [];
  buildGround(builder);
  addWaterColliders(colliders);
  buildTownDetails(builder, colliders, props, vegetation, awnings, spriteProps);
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
    awnings,
    spriteProps,
    vegetation,
    walkers,
    heroPath,
    // The bridge crown opens on the market and keeps the first live frame's
    // hero in the authored focal composition rather than stranded low-left.
    spawn: worldPoint(0, 16),
    waterBounds: {
      minX: WORLD_MIN_X * VOXEL_SIZE,
      maxX: WORLD_MAX_X * VOXEL_SIZE,
      minZ: (CANAL_MIN_Z - 0.5) * VOXEL_SIZE,
      maxZ: (CANAL_MAX_Z + 0.5) * VOXEL_SIZE,
    },
    waterfall: {
      minX: WATERFALL_GRID.minX * VOXEL_SIZE,
      maxX: WATERFALL_GRID.maxX * VOXEL_SIZE,
      z: WATERFALL_GRID.z * VOXEL_SIZE,
      topY: WATERFALL_GRID.topY * VOXEL_SIZE,
      bottomY: WATERFALL_GRID.bottomY * VOXEL_SIZE,
      channelMinZ: WATERFALL_GRID.channelMinZ * VOXEL_SIZE,
      channelMaxZ: WATERFALL_GRID.channelMaxZ * VOXEL_SIZE,
    },
    fountain: {
      x: 0,
      z: -6 * VOXEL_SIZE,
      basinY: 0.5 * VOXEL_SIZE,
      waterY: 0.9 * VOXEL_SIZE,
      radius: 3.2 * VOXEL_SIZE,
      jetTopY: 8.45 * VOXEL_SIZE,
      outlets: [
        { x: -1.25 * VOXEL_SIZE, y: 7 * VOXEL_SIZE, z: -6 * VOXEL_SIZE },
        { x: 1.25 * VOXEL_SIZE, y: 7 * VOXEL_SIZE, z: -6 * VOXEL_SIZE },
        { x: 0, y: 7 * VOXEL_SIZE, z: -7.25 * VOXEL_SIZE },
        { x: 0, y: 7 * VOXEL_SIZE, z: -4.75 * VOXEL_SIZE },
      ],
    },
    extent: Math.max(Math.abs(mesh.bounds.min[0]), Math.abs(mesh.bounds.max[0])),
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
