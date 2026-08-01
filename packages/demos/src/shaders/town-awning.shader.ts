import {
  shader,
  abs,
  clamp,
  cos,
  dot,
  floor,
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
 * Instanced, physically bent market cloth. The normalized source sheet is
 * subdivided on the CPU; pitch, sag and two-frequency wind happen here so the
 * silhouette, lighting normal and shadow caster all move together.
 */
export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2' },
  instanceAttributes: {
    iCenter: 'vec3',
    iSize: 'vec2',
    iYaw: 'float',
    iSlope: 'float',
    iStyle: 'float',
    iPhase: 'float',
  },
  uniforms: {
    uViewProj: 'mat4',
    uLightViewProj: 'mat4',
    uCamPos: 'vec3',
    uTime: 'float',
    uMaterialAtlas: 'sampler2D',
    uMaterialAtlasTexel: 'vec2',
    uLightDir: 'vec3',
    uSunColor: 'vec3',
    uSunIntensity: 'float',
    uSkyColor: 'vec3',
    uSkyIntensity: 'float',
    uGroundColor: 'vec3',
    uGroundIntensity: 'float',
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
    vWorld: 'vec3',
    vNormal: 'vec3',
    vStyle: 'float',
    vSide: 'float',
    vDepth: 'float',
  },

  vertex(
    { aPosition, aUv, iCenter, iSize, iYaw, iSlope, iStyle, iPhase },
    { uViewProj, uCamPos, uTime },
    v,
  ) {
    const phaseA = uTime * 1.35 + iPhase * 6.28318 + aUv.x * 5.4 + aUv.y * 2.1;
    const phaseB = uTime * 0.83 + iPhase * 10.6814 - aUv.x * 3.2 + aUv.y * 4.6;
    const waveA = sin(phaseA);
    const waveB = sin(phaseB);
    const freeEdge = 0.35 + smoothstep(0.12, 1, aUv.y) * 0.65;
    const wind = (waveA * 0.7 + waveB * 0.3) * 0.026 * freeEdge;
    const sagAmplitude = 0.03 + iSize.y * 0.012;
    const sagX = sin(aUv.x * 3.14159);
    const sagZ = sin(aUv.y * 3.14159);
    const localX = aPosition.x * iSize.x;
    const localZ = aPosition.z * iSize.y;
    const localY = -aPosition.z * iSlope * iSize.y - sagX * sagZ * sagAmplitude + wind;

    const safeWidth = max(iSize.x, 0.01);
    const safeDepth = max(iSize.y, 0.01);
    const dyDx = -cos(aUv.x * 3.14159) * 3.14159 / safeWidth * sagZ * sagAmplitude +
      (cos(phaseA) * 5.4 * 0.7 - cos(phaseB) * 3.2 * 0.3) / safeWidth *
      0.026 * freeEdge;
    const dyDz = -iSlope - sagX * cos(aUv.y * 3.14159) * 3.14159 /
      safeDepth * sagAmplitude +
      (cos(phaseA) * 2.1 * 0.7 + cos(phaseB) * 4.6 * 0.3) / safeDepth *
      0.026 * freeEdge;
    const localNormal = normalize(vec3(-dyDx, 1, -dyDz));
    const yawCos = cos(iYaw);
    const yawSin = sin(iYaw);
    const rotated = vec3(
      yawCos * localX + yawSin * localZ,
      localY,
      -yawSin * localX + yawCos * localZ,
    );
    const upperNormal = normalize(vec3(
      yawCos * localNormal.x + yawSin * localNormal.z,
      localNormal.y,
      -yawSin * localNormal.x + yawCos * localNormal.z,
    ));
    const side = aPosition.y;
    const surfaceNormal = upperNormal.scale(side);
    const world = iCenter.add(rotated).add(surfaceNormal.scale(0.008));
    v.vUv = aUv;
    v.vWorld = world;
    v.vNormal = surfaceNormal;
    v.vStyle = iStyle;
    v.vSide = side;
    v.vDepth = length(world.sub(uCamPos));
    return uViewProj.mul(vec4(world, 1));
  },

  fragment(
    {
      uLightViewProj,
      uCamPos,
      uMaterialAtlas,
      uMaterialAtlasTexel,
      uLightDir,
      uSunColor,
      uSunIntensity,
      uSkyColor,
      uSkyIntensity,
      uGroundColor,
      uGroundIntensity,
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
    { vUv, vWorld, vNormal, vStyle, vSide, vDepth },
  ) {
    const localInset = vec2(uMaterialAtlasTexel.x * 4, uMaterialAtlasTexel.y * 3);
    const clothUv = mix(localInset, vec2(1, 1).sub(localInset), vUv);
    // Tile eight is the bottom-left red/cream market cloth.
    const atlasUv = vec2(clothUv.x / 4, clothUv.y / 3);
    const clothSample = texture(uMaterialAtlas, atlasUv).xyz;
    const sampleLuma = max(dot(clothSample, vec3(0.299, 0.587, 0.114)), 0.04);
    const stripe = smoothstep(0.045, 0.19, clothSample.x - max(clothSample.y, clothSample.z));
    let stripeColor = vec3(0.58, 0.15, 0.09);
    stripeColor = mix(stripeColor, vec3(0.12, 0.27, 0.5), step(0.5, vStyle));
    stripeColor = mix(stripeColor, vec3(0.6, 0.37, 0.09), step(1.5, vStyle));
    const cream = vec3(0.74, 0.65, 0.49);
    const expectedLuma = mix(0.66, 0.32, stripe);
    const weaveValue = clamp(sampleLuma / expectedLuma, 0.7, 1.32);
    let albedo = mix(cream, stripeColor, stripe).scale(weaveValue);
    const front = step(0, vSide);
    albedo = mix(albedo.mul(vec3(0.5, 0.43, 0.36)), albedo, front);

    const normal = normalize(vNormal);
    const light = normalize(uLightDir);
    const view = normalize(uCamPos.sub(vWorld));
    const ndotl = max(dot(normal, light), 0);
    const lightClip = uLightViewProj.mul(vec4(vWorld, 1));
    const shadowUv = targetUv(lightClip);
    const receiverDepth = clamp(lightClip.z / lightClip.w * 0.5 + 0.5, 0, 1);
    const insideShadow = step(0.001, shadowUv.x) * step(shadowUv.x, 0.999) *
      step(0.001, shadowUv.y) * step(shadowUv.y, 0.999) *
      step(0.001, receiverDepth) * step(receiverDepth, 0.999) *
      step(0.001, lightClip.w);
    const slope = 1 - ndotl;
    const depthBias = uShadowBias + uShadowSlopeBias * slope * slope;
    let occluded = 0;
    for (let i = 0; i < 4; i += 1) {
      const x = mod(i, 2) - 0.5;
      const y = floor(i / 2) - 0.5;
      const stored = texture(uShadowMap, shadowUv.add(uShadowTexel.mul(vec2(x, y))));
      const nearestDepth = stored.x + stored.y / 255;
      occluded = occluded + step(nearestDepth + depthBias, receiverDepth);
    }
    const shadow = 1 - insideShadow * clamp(uShadowStrength, 0, 1) * occluded * 0.25;

    const up = normal.y * 0.5 + 0.5;
    const indirect = uSkyColor.scale(uSkyIntensity * (0.34 + up * 0.66))
      .add(uGroundColor.scale(uGroundIntensity * (0.28 + (1 - up) * 0.72)))
      .add(vec3(0.04, 0.052, 0.078));
    const warmKey = mix(vec3(1, 0.94, 0.84), uSunColor, 0.46);
    const direct = warmKey.scale(uSunIntensity * 0.5 * ndotl * shadow * shadow);
    const transmission = pow(max(dot(normal.scale(-1), light), 0), 2) * shadow * 0.07;
    let color = albedo.mul(indirect.add(direct))
      .add(albedo.mul(warmKey).scale(transmission));
    const clothEdge = pow(1 - abs(dot(normal, view)), 3) * 0.025;
    color = color.add(uSkyColor.scale(clothEdge));
    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(max(color, vec3(0, 0, 0)), vDepth);
  },
});
