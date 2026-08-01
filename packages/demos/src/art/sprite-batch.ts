import type { BroMetalTexture, Mat4Array } from 'brometal';

export const QUAD_POSITIONS_GROUNDED = new Float32Array([
  -0.5, 0, 0,
  0.5, 0, 0,
  0.5, 1, 0,
  -0.5, 1, 0,
]);

/**
 * The Wayfarer frames use a 64px cell and a foot pivot at (32, 56), leaving
 * eight transparent pixels below the contact point. Keeping that padding in
 * the atlas while moving the quad around the pivot prevents feet from
 * floating above the collision root.
 */
export const QUAD_POSITIONS_WAYFARER_PIVOT = new Float32Array([
  -0.5, -8 / 64, 0,
  0.5, -8 / 64, 0,
  0.5, 56 / 64, 0,
  -0.5, 56 / 64, 0,
]);

export const QUAD_POSITIONS = new Float32Array([
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
  0.5, 0.5, 0,
  -0.5, 0.5, 0,
]);

export const QUAD_UVS = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
export const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

export type StandeeFaceGeometry = {
  positions: Float32Array;
  uvs: Float32Array;
  shells: Float32Array;
  indices: Uint16Array;
  doubleSidedIndices: Uint16Array;
};

/**
 * One illustrated face at the front of the board. Physical thickness is built
 * separately from the atlas alpha contour; duplicating the full cutout mask at
 * several depths reads as a white outline instead of an extruded object.
 */
export function createStandeeFaceGeometry(options?: {
  tileHeight?: number;
  pivotY?: number;
}): StandeeFaceGeometry {
  const tileHeight = options?.tileHeight ?? 64;
  const pivotY = options?.pivotY ?? 56;
  const bottom = pivotY / tileHeight - 1;
  const top = pivotY / tileHeight;
  return {
    positions: new Float32Array([
      -0.5, bottom, 0,
      0.5, bottom, 0,
      0.5, top, 0,
      -0.5, top, 0,
    ]),
    uvs: QUAD_UVS.slice(),
    shells: new Float32Array([1, 1, 1, 1]),
    indices: QUAD_INDICES.slice(),
    doubleSidedIndices: new Uint16Array([
      0, 1, 2, 0, 2, 3,
      2, 1, 0, 3, 2, 0,
    ]),
  };
}

export type SpriteSilhouetteAtlas = {
  tileWidth: number;
  tileHeight: number;
  pivotY: number;
  boundaries: readonly Float32Array[];
};

/**
 * Extract the exact opaque-pixel boundary for every atlas frame. Each segment
 * is stored as x0,y0,x1,y1,nx,ny in top-left pixel-grid coordinates. The
 * resulting contour is used to build real side walls, never a front-facing
 * dilation or halo.
 */
export async function loadSpriteSilhouetteAtlas(
  url: string,
  options: {
    cols: number;
    rows: number;
    tileWidth: number;
    tileHeight: number;
    pivotY?: number;
    cutoff?: number;
  },
): Promise<SpriteSilhouetteAtlas> {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Unable to inspect sprite alpha for standee extrusion');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const cutoff = Math.round((options.cutoff ?? 0.48) * 255);
  const boundaries: Float32Array[] = [];

  for (let row = 0; row < options.rows; row += 1) {
    for (let col = 0; col < options.cols; col += 1) {
      const mask = new Uint8Array(options.tileWidth * options.tileHeight);
      for (let y = 0; y < options.tileHeight; y += 1) {
        for (let x = 0; x < options.tileWidth; x += 1) {
          const sourceX = col * options.tileWidth + x;
          const sourceY = row * options.tileHeight + y;
          const alpha = pixels[(sourceY * canvas.width + sourceX) * 4 + 3]!;
          mask[y * options.tileWidth + x] = alpha >= cutoff ? 1 : 0;
        }
      }

      const segments: number[] = [];
      const opaque = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < options.tileWidth && y < options.tileHeight &&
        mask[y * options.tileWidth + x] === 1;
      for (let y = 0; y < options.tileHeight; y += 1) {
        for (let x = 0; x < options.tileWidth; x += 1) {
          if (!opaque(x, y)) continue;
          // Segment winding is chosen so front -> back -> next-front produces
          // the declared outward normal under the billboard basis.
          if (!opaque(x - 1, y)) segments.push(x, y, x, y + 1, -1, 0);
          if (!opaque(x + 1, y)) segments.push(x + 1, y + 1, x + 1, y, 1, 0);
          if (!opaque(x, y - 1)) segments.push(x + 1, y, x, y, 0, 1);
          if (!opaque(x, y + 1)) segments.push(x, y + 1, x + 1, y + 1, 0, -1);
        }
      }
      boundaries.push(new Float32Array(segments));
    }
  }

  return {
    tileWidth: options.tileWidth,
    tileHeight: options.tileHeight,
    pivotY: options.pivotY ?? options.tileHeight,
    boundaries,
  };
}

