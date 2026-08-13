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
  sin,
  shader,
  smoothstep,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { shadowFactor } from 'brometal/shader-functions';
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

function materialPresentationPointRadiance(
  world: Vec3,
  normal: Vec3,
  view: Vec3,
  lightPosition: Vec3,
  lightColor: Vec3,
  lightPower: number,
  lightRadius: number,
  roughness: number,
  metalness: number,
  albedo: Vec3,
): Vec3 {
  const toLight = lightPosition.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq / (lightRadius * lightRadius), 0, 1);
  const attenuation = range * range;
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  // A metal reflects its own colour and has no diffuse; a dielectric reflects 0.04 white and keeps
  // all of its diffuse. Blending both ends by metalness is what separates the brass from the stone,
  // and it replaces a `0.16 + metalness * 0.84` scale that stood in for the same idea by feel.
  const f0 = mix(vec3(0.04, 0.04, 0.04), albedo, metalness);
  const specular = specularGGX(normal, light, view, roughness, f0);
  const arriving = lightColor.scale(lightPower * attenuation);
  // Albedo tints the diffuse and not the specular, and a metal has no diffuse at all — its colour
  // reaches the eye through `f0` instead. That is the whole difference between brass and stone.
  const diffuseEnergy = diffuse * (1 - metalness);
  return arriving.mul(albedo.scale(diffuseEnergy).add(specular));
}

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iBaseColor: 'vec3',
    iMaterial: 'vec3',
    iYaw: 'float',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
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
    uDetailNormal: 'sampler2D',
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
    vBaseColor: 'vec3',
    vMaterial: 'vec3',
  },

  vertex(
    { aPosition, aNormal, iOffset, iScale, iBaseColor, iMaterial, iYaw },
    { uViewProj },
    v,
  ) {
    const local = aPosition.mul(iScale);
    const yawCos = cos(iYaw);
    const yawSin = sin(iYaw);
    const rotated = vec3(
      local.x * yawCos - local.z * yawSin,
      local.y,
      local.x * yawSin + local.z * yawCos,
    );
    const world = rotated.add(iOffset);
    const inverseScaledNormal = normalize(vec3(
      aNormal.x / max(iScale.x, 0.001),
      aNormal.y / max(iScale.y, 0.001),
      aNormal.z / max(iScale.z, 0.001),
    ));
    const rotatedNormal = vec3(
      inverseScaledNormal.x * yawCos - inverseScaledNormal.z * yawSin,
      inverseScaledNormal.y,
      inverseScaledNormal.x * yawSin + inverseScaledNormal.z * yawCos,
    );
    v.vWorld = world;
    v.vNormal = normalize(rotatedNormal);
    v.vBaseColor = iBaseColor;
    v.vMaterial = iMaterial;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({
    uCameraPosition,
    uTime,
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
    uDetailNormal,
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
  }, { vWorld, vNormal, vBaseColor, vMaterial }) {
const baseNormal = normalize(vNormal);
    // Triplanar detail normal, written out here rather than called through a helper.
    //
    // A `texture()` call inside a DSL helper compiles to `textureSampleLevel(..., 0.0)`, pinning the
    // sample to the base mip. On a texture tiled this often that reads as crawling static the moment
    // the camera moves. Inlining the sample in the fragment body is what keeps the mip chain.
    //
    // These are the reliquary's props - forms, creatures, orbs and rings - drawn as untextured
    // instanced primitives tinted per instance. Cones and spheres with no surface variation at all
    // are the clearest case in the demo for projected tooth.
    //
    // Rate and strength are local consts rather than uniforms. Nothing varies them at run time, and
    // a uniform would mean binding plumbing at every call site for a number that never moves.
    const detailRate = 0.55;
    const detailStrength = 0.6;
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
    const roughness = clamp(vMaterial.x, 0.08, 1);
    const metalness = clamp(vMaterial.y, 0, 1);
    const ember = materialPresentationPointRadiance(
      vWorld,
      normal,
      view,
      uEmberPosition,
      uEmberColor,
      uEmberPower,
      uEmberRadius,
      roughness,
      metalness,
      vBaseColor,
    );
    const ion = materialPresentationPointRadiance(
      vWorld,
      normal,
      view,
      uIonPosition,
      uIonColor,
      uIonPower,
      uIonRadius,
      roughness,
      metalness,
      vBaseColor,
    );
    const violet = materialPresentationPointRadiance(
      vWorld,
      normal,
      view,
      uVioletPosition,
      uVioletColor,
      uVioletPower,
      uVioletRadius,
      roughness,
      metalness,
      vBaseColor,
    );
    const radiance = ember.add(ion).add(violet).scale(uRelayLightStrength);
    const hemisphere = 0.78 + normal.y * 0.2;
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
    // `radiance` already carries the specular, Fresnel-tinted by albedo for metal and left white
    // for dielectric, so the `+ radiance * metalness * 0.2` that used to fake a metal highlight
    // here has nothing left to do. Albedo still tints the diffuse and the ambient.
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
    const sunSpecular = specularGGX(normal, uSunDirection, view, roughness, mix(vec3(0.04, 0.04, 0.04), vBaseColor, metalness));
    // Albedo tints the diffuse, `f0` tints the specular — the same split the relay lights use.
    const sunRadiance = uSunColor
      .scale(sunVisibility)
      .mul(vBaseColor.scale(sunDiffuse).add(sunSpecular));
    const lit = vBaseColor.mul(ambient).add(radiance).add(sunRadiance);
    const pulse = 0.92 + sin(uTime * 2.4 + vWorld.x * 0.5) * 0.08;
    const emissive = vBaseColor.scale(vMaterial.z * pulse);
    const fog = smoothstep(uFogStart, uFogEnd, length(uCameraPosition.sub(vWorld)));
    const color = mix(
      lit.add(emissive),
      uFogColor,
      fog * uFogMaximumMix,
    );
    // Linear HDR. See `post.shader.ts` for where this becomes an image.
    return vec4(color, 1);
  },
});
