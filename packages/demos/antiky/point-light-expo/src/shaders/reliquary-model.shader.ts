import {
  step,
  pow,
  abs,
  clamp,
  cos,
  dot,
  length,
  max,
  mix,
  normalize,
  sqrt,
  sign,
  sin,
  shader,
  smoothstep,
  texture,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { shadowFactor } from 'brometal/shader-functions';

function rotateModel(value: Vec3, rotation: Vec3): Vec3 {
  const cosZ = cos(rotation.z);
  const sinZ = sin(rotation.z);
  const aroundZ = vec3(
    value.x * cosZ - value.y * sinZ,
    value.x * sinZ + value.y * cosZ,
    value.z,
  );
  const cosX = cos(rotation.x);
  const sinX = sin(rotation.x);
  const aroundX = vec3(
    aroundZ.x,
    aroundZ.y * cosX - aroundZ.z * sinX,
    aroundZ.y * sinX + aroundZ.z * cosX,
  );
  const cosY = cos(rotation.y);
  const sinY = sin(rotation.y);
  return vec3(
    aroundX.x * cosY - aroundX.z * sinY,
    aroundX.y,
    aroundX.x * sinY + aroundX.z * cosY,
  );
}

/**
 * Cook-Torrance GGX specular: the light that leaves this surface toward the viewer.
 *
 * BroMetal's `specGGX` is the distribution term on its own — no Fresnel, no geometry term, and a
 * hard-coded `0.25` sitting where `1 / (4 · N·L · N·V)` belongs. Nothing bounds it, so every call
 * site in this demo used to wrap it in `min(…, 1.5)` or `min(…, 2.4)` and scale the result down by
 * 0.12 to keep highlights off the ceiling. Those numbers were not tuning, they were a workaround.
 *
 * The three terms that make the ceilings unnecessary:
 *
 * - **Distribution** (GGX / Trowbridge-Reitz) — how tightly the microfacets line up with the
 *   halfway vector, which is how wide the highlight is. This is the only part `specGGX` had.
 * - **Visibility** — height-correlated Smith, which is the geometry term already divided by
 *   `4 · N·L · N·V`. This is the real denominator the `0.25` stood in for, and it is what makes a
 *   grazing highlight fall off rather than run away.
 * - **Fresnel** (Schlick) — how reflective the surface is at this angle. `f0` is its reflectance
 *   head-on: 0.04 for dielectrics, the albedo itself for metals. This is the term that makes brass
 *   and stone stop looking like the same material.
 *
 * Energy is conserved by construction, so there is nothing left to clamp. `tests/specular.test.ts`
 * integrates this over the hemisphere and finds it never returns more light than arrives.
 *
 * Declared in every shader that needs it rather than imported, for the same reason `decodeSrgb` is:
 * the BroMetal MVP resolves only module-level helpers declared above their first use, and an
 * imported one fails to compile. `pipeline-invariants.test.mjs` asserts every copy is identical.
 */
function specularGGX(normal: Vec3, light: Vec3, view: Vec3, roughness: number, f0: Vec3): Vec3 {
  const halfway = normalize(light.add(view));
  const nDotL = max(dot(normal, light), 0);
  // Floored rather than clamped to zero. Both of these end up in a denominator, and a surface
  // exactly edge-on to the viewer should be an unlit pixel, not a division by zero.
  const nDotV = max(dot(normal, view), 0.0001);
  const nDotH = max(dot(normal, halfway), 0);
  const vDotH = max(dot(view, halfway), 0);
  const alpha = roughness * roughness;
  const alphaSq = alpha * alpha;
  const distributionDenominator = nDotH * nDotH * (alphaSq - 1) + 1;
  const distribution = alphaSq / (3.14159265 * distributionDenominator * distributionDenominator);
  const occlusionTowardView = nDotL * sqrt(nDotV * nDotV * (1 - alphaSq) + alphaSq);
  const occlusionTowardLight = nDotV * sqrt(nDotL * nDotL * (1 - alphaSq) + alphaSq);
  const visibility = 0.5 / max(occlusionTowardView + occlusionTowardLight, 0.0001);
  // (1 - V·H)^5 as five multiplies rather than a `pow`: cheaper, and exact at both endpoints.
  const grazing = 1 - vDotH;
  const grazingSq = grazing * grazing;
  const fresnelWeight = grazingSq * grazingSq * grazing;
  const fresnel = f0.add(vec3(1, 1, 1).sub(f0).scale(fresnelWeight));
  return fresnel.scale(distribution * visibility * nDotL);
}

function pointRadiance(
  world: Vec3,
  normal: Vec3,
  view: Vec3,
  lightPosition: Vec3,
  lightColor: Vec3,
  lightPower: number,
  lightRadius: number,
  roughness: number,
  albedo: Vec3,
): Vec3 {
  const toLight = lightPosition.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq / (lightRadius * lightRadius), 0, 1);
  // Item 11's falloff, agreed with the floor shader's copy: inverse-square with a windowed radius
  // and a floored divisor, so the core clips instead of the profile plateauing.
  const attenuation = range * range / (0.4 + distanceSq * 0.28);
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  // Dielectric, same as the floor beneath it: 0.04 is a non-metal's head-on reflectance.
  const specular = specularGGX(normal, light, view, roughness, vec3(0.04, 0.04, 0.04));
  const arriving = lightColor.scale(lightPower * attenuation);
  // Albedo tints the diffuse and not the specular. A highlight is the colour of the light; how
  // reflective the surface is at this angle is `f0`'s job. Summing the two and tinting both, which
  // is what the caller used to do, gave every highlight the surface's own colour.
  return arriving.mul(albedo.scale(diffuse).add(specular));
}

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
    iScale: 'float',
    iRotation: 'vec3',
    iTint: 'vec3',
    iMaterial: 'vec2',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
    uDiffuse: 'sampler2D',
    uArm: 'sampler2D',
    uNormalMap: 'sampler2D',
    uNormalStrength: 'float',
    uMaterialLayout: 'float',
    uSh0: 'vec3',
    uSh1: 'vec3',
    uSh2: 'vec3',
    uSh3: 'vec3',
    uSh4: 'vec3',
    uSh5: 'vec3',
    uSh6: 'vec3',
    uSh7: 'vec3',
    uSh8: 'vec3',
    uAmbientStrength: 'float',
    uRelayLightStrength: 'float',
    uSunDirection: 'vec3',
    uSunColor: 'vec3',
    uShadowMap: 'sampler2D',
    uLightViewProj: 'mat4',
    uLightPosition: 'vec3',
    uShadowRange: 'float',
    uFogColor: 'vec3',
    uFogStart: 'float',
    uFogEnd: 'float',
    uFogMaximumMix: 'float',
    uEmberPosition: 'vec3',
    uEmberColor: 'vec3',
    uEmberPower: 'float',
    uEmberRadius: 'float',
    uIonPosition: 'vec3',
    uIonColor: 'vec3',
    uIonPower: 'float',
    uIonRadius: 'float',
    uVioletPosition: 'vec3',
    uVioletColor: 'vec3',
    uVioletPower: 'float',
    uVioletRadius: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    // Object space, so the triplanar projection does not swim when a prop is rotated per instance.
    vObject: 'vec3',
    vObjectNormal: 'vec3',
    vRotation: 'vec3',
    vUv: 'vec2',
    vTint: 'vec3',
    vMaterial: 'vec2',
  },

  vertex({ aPosition, aNormal, aUv, iOffset, iScale, iRotation, iTint, iMaterial }, {
    uViewProj,
  }, v) {
    const world = rotateModel(aPosition.scale(iScale), iRotation).add(iOffset);
    v.vWorld = world;
    v.vNormal = normalize(rotateModel(aNormal, iRotation));
    v.vObject = aPosition.scale(iScale);
    v.vObjectNormal = normalize(aNormal);
    v.vRotation = iRotation;
    v.vUv = aUv;
    v.vTint = iTint;
    v.vMaterial = iMaterial;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({
    uCameraPosition,
    uTime,
    uDiffuse,
    uArm,
    uMaterialLayout,
    uNormalMap,
    uNormalStrength,
    uSh0,
    uSh1,
    uSh2,
    uSh3,
    uSh4,
    uSh5,
    uSh6,
    uSh7,
    uSh8,
    uAmbientStrength,
    uRelayLightStrength,
    uSunDirection,
    uSunColor,
    uShadowMap,
    uLightViewProj,
    uLightPosition,
    uShadowRange,
    uFogColor,
    uFogStart,
    uFogEnd,
    uFogMaximumMix,
    uEmberPosition,
    uEmberColor,
    uEmberPower,
    uEmberRadius,
    uIonPosition,
    uIonColor,
    uIonPower,
    uIonRadius,
    uVioletPosition,
    uVioletColor,
    uVioletPower,
    uVioletRadius,
  }, { vWorld, vNormal, vObject, vObjectNormal, vRotation, vUv, vTint, vMaterial }) {
    const geometricNormal = normalize(vNormal);
    const view = normalize(uCameraPosition.sub(vWorld));
    // Triplanar normal mapping. These meshes ship no TANGENT and BroMetal's DSL has no dpdx/dpdy or
    // fwidth, so a tangent basis is not available by either route. Triplanar needs none: it derives
    // its coordinates from position and normal.
    //
    // Projected in OBJECT space and rotated into world afterwards. World-space projection would make
    // the texture swim across a prop whenever that prop is placed at a different yaw, because the
    // geometry would slide through a fixed projection.
    //
    // Every texture() call is inlined here rather than wrapped in a helper: a texture() inside a DSL
    // helper compiles to textureSampleLevel(..., 0.0) and silently loses mips.
    // Measured, not guessed: 0.55, 1.6, 4.0 and 9.0 were captured and compared against the same
    // frame with normal mapping off. Local luminance standard deviation on the lit rock rose 1.46x,
    // 1.40x, 1.39x and 1.37x respectively, so the response is nearly flat in scale and 0.55 is the
    // best of them. The frame-to-frame noise floor is 0.000, so all of that is signal.
    const triplanarScale = 0.55;
    const projection = vObject.scale(triplanarScale);
    // `abs` here is scalar-only, so the blend weights are taken per component.
    const axisX = abs(vObjectNormal.x);
    const axisY = abs(vObjectNormal.y);
    const axisZ = abs(vObjectNormal.z);
    const weightSum = max(axisX + axisY + axisZ, 0.0001);
    const weightX = axisX / weightSum;
    const weightY = axisY / weightSum;
    const weightZ = axisZ / weightSum;

    const tangentX = texture(uNormalMap, projection.yz).xyz.scale(2).sub(vec3(1, 1, 1));
    const tangentY = texture(uNormalMap, projection.xz).xyz.scale(2).sub(vec3(1, 1, 1));
    const tangentZ = texture(uNormalMap, projection.xy).xyz.scale(2).sub(vec3(1, 1, 1));

    // Each plane's tangent normal is reoriented so its z lies along that plane's axis. Vec3 exposes
    // only .xy/.xz/.yz, so the reoriented vectors are built with explicit constructors.
    const planeX = vec3(tangentX.z * sign(vObjectNormal.x), tangentX.x, tangentX.y);
    const planeY = vec3(tangentY.x, tangentY.z * sign(vObjectNormal.y), tangentY.y);
    const planeZ = vec3(tangentZ.x, tangentZ.y, tangentZ.z * sign(vObjectNormal.z));

    const objectPerturbed = normalize(
      planeX.scale(weightX).add(planeY.scale(weightY)).add(planeZ.scale(weightZ)),
    );
    const worldPerturbed = normalize(rotateModel(objectPerturbed, vRotation));
    const normal = normalize(mix(geometricNormal, worldPerturbed, clamp(uNormalStrength, 0, 1)));

    const materialMap = texture(uArm, vUv).xyz;
    const roughness = clamp(mix(materialMap.y, materialMap.x, uMaterialLayout) + vMaterial.x, 0.18, 1);
    // `rock-moss` (layout 1) gets no occlusion, and that is a gap rather than a choice: its
    // `catalog_material` image is one greyscale channel replicated across RGB, which is roughness
    // with no occlusion anywhere in it. Reading `materialMap.x` for it would read roughness as
    // occlusion. `packages/demos/scripts/bake-vertex-occlusion.mjs` exists to fill this and is
    // tested, but wiring it in blanked the scene and the rock measured only 3.9% occluded at p10 —
    // it is a set of convex boulders with very little to occlude. See goal 99 row A13.
    const occlusion = mix(0.58 + materialMap.x * 0.42, 1, uMaterialLayout);
    // Albedo is the decoded texture and the instance tint, and nothing else.
    //
    // A grey wash, a lift and a saturation control used to sit between them. All three existed to
    // fight a scene that was lit in display space, and with the encode in place there is nothing
    // left for them to fight. Deleted rather than re-tuned: a knob that compensates for a bug
    // outlives the bug and then nobody can tell which is which.
    const base = clamp(decodeSrgb(texture(uDiffuse, vUv).xyz), 0, 1).mul(vTint);
    const relay = pointRadiance(
      vWorld, normal, view, uEmberPosition, uEmberColor, uEmberPower, uEmberRadius, roughness, base,
    ).add(pointRadiance(
      vWorld, normal, view, uIonPosition, uIonColor, uIonPower, uIonRadius, roughness, base,
    )).add(pointRadiance(
      vWorld, normal, view, uVioletPosition, uVioletColor, uVioletPower, uVioletRadius, roughness, base,
    )).scale(uRelayLightStrength);
    // Ambient that knows which way the surface faces.
    //
    // This replaced a flat colour with a crude up-facing fudge bolted on. The nine coefficients come
    // from a real sky, baked offline by `packages/demos/scripts/bake-sh9-irradiance.mjs`: nine
    // multiply-adds, no texture fetch, and a genuine sky-to-ground hue shift rather than a scalar
    // lean toward brighter-if-upward.
    //
    // The bake decides direction; the demo's existing exposure still decides level. See
    // `src/ambient.ts` for why those two are deliberately kept apart.
    const shIrradiance = uSh0
      .add(uSh1.scale(normal.y))
      .add(uSh2.scale(normal.z))
      .add(uSh3.scale(normal.x))
      .add(uSh4.scale(normal.x * normal.y))
      .add(uSh5.scale(normal.y * normal.z))
      .add(uSh6.scale(3 * normal.z * normal.z - 1))
      .add(uSh7.scale(normal.x * normal.z))
      .add(uSh8.scale(normal.x * normal.x - normal.y * normal.y));
    const ambient = shIrradiance.scale(uAmbientStrength);
    // Always-on rim.
    //
    // A surface turning away from the camera catches light from everything behind it, and without
    // that term every object in the frame ends at a hard edge against whatever is behind it. It is
    // the cheapest thing that separates a subject from its background, which is what AC-L6 measures
    // when it asks for a silhouette band brighter than the interior.
    //
    // Hand-rolled rather than calling BroMetal's `fresnel()`. The helper takes its power as a
    // parameter and compiles the sample-free maths inline anyway, so the only difference is that
    // this spelling matches the twelve other places in this repository that already do it.
    const rim = pow(1 - max(dot(normal, view), 0), 2.4);
    // The sun, and the only shadow in this demo.
    //
    // Softness, bias and the shadow texel are literals rather than uniforms, in the same spirit as
    // the triplanar detail rate: nothing varies them at run time, and a uniform would mean binding
    // plumbing at every call site for a number that never moves. All three are agreed across the
    // three material shaders, and `pipeline-invariants.test.mjs` holds them equal.
    //
    // 2.5 spreads the nine taps over five shadow texels, about 5 cm here — a visible penumbra that
    // still lets a rock meet its own shadow. The bias is in world units and has to clear both the
    // depth quantum (0.016) and one texel's world footprint (0.010); below that a surface shadows
    // itself in stripes, and far above it the shadow walks away from its caster.
    //
    // 0.00048828125 is 1 / 2048, which is `SHADOW_MAP_SIZE` in `src/sun.ts`. `sun.test.ts` asserts
    // the two agree, because a texel size that does not match the map silently resizes the penumbra.
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
    const sunDiffuse = max(dot(normal, uSunDirection), 0);
    const sunSpecular = specularGGX(normal, uSunDirection, view, roughness, vec3(0.04, 0.04, 0.04));
    // Albedo tints the diffuse, `f0` tints the specular — the same split the relay lights use.
    const sunRadiance = uSunColor
      .scale(sunVisibility)
      .mul(base.scale(sunDiffuse).add(sunSpecular));
    // Occlusion multiplies the ambient term and nothing else.
    //
    // It used to scale the whole sum, which meant a crevice was darkened once for receiving less
    // sky and again for receiving less sun — and the sun does not care what the sky can see. That
    // is the classic ambient-occlusion mistake, and its signature is exactly what this demo had:
    // shadowed areas that go flat and grey instead of dark and shaped.
    //
    // The rim term keeps its occlusion because it is ambient: `uSh0` is the sky's average over the
    // whole sphere, which is what a surface turning away from the camera is catching.
    const lit = base.mul(ambient.scale(occlusion)).add(relay).add(sunRadiance)
      // Band 0 is the sky's average over the whole sphere, which is exactly what a surface
      // turning away from the camera is catching.
      .add(uSh0.scale(rim * 0.22 * occlusion));
    // A steady emissive, no sine.
    //
    // The pulse was self-illumination standing in for a glow: with no bloom in the frame, a light
    // source had nothing to bleed onto and was made to breathe instead so it read as one. Bloom
    // arrived in 06-06 and does that job properly, so the fake is gone and the emission that stays
    // is the amount the instance actually declares.
    const emissive = base.scale(vMaterial.y);
    const fog = smoothstep(uFogStart, uFogEnd, length(uCameraPosition.sub(vWorld)));
    // Linear HDR, and nothing else. Exposure, the tone-map and the encode all happen once in
    // `post.shader.ts`; this shader's job ends at "how much light leaves this surface".
    return vec4(mix(
      lit.add(emissive),
      uFogColor,
      fog * uFogMaximumMix,
    ), 1);
  },
});
