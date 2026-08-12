import {
  abs,
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
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { rotate2, tonemapACES } from 'brometal/shader-functions';

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
    uDetailNormal: 'sampler2D',
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

  fragment(
    { uCameraPosition, uTex, uDetailNormal, uTime },
    { vWorld, vNormal, vUv, vTint, vParams },
  ) {
    const baseNormal = normalize(vNormal);
    // Triplanar detail normal, written out here rather than called through a helper.
    //
    // A `texture()` call inside a DSL helper compiles to `textureSampleLevel(..., 0.0)`, pinning the
    // sample to the base mip. On a texture tiled this often that reads as crawling static the moment
    // the camera moves. Inlining the sample in the fragment body is what keeps the mip chain.
    //
    // The ships keep their 1,521 authored UVs for albedo — that panel work is real information and
    // triplanar would destroy it. Only the detail normal is projected, so the two never fight: one
    // places the paint, the other adds the tooth underneath it.
    //
    // Rate and strength are local consts rather than uniforms. Nothing varies them at run time, and
    // a uniform would mean binding plumbing at every call site for a number that never moves.
    const detailRate = 0.85;
    const detailStrength = 0.35;
    const weightX = abs(baseNormal.x);
    const weightY = abs(baseNormal.y);
    const weightZ = abs(baseNormal.z);
    const weightSum = weightX + weightY + weightZ;
    const detailX = texture(uDetailNormal, vec2(vWorld.z, vWorld.y).scale(detailRate)).xyz;
    const detailY = texture(uDetailNormal, vWorld.xz.scale(detailRate)).xyz;
    const detailZ = texture(uDetailNormal, vWorld.xy.scale(detailRate)).xyz;
    const tiltX = detailX.scale(2).sub(vec3(1, 1, 1));
    const tiltY = detailY.scale(2).sub(vec3(1, 1, 1));
    const tiltZ = detailZ.scale(2).sub(vec3(1, 1, 1));
    // Each projection's tangent X/Y is a tilt within that projection's own plane, so it lands in
    // world space by dropping the axis it was projected along. Summing the three by their weights
    // needs no tangent basis - which is why this projects instead of unwrapping, since no source
    // mesh here carries TANGENT and the DSL has no derivatives to rebuild one from.
    const tilt = vec3(0, tiltX.y, tiltX.x).scale(weightX)
      .add(vec3(tiltY.x, 0, tiltY.y).scale(weightY))
      .add(vec3(tiltZ.x, tiltZ.y, 0).scale(weightZ))
      .scale(detailStrength / weightSum);
    const normal = normalize(baseNormal.add(tilt));
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
    // Same earthshine as the arena beneath them, tinted the same way, so hulls and deck agree about
    // where the light in this scene comes from.
    const earthshine = vec3(0.34, 0.42, 0.55).scale(0.56 + max(normal.y, 0) * 0.4);
    const lit = authored.mul(earthshine)
      .add(authored.scale(keyLight * 1.15 + fillLight * 0.32));
    const energy = vTint.scale(clamp(vParams.x, 0, 1.2) * pulse * (0.12 + rim * 0.44));
    const hit = clamp(vParams.y, 0, 1);
    const confirmed = mix(lit.add(energy), vec3(3, 3.15, 3.3), hit * hit);
    const fog = smoothstep(17, 34, length(uCameraPosition.sub(vWorld)));
    return vec4(tonemapACES(mix(confirmed, vec3(0.004, 0.009, 0.02), fog * 0.55)), 1);
  },
});
