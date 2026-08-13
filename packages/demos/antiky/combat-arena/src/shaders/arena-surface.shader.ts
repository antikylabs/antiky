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
 * them out as though they were already display-encoded. That is why its p95 fell from 0.101 to
 * 0.081.
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
    iParams: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vColor: 'vec3',
    vParams: 'vec3',
    vPulse: 'float',
  },

  vertex({ aPosition, aNormal, iOffset, iScale, iColor, iParams }, { uViewProj, uTime }, v) {
    const angle = iParams.z;
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), angle);
    const rotatedNormal = rotate2(aNormal.xz, angle);
    const bob = sin(uTime * (2.1 + iParams.z * 0.2) + iOffset.x + iOffset.z) * iParams.x * 0.025;
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y + bob,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, aNormal.y, rotatedNormal.y));
    v.vColor = iColor;
    v.vParams = iParams;
    v.vPulse = 0.72 + sin(uTime * 4.2 + iOffset.x * 0.7 - iOffset.z * 0.4) * 0.28;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition }, { vWorld, vNormal, vColor, vParams, vPulse }) {
    const normal = normalize(vNormal);
    const view = normalize(uCameraPosition.sub(vWorld));
    // Key light for the whole arena. This vector is repeated in every combat-arena shader because
    // the BroMetal MVP cannot read a module-level constant from a shader body ("unknown identifier
    // — only shader parameters and local consts are in scope"). `pipeline-invariants.test.mjs`
    // fails if the copies ever disagree, so the test is what keeps them in step.
    //
    // It is the ship shader's original value. The ships are the subject, and the contact shadows
    // land on the arena floor, so the floor must agree with what lights the ships rather than the
    // other way round. The floor's old +X sun lit it from the opposite side from the ships.
    const light = normalize(vec3(-0.44, 0.86, 0.42));
    const diffuse = max(dot(normal, light), 0);
    const rim = pow(1 - max(dot(normal, view), 0), 2.1);
    const heightGlow = smoothstep(-0.45, 1.2, vWorld.y);
    const base = vColor.scale(0.16 + diffuse * 0.72)
      .add(vec3(0.06, 0.11, 0.2).scale(0.22 + normal.y * 0.18));
    const energy = vColor.scale(vParams.x * (0.35 + vPulse * 0.65))
      .add(vec3(0.22, 0.6, 1.2).scale(rim * (0.32 + heightGlow * 0.24)));
    const hit = clamp(vParams.y, 0, 1);
    const flashed = mix(base.add(energy), vec3(2.6, 2.8, 3.2), hit * hit);
    // One fog range for the arena, matching the sun above: same reason, same guard. 17..34 is the
    // ship shader's original range. The tighter floor ranges faded the ground while ships at the
    // same distance were still crisp, which is what made near and far disagree about depth.
    const fog = smoothstep(17, 34, length(uCameraPosition.sub(vWorld)));
    return vec4(encodeSrgb(tonemapACES(mix(flashed, vec3(0.008, 0.012, 0.03), fog * 0.8))), 1);
  },
});
