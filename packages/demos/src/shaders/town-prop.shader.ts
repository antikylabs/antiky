import {
  shader,
  clamp,
  cos,
  discard,
  dot,
  floor,
  length,
  max,
  min,
  mix,
  mod,
  normalize,
  sin,
  smoothstep,
  step,
  targetUv,
  texture,
  vec2,
  vec3,
  vec4,
} from 'brometal';
import { specGGX } from 'brometal/shader-functions';

/**
 * Alpha-tested, genuinely curved 2.5D town props. Front and back surfaces have
 * independent normals and physical separation; the back is warm dark board,
 * never a mirrored copy of the illustration.
 */
export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2' },
  instanceAttributes: {
    iCenter: 'vec3',
    iSize: 'vec2',
    iUvRect: 'vec4',
    iYaw: 'float',
    iCurvature: 'float',
    iTile: 'float',
  },
  uniforms: {
    uViewProj: 'mat4',
    uLightViewProj: 'mat4',
    uCamPos: 'vec3',
    uAtlas: 'sampler2D',
    uCutoff: 'float',
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
    vSide: 'float',
    vTile: 'float',
    vDepth: 'float',
  },

  vertex(
    { aPosition, aUv, iCenter, iSize, iUvRect, iYaw, iCurvature, iTile },
    { uViewProj, uCamPos },
    v,
  ) {
    const bend = max(iCurvature * 2.4, 0.001);
    const angle = aPosition.x * bend;
    const lean = 0.12;
    const localX = sin(angle) / bend * iSize.x;
    const localY = aPosition.y * iSize.y;
    const localZ = (cos(angle) - 1) / bend * iSize.x - aPosition.y * iSize.y * lean;
    const frontNormal = normalize(vec3(sin(angle), cos(angle) * lean, cos(angle)));
    const yawCos = cos(iYaw);
    const yawSin = sin(iYaw);
    const rotated = vec3(
      yawCos * localX + yawSin * localZ,
      localY,
      -yawSin * localX + yawCos * localZ,
    );
    const rotatedFrontNormal = normalize(vec3(
      yawCos * frontNormal.x + yawSin * frontNormal.z,
      frontNormal.y,
      -yawSin * frontNormal.x + yawCos * frontNormal.z,
    ));
    const side = aPosition.z;
    const surfaceNormal = rotatedFrontNormal.scale(side);
    const thickness = 0.012 + iSize.x * 0.012;
    const world = iCenter.add(rotated).add(surfaceNormal.scale(thickness));
    v.vUv = iUvRect.xy.add(aUv.mul(iUvRect.zw));
    v.vWorld = world;
    v.vNormal = surfaceNormal;
    v.vSide = side;
    v.vTile = iTile;
    v.vDepth = length(world.sub(uCamPos));
    return uViewProj.mul(vec4(world, 1));
  },

  fragment(
    {
      uLightViewProj,
      uCamPos,
      uAtlas,
      uCutoff,
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
    { vUv, vWorld, vNormal, vSide, vTile, vDepth },
  ) {
    const texel = texture(uAtlas, vUv);
    if (texel.w < uCutoff) discard();

    const front = step(0, vSide);
    const artLuma = dot(texel.xyz, vec3(0.299, 0.587, 0.114));
    const back = mix(vec3(0.12, 0.06, 0.032), vec3(0.31, 0.17, 0.075), artLuma);
    const albedo = mix(back, texel.xyz, front);
    const chest = step(0.5, vTile) * (1 - step(2.5, vTile));
    const paper = step(2.5, vTile) * (1 - step(5.5, vTile));
    let roughness = mix(0.74, 0.58, chest);
    roughness = mix(roughness, 0.9, paper);
    roughness = mix(0.94, roughness, front);
    let specularLevel = mix(0.075, 0.18, chest);
    specularLevel = mix(specularLevel, 0.035, paper);
    specularLevel = mix(0.025, specularLevel, front);

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
    const indirect = uSkyColor.scale(uSkyIntensity * (0.3 + up * 0.7))
      .add(uGroundColor.scale(uGroundIntensity * (0.26 + (1 - up) * 0.74)))
      .add(vec3(0.042, 0.054, 0.08));
    const warmKey = mix(vec3(1, 0.94, 0.84), uSunColor, 0.46);
    const direct = warmKey.scale(uSunIntensity * 0.52 * ndotl * shadow * shadow);
    let color = albedo.mul(indirect.add(direct));
    const specular = min(specGGX(normal, light, view, roughness), 1.4) *
      specularLevel * uSunIntensity * 0.5 * shadow * shadow;
    color = color.add(warmKey.scale(specular));
    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(max(color, vec3(0, 0, 0)), vDepth);
  },
});
