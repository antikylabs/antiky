import { shader, targetUv, texture, vec2, vec4 } from 'brometal';

/**
 * One axis of a separable Gaussian blur. Run twice — across, then down.
 *
 * Copied by hand from `point-light-expo`, the reference implementation goal 07 names.
 *
 * Separable because a 9x9 two-dimensional kernel is 81 samples and two 9-tap passes are 18 for the
 * same result. `uDirection` carries the step between taps in uv, so the same shader serves both
 * axes and there is no second copy to keep in step.
 *
 * The weights are a normalised 9-tap Gaussian, written out rather than looped: the DSL supports a
 * loop, but an unrolled chain of nine adds compiles to the same thing and reads as what it is.
 *
 * The target this samples is created with `filter: 'linear'` — goal 02's `render-target-filtering`
 * patch. On a point sampler the taps between texels snap back onto texel centres and the blur turns
 * into blocky glow that crawls when the camera moves.
 */
export default shader({
  attributes: { aPosition: 'vec3' },
  uniforms: {
    uSource: 'sampler2D',
    uDirection: 'vec2',
  },
  varyings: { vUv: 'vec2' },

  vertex({ aPosition }, _uniforms, v) {
    v.vUv = targetUv(vec4(aPosition.x, aPosition.y, 0, 1));
    return vec4(aPosition.x, aPosition.y, 0, 1);
  },

  fragment({ uSource, uDirection }, { vUv }) {
    const step1 = vec2(uDirection.x, uDirection.y);
    const centre = texture(uSource, vUv).xyz.scale(0.1964825501511404);
    const near = texture(uSource, vUv.add(step1)).xyz
      .add(texture(uSource, vUv.sub(step1)).xyz)
      .scale(0.2969069646728344);
    const mid = texture(uSource, vUv.add(step1.scale(2))).xyz
      .add(texture(uSource, vUv.sub(step1.scale(2))).xyz)
      .scale(0.09447039785044732);
    const far = texture(uSource, vUv.add(step1.scale(3))).xyz
      .add(texture(uSource, vUv.sub(step1.scale(3))).xyz)
      .scale(0.010381362401148057);
    return vec4(centre.add(near).add(mid).add(far), 1);
  },
});
