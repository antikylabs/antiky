import {
  step,
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
  texture,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { rotate2, tonemapACES } from 'brometal/shader-functions';
import { decodeSrgb } from './color.ts';

/**
 * sRGB to linear, applied when an albedo texture is sampled.
 *
 * BroMetal exposes no sRGB texture format — everything uploads as `rgba8unorm` — so a sampled albedo
 * texel arrives holding display-encoded values. Lighting maths on those is wrong: mid-tones come out
 * too dark, which then gets compensated by over-bright lights, and the error compounds through every
 * term downstream. This is the sample-side half of colour management; encoding once on output is the
 * other half and belongs to the post pass.
 *
 * Only albedo goes through here. Normal maps, ARM and roughness maps, shadow maps and scene targets
 * already hold linear data, and decoding those would corrupt them.
 *
 * The piecewise curve rather than the 2.2 approximation: they differ most below 0.04045, which is
 * exactly where these dark scenes spend their time.
 *
 * Declared in every shader that needs it rather than imported. The BroMetal MVP resolves only
 * "module-level helper functions declared above their first use" — an imported helper fails to
 * compile. `pipeline-invariants.test.mjs` asserts every copy is identical.
 */
function channelToLinear(channel: number): number {
  const low = channel / 12.92;
  const high = pow((channel + 0.055) / 1.055, 2.4);
  // `pow` and `step` are scalar-only here, so the curve is applied one component at a time.
  return mix(low, high, step(0.04045, channel));
}

function decodeSrgb(color: Vec3): Vec3 {
  return vec3(channelToLinear(color.x), channelToLinear(color.y), channelToLinear(color.z));
}

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
    aUv: 'vec2',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iNormalScale: 'vec3',
    iTint: 'vec3',
    iParams: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTex: 'sampler2D',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vUv: 'vec2',
    vTint: 'vec3',
    vParams: 'vec3',
  },

  vertex({ aPosition, aNormal, aUv, iOffset, iScale, iNormalScale, iTint, iParams }, { uViewProj }, v) {
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), iParams.z);
    const inverseScaledNormal = aNormal.mul(iNormalScale);
    const rotatedNormal = rotate2(inverseScaledNormal.xz, iParams.z);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, inverseScaledNormal.y, rotatedNormal.y));
    v.vUv = aUv;
    v.vTint = iTint;
    v.vParams = iParams;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition, uTex, uTime }, { vWorld, vNormal, vUv, vTint, vParams }) {
    const normal = normalize(vNormal);
    const view = normalize(uCameraPosition.sub(vWorld));
    // This is the arena's key light, and this shader is where the value comes from: the ships are
    // the subject, so the floor was moved to agree with them rather than the other way round. The
    // same vector appears in arena-model and arena-surface, guarded by `pipeline-invariants`.
    const key = normalize(vec3(-0.44, 0.86, 0.42));
    const fill = normalize(vec3(0.72, 0.3, -0.52));
    const keyLight = max(dot(normal, key), 0);
    const fillLight = max(dot(normal, fill), 0);
    const rim = pow(1 - max(dot(normal, view), 0), 2.25);
    const authored = decodeSrgb(texture(uTex, vUv).xyz);
    const pulse = 0.76 + sin(uTime * 5.4 + vWorld.x * 0.75 - vWorld.z * 0.52) * 0.24;
    const lit = authored.scale(0.25 + keyLight * 1.02 + fillLight * 0.28)
      .add(vec3(0.025, 0.045, 0.075).scale(0.4 + max(normal.y, 0) * 0.34));
    const energy = vTint.scale(clamp(vParams.x, 0, 1.2) * pulse * (0.12 + rim * 0.44));
    const hit = clamp(vParams.y, 0, 1);
    const confirmed = mix(lit.add(energy), vec3(3, 3.15, 3.3), hit * hit);
    const fog = smoothstep(17, 34, length(uCameraPosition.sub(vWorld)));
    return vec4(tonemapACES(mix(confirmed, vec3(0.004, 0.009, 0.02), fog * 0.55)), 1);
  },
});
