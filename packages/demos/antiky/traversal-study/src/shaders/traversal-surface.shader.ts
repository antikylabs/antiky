import {
  clamp,
  dot,
  length,
  max,
  mix,
  normalize,
  pow,
  shader,
  sin,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { rotate2, tonemapACES } from 'brometal/shader-functions';

/**
 * Linear to sRGB, applied once to the pixel this shader writes.
 *
 * Copied by hand from `point-light-expo`, which goal 07 names as the reference implementation. The
 * duplication is the slice process, not an oversight: `pipeline-invariants.test.mjs` asserts every
 * copy compiles to an identical body, and goal 12 extracts the shared driver from the result.
 *
 * BroMetal never configures an sRGB canvas — `getPreferredCanvasFormat()` with no `viewFormats` —
 * so nothing applies the display curve unless a shader does. Goal 04 added the decode on albedo
 * sample without this half, which left this demo doing lighting on correct numbers and then writing
 * them out as though they were already display-encoded. That is why its p95 fell from 0.400 to
 * 0.258.
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
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iColor: 'vec3',
    iMaterial: 'vec3',
  },
  uniforms: {
    uBillboard: 'sampler2D',
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vColor: 'vec3',
    vMaterial: 'vec3',
    vPulse: 'float',
  },

  vertex({ aPosition, aNormal, iOffset, iScale, iColor, iMaterial }, { uViewProj, uTime }, v) {
    const rotatedPosition = rotate2(aPosition.xy.mul(iScale.xy), iMaterial.z);
    const rotatedNormal = rotate2(aNormal.xy, iMaterial.z);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      rotatedPosition.y + iOffset.y,
      aPosition.z * iScale.z + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, rotatedNormal.y, aNormal.z));
    v.vColor = iColor;
    v.vMaterial = iMaterial;
    v.vPulse = 0.74 + sin(uTime * 3.6 + iOffset.x * 0.28 + iOffset.y) * 0.26;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition, uBillboard }, { vWorld, vNormal, vColor, vMaterial, vPulse }) {
    const normal = normalize(vNormal);
    // Same key light as traversal-model, which is where the value comes from: the model shader
    // lights what the player watches, and this surface is what its shadows land on. Repeated
    // rather than shared because the BroMetal MVP cannot read a module-level constant from a
    // shader body; `pipeline-invariants.test.mjs` fails if the two copies drift apart.
    const light = normalize(vec3(-0.38, 0.84, 0.48));
    const view = normalize(uCameraPosition.sub(vWorld));
    const rawLight = max(dot(normal, light), 0);
    const litBand = smoothstep(0.18, 0.24, rawLight) * 0.28
      + smoothstep(0.58, 0.64, rawLight) * 0.48;
    const rim = pow(1 - max(dot(normal, view), 0), 2.2);
    const base = vColor.scale(0.48 + litBand)
      .add(vec3(0.16, 0.2, 0.18).scale(0.12 + normal.y * 0.08));
    const emissive = vColor.scale(vMaterial.x * (0.16 + vPulse * 0.24));
    const highlight = vec3(1.05, 0.83, 0.48).scale(clamp(vMaterial.y, 0, 1) * (0.16 + rim * 0.3));
    // Matched to traversal-model's range for the same reason. Was 20..58 here against 22..58
    // there, so the ground began fading two metres before the props standing on it did.
    const depth = smoothstep(22, 58, length(uCameraPosition.sub(vWorld)));
    const heightHaze = (1 - smoothstep(-5, 6, vWorld.y)) * 0.08;
    const sky = vec3(0.52, 0.63, 0.65).add(vec3(0.08, 0.06, 0.02).scale(heightHaze));
    // Structure on the contact shadow, which is the only thing this shader still draws — the HUD
    // moved to a flat screen-space batch, which is what freed this shader to be textured at all.
    //
    // The blob is a sphere with no UVs, so the view-facing normal is the coordinate: it reaches the
    // sprite's rim, where alpha is already zero, exactly at the silhouette. Without it every contact
    // shadow in the frame is the same perfect ellipse.
    const surfaceNormal = normalize(vNormal);
    const structure = texture(uBillboard, vec2(surfaceNormal.x * 0.5 + 0.5, surfaceNormal.z * 0.5 + 0.5)).w;
    const textured = 0.6 + structure * 0.4;
    const composed = base.add(emissive).add(highlight).scale(textured);
    return vec4(encodeSrgb(tonemapACES(mix(composed, sky, depth * 0.5))), 1);
  },
});
