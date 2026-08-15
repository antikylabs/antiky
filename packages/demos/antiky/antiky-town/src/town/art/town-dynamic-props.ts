import type { PipelineProgram } from '@antiky/framework/render-driver';

import type { TownAwning, TownAwningStyle, TownSpriteProp, TownSpritePropType } from './town';

export const TOWN_AWNING_STYLE_INDEX = {
  'red-cream': 0,
  'blue-cream': 1,
  'gold-cream': 2,
} as const satisfies Record<TownAwningStyle, number>;

export const TOWN_PROP_TILE_BY_TYPE = {
  barrel: 0,
  'open-chest': 1,
  'closed-chest': 2,
  'open-book': 3,
  'book-stack': 4,
  'map-kit': 5,
  'produce-basket': 6,
  crate: 7,
} as const satisfies Record<TownSpritePropType, number>;

export const TOWN_PROP_ATLAS_COLUMNS = 4;
export const TOWN_PROP_ATLAS_ROWS = 2;
export const TOWN_PROP_ATLAS_CELL_WIDTH = 418;
export const TOWN_PROP_ATLAS_CELL_HEIGHT = 470;
export const TOWN_PROP_CARD_HEIGHT_SCALE = 1.35;

export type TownAwningGeometry = {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  /** The upper sheet alone is sufficient for a closed, alpha-free shadow silhouette. */
  shadowIndices: Uint16Array;
};

export type TownAwningBatch = {
  centers: Float32Array;
  sizes: Float32Array;
  yaws: Float32Array;
  slopes: Float32Array;
  styles: Float32Array;
  phases: Float32Array;
  count: number;
};

export type TownPropGeometry = {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
};

export type TownPropBatch = {
  centers: Float32Array;
  sizes: Float32Array;
  uvRects: Float32Array;
  yaws: Float32Array;
  curvatures: Float32Array;
  tiles: Float32Array;
  count: number;
};

function segmentCount(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > 64) {
    throw new Error(`${label} must be an integer between 1 and 64; received ${resolved}`);
  }
  return resolved;
}

/**
 * A normalized XZ sheet with duplicated upper/lower vertices. The shader owns
 * sag, pitch, wind and the physical separation between its two cloth faces.
 */
export function createTownAwningGeometry(options?: {
  widthSegments?: number;
  depthSegments?: number;
}): TownAwningGeometry {
  const widthSegments = segmentCount(options?.widthSegments, 12, 'widthSegments');
  const depthSegments = segmentCount(options?.depthSegments, 8, 'depthSegments');
  const verticesPerSide = (widthSegments + 1) * (depthSegments + 1);
  const positions = new Float32Array(verticesPerSide * 2 * 3);
  const uvs = new Float32Array(verticesPerSide * 2 * 2);
  const frontIndices: number[] = [];
  const backIndices: number[] = [];

  for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    const side = sideIndex === 0 ? 1 : -1;
    const vertexBase = sideIndex * verticesPerSide;
    for (let z = 0; z <= depthSegments; z += 1) {
      const v = z / depthSegments;
      for (let x = 0; x <= widthSegments; x += 1) {
        const u = x / widthSegments;
        const vertex = vertexBase + z * (widthSegments + 1) + x;
        // The sheet has no authored local Y, so pack its face sign there. This
        // saves a ninth vertex buffer on WebGPU adapters capped at eight.
        positions.set([u - 0.5, side, v - 0.5], vertex * 3);
        uvs.set([u, v], vertex * 2);
      }
    }

    for (let z = 0; z < depthSegments; z += 1) {
      for (let x = 0; x < widthSegments; x += 1) {
        const a = vertexBase + z * (widthSegments + 1) + x;
        const b = a + 1;
        const c = a + widthSegments + 1;
        const d = c + 1;
        if (side > 0) frontIndices.push(a, c, b, b, c, d);
        else backIndices.push(a, b, c, b, d, c);
      }
    }
  }

  return {
    positions,
    uvs,
    indices: new Uint16Array([...frontIndices, ...backIndices]),
    shadowIndices: new Uint16Array(frontIndices),
  };
}

export function buildTownAwningBatch(awnings: readonly TownAwning[]): TownAwningBatch {
  const centers = new Float32Array(awnings.length * 3);
  const sizes = new Float32Array(awnings.length * 2);
  const yaws = new Float32Array(awnings.length);
  const slopes = new Float32Array(awnings.length);
  const styles = new Float32Array(awnings.length);
  const phases = new Float32Array(awnings.length);

  awnings.forEach((awning, index) => {
    if (
      ![
        awning.x,
        awning.y,
        awning.z,
        awning.width,
        awning.depth,
        awning.yaw,
        awning.slope,
        awning.phase,
      ].every(Number.isFinite)
      || awning.width <= 0
      || awning.depth <= 0
    ) {
      throw new Error(`Invalid town awning at index ${index}`);
    }
    centers.set([awning.x, awning.y, awning.z], index * 3);
    sizes.set([awning.width, awning.depth], index * 2);
    yaws[index] = awning.yaw;
    slopes[index] = awning.slope;
    styles[index] = TOWN_AWNING_STYLE_INDEX[awning.style];
    phases[index] = awning.phase;
  });

  return { centers, sizes, yaws, slopes, styles, phases, count: awnings.length };
}

export function bindTownAwningGeometry(
  program: PipelineProgram,
  geometry: TownAwningGeometry,
  shadowOnly = false,
): void {
  program.attributes.aPosition?.set(geometry.positions);
  program.attributes.aUv?.set(geometry.uvs);
  program.setIndices(shadowOnly ? geometry.shadowIndices : geometry.indices);
}

/**
 * Every awning in the town, uploaded once when the pipeline is built.
 *
 * These rows never change — an awning does not move, and the shader owns its sag and wind — so they
 * belong with the geometry rather than in each frame's draw.
 */
