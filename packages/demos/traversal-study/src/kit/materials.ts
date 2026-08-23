import { createTexture3D, type BroMetalTexture, type Renderer } from 'brometal';

import { TRAVERSAL_KIT_MATERIALS, TRAVERSAL_KIT_GRID } from '../kit-materials.gen.ts';

/**
 * Upload the kit's material table as a lookup the shader can address with a UV.
 *
 * The atlas identity is two dimensional — V picks a row of the palette, U picks the swatch within it
 * — so this is a 16x4 lookup sampled with the same UV the albedo uses. A one-dimensional table keyed
 * on V would name a row of a dozen unrelated colours.
 *
 * A 3D texture with depth 1 because `createTexture3D` is BroMetal's only raw-buffer upload; there is
 * no way to hand it a byte array for a 2D texture.
 *
 * `filter: 'nearest'` matters here in a way it does not for the lighting ramp. This is a table of
 * discrete entries, not a gradient: blending between two swatches would invent a roughness that
 * belongs to neither, and every value would be wrong near a swatch boundary.
 */
export function createKitMaterialLookup(renderer: Renderer): BroMetalTexture {
  const { rows, columns } = TRAVERSAL_KIT_GRID;
  const data = new Uint8Array(rows * columns * 4);
  for (const swatch of TRAVERSAL_KIT_MATERIALS) {
    const at = (swatch.row * columns + swatch.column) * 4;
    // An unused swatch takes the roughest value rather than zero: a hole in the table should read as
    // dull stone, not as a mirror.
    const roughness = swatch.roughness ?? 0.95;
    data[at] = Math.round(roughness * 255);
    data[at + 3] = 255;
  }
  return createTexture3D(renderer, { width: columns, height: rows, depth: 1, data }, {
    wrap: 'clamp',
    filter: 'nearest',
  });
}
