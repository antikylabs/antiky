import {
  shader,
  sqrt,
  clamp,
  cos,
  dot,
  floor,
  length,
  max,
  min,
  mix,
  mod,
  normalize,
  pow,
  sin,
  smoothstep,
  step,
  targetUv,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
  type Vec4,
} from 'brometal';

/**
 * Cook-Torrance GGX specular, the reference implementation (`point-light-expo`) copied by hand —
 * the same energy-conserving model the other three demos carry, with the Smith visibility and
 * Schlick Fresnel terms BroMetal's distribution-only `specGGX` leaves out. Its arrival is what
 * lets the `min(specGGX, ...)` ceilings below it go: energy is conserved by construction, so
 * there is nothing left to clamp. `pipeline-invariants.test.mjs` holds every copy identical.
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

function waterNormal(x: number, z: number, time: number): Vec3 {
  const dx = cos(x * 0.72 + time * 0.7) * 0.09 +
    cos((x + z) * 1.1 - time * 0.82) * 0.045;
  const dz = cos(z * 0.58 - time * 0.58) * 0.075 +
    cos((x + z) * 1.1 - time * 0.82) * 0.045;
  return normalize(vec3(-dx, 1, -dz));
}

function practicalWaterRadiance(
  world: Vec3,
  normal: Vec3,
  view: Vec3,
  posInvRangeSq: Vec4,
  colorPower: Vec4,
): Vec3 {
  const toLight = posInvRangeSq.xyz.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq * posInvRangeSq.w, 0, 1);
  const attenuation = range * range;
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0) * 0.08;
  const specular = dot(specularGGX(normal, light, view, 0.2, vec3(0.02, 0.02, 0.02)), vec3(1, 1, 1)) * 0.45;
  return colorPower.xyz.scale(colorPower.w * attenuation * (diffuse + specular));
}

/**
 * Opaque canal water for the depth-payload scene target. It cannot refract the
 * scene in-place (sampling the active render target is illegal); instead it uses
 * deterministic low-amplitude waves, Fresnel sky reflection, a bounded GGX sun
 * path, directional shadow receiving and distance atmosphere. No random noise.
 */
