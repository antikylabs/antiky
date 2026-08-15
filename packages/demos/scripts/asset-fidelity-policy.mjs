/**
 * One fidelity policy for every script that turns a downloaded model into a shipped GLB.
 *
 * The three scripts stay separate — they process different kits with genuinely different needs, and
 * merging them would trade three readable scripts for one with three modes. What is shared is the
 * *policy*: which attributes must survive, which material maps must survive, and what a shipped
 * texture is allowed to look like. Each script imports these and asserts against them, so a future
 * edit cannot quietly drop an attribute or a map again.
 *
 * Two defects motivated this, and they are the tests below:
 *
 * - `point-light-expo` downloaded, hash-verified and committed 3.7 MB of Poly Haven normal maps and
 *   then ran `delete material.normalTexture` at pack time, so every scan reached the game with no
 *   surface detail for light to catch.
 * - A textured model whose unwrap is replaced by a palette lookup ships a texture it can no longer
 *   address. That has not happened, but it is one careless merge away.
 *
 * `antiky-town` is deliberately **excluded**. It has no asset script at all: its art arrives as
 * three texture atlases with JSON companions plus sprite atlases, with no GLB packing step, no
 * `TEXCOORD_0` to preserve and no `normalTexture` to drop. Inventing a script for it to make the set
 * symmetrical would add a build step the demo does not need.
 */

/** Demos whose assets pass through a packing script and are therefore covered by this policy. */
export const SCRIPTED_DEMOS = Object.freeze(['combat-arena', 'point-light-expo', 'traversal-study']);

/** Attributes a shipped primitive must carry. Without UVs a texture cannot be addressed at all. */
export const REQUIRED_ATTRIBUTES = Object.freeze(['POSITION', 'NORMAL', 'TEXCOORD_0']);

/**
 * Widest strip still treated as a colour palette rather than a picture.
 *
 * Flat-shaded kits legitimately ship one texel per material — `cloud-large` is 1x1 because the model
 * is one colour. Anything wider than this carries real image data and must have a real unwrap.
 */
export const PALETTE_MAX_WIDTH = 16;

/** A source material map that must reach the shipped GLB when the source provides one. */
export const PRESERVED_MATERIAL_MAPS = Object.freeze(['normalTexture']);

/**
 * The deepest mip level a town surface selects, and therefore the level every atlas must survive.
 *
 * Derived rather than chosen, in `build-texture-atlas.mjs`: at the far plane a town material covers
 * about 37.7 texels per pixel, which is mip 5.24, rounded up to 6.
 */
export const ATLAS_DEEPEST_MIP = 6;

/**
 * The narrowest gutter an atlas may declare.
 *
 * A texel at mip N averages 2^N source texels, so a tile stays clean to mip N only if it carries at
 * least 2^N pixels of its own material outside the rectangle anything samples.
 */
export const ATLAS_GUTTER_PIXELS = 2 ** ATLAS_DEEPEST_MIP;

/**
 * Check one atlas layout against the policy.
 *
 * The atlas equivalent of `checkFidelity`: it takes the descriptor rather than the image, so the
 * packer can assert before it writes and a test can assert against what shipped. Pixels are somebody
 * else's job — `pipeline-invariants.test.mjs` opens the image and proves the gutter is really
 * extruded, because a `"gutter": 64` typed into the JSON is a claim and not a measurement.
 *
 * The rule exists because the defect it prevents is invisible until it ships. An atlas with no
 * gutter looks correct at full size and grows a wrong-coloured fringe on every distant surface, and
 * the three atlases already in the tree arrived that way with nothing to stop them.
 */
export function checkAtlasLayout(descriptor, name = descriptor.image ?? 'atlas') {
  const failures = [];
  const texel = 2 ** ATLAS_DEEPEST_MIP;

  if (descriptor.gutter === undefined) {
    failures.push(
      `${name}: no gutter declared. Pack it with build-texture-atlas.mjs, which surrounds every tile `
      + `with ${ATLAS_GUTTER_PIXELS}px of its own extruded edge.`,
    );
  } else if (descriptor.gutter < ATLAS_GUTTER_PIXELS) {
    failures.push(
      `${name}: a ${descriptor.gutter}px gutter is thinner than the ${ATLAS_GUTTER_PIXELS}px a mip-`
      + `${ATLAS_DEEPEST_MIP} average reaches, so a distant surface still samples the tile beside it`,
    );
  }

  if (!Array.isArray(descriptor.tileRects) || descriptor.tileRects.length === 0) {
    failures.push(
      `${name}: publishes no per-tile rectangles, so a shader must recompute the grid and cannot `
      + 'inset. Nothing then keeps the shader and the image agreeing.',
    );
    return failures;
  }

  if (descriptor.tiles && descriptor.tiles.length !== descriptor.tileRects.length) {
    failures.push(
      `${name}: ${descriptor.tiles.length} tiles but ${descriptor.tileRects.length} rectangles`,
    );
  }

  const { width, height } = descriptor.size ?? {};
  if (!width || !height) {
    failures.push(`${name}: no image size, so a normalised rectangle cannot be checked against pixels`);
    return failures;
  }

  // Alignment is the other half of the fix. A rectangle whose pixel edges fall inside a mip texel
  // puts part of the gutter into a texel the shader samples, and no gutter width repairs that.
  for (const rect of descriptor.tileRects) {
    const pixels = [rect.x * width, rect.width * width, rect.y * height, rect.height * height];
    if (pixels.some((value) => Math.abs(value - Math.round(value)) > 1e-6 || Math.round(value) % texel !== 0)) {
      failures.push(
        `${name}/${rect.name}: its rectangle is [${pixels.map((v) => v.toFixed(2)).join(', ')}]px, `
        + `which does not land on whole mip-${ATLAS_DEEPEST_MIP} texels of ${texel}px`,
      );
    }
  }

  return failures;
}

/**
 * Check one packed model against the policy.
 *
 * Takes the facts rather than a file, so a script can call it before writing anything and a test can
 * call it against what actually shipped.
 */
export function checkFidelity({
  name,
  attributes,
  textureWidth,
  textureHeight,
  uniqueUvCount,
  materialCount,
  sourceMaterialMaps = [],
  packedMaterialMaps = [],
}) {
  const failures = [];

  for (const attribute of REQUIRED_ATTRIBUTES) {
    if (!attributes.includes(attribute)) failures.push(`${name}: missing ${attribute}`);
  }

  for (const map of PRESERVED_MATERIAL_MAPS) {
    if (sourceMaterialMaps.includes(map) && !packedMaterialMaps.includes(map)) {
      failures.push(`${name}: the source provides ${map} and the packed model does not carry it`);
    }
  }

  if (textureWidth !== undefined && textureHeight !== undefined) {
    const palette = textureHeight === 1 && textureWidth <= PALETTE_MAX_WIDTH;
    if (palette) {
      if (textureWidth > materialCount) {
        failures.push(`${name}: a ${textureWidth}-wide palette for ${materialCount} material(s)`);
      }
    } else if (uniqueUvCount <= materialCount) {
      failures.push(
        `${name}: a ${textureWidth}x${textureHeight} texture with only ${uniqueUvCount} unique UV `
        + `pair(s) across ${materialCount} material(s) — the unwrap was replaced by a lookup`,
      );
    }
  }

  return failures;
}