export type StandeeSideMesh = {
  positions: Float32Array;
  normals: Float32Array;
  baseColors: Float32Array;
  materials: Float32Array;
  localAo: Float32Array;
  emissive: Float32Array;
  indices: Uint32Array;
};

export type SpriteAtlas = {
  texture: BroMetalTexture;
  cols: number;
  rows: number;
  rect(tile: number, out: Float32Array, offset: number): void;
};

export function spriteAtlas(
  texture: BroMetalTexture,
  options: { cols: number; rows: number; tileWidth?: number; tileHeight?: number },
): SpriteAtlas {
  const tileWidth = options.tileWidth ?? 16;
  const tileHeight = options.tileHeight ?? 16;
  const du = 1 / options.cols;
  const dv = 1 / options.rows;
  const insetU = 0.5 / (options.cols * tileWidth);
  const insetV = 0.5 / (options.rows * tileHeight);
  return {
    texture,
    cols: options.cols,
    rows: options.rows,
    rect(tile, out, offset) {
      const col = tile % options.cols;
      const row = Math.floor(tile / options.cols);
      out[offset] = col * du + insetU;
      out[offset + 1] = 1 - (row + 1) * dv + insetV;
      out[offset + 2] = du - insetU * 2;
      out[offset + 3] = dv - insetV * 2;
    },
  };
}

export type SpriteInput = {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  tile: number;
  tint?: readonly [number, number, number];
  alpha?: number;
  flipX?: boolean;
  facingX?: number;
  facingZ?: number;
};

/** A grow-only instance pool. Only its live prefix is uploaded. */
export class SpriteBatch {
  centers: Float32Array;
  sizes: Float32Array;
  uvRects: Float32Array;
  tints: Float32Array;
  facings: Float32Array;
  tiles: Uint16Array;
  count = 0;
  dirty = true;

  private capacity: number;
  private readonly atlas: SpriteAtlas;

  constructor(atlas: SpriteAtlas, capacity = 32) {
    this.atlas = atlas;
    this.capacity = Math.max(1, capacity);
    this.centers = new Float32Array(this.capacity * 3);
    this.sizes = new Float32Array(this.capacity * 2);
    this.uvRects = new Float32Array(this.capacity * 4);
    this.tints = new Float32Array(this.capacity * 4);
    this.facings = new Float32Array(this.capacity * 3);
    this.tiles = new Uint16Array(this.capacity);
  }

  clear(): void {
    this.count = 0;
    this.dirty = true;
  }

  push(sprite: SpriteInput): void {
    if (this.count === this.capacity) this.grow();
    const i = this.count++;
    this.dirty = true;
    this.tiles[i] = sprite.tile;
    this.centers.set([sprite.x, sprite.y, sprite.z], i * 3);
    this.sizes.set([sprite.width, sprite.height], i * 2);
    const uvOffset = i * 4;
    this.atlas.rect(sprite.tile, this.uvRects, uvOffset);
    if (sprite.flipX) {
      this.uvRects[uvOffset] = this.uvRects[uvOffset]! + this.uvRects[uvOffset + 2]!;
      this.uvRects[uvOffset + 2] = -this.uvRects[uvOffset + 2]!;
    }
    const tint = sprite.tint ?? [1, 1, 1];
    this.tints.set([tint[0], tint[1], tint[2], sprite.alpha ?? 1], i * 4);
    const facingLength = Math.hypot(sprite.facingX ?? 0, sprite.facingZ ?? 1) || 1;
    this.facings.set([
      (sprite.facingX ?? 0) / facingLength,
      0,
      (sprite.facingZ ?? 1) / facingLength,
    ], i * 3);
  }

