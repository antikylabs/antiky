import {
  clamp,
  exp,
  length,
  normalize,
  shader,
  step,
  vec2,
  vec4,
} from 'brometal';

/**
 * Distortion ripples — item 17's source pass. Each instance is an expanding impact ring lying flat
 * on the deck, and what it writes is not colour: the red and green channels carry a screen-space
 * offset vector, which the post pass reads to bend its scene lookup. Heat-haze and shockwaves are
 * this and nothing more — the scene is already rendered, so a two-channel nudge of where each
 * pixel reads from is the whole effect.
 *
 * Additive into a target cleared to zero, so overlapping ripples sum and an empty frame means "no
 * distortion anywhere" without a branch.
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    /** ring radius, strength, and ring thickness. */
    iParams: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uTime: 'float',
  },
  varyings: {
    vLocal: 'vec2',
    vParams: 'vec3',
  },

  vertex({ aPosition, iOffset, iParams }, { uViewProj }, v) {
    // A flat quad on the deck, spanning the ripple's maximum reach. The 2.2 keeps the quad ahead
    // of the ring so the gaussian never clips against its own geometry.
    const reach = iParams.x + iParams.z * 2.2;
    const world = vec4(
      aPosition.x * reach + iOffset.x,
      iOffset.y,
      aPosition.y * reach + iOffset.z,
      1,
    );
    v.vLocal = vec2(aPosition.x * reach, aPosition.y * reach);
    v.vParams = iParams;
    return uViewProj.mul(world);
  },

  fragment(_, { vLocal, vParams }) {
    const distance = length(vLocal);
    // A gaussian band at the ring radius: the offset is strongest on the ring and falls away on
    // both sides, which is what a pressure wave looks like from above.
    const off = distance - vParams.x;
    const band = exp(0 - (off * off) / clamp(vParams.z * vParams.z, 0.0001, 100));
    const direction = normalize(vLocal);
    const alive = step(0.0001, vParams.y);
    const push = vParams.y * band * alive;
    return vec4(direction.x * push, direction.y * push, 0, 1);
  },
});
