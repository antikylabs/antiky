import { loadTexture, type BroMetalTexture, type Renderer } from 'brometal';

const map = (name: string): string => new URL(
  `../assets/poly-haven/plywood/plywood_${name}_1k.jpg`,
  import.meta.url,
).href;

/**
 * The Poly Haven material this demo's built surfaces are made of.
 *
 * Installed and verified by `packages/demos/scripts/install-poly-haven-material.mjs`. Plywood is the
 * cardboard-and-corrugate read the art direction is after: the kit supplies the colour language,
 * this supplies what the surface is actually made of.
 *
 * `wrap: 'repeat'` because it is projected across world space at a fixed rate rather than addressed
 * by the kit's UVs — those carry the palette swatch and are not a surface parameterisation.
 */
export async function loadKitMaterialMaps(renderer: Renderer): Promise<Readonly<{
  diffuse: BroMetalTexture;
  roughness: BroMetalTexture;
}>> {
  const options = { wrap: 'repeat', filter: 'smooth', anisotropy: 8, flipY: false } as const;
  const [diffuse, roughness] = await Promise.all([
    loadTexture(renderer, map('diff'), options),
    loadTexture(renderer, map('rough'), options),
  ]);
  return Object.freeze({ diffuse, roughness });
}