  live() {
    return {
      centers: this.centers.subarray(0, this.count * 3),
      sizes: this.sizes.subarray(0, this.count * 2),
      uvRects: this.uvRects.subarray(0, this.count * 4),
      tints: this.tints.subarray(0, this.count * 4),
      facings: this.facings.subarray(0, this.count * 3),
      tiles: this.tiles.subarray(0, this.count),
    };
  }

  markUploaded(): void {
    this.dirty = false;
  }

  private grow(): void {
    this.capacity *= 2;
    this.centers = grow(this.centers, this.capacity * 3);
    this.sizes = grow(this.sizes, this.capacity * 2);
    this.uvRects = grow(this.uvRects, this.capacity * 4);
    this.tints = grow(this.tints, this.capacity * 4);
    this.facings = grow(this.facings, this.capacity * 3);
    const nextTiles = new Uint16Array(this.capacity);
    nextTiles.set(this.tiles);
    this.tiles = nextTiles;
  }
}

/**
 * Build only the physical side walls of each die-cut character. The front art
 * is rendered by the ordinary alpha-tested quad. Because these quads follow
 * the actual alpha contour from front depth to back depth, warm paper stock is
 * visible only on an exposed side—never as a white outline around the art.
 */
export function buildStandeeSideMesh(
  batch: SpriteBatch,
  atlas: SpriteSilhouetteAtlas,
  right: Float32Array,
  up: Float32Array,
  thickness: number,
): StandeeSideMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const baseColors: number[] = [];
  const materials: number[] = [];
  const localAo: number[] = [];
  const emissive: number[] = [];
  const indices: number[] = [];
  const boardNormal = normalizeCross(right, up);
  const frontDepth = thickness * 0.47;
  const backDepth = -thickness * 0.5;
  const paper = [0.9, 0.82, 0.7] as const;

  for (let actorIndex = 0; actorIndex < batch.count; actorIndex += 1) {
    const tile = batch.tiles[actorIndex]!;
    const boundary = atlas.boundaries[tile];
    if (!boundary) continue;
    const centerOffset = actorIndex * 3;
    const sizeOffset = actorIndex * 2;
    const centerX = batch.centers[centerOffset]!;
    const centerY = batch.centers[centerOffset + 1]!;
    const centerZ = batch.centers[centerOffset + 2]!;
    const width = batch.sizes[sizeOffset]!;
    const height = batch.sizes[sizeOffset + 1]!;

    for (let segmentOffset = 0; segmentOffset < boundary.length; segmentOffset += 6) {
      const x0 = boundary[segmentOffset]! / atlas.tileWidth - 0.5;
      const y0 = (atlas.pivotY - boundary[segmentOffset + 1]!) / atlas.tileHeight;
      const x1 = boundary[segmentOffset + 2]! / atlas.tileWidth - 0.5;
      const y1 = (atlas.pivotY - boundary[segmentOffset + 3]!) / atlas.tileHeight;
      const normalX = boundary[segmentOffset + 4]!;
      const normalY = boundary[segmentOffset + 5]!;
      const worldNormalX = right[0]! * normalX + up[0]! * normalY;
      const worldNormalY = right[1]! * normalX + up[1]! * normalY;
      const worldNormalZ = right[2]! * normalX + up[2]! * normalY;
      const vertexOffset = positions.length / 3;

      pushStandeeSideVertex(
        positions, normals, baseColors, materials, localAo, emissive,
        centerX, centerY, centerZ, x0, y0, frontDepth, width, height,
        right, up, boardNormal, worldNormalX, worldNormalY, worldNormalZ, paper,
      );
      pushStandeeSideVertex(
        positions, normals, baseColors, materials, localAo, emissive,
        centerX, centerY, centerZ, x0, y0, backDepth, width, height,
        right, up, boardNormal, worldNormalX, worldNormalY, worldNormalZ, paper,
      );
      pushStandeeSideVertex(
        positions, normals, baseColors, materials, localAo, emissive,
        centerX, centerY, centerZ, x1, y1, frontDepth, width, height,
        right, up, boardNormal, worldNormalX, worldNormalY, worldNormalZ, paper,
      );
      pushStandeeSideVertex(
        positions, normals, baseColors, materials, localAo, emissive,
        centerX, centerY, centerZ, x1, y1, backDepth, width, height,
        right, up, boardNormal, worldNormalX, worldNormalY, worldNormalZ, paper,
      );
      indices.push(
        vertexOffset, vertexOffset + 1, vertexOffset + 2,
        vertexOffset + 2, vertexOffset + 1, vertexOffset + 3,
      );
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    baseColors: new Float32Array(baseColors),
    materials: new Float32Array(materials),
    localAo: new Float32Array(localAo),
    emissive: new Float32Array(emissive),
    indices: new Uint32Array(indices),
  };
}

