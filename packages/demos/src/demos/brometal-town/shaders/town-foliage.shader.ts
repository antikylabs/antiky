import {
  shader,
  clamp,
  cos,
  discard,
  dot,
  floor,
  fract,
  length,
  max,
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
} from 'brometal';

/**
 * Scene-lit, depth-writing foliage and organic trunk shader.
 *
 * Create one program for crossed cards and a second for trunks. Both programs
 * share the exact attribute/instance interface and deformation uniforms, so
 * the matching shadow caster can consume the same CPU buffers without repack.
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormalWind: 'vec4',
    aUv: 'vec2',
  },
  instanceAttributes: {
    iCenter: 'vec3',
    iShape: 'vec4',
    iUvRect: 'vec4',
    iTint: 'vec3',
    iWindKind: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uLightViewProj: 'mat4',
    uCamPos: 'vec3',
    uLightDir: 'vec3',
    uSunColor: 'vec3',
    uSunIntensity: 'float',
    uSkyColor: 'vec3',
    uSkyIntensity: 'float',
    uGroundColor: 'vec3',
    uGroundIntensity: 'float',
    uAtlas: 'sampler2D',
    uCutoff: 'float',
    uTime: 'float',
    uWindDirection: 'vec2',
    uWindStrength: 'float',
    uWindSpeed: 'float',
    uFogColor: 'vec3',
    uFogStart: 'float',
    uFogEnd: 'float',
    uFogStrength: 'float',
    uShadowMap: 'sampler2D',
    uShadowTexel: 'vec2',
    uShadowBias: 'float',
    uShadowSlopeBias: 'float',
    uShadowStrength: 'float',
  },
  varyings: {
    vUv: 'vec2',
    vLocalUv: 'vec2',
    vTint: 'vec3',
    vKind: 'float',
    vWorld: 'vec3',
    vNormal: 'vec3',
    vRootAo: 'float',
    vDepth: 'float',
  },

  vertex(
    { aPosition, aNormalWind, aUv, iCenter, iShape, iUvRect, iTint, iWindKind },
    { uViewProj, uCamPos, uTime, uWindDirection, uWindStrength, uWindSpeed },
    v,
  ) {
    const aNormal = aNormalWind.xyz;
    const aWindWeight = aNormalWind.w;
    const iWind = iWindKind.xy;
    const iKind = iWindKind.z;
    const width = max(iShape.x, 0.001);
    const height = max(iShape.y, 0.001);
    const cosine = cos(iShape.z);
    const sine = sin(iShape.z);
    const local = vec3(aPosition.x * width, aPosition.y * height, aPosition.z * width);
    const rotated = vec3(
      local.x * cosine - local.z * sine,
      local.y,
      local.x * sine + local.z * cosine,
    );

    const windLength = max(length(uWindDirection), 0.001);
    const windDirection = uWindDirection.scale(1 / windLength);
    const anchorWeight = mix(
      1 - clamp(aWindWeight, 0, 1),
      clamp(aWindWeight, 0, 1),
      clamp(iWind.y, 0, 1),
    );
    const phase = iShape.w * 6.2831853 + iCenter.x * 0.19 + iCenter.z * 0.27;
    const primary = sin(uTime * uWindSpeed + phase + aWindWeight * 0.8);
    const flutter = sin(uTime * uWindSpeed * 2.73 + phase * 1.71) * 0.34;
    const sway = (primary + flutter) * iWind.x * uWindStrength * anchorWeight * anchorWeight;
    const world = iCenter.add(rotated).add(vec3(
      windDirection.x * sway,
      0,
      windDirection.y * sway,
    ));

    const inverseScaledNormal = normalize(vec3(
      aNormal.x / width,
      aNormal.y / height,
      aNormal.z / width,
    ));
    const worldNormal = normalize(vec3(
      inverseScaledNormal.x * cosine - inverseScaledNormal.z * sine,
      inverseScaledNormal.y,
      inverseScaledNormal.x * sine + inverseScaledNormal.z * cosine,
    ));

    v.vUv = iUvRect.xy.add(aUv.mul(vec2(iUvRect.z, iUvRect.w)));
    v.vLocalUv = aUv;
    v.vTint = iTint;
    v.vKind = iKind;
    v.vWorld = world;
    v.vNormal = worldNormal;
    v.vRootAo = mix(0.72, 1, clamp(aWindWeight, 0, 1));
    v.vDepth = length(world.sub(uCamPos));
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
      uSkyIntensity,
      uGroundColor,
      uGroundIntensity,
      uAtlas,
      uCutoff,
      uFogColor,
      uFogStart,
      uFogEnd,
      uFogStrength,
      uShadowMap,
      uShadowTexel,
      uShadowBias,
      uShadowSlopeBias,
      uShadowStrength,
    },
    { vUv, vLocalUv, vTint, vKind, vWorld, vNormal, vRootAo, vDepth },
  ) {
    // WebGPU requires implicit-derivative texture sampling to execute in
    // uniform control flow. Sample for both cards and trunks, then select.
    const atlasSample = texture(uAtlas, vUv);
    let baseColor = vTint;
    if (vKind < 0.5) {
      if (atlasSample.w < uCutoff) discard();
      baseColor = atlasSample.xyz.mul(vTint);
    } else {
      // A directional, multi-frequency bark response gives the tapered mesh
      // organic grain without baking light into its base color.
      const longGrain = sin(vLocalUv.x * 43 + sin(vLocalUv.y * 17) * 2.2);
      const fineGrain = sin(vLocalUv.x * 97 + vLocalUv.y * 31) * 0.35;
      const ringBreak = smoothstep(0.78, 0.96, fract(vLocalUv.y * 11 + longGrain * 0.08));
      const barkValue = clamp(0.78 + longGrain * 0.105 + fineGrain * 0.06 - ringBreak * 0.16, 0.52, 1.08);
      baseColor = vTint.scale(barkValue);
    }

    const normal = normalize(vNormal);
    const light = normalize(uLightDir);
    const view = normalize(uCamPos.sub(vWorld));
    const baseNdotL = max(dot(normal, light), 0);

    const lightClip = uLightViewProj.mul(vec4(vWorld, 1));
    const shadowUv = targetUv(lightClip);
    const receiverDepth = clamp(lightClip.z / lightClip.w * 0.5 + 0.5, 0, 1);
    const insideShadow = step(0.001, shadowUv.x) * step(shadowUv.x, 0.999) *
      step(0.001, shadowUv.y) * step(shadowUv.y, 0.999) *
      step(0.001, receiverDepth) * step(receiverDepth, 0.999) *
      step(0.001, lightClip.w);
    const slope = 1 - baseNdotL;
    const depthBias = uShadowBias + uShadowSlopeBias * slope * slope;
    let occluded = 0;
    for (let i = 0; i < 9; i += 1) {
      const x = mod(i, 3) - 1;
      const y = floor(i / 3) - 1;
      const stored = texture(uShadowMap, shadowUv.add(uShadowTexel.mul(vec2(x, y))));
      const nearestDepth = stored.x + stored.y / 255;
      occluded = occluded + step(nearestDepth + depthBias, receiverDepth);
    }
    const shadow = 1 - insideShadow * clamp(uShadowStrength, 0, 1) * occluded / 9;

    const sky = uSkyColor.scale(uSkyIntensity * (0.58 + max(normal.y, 0) * 0.42));
    const ground = uGroundColor.scale(uGroundIntensity * (0.3 + max(-normal.y, 0) * 0.7));
    const wrappedDiffuse = 0.16 + baseNdotL * 0.84;
    const direct = uSunColor.scale(uSunIntensity * wrappedDiffuse * shadow);
    const cardWeight = 1 - clamp(vKind, 0, 1);
    const transmission = max(0 - dot(normal, light), 0) * cardWeight;
    const transmitted = uSunColor.scale(uSunIntensity * transmission * 0.22 * shadow);

    const halfVector = normalize(light.add(view));
    const specular = pow(max(dot(normal, halfVector), 0), mix(18, 8, clamp(vKind, 0, 1)));
    let color = baseColor.mul(sky.add(ground).add(direct).add(transmitted)).scale(vRootAo);
    color = color.add(uSunColor.scale(specular * mix(0.06, 0.025, clamp(vKind, 0, 1)) * shadow));

    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(vec3(max(color.x, 0), max(color.y, 0), max(color.z, 0)), vDepth);
  },
});
