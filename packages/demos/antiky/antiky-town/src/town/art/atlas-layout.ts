import materialAtlasJson from '../../../assets/textures/town-material-atlas-v1.json' with { type: 'json' };
import propAtlasJson from '../../../assets/textures/town-prop-atlas-v2.json' with { type: 'json' };
import vegetationAtlasJson from '../../../assets/textures/town-vegetation-atlas-v2.json' with { type: 'json' };

/**
 * Where each atlas tile actually is, read from the file the atlas was built with.
 *
 * Every atlas here is packed by `packages/demos/scripts/build-texture-atlas.mjs`, which surrounds
 * each tile with 64 pixels of its own extruded edge so a mip average taken near the tile's border
 * finds more of the same material instead of the tile next door. That gutter only works if whatever
 * samples the atlas stays inside the tile's inner rectangle — so the rectangles come from the same
 * JSON the packer wrote, rather than from a `column / 4` the shader works out for itself.
 *
 * The rule this exists to enforce: **repack the atlas and every sample follows.** The previous
 * arrangement had the grid written down in four places — two shaders and two mesh builders — and
 * nothing kept them equal to the image.
 *
 * Rectangles are published in the renderer's UV convention, v = 0 at the bottom of the image, so
 * grid row 0 sits at the top of the file and gets the highest v.
 */

export type AtlasTileRect = {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type AtlasLayout = {
  readonly size: { readonly width: number; readonly height: number };
  readonly grid: {
    readonly columns: number;
    readonly rows: number;
    readonly cellWidth: number;
    readonly cellHeight: number;
  };
  readonly gutter: number;
  readonly inner: { readonly width: number; readonly height: number };
  readonly uvOrigin: string;
  readonly tiles: readonly string[];
  readonly tileRects: readonly AtlasTileRect[];
  readonly source: {
    readonly size: { readonly width: number; readonly height: number };
    readonly cell: { readonly width: number; readonly height: number };
  };
};

export const TOWN_MATERIAL_ATLAS = materialAtlasJson as AtlasLayout;
export const TOWN_PROP_ATLAS = propAtlasJson as AtlasLayout;
export const TOWN_VEGETATION_ATLAS = vegetationAtlasJson as AtlasLayout;

/** A tile's inner rectangle as `[u, v, width, height]`, ready to hand to a shader or an instance. */
export function tileRect(
  layout: AtlasLayout,
  tile: number,
): readonly [number, number, number, number] {
  const rect = layout.tileRects[tile];
  if (rect === undefined) {
    throw new Error(`atlas tile ${tile} is outside the ${layout.tileRects.length} tiles published`);
  }
  return [rect.x, rect.y, rect.width, rect.height];
}

/** The index a named tile occupies, so a caller can ask for `red-cream-market-cloth` by name. */
export function tileIndex(layout: AtlasLayout, name: string): number {
  const index = layout.tileRects.findIndex((rect) => rect.name === name);
  if (index === -1) throw new Error(`no atlas tile named ${name}`);
  return index;
}

/**
 * The four numbers a shader needs to find any tile: columns, rows, and the gutter in UV.
 *
 * `town-voxel` picks its tile per fragment from a material id, so it cannot be handed one
 * rectangle — it has to work the rectangle out. This hands it the grid the packer used and then
 * **checks that arithmetic against every published rectangle**, so the shader deriving a rectangle
 * and the packer writing one cannot disagree. If they ever do, construction throws here rather than
 * shipping a frame with a quarter-tile offset that only shows up as a strange fringe.
 */
export function atlasGridUniform(
  layout: AtlasLayout,
): readonly [number, number, number, number] {
  const { columns, rows } = layout.grid;
  const gutterU = layout.gutter / layout.size.width;
  const gutterV = layout.gutter / layout.size.height;
  const cellU = 1 / columns;
  const cellV = 1 / rows;
  const innerU = cellU - gutterU * 2;
  const innerV = cellV - gutterV * 2;

  const tolerance = 1e-6;
  layout.tileRects.forEach((rect, tile) => {
    const column = tile % columns;
    const row = Math.floor(tile / columns);
    const expected = [
      column * cellU + gutterU,
      (rows - 1 - row) * cellV + gutterV,
      innerU,
      innerV,
    ];
    const published = [rect.x, rect.y, rect.width, rect.height];
    for (let part = 0; part < 4; part += 1) {
      if (Math.abs(expected[part]! - published[part]!) > tolerance) {
        throw new Error(
          `atlas tile ${rect.name} sits at [${published.join(', ')}] but a ${columns}x${rows} grid `
          + `with a ${layout.gutter}px gutter puts it at [${expected.join(', ')}]. A shader that `
          + 'derives its rectangle would sample the wrong pixels.',
        );
      }
    }
  });

  return [columns, rows, gutterU, gutterV];
}

/**
 * How far one authored texel reaches in the packed atlas's UV space.
 *
 * `town-voxel` takes two forward taps off the albedo to turn its value into a micro-normal, and the
 * distance between the taps decides how coarse that relief reads. Packing resamples every tile — the
 * material tiles go from 313.5 x 418 to 384 x 512 — so a step measured in packed texels would shrink
 * the relief by the resample ratio and flatten every stone and timber face. Measuring it in authored
 * texels keeps the step the same distance across the material.
 */
export function authoredTexel(layout: AtlasLayout): readonly [number, number] {
  return [
    layout.inner.width / layout.source.cell.width / layout.size.width,
    layout.inner.height / layout.source.cell.height / layout.size.height,
  ];
}
