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
