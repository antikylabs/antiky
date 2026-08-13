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

/**
 * One floodlight's contribution, inverse-square with a smooth cut-off at its radius.
 *
 * Colour arrives premultiplied by power and falloff arrives as `1 / radius^2`, so this is a couple
 * of multiplies rather than a divide per light per fragment — six lights on every arena fragment is
 * where that starts to matter.
 *
 * The clamp is what bounds the range: pure inverse square never reaches zero, so lights would
 * contribute faintly across the whole deck and the six would sum into flat fill.
 */
function arenaFloodlight(
  world: Vec3,
  normal: Vec3,
  lightPosition: Vec3,
  lightColor: Vec3,
  falloff: number,
): Vec3 {
  const toLight = lightPosition.sub(world);
  const distanceSquared = dot(toLight, toLight);
  const range = clamp(1 - distanceSquared * falloff, 0, 1);
  const lambert = max(dot(normal, normalize(toLight)), 0);
  return lightColor.scale(range * range * lambert);
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
    uKitMaterials: 'sampler3D',
    uLightPosition0: 'vec3',
    uLightColor0: 'vec3',
    uLightFalloff0: 'float',
    uLightPosition1: 'vec3',
    uLightColor1: 'vec3',
    uLightFalloff1: 'float',
    uLightPosition2: 'vec3',
    uLightColor2: 'vec3',
    uLightFalloff2: 'float',
    uLightPosition3: 'vec3',
    uLightColor3: 'vec3',
    uLightFalloff3: 'float',
    uLightPosition4: 'vec3',
    uLightColor4: 'vec3',
    uLightFalloff4: 'float',
    uLightPosition5: 'vec3',
    uLightColor5: 'vec3',
    uLightFalloff5: 'float',
    uMaterialDiffuse: 'sampler2D',
    uMaterialStrength: 'float',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vUv: 'vec2',
    vTint: 'vec3',
    vParams: 'vec3',
  },

  vertex({ aPosition, aNormal, aUv, iOffset, iScale, iTint, iParams }, { uViewProj }, v) {
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), iParams.z);
    const rotatedNormal = rotate2(aNormal.xz, iParams.z);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, aNormal.y, rotatedNormal.y));
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
    uShadowRange, uCameraPosition, uTex, uDetailNormal, uKitMaterials, uMaterialDiffuse, uMaterialStrength, uLightPosition0, uLightColor0, uLightFalloff0, uLightPosition1, uLightColor1, uLightFalloff1, uLightPosition2, uLightColor2, uLightFalloff2, uLightPosition3, uLightColor3, uLightFalloff3, uLightPosition4, uLightColor4, uLightFalloff4, uLightPosition5, uLightColor5, uLightFalloff5, uTime },
    { vWorld, vNormal, vUv, vTint, vParams },
  ) {
    const baseNormal = normalize(vNormal);
    // Triplanar detail normal, written out here rather than called through a helper.
    //
    // A `texture()` call inside a DSL helper compiles to `textureSampleLevel(…, 0.0)`, pinning the
    // sample to the base mip. On a texture tiled this often that reads as crawling static the moment
    // the camera moves. Inlining the sample in the fragment body is what keeps the mip chain.
    //
    // Projection weights come off the surface normal one component at a time, because `abs` is
    // scalar-only here. Vec3 exposes no reordered swizzles either, so the plane facing X is built
    // with an explicit `vec2` rather than a `.zy` that does not exist.
    //
    // Rate and strength are local consts rather than uniforms on purpose. Nothing varies them at
    // run time — they are properties of what this surface is made of — and a uniform would mean
    // binding plumbing at every call site in every demo for a number that never moves. Goal 08 is
    // where art direction tunes these, and this is the line it wants.
    const detailRate = 0.25;
    const detailStrength = 0.55;
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
    // needs no tangent basis — which is the whole reason for projecting instead of unwrapping, since
    // no source mesh here carries TANGENT and the DSL has no derivatives to rebuild one from.
    const tilt = vec3(0, tiltX.y, tiltX.x).scale(weightX)
      .add(vec3(tiltY.x, 0, tiltY.y).scale(weightY))
      .add(vec3(tiltZ.x, tiltZ.y, 0).scale(weightZ))
      .scale(detailStrength / weightSum);
    const normal = normalize(baseNormal.add(tilt));
    // Key light for the whole arena. This vector is repeated in every combat-arena shader because
    // the BroMetal MVP cannot read a module-level constant from a shader body ("unknown identifier
    // — only shader parameters and local consts are in scope"). `pipeline-invariants.test.mjs`
    // fails if the copies ever disagree, so the test is what keeps them in step.
    //
    // It is the ship shader's original value. The ships are the subject, and the contact shadows
    // land on the arena floor, so the floor must agree with what lights the ships rather than the
    // other way round. The floor's old +X sun lit it from the opposite side from the ships.
    // Lowered and moved behind the arena by goal 07's W B.3, and the reason is measured rather than
    // aesthetic. At its previous 59 degrees of elevation the sun dropped each caster's shadow
    // underneath the caster: only **1.63%** of the deck came back darkened by 25% or more, and no
    // 32-pixel probe pair could be placed. Elevation is what decides how much shadow a frame
    // contains. Moving it to -z also turns the shadows to face a camera that sits at +z.
    //
    // One value, agreed by every shader here and by `src/sun.ts`, which is what
    // `pipeline-invariants.test.mjs` asserts when it says a demo has one key direction.
    const light = normalize(vec3(-0.52, 0.58, -0.63));
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
    const view = normalize(uCameraPosition.sub(vWorld));
    const diffuse = max(dot(normal, light), 0) * sunVisibility;
    // Roughness from the kit's own palette, addressed by the same UV the albedo uses: V picks the
    // palette row, U picks the swatch. Before this every face of every arena piece took one
    // roughness, so a painted panel and a bare grate scattered light identically.
    //
    // Sampled `nearest` — a table of discrete entries, where blending two swatches would invent a
    // roughness belonging to neither.
    const kitRoughness = texture(uKitMaterials, vec3(vUv.x, vUv.y, 0.5)).x;
    // Rough scatters wide and weak; smooth keeps a tight bright edge.
    const rim = pow(1 - max(dot(normal, view), 0), 2.2) * (1.25 - kitRoughness);
    // What the deck is plated with, projected in world space over the kit's palette colour.
    //
    // Normalised by the material's own mean linear luminance (0.0357 for this one) so it modulates
    // brightness rather than removing it — multiplying a dark metal albedo straight into a palette
    // colour costs about five stops and turns a lit deck into a black hole. Centred on 1.0, panel
    // grain lighter than the average brightens and grain darker than it darkens.
    //
    // `uMaterialStrength` is per batch: the deck and structure are plated, the cables and the
    // blaster-kit props are not.
    //
    // Sampled in the fragment body, never through a helper — `texture()` inside a DSL helper
    // compiles to `textureSampleLevel(..., 0.0)` and loses the mip chain.
    const platingRate = 0.30;
    const platingX = texture(uMaterialDiffuse, vec2(vWorld.z, vWorld.y).scale(platingRate)).xyz;
    const platingY = texture(uMaterialDiffuse, vWorld.xz.scale(platingRate)).xyz;
    const platingZ = texture(uMaterialDiffuse, vWorld.xy.scale(platingRate)).xyz;
    const plating = decodeSrgb(
      platingX.scale(weightX).add(platingY.scale(weightY)).add(platingZ.scale(weightZ))
        .scale(1 / weightSum),
    ).scale(28.03);
    const surface = mix(vec3(1, 1, 1), mix(vec3(1, 1, 1), plating, 0.34), uMaterialStrength);
    const sampled = decodeSrgb(texture(uTex, vUv).xyz).mul(vTint).mul(surface);
    // Earthshine. In orbit the planet fills a large part of the sky and bounces a lot of blue light
    // onto everything facing it — that fill is the difference between "in space" and "in orbit", and
    // it is why the arena was reading as a deck in a void.
    // Earthshine, arriving from the planet rather than from overhead. Earth sits down and to the
    // left, so surfaces facing that way catch its blue bounce and surfaces facing away do not —
    // which is the difference between "lit by a planet" and "lit by a blue lamp on the ceiling".
    const earthward = normalize(vec3(-0.78, -0.42, -0.46));
    const fill = max(dot(normal, earthward), 0) * 0.62 + max(normal.y, 0) * 0.2;
    const pulse = 0.72 + sin(uTime * 5.2 + vWorld.x * 0.8 - vWorld.z * 0.55) * 0.28;
    const lit = sampled.mul(vec3(0.46, 0.57, 0.74).scale(0.72 + fill))
      .add(sampled.scale(diffuse * 1.15))
      .add(vTint.scale(clamp(vParams.x, 0, 1) * pulse * (0.12 + rim * 0.34)));
    // The six floodlights posted around the rim, in `src/arena-lights.ts`.
    //
    // These are what make the arena read as a place with power rather than as a lit object: the key
    // light and Earth's bounce both arrive from one side and neither belongs to the structure. Their
    // colours alternate cyan and amber, which is the demo's own signal language.
    const floodlit = lit
      .add(arenaFloodlight(vWorld, normal, uLightPosition0, uLightColor0, uLightFalloff0))
      .add(arenaFloodlight(vWorld, normal, uLightPosition1, uLightColor1, uLightFalloff1))
      .add(arenaFloodlight(vWorld, normal, uLightPosition2, uLightColor2, uLightFalloff2))
      .add(arenaFloodlight(vWorld, normal, uLightPosition3, uLightColor3, uLightFalloff3))
      .add(arenaFloodlight(vWorld, normal, uLightPosition4, uLightColor4, uLightFalloff4))
      .add(arenaFloodlight(vWorld, normal, uLightPosition5, uLightColor5, uLightFalloff5));
    const confirmed = mix(floodlit, vec3(1.7, 1.8, 1.9), clamp(vParams.y, 0, 1));
    // One fog range for the arena, matching the sun above: same reason, same guard. 17..34 is the
    // ship shader's original range. The tighter floor ranges faded the ground while ships at the
    // same distance were still crisp, which is what made near and far disagree about depth.
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
    return vec4(mix(confirmed, vec3(0.001887, 0.002936, 0.004748), fog * 0.72), 1);
  },
});
