import {
  max,
  mix,
  pow,
  shader,
  step,
  targetUv,
  texture,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { tonemapACES } from 'brometal/shader-functions';

/**
 * The one place the frame becomes an image.
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
 * `onboarding` is deliberately not in this target — see `renderer.ts`.
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

function encodeSrgb(color: Vec3): Vec3 {
  return vec3(channelToDisplay(color.x), channelToDisplay(color.y), channelToDisplay(color.z));
}

export default shader({
  attributes: { aPosition: 'vec3' },
  uniforms: {
    uScene: 'sampler2D',
    uExposure: 'float',
  },
  varyings: { vUv: 'vec2' },

  vertex({ aPosition }, _uniforms, v) {
    // `targetUv` flips Y, which is what sampling a WebGPU render target needs. The position passes
    // through unchanged: the quad is already in clip space.
    v.vUv = targetUv(vec4(aPosition.x, aPosition.y, 0, 1));
    return vec4(aPosition.x, aPosition.y, 0, 1);
  },

  fragment({ uScene, uExposure }, { vUv }) {
    const scene = texture(uScene, vUv).xyz;
    return vec4(encodeSrgb(tonemapACES(scene.scale(uExposure))), 1);
  },
});