export default shader({
  attributes: { aPosition: 'vec3' },
  uniforms: {
    uViewProj: 'mat4',
    uLightViewProj: 'mat4',
    uCamPos: 'vec3',
    uLightDir: 'vec3',
    uSunColor: 'vec3',
    uSunIntensity: 'float',
    uSkyColor: 'vec3',
    uDeepColor: 'vec3',
    uShallowColor: 'vec3',
    uRoughness: 'float',
    uCrestStrength: 'float',
    uPracticalCount: 'float',
    uPracticalStrength: 'float',
    uPracticalPosInvRangeSq0: 'vec4',
    uPracticalColorPower0: 'vec4',
    uPracticalPosInvRangeSq1: 'vec4',
    uPracticalColorPower1: 'vec4',
    uPracticalPosInvRangeSq2: 'vec4',
    uPracticalColorPower2: 'vec4',
    uPracticalPosInvRangeSq3: 'vec4',
    uPracticalColorPower3: 'vec4',
    uFogColor: 'vec3',
    uFogStart: 'float',
    uFogEnd: 'float',
    uFogStrength: 'float',
    uTime: 'float',
    uWaterLevel: 'float',
    uShadowMap: 'sampler2D',
    uShadowTexel: 'vec2',
    uShadowBias: 'float',
    uShadowStrength: 'float',
  },
  varyings: { vWorld: 'vec3', vDepth: 'float', vRipple: 'float' },

  vertex({ aPosition }, { uViewProj, uCamPos, uTime, uWaterLevel }, v) {
    const ripple = sin(aPosition.x * 0.72 + uTime * 0.7) * 0.55 +
      sin(aPosition.z * 0.58 - uTime * 0.58) * 0.3 +
      sin((aPosition.x + aPosition.z) * 1.1 - uTime * 0.82) * 0.15;
    const world = vec3(aPosition.x, uWaterLevel + ripple * 0.026, aPosition.z);
    v.vWorld = world;
    v.vDepth = length(world.sub(uCamPos));
    v.vRipple = ripple;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment(
    {
      uLightViewProj,
      uCamPos,
      uLightDir,
      uSunColor,
      uSunIntensity,
      uSkyColor,
      uDeepColor,
      uShallowColor,
      uRoughness,
      uCrestStrength,
      uPracticalCount,
      uPracticalStrength,
      uPracticalPosInvRangeSq0,
      uPracticalColorPower0,
      uPracticalPosInvRangeSq1,
      uPracticalColorPower1,
      uPracticalPosInvRangeSq2,
      uPracticalColorPower2,
      uPracticalPosInvRangeSq3,
      uPracticalColorPower3,
      uFogColor,
      uFogStart,
      uFogEnd,
      uFogStrength,
      uTime,
      uShadowMap,
      uShadowTexel,
      uShadowBias,
      uShadowStrength,
    },
    { vWorld, vDepth, vRipple },
  ) {
    const normal = waterNormal(vWorld.x, vWorld.z, uTime);
    const view = normalize(uCamPos.sub(vWorld));
    const light = normalize(uLightDir);
    const ndotl = max(dot(normal, light), 0);

    const lightClip = uLightViewProj.mul(vec4(vWorld, 1));
    const shadowUv = targetUv(lightClip);
    const receiverDepth = clamp(lightClip.z / lightClip.w * 0.5 + 0.5, 0, 1);
    const insideShadow = step(0.001, shadowUv.x) * step(shadowUv.x, 0.999) *
      step(0.001, shadowUv.y) * step(shadowUv.y, 0.999) *
      step(0.001, receiverDepth) * step(receiverDepth, 0.999) *
      step(0.001, lightClip.w);
    let occluded = 0;
    for (let i = 0; i < 4; i += 1) {
      // Goal 08 widened the penumbra to match the voxel surface's: four vogel taps over ±2.6
      // texels instead of the half-texel grid. Bias is untouched, so no acne returns.
      const angle = i * 2.399963 + 0.7;
      const ringRadius = sqrt((i + 0.5) / 4) * 2.6;
      const x = cos(angle) * ringRadius;
      const y = sin(angle) * ringRadius;
      const stored = texture(uShadowMap, shadowUv.add(uShadowTexel.mul(vec2(x, y))));
      const nearestDepth = stored.x + stored.y / 255;
      occluded = occluded + step(nearestDepth + uShadowBias, receiverDepth);
    }
    const shadow = 1 - insideShadow * clamp(uShadowStrength, 0, 1) * occluded * 0.25;

    const ndotv = max(dot(normal, view), 0);
    const fresnel = 0.025 + 0.975 * pow(1 - ndotv, 5);
    // Goal 08: real colour travel along the flow. The old 0.18..0.36 band read as one cyan; the
    // striation runs along the canal's own axis on two rates so the surface never slides as one
    // rigid sheet, and the crest of each ripple carries a foam fleck at the banks' scale.
    const striation = sin(vWorld.x * 0.9 - uTime * 0.62 + vWorld.z * 0.35) * 0.5 + 0.5;
    const bodyMix = 0.12 + smoothstep(-0.72, 0.82, vRipple) * 0.34 + striation * 0.22;
    const body = mix(uDeepColor, uShallowColor, clamp(bodyMix, 0, 1));
    const crestFoam = smoothstep(0.78, 1, vRipple) * (0.3 + striation * 0.35);
    let color = mix(body, uSkyColor, fresnel * 0.72);
    color = mix(color, vec3(0.9, 0.95, 0.96), clamp(crestFoam, 0, 1) * 0.6);

    // Water is a dielectric: f0 0.02. Energy-conserving, so the old ceiling is gone with the
    // distribution-only helper it was containing.
    const sunSpecular = dot(
      specularGGX(normal, light, view, clamp(uRoughness, 0.08, 1), vec3(0.02, 0.02, 0.02)),
      vec3(1, 1, 1),
    ) * uSunIntensity * shadow * 3;
    const diffuseGlint = ndotl * shadow * 0.06;
    const crest = smoothstep(0.72, 0.98, vRipple) * clamp(uCrestStrength, 0, 1);
    color = color
      .add(uSunColor.scale(sunSpecular + diffuseGlint))
      .add(uShallowColor.scale(crest * 0.22));

    // The canal catches the same authored lantern bank as the town instead of
    // reading as an unlit blue strip after sunset. Four nearby fixtures are a
    // bounded lighting path; no clustered-light compute dependency.
    let practical = vec3(0, 0, 0);
    if (uPracticalCount > 0.5) practical = practical.add(practicalWaterRadiance(
      vWorld, normal, view, uPracticalPosInvRangeSq0, uPracticalColorPower0,
    ));
    if (uPracticalCount > 1.5) practical = practical.add(practicalWaterRadiance(
      vWorld, normal, view, uPracticalPosInvRangeSq1, uPracticalColorPower1,
    ));
    if (uPracticalCount > 2.5) practical = practical.add(practicalWaterRadiance(
      vWorld, normal, view, uPracticalPosInvRangeSq2, uPracticalColorPower2,
    ));
    if (uPracticalCount > 3.5) practical = practical.add(practicalWaterRadiance(
      vWorld, normal, view, uPracticalPosInvRangeSq3, uPracticalColorPower3,
    ));
    color = color.add(practical.scale(uPracticalStrength));

    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(vec3(max(color.x, 0), max(color.y, 0), max(color.z, 0)), vDepth);
  },
});
