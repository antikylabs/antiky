import {
  length,
  max,
  mix,
  pow,
  shader,
  smoothstep,
  step,
  targetUv,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { tonemapACES } from 'brometal/shader-functions';

/**
 * The one place the frame becomes an image.
 *
 * Copied by hand from `point-light-expo`, which goal 07 names as the reference implementation. It
 * carries W B.2's shape only — exposure, one ACES curve, one sRGB encode. The grade, the vignette
 * and the bloom the reference also has arrive here in W B.5, and adding them now would destroy the
 * invariance measurement that is this packet's only real check.
 *
 * Before this pass existed, three material shaders each applied their own exposure and their own
 * ACES curve, so the demo had three tone-maps and no single point where linear light stopped and a
 * picture started. Anything added afterwards — shadows, bloom, a grade — had to be threaded through
 * all three and kept in step by hand.
 *
 * Now the scene renders into one RGBA16F target holding linear HDR, and exposure, tone-mapping and
 * the sRGB encode happen exactly once, here, in that order. The order is not interchangeable:
 * exposure scales linear light, ACES maps that range into 0..1, and only then is it display data.
 *
 */

/**
 * Linear to sRGB. The only copy left: 06-01 needed one per material shader, and collapsing them into
 * this pass is most of what 06-02 is for.
 *
 * The piecewise curve rather than the 2.2 approximation, because the two differ most in the darks
 * and this scene lives there. `max` guards the toe: `pow` of a negative is undefined and a
 * tone-mapped value can land fractionally below zero.
 */
function channelToDisplay(channel: number): number {
  const safe = max(channel, 0);
  const low = safe * 12.92;
  // 1 / 2.4, written out rather than divided. `brometal prod` constant-folds the division and
  // `brometal dev` does not, so a division here makes the committed `.gen.ts` depend on which mode
  // last ran — which `shader-output-parity` correctly refuses.
  const high = pow(safe, 0.4166666666666667) * 1.055 - 0.055;
  // `pow` and `step` are scalar-only here, so the curve is applied one component at a time.
  return mix(low, high, step(0.0031308, safe));
}

/**
 * Contrast about a pivot, as a power rather than a straight line.
 *
 * 0.18 is mid grey in linear light — not 0.5, which is mid grey only after the display curve.
 *
 * **The straight-line form is wrong and it looks like a pass.** `pivot + (v - pivot) * gain` sends
 * everything below `pivot / gain` negative, and clamping at zero turns a gradient into a plateau of
 * pure black. In the reference it cleared the local-contrast floor while taking `clippedLow` from 0
 * to 33.5%. This form has the same slope at the pivot and maps zero to zero.
 *
 * Written into the expression rather than named as module constants: the BroMetal MVP resolves only
 * shader parameters and local consts.
 */
function shapeContrast(channel: number): number {
  return 0.18 * pow(max(channel, 0) / 0.18, 1.16);
}

function encodeSrgb(color: Vec3): Vec3 {
  return vec3(channelToDisplay(color.x), channelToDisplay(color.y), channelToDisplay(color.z));
}

export default shader({
  attributes: { aPosition: 'vec3' },
  uniforms: {
    uScene: 'sampler2D',
    uBloom: 'sampler2D',
    uBloomStrength: 'float',
    uExposure: 'float',
    uVignetteStrength: 'float',
    /**
     * Item 17's offset map: red and green carry a screen-space nudge written by the ripple pass.
     * Warping the *lookup* rather than the scene is the whole trick — an impact bends the already
     * rendered image outward for a few frames, which reads as a pressure wave without a single
     * extra scene draw. Zero offset samples straight, so an empty map is exactly a no-op.
     */
    uDistortion: 'sampler2D',
  },
  varyings: { vUv: 'vec2' },

  vertex({ aPosition }, _uniforms, v) {
    // `targetUv` flips Y, which is what sampling a WebGPU render target needs. The position passes
    // through unchanged: the quad is already in clip space.
    v.vUv = targetUv(vec4(aPosition.x, aPosition.y, 0, 1));
    return vec4(aPosition.x, aPosition.y, 0, 1);
  },

  fragment({ uScene, uBloom, uBloomStrength, uExposure, uVignetteStrength, uDistortion }, { vUv }) {
    const ripple = texture(uDistortion, vUv).xy;
    const warped = vec2(vUv.x + ripple.x, vUv.y + ripple.y);
    const scene = texture(uScene, warped).xyz;
    // Added in linear light, before exposure, because that is the space it was extracted in. The
    // bloom deliberately samples the unwarped position: a halo that ripples with the impact reads
    // as the light itself wobbling rather than the air.
    const withBloom = scene.add(texture(uBloom, vUv).xyz.scale(uBloomStrength));
    const exposed = withBloom.scale(uExposure);

    // The grade, in linear light and before the tone-map. A grade after ACES operates on values the
    // curve has already compressed, so lifting a shadow there also lifts everything folded into it.
    const grey = exposed.x * 0.2126 + exposed.y * 0.7152 + exposed.z * 0.0722;
    const saturated = mix(vec3(grey, grey, grey), exposed, 1.1);
    const graded = vec3(
      shapeContrast(saturated.x),
      shapeContrast(saturated.y),
      shapeContrast(saturated.z),
    );

    // The vignette, on linear light for the same reason. `vUv` runs 0..1 across the frame, so this
    // is distance from centre; the corner sits at 0.707 and lands 10-25% down, which is the band the
    // goal calls restrained.
    const centred = vUv.sub(vec2(0.5, 0.5));
    const vignette = 1 - smoothstep(0.28, 0.78, length(centred)) * uVignetteStrength;

    return vec4(encodeSrgb(tonemapACES(graded.scale(vignette))), 1);
  },
});