function normalizeCross(a: Float32Array, b: Float32Array): readonly [number, number, number] {
  const x = a[1]! * b[2]! - a[2]! * b[1]!;
  const y = a[2]! * b[0]! - a[0]! * b[2]!;
  const z = a[0]! * b[1]! - a[1]! * b[0]!;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function pushStandeeSideVertex(
  positions: number[],
  normals: number[],
  baseColors: number[],
  materials: number[],
  localAo: number[],
  emissive: number[],
  centerX: number,
  centerY: number,
  centerZ: number,
  localX: number,
  localY: number,
  depth: number,
  width: number,
  height: number,
  right: Float32Array,
  up: Float32Array,
  boardNormal: readonly [number, number, number],
  normalX: number,
  normalY: number,
  normalZ: number,
  paper: readonly [number, number, number],
): void {
  positions.push(
    centerX + right[0]! * localX * width + up[0]! * localY * height + boardNormal[0] * depth,
    centerY + right[1]! * localX * width + up[1]! * localY * height + boardNormal[1] * depth,
    centerZ + right[2]! * localX * width + up[2]! * localY * height + boardNormal[2] * depth,
  );
  normals.push(normalX, normalY, normalZ);
  baseColors.push(paper[0], paper[1], paper[2]);
  materials.push(0.92, 0.035);
  localAo.push(0.88);
  emissive.push(0);
}

type SpriteTarget = {
  instanceAttributes: {
    iCenter: { set(value: Float32Array): void };
    iSize: { set(value: Float32Array): void };
    iUvRect: { set(value: Float32Array): void };
    iTint: { set(value: Float32Array): void };
    iFacing: { set(value: Float32Array): void };
  };
};

export function uploadSpriteBatch(program: SpriteTarget, batch: SpriteBatch): number {
  if (batch.count === 0) return 0;
  // A batch can feed both its visible and shadow-caster programs. Each program
  // owns separate GPU buffers, so an upload completed for one target cannot be
  // treated as completed for the other. Actor counts are deliberately small;
  // upload the live prefix to every requested target.
  const live = batch.live();
  program.instanceAttributes.iCenter.set(live.centers);
  program.instanceAttributes.iSize.set(live.sizes);
  program.instanceAttributes.iUvRect.set(live.uvRects);
  program.instanceAttributes.iTint.set(live.tints);
  program.instanceAttributes.iFacing.set(live.facings);
  batch.markUploaded();
  return batch.count;
}

/** World-space axes for a vertical billboard. */
export function billboardBasis(
  view: Mat4Array,
  right: Float32Array,
  up: Float32Array,
  yawOffsetRadians = 0,
): void {
  const length = Math.hypot(view[0]!, view[8]!) || 1;
  const baseX = view[0]! / length;
  const baseZ = view[8]! / length;
  const cosine = Math.cos(yawOffsetRadians);
  const sine = Math.sin(yawOffsetRadians);
  right.set([
    baseX * cosine + baseZ * sine,
    0,
    -baseX * sine + baseZ * cosine,
  ]);
  up.set([0, 1, 0]);
}

function grow(source: Float32Array, length: number): Float32Array {
  const next = new Float32Array(length);
  next.set(source);
  return next;
}