export function uploadTownAwningBatch(program: PipelineProgram, batch: TownAwningBatch): number {
  if (batch.count === 0) return 0;
  program.instanceAttributes.iCenter?.set(batch.centers);
  program.instanceAttributes.iSize?.set(batch.sizes);
  program.instanceAttributes.iYaw?.set(batch.yaws);
  program.instanceAttributes.iSlope?.set(batch.slopes);
  program.instanceAttributes.iStyle?.set(batch.styles);
  program.instanceAttributes.iPhase?.set(batch.phases);
  return batch.count;
}

/**
 * A normalized XY card with independent front/back vertices. Subdivision is
 * required: the vertex shader bends the card into a true shallow cylinder,
 * rather than faking curvature with a flat normal or screen-space warp.
 */
export function createTownPropGeometry(options?: {
  widthSegments?: number;
  heightSegments?: number;
}): TownPropGeometry {
  const widthSegments = segmentCount(options?.widthSegments, 10, 'widthSegments');
  const heightSegments = segmentCount(options?.heightSegments, 8, 'heightSegments');
  const verticesPerSide = (widthSegments + 1) * (heightSegments + 1);
  const positions = new Float32Array(verticesPerSide * 2 * 3);
  const uvs = new Float32Array(verticesPerSide * 2 * 2);
  const indices: number[] = [];

  for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    const side = sideIndex === 0 ? 1 : -1;
    const vertexBase = sideIndex * verticesPerSide;
    for (let y = 0; y <= heightSegments; y += 1) {
      const v = y / heightSegments;
      for (let x = 0; x <= widthSegments; x += 1) {
        const u = x / widthSegments;
        const vertex = vertexBase + y * (widthSegments + 1) + x;
        // The flat source card has no authored local Z, so pack its face sign
        // there instead of allocating a ninth vertex buffer.
        positions.set([u - 0.5, v, side], vertex * 3);
        uvs.set([u, v], vertex * 2);
      }
    }

    for (let y = 0; y < heightSegments; y += 1) {
      for (let x = 0; x < widthSegments; x += 1) {
        const a = vertexBase + y * (widthSegments + 1) + x;
        const b = a + 1;
        const c = a + widthSegments + 1;
        const d = c + 1;
        if (side > 0) indices.push(a, b, c, b, d, c);
        else indices.push(a, c, b, b, c, d);
      }
    }
  }

  return {
    positions,
    uvs,
    indices: new Uint16Array(indices),
  };
}

export function buildTownPropBatch(props: readonly TownSpriteProp[]): TownPropBatch {
  const centers = new Float32Array(props.length * 3);
  const sizes = new Float32Array(props.length * 2);
  const uvRects = new Float32Array(props.length * 4);
  const yaws = new Float32Array(props.length);
  const curvatures = new Float32Array(props.length);
  const tiles = new Float32Array(props.length);
  const du = 1 / TOWN_PROP_ATLAS_COLUMNS;
  const dv = 1 / TOWN_PROP_ATLAS_ROWS;
  const atlasWidth = TOWN_PROP_ATLAS_COLUMNS * TOWN_PROP_ATLAS_CELL_WIDTH;
  const atlasHeight = TOWN_PROP_ATLAS_ROWS * TOWN_PROP_ATLAS_CELL_HEIGHT;
  const insetU = 0.5 / atlasWidth;
  const insetV = 0.5 / atlasHeight;
  const aspect = TOWN_PROP_ATLAS_CELL_WIDTH / TOWN_PROP_ATLAS_CELL_HEIGHT;

  props.forEach((prop, index) => {
    if (
      ![prop.x, prop.y, prop.z, prop.scale, prop.yaw, prop.curvature].every(Number.isFinite)
      || prop.scale <= 0
      || prop.curvature < 0
      || prop.curvature > 1
    ) {
      throw new Error(`Invalid town sprite prop at index ${index}`);
    }
    const tile = TOWN_PROP_TILE_BY_TYPE[prop.type];
    const column = tile % TOWN_PROP_ATLAS_COLUMNS;
    const row = Math.floor(tile / TOWN_PROP_ATLAS_COLUMNS);
    const height = prop.scale * TOWN_PROP_CARD_HEIGHT_SCALE;
    centers.set([prop.x, prop.y, prop.z], index * 3);
    sizes.set([height * aspect, height], index * 2);
    uvRects.set([
      column * du + insetU,
      1 - (row + 1) * dv + insetV,
      du - insetU * 2,
      dv - insetV * 2,
    ], index * 4);
    yaws[index] = prop.yaw;
    curvatures[index] = prop.curvature;
    tiles[index] = tile;
  });

  return {
    centers,
    sizes,
    uvRects,
    yaws,
    curvatures,
    tiles,
    count: props.length,
  };
}

export function bindTownPropGeometry(program: PipelineProgram, geometry: TownPropGeometry): void {
  program.attributes.aPosition?.set(geometry.positions);
  program.attributes.aUv?.set(geometry.uvs);
  program.setIndices(geometry.indices);
}

/** Every placed prop, uploaded once with the geometry. Props do not move. */
export function uploadTownPropBatch(program: PipelineProgram, batch: TownPropBatch): number {
  if (batch.count === 0) return 0;
  program.instanceAttributes.iCenter?.set(batch.centers);
  program.instanceAttributes.iSize?.set(batch.sizes);
  program.instanceAttributes.iUvRect?.set(batch.uvRects);
  program.instanceAttributes.iYaw?.set(batch.yaws);
  program.instanceAttributes.iCurvature?.set(batch.curvatures);
  program.instanceAttributes.iTile?.set(batch.tiles);
  return batch.count;
}
