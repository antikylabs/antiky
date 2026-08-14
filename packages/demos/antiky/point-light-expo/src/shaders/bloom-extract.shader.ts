import { max, shader, targetUv, texture, vec2, vec4 } from 'brometal';
/**
 * The part of the frame bright enough to bleed light, pulled out of the HDR target.
 *
 * Reads the same RGBA16F target the post pass reads, before exposure and before the tone-map. That
 * is the only place the question "is this brighter than white" can still be asked: after ACES
 * everything is inside 0..1 and a genuine emissive is indistinguishable from a well-lit surface.
 *
 * The threshold is applied to the brightest channel rather than to luminance. A saturated red relay
 * at (3, 0.2, 0.2) has a luminance of 0.78 and would fall under any threshold that leaves lit
 * diffuse alone — but it is three times over white in red and obviously glows.
 *
 * Colour is preserved rather than the excess being taken per channel: scaling the original colour by
 * how far it is over keeps the relay's hue, where subtracting the threshold from each channel drags
 * everything toward white.
 */
export default shader({
  attributes: { aPosition: 'vec3' },
  uniforms: {
    uScene: 'sampler2D',
    uThreshold: 'float',
    /** One quarter-resolution texel in uv, for the downsample taps below. */
    uTexel: 'vec2',
  },
  varyings: { vUv: 'vec2' },

  vertex({ aPosition }, _uniforms, v) {
    v.vUv = targetUv(vec4(aPosition.x, aPosition.y, 0, 1));
    return vec4(aPosition.x, aPosition.y, 0, 1);
  },

  fragment({ uScene, uThreshold, uTexel }, { vUv }) {
    // A real 4x downsample, not a point pick — one nearest tap read 1 of every 16 scene pixels,
    // and any small bright source became isolated hot texels the blur walked into boxes.
    const offset = vec2(uTexel.x * 0.25, uTexel.y * 0.25);
    const scene = texture(uScene, vec2(vUv.x - offset.x, vUv.y - offset.y)).xyz
      .add(texture(uScene, vec2(vUv.x + offset.x, vUv.y - offset.y)).xyz)
      .add(texture(uScene, vec2(vUv.x - offset.x, vUv.y + offset.y)).xyz)
      .add(texture(uScene, vec2(vUv.x + offset.x, vUv.y + offset.y)).xyz)
      .scale(0.25);
    const brightest = max(max(scene.x, scene.y), scene.z);
    // Guarded because a black pixel divides by zero here, and a NaN in a bloom chain spreads across
    // the whole frame on the next blur rather than staying where it started.
    const overflow = max(brightest - uThreshold, 0) / max(brightest, 0.0001);
    return vec4(scene.scale(overflow), 1);
  },
});
