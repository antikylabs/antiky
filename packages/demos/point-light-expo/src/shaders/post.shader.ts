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

/**
 * Contrast about a pivot, as a power rather than a straight line.
 *
 * 0.18 is mid grey in linear light — not 0.5, which is mid grey only after the display curve, and
 * pivoting there would crush everything this scene actually contains. 1.12 is enough to separate the
 * lit from the unlit without posterising.
 *
 * Both are written into the expression rather than named as module constants, because the BroMetal
 * MVP resolves only shader parameters and local consts; a module-level value fails to compile.
 */
function shapeContrast(channel: number): number {
  return 0.18 * pow(max(channel, 0) / 0.18, 1.22);
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
  },
  varyings: { vUv: 'vec2' },

  vertex({ aPosition }, _uniforms, v) {
    // `targetUv` flips Y, which is what sampling a WebGPU render target needs. The position passes
    // through unchanged: the quad is already in clip space.
    v.vUv = targetUv(vec4(aPosition.x, aPosition.y, 0, 1));
    return vec4(aPosition.x, aPosition.y, 0, 1);
  },

  fragment({ uScene, uBloom, uBloomStrength, uExposure }, { vUv }) {
    const scene = texture(uScene, vUv).xyz;
    // Added in linear light, before exposure, because that is the space it was extracted in. Adding
    // it after exposure would make the glow's brightness depend on the exposure twice.
    const withBloom = scene.add(texture(uBloom, vUv).xyz.scale(uBloomStrength));
    const exposed = withBloom.scale(uExposure);

    // The grade, in linear light and before the tone-map.
    //
    // Order is not a preference. A grade after ACES is operating on display values whose ratios the
    // curve has already compressed, so lifting a shadow there also lifts everything the curve had
    // folded into it. In linear light the same lift moves only what is genuinely dark.
    //
    // Two moves, both small, both aimed at the thing this scene is short of — separation between the
    // lit and the unlit, which is what the demo's local-contrast budget measures:
    //
    // - **Saturation** toward the relay colours, because the three lights are the subject and the
    //   forest floor between them is not.
    // - **A slight S-curve** about the mid grey, which pushes the darks down and the lit surfaces up
    //   without touching either end.
    const grey = exposed.x * 0.2126 + exposed.y * 0.7152 + exposed.z * 0.0722;
    const saturated = mix(vec3(grey, grey, grey), exposed, 1.14);
    // Contrast as a power about the pivot, not a straight line through it.
    //
    // The straight-line form — `pivot + (v - pivot) * gain` — is the obvious one and it is wrong
    // here. It sends everything below `pivot / gain` negative, and clamping that at zero turns a
    // gradient into a plateau of pure black: it took `clippedLow` from 0 to **33.5%** against a 2%
    // ceiling, because this scene's void background sits at about 0.008 and the whole of it went
    // flat. Local contrast read 8.54 while a third of the frame had been destroyed, which is a good
    // reminder that one metric passing is not the same as the frame being right.
    //
    // `pivot * (v / pivot) ^ gain` has the same slope at the pivot and the same intent, and maps
    // zero to zero, so darks compress toward black without ever reaching it.
    const graded = vec3(
      shapeContrast(saturated.x),
      shapeContrast(saturated.y),
      shapeContrast(saturated.z),
    );

    // The vignette, applied to linear light for the same reason the grade is.
    //
    // `vUv` runs 0..1 across the frame, so this is distance from the centre in screen space. The
    // corner is about 0.707 away, and the smoothstep is tuned so the corner lands 10-25% below the
    // centre — under 10% is invisible and over 25% is heavy-handed. The budget asserts the number.
    const centred = vUv.sub(vec2(0.5, 0.5));
    const radius = length(centred);
    const vignette = 1 - smoothstep(0.28, 0.78, radius) * 0.22;

    return vec4(encodeSrgb(tonemapACES(graded.scale(vignette))), 1);
  },
});
