import {
  shader,
  step,
  texture,
  vec2,
  vec4,
} from 'brometal';

/**
 * Relay rings — goal 08. These used to be lit `tube: 0.035` tori with eight radial segments, and
 * the capture showed exactly that: hard-edged plastic hoops whose polygon count you could read.
 * Each instance is now a flat annulus on the ground, additive and unlit, whose band fades softly
 * at both radial edges — a ring of light, not a ring of pipe. The radii these draw are gameplay
 * information (safe field, charge field, forge, player charge), so the band stays uniform around
 * the circumference and the existing radius animations are what make a pulse read as a shockwave.
 *
 * Alpha stays at 1: BroMetal's additive blend is `(src-alpha, one)`, so intensity lives in RGB.
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
    /** u around the circumference, v across the band: 0 at the inner edge, 1 at the outer. */
    aUv: 'vec2',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    /** ring radius in world units, and how wide the soft band is relative to it. */
    iShape: 'vec2',
    iColor: 'vec3',
    iIntensity: 'float',
  },
  uniforms: {
    uViewProj: 'mat4',
    uTime: 'float',
    uBillboard: 'sampler2D',
  },
  varyings: {
    vUv: 'vec2',
    vColor: 'vec3',
    vIntensity: 'float',
  },

  vertex({ aPosition, aUv, iOffset, iShape, iColor, iIntensity }, { uViewProj }, v) {
    // The unit annulus spans radius 1 ± bandHalfWidth in its geometry; the instance scales the
    // whole disc so the band's world width tracks the ring's radius times `iShape.y`.
    const world = vec4(
      aPosition.x * iShape.x + iOffset.x,
      iOffset.y,
      aPosition.z * iShape.x + iOffset.z,
      1,
    );
    v.vUv = aUv;
    v.vColor = iColor;
    v.vIntensity = iIntensity;
    return uViewProj.mul(world);
  },

  fragment({ uBillboard }, { vUv, vColor, vIntensity }) {
    // The sprite's centre column read across the band: bright in the middle, zero at both edges,
    // with no edge for the rasteriser to show. This is the same soft profile the trails use.
    const band = texture(uBillboard, vec2(0.5, vUv.y)).x;
    const alive = step(0.0001, vIntensity);
    return vec4(vColor.scale(band * vIntensity * alive), 1);
  },
});
