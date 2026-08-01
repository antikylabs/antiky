/* A deterministic voxel compiler.
 *
 * This is the shape our AI asset research argues for: a model — or a person —
 * proposes primitives, and an owned, deterministic compiler turns them into
 * voxels. The generator never emits binary directly, every write is validated
 * against the palette, and the same seed always produces the same model.
 *
 * The compiler also does the one optimisation that matters before drawing:
 * a voxel with all six neighbours present can never be seen, so it is dropped. */

export type VoxelModel = {
  offsets: Float32Array;
  colors: Float32Array;
  /** Voxels the primitives wrote. */
  authored: number;
  /** Voxels that survive interior culling — what actually gets drawn. */
  drawn: number;
  name: string;
};

const PALETTE: Record<string, [number, number, number]> = {
  stone: [0.42, 0.42, 0.46],
  stoneDark: [0.28, 0.28, 0.33],
  roof: [0.62, 0.24, 0.16],
  timber: [0.35, 0.23, 0.15],
  leaf: [0.20, 0.44, 0.22],
  leafDark: [0.13, 0.31, 0.16],
  soil: [0.26, 0.19, 0.14],
  grass: [0.24, 0.46, 0.20],
  gold: [0.85, 0.68, 0.24],
  ember: [0.90, 0.36, 0.14],
  water: [0.16, 0.36, 0.55],
  bone: [0.80, 0.78, 0.68],
};

export type PaletteName = keyof typeof PALETTE;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The compiler's working surface: a sparse grid keyed by packed coordinates. */
class Grid {
  private readonly cells = new Map<number, string>();

  private static key(x: number, y: number, z: number): number {
    // ±512 on each axis, packed into one integer key.
    return (((x + 512) & 1023) << 20) | (((y + 512) & 1023) << 10) | ((z + 512) & 1023);
  }

  set(x: number, y: number, z: number, color: PaletteName): void {
    if (y < 0) return; // nothing below the ground plane
    this.cells.set(Grid.key(x, y, z), color);
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, color: PaletteName): void {
    for (let ix = 0; ix < w; ix++)
      for (let iy = 0; iy < h; iy++)
        for (let iz = 0; iz < d; iz++) this.set(x + ix, y + iy, z + iz, color);
  }

  /** A filled disc in the XZ plane, one voxel tall. */
  disc(cx: number, y: number, cz: number, radius: number, color: PaletteName): void {
    const r2 = radius * radius;
    for (let x = -radius; x <= radius; x++)
      for (let z = -radius; z <= radius; z++)
        if (x * x + z * z <= r2) this.set(cx + x, y, cz + z, color);
  }

  ball(cx: number, cy: number, cz: number, radius: number, color: PaletteName): void {
    const r2 = radius * radius;
    for (let x = -radius; x <= radius; x++)
      for (let y = -radius; y <= radius; y++)
        for (let z = -radius; z <= radius; z++)
          if (x * x + y * y + z * z <= r2) this.set(cx + x, cy + y, cz + z, color);
  }

  carve(x: number, y: number, z: number, w: number, h: number, d: number): void {
    for (let ix = 0; ix < w; ix++)
      for (let iy = 0; iy < h; iy++)
        for (let iz = 0; iz < d; iz++) this.cells.delete(Grid.key(x + ix, y + iy, z + iz));
  }

  has(x: number, y: number, z: number): boolean {
    return this.cells.has(Grid.key(x, y, z));
  }

  compile(name: string): VoxelModel {
    const authored = this.cells.size;
    const visible: { x: number; y: number; z: number; color: string }[] = [];
    for (const [key, color] of this.cells) {
      const x = ((key >> 20) & 1023) - 512;
      const y = ((key >> 10) & 1023) - 512;
      const z = (key & 1023) - 512;
      const enclosed =
        this.has(x + 1, y, z) &&
        this.has(x - 1, y, z) &&
        this.has(x, y + 1, z) &&
        this.has(x, y - 1, z) &&
        this.has(x, y, z + 1) &&
        this.has(x, y, z - 1);
      if (!enclosed) visible.push({ x, y, z, color });
    }

    const offsets = new Float32Array(visible.length * 3);
    const colors = new Float32Array(visible.length * 3);
    visible.forEach((voxel, i) => {
      offsets[i * 3] = voxel.x;
      offsets[i * 3 + 1] = voxel.y;
      offsets[i * 3 + 2] = voxel.z;
      const rgb = PALETTE[voxel.color as PaletteName] ?? PALETTE.stone!;
      // A little per-voxel value jitter, derived from position so it is stable
      // across recompiles rather than random per run.
      const jitter = 0.88 + (((voxel.x * 7 + voxel.y * 13 + voxel.z * 29) & 7) / 7) * 0.24;
      colors[i * 3] = rgb[0] * jitter;
      colors[i * 3 + 1] = rgb[1] * jitter;
      colors[i * 3 + 2] = rgb[2] * jitter;
    });

    return { offsets, colors, authored, drawn: visible.length, name };
  }
}

