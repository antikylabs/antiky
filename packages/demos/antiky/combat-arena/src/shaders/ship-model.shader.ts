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
import { rotate2, shadowFactor } from 'brometal/shader-functions';

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
    uSunDirection: 'vec3',
    uShadowMap: 'sampler2D',
    uLightViewProj: 'mat4',
    uLightPosition: 'vec3',
    uShadowRange: 'float',
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
    {
    uSunDirection,
    uShadowMap,
    uLightViewProj,
    uLightPosition,
    uShadowRange, uCameraPosition, uTex, uDetailNormal, uTime },
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
    // Lowered and moved behind the arena by goal 07's W B.3, and the reason is measured rather than
    // aesthetic. At its previous 59 degrees of elevation the sun dropped each caster's shadow
    // underneath the caster: only **1.63%** of the deck came back darkened by 25% or more, and no
    // 32-pixel probe pair could be placed. Elevation is what decides how much shadow a frame
    // contains. Moving it to -z also turns the shadows to face a camera that sits at +z.
    //
    // One value, agreed by every shader here and by `src/sun.ts`, which is what
    // `pipeline-invariants.test.mjs` asserts when it says a demo has one key direction.
    const key = normalize(vec3(-0.52, 0.58, -0.63));
    // The sun's shadow, and the only shadow this arena casts.
    //
    // Softness, bias and the shadow texel are literals rather than uniforms, agreed across the three
    // material shaders and held equal by `pipeline-invariants.test.mjs`. Nothing varies them at run
    // time, and a uniform would mean binding plumbing at every call site for a number that never
    // moves.
    //
    // 0.00048828125 is 1 / 2048, which is `SHADOW_MAP_SIZE` in `src/sun.ts`. A texel size that does
    // not match the map silently resizes the penumbra rather than failing.
    const shadowSoftness = 2.5;
    const shadowBias = 0.03;
    const sunVisibility = shadowFactor(
      uShadowMap,
      uLightViewProj,
      vWorld,
      normal,
      uLightPosition,
      uShadowRange,
      0.00048828125,
      shadowSoftness,
      shadowBias,
    );
    // Applied to the key term only. The fill, the rim and the ambient are what a surface receives
    // from everything that is *not* the key, so a shadow must not touch them — dimming them too is
    // what makes a shadowed area read as flat grey instead of dark and shaped.
    const fill = normalize(vec3(0.72, 0.3, -0.52));
    const keyLight = max(dot(normal, key), 0) * sunVisibility;
    const fillLight = max(dot(normal, fill), 0);
    const rim = pow(1 - max(dot(normal, view), 0), 2.25);
    const authored = decodeSrgb(texture(uTex, vUv).xyz);
    const pulse = 0.76 + sin(uTime * 5.4 + vWorld.x * 0.75 - vWorld.z * 0.52) * 0.24;
    // Same earthshine as the arena beneath them, tinted the same way, so hulls and deck agree about
    // where the light in this scene comes from.
    // Same planet, same direction as the deck below, so hulls and arena agree about the light.
    const earthward = normalize(vec3(-0.78, -0.42, -0.46));
    // Hemispheric ambient: the planet below, and empty space everywhere else.
    //
    // W B.4. What this replaces is the `0.72 +` that used to sit in front of the directional term —
    // a flat constant that was **73% of the value a down-facing surface received**, so the direction
    // only ever modulated the last quarter of it. Measured, the old term differed by **6.2%** between
    // an up-facing and a down-facing normal, against the goal's 30% bar.
    //
    // The two lobes are this scene's actual sky: an arena in orbit is lit from below by a planet and
    // from everywhere else by almost nothing. **Down-facing surfaces are the bright ones here**, and
    // that is not a mistake to be corrected — it is where the light is.
    //
    // 0.18 and 1.55 are chosen so the spherical average lands at 0.865 against the old term's 0.925,
    // which keeps the overall level while separating the two ends by 50%.
    const planetFacing = dot(normal, earthward) * 0.5 + 0.5;
    const ambient = mix(vec3(0.18, 0.18, 0.18), vec3(1.55, 1.55, 1.55), planetFacing);
    const earthshine = vec3(0.40, 0.50, 0.66).mul(ambient);
    const lit = authored.mul(earthshine)
      .add(authored.scale(keyLight * 1.15 + fillLight * 0.32));
    const energy = vTint.scale(clamp(vParams.x, 0, 1.2) * pulse * (0.12 + rim * 0.44));
    const hit = clamp(vParams.y, 0, 1);
    const confirmed = mix(lit.add(energy), vec3(3, 3.15, 3.3), hit * hit);
    const fog = smoothstep(17, 34, length(uCameraPosition.sub(vWorld)));
    // Linear HDR, and nothing else. Exposure, the tone-map and the encode all happen once in
    // `post.shader.ts`; this shader's job ends at "how much light leaves this surface".
    //
    // The fog colour is the demo's one agreed distance colour, expressed in pre-exposure scene
    // light. Three shaders used to fade to three different near-blacks — (0.006, 0.01, 0.018),
    // (0.008, 0.012, 0.03) and (0.004, 0.009, 0.02) — which is one arena receding into three
    // different skies. Goal 07 names that as the example of undocumented divergence.
    //
    // The value is linear because the target is: the post pass exposes, tone-maps and encodes it
    // along with the geometry, so it has to enter in the same space.
    return vec4(mix(confirmed, vec3(0.001887, 0.002936, 0.004748), fog * 0.55), 1);
  },
});
