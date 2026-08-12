import {
  step,
  pow,
  dot,
  length,
  max,
  mix,
  normalize,
  shader,
  sin,
  smoothstep,
  texture,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { rotate2 } from 'brometal/shader-functions';

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
  attributes: { aPosition: 'vec3', aNormal: 'vec3', aUv: 'vec2' },
  instanceAttributes: { iOffset: 'vec3', iScale: 'vec3', iParams: 'vec3' },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
    uGradeColor: 'vec3',
    uGradeMix: 'float',
    uTex: 'sampler2D',
  },
  varyings: { vWorld: 'vec3', vNormal: 'vec3', vUv: 'vec2', vWash: 'float' },

  vertex({ aPosition, aNormal, aUv, iOffset, iScale, iParams }, { uViewProj, uTime }, v) {
    const animatedYaw = iParams.x + sin(uTime * 3.1 + iParams.z) * iParams.y;
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), animatedYaw);
    const rotatedNormal = rotate2(aNormal.xz, animatedYaw);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, aNormal.y, rotatedNormal.y));
    v.vUv = aUv;
    v.vWash = 0.96 + sin(world.x * 1.7 + world.y * 2.3) * 0.04;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition, uGradeColor, uGradeMix, uTex }, { vWorld, vNormal, vUv, vWash }) {
    const texel = decodeSrgb(texture(uTex, vUv).xyz);
    const normal = normalize(vNormal);
    const light = normalize(vec3(-0.38, 0.84, 0.48));
    const diffuse = max(dot(normal, light), 0);
    const band = 0.54 + smoothstep(0.18, 0.25, diffuse) * 0.2
      + smoothstep(0.62, 0.7, diffuse) * 0.24;
    const graded = mix(texel, uGradeColor, uGradeMix);
    const base = graded.scale(band * vWash);
    const distanceFog = smoothstep(22, 58, length(uCameraPosition.sub(vWorld)));
    return vec4(mix(base, vec3(0.55, 0.65, 0.66), distanceFog * 0.42), 1);
  },
});