function island(grid: Grid, random: () => number): void {
  const radius = 11;
  for (let y = 0; y < 5; y++) grid.disc(0, y, 0, Math.max(2, radius - y * 2), y === 4 ? 'grass' : 'soil');
  for (let i = 0; i < 26; i++) {
    const angle = random() * Math.PI * 2;
    const r = random() * (radius - 3);
    grid.set(Math.round(Math.cos(angle) * r), 5, Math.round(Math.sin(angle) * r), random() < 0.3 ? 'stone' : 'grass');
  }
}

function keep(grid: Grid, random: () => number): void {
  const height = 7 + Math.floor(random() * 4);
  const half = 3;
  grid.box(-half, 5, -half, half * 2 + 1, height, half * 2 + 1, 'stone');
  grid.carve(-half + 1, 6, -half + 1, half * 2 - 1, height - 2, half * 2 - 1);
  // Battlements: alternate blocks around the rim.
  for (let x = -half; x <= half; x++)
    for (let z = -half; z <= half; z++) {
      const rim = Math.abs(x) === half || Math.abs(z) === half;
      if (rim && (x + z) % 2 === 0) grid.set(x, 5 + height, z, 'stoneDark');
    }
  // Windows, and a lit one.
  for (let level = 7; level < 5 + height - 1; level += 3) {
    grid.carve(-half, level, -1, 1, 2, 2);
    grid.set(-half, level, 0, random() < 0.5 ? 'ember' : 'stoneDark');
  }
  grid.box(-1, 5, half, 2, 3, 1, 'timber'); // door
  // A stepped roof inside the battlements, so the silhouette is not a slab.
  for (let step = 0; step < half + 1; step++) {
    const r = half - step;
    grid.box(-r, 5 + height + step, -r, r * 2 + 1, 1, r * 2 + 1, 'roof');
  }
  grid.set(0, 5 + height + half + 1, 0, 'gold'); // finial
}

function grove(grid: Grid, random: () => number): void {
  const trees = 3 + Math.floor(random() * 3);
  for (let i = 0; i < trees; i++) {
    const angle = (i / trees) * Math.PI * 2 + random() * 0.7;
    const r = 6 + random() * 3;
    const x = Math.round(Math.cos(angle) * r);
    const z = Math.round(Math.sin(angle) * r);
    const trunk = 3 + Math.floor(random() * 3);
    grid.box(x, 5, z, 1, trunk, 1, 'timber');
    const crown = 2 + Math.floor(random() * 2);
    grid.ball(x, 5 + trunk + crown - 1, z, crown, random() < 0.35 ? 'leafDark' : 'leaf');
  }
}

function menhirs(grid: Grid, random: () => number): void {
  const count = 5 + Math.floor(random() * 4);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.round(Math.cos(angle) * 8);
    const z = Math.round(Math.sin(angle) * 8);
    grid.box(x, 5, z, 1, 3 + Math.floor(random() * 3), 1, 'bone');
  }
}

const RECIPES: { name: string; build: (grid: Grid, random: () => number) => void }[] = [
  { name: 'watchtower', build: (g, r) => { island(g, r); keep(g, r); grove(g, r); } },
  { name: 'grove', build: (g, r) => { island(g, r); grove(g, r); menhirs(g, r); } },
  { name: 'standing stones', build: (g, r) => { island(g, r); menhirs(g, r); grove(g, r); } },
];

/** Same seed in, same model out — the property that makes a generated asset
 *  reviewable rather than merely surprising. */
export function forgeVoxelModel(seed: number): VoxelModel {
  const random = mulberry32(seed);
  const recipe = RECIPES[Math.floor(random() * RECIPES.length)]!;
  const grid = new Grid();
  recipe.build(grid, random);
  return grid.compile(recipe.name);
}
