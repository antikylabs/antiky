import {
  shader,
  abs,
  clamp,
  dot,
  floor,
  fract,
  length,
  max,
  min,
  mix,
  mod,
  normalize,
  pow,
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
import { specGGX } from 'brometal/shader-functions';

function practicalRadiance(
  world: Vec3,
  normal: Vec3,
  ao: number,
  posInvRangeSq: Vec4,
  colorPower: Vec4,
  lobe: number,
): Vec3 {
  const toLight = posInvRangeSq.xyz.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq * posInvRangeSq.w, 0, 1);
  const attenuation = range * range;
  const wrappedDiffuse = 0.18 + 0.82 * max(dot(normal, normalize(toLight)), 0);
  return colorPower.xyz.scale(
    colorPower.w * attenuation * wrappedDiffuse * (0.55 + 0.45 * ao) * lobe,
  );
}

/**
 * Forward-lit surface shader for the merged town mesh.
 *
 * Attribute contract (all values are world-space / linear unless noted):
 * - aPosition: final world position. No model matrix is applied here.
 * - aNormal: unit world normal.
 * - aBaseColor: linear RGB albedo; do not bake direct light into it.
 * - aMaterial.xy: perceptual roughness [0,1], neutral specular level [0,1].
 * - aMaterialId: town material-table index used to select an atlas family.
 * - aLocalAo: baked local visibility, 0 fully occluded -> 1 open.
 * - aEmissive: emissive mask/intensity scalar (0 for non-emissive surfaces).
 *
 * The color target stores linear camera distance in alpha for the post pass.
 * The shadow map stores packed normalized light depth in RG; it must be rendered
 * by town-shadow.shader.ts into a depth-enabled target cleared to [1,1,1,1].
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
    aBaseColor: 'vec3',
    aMaterial: 'vec2',
    aMaterialId: 'float',
    aLocalAo: 'float',
    aEmissive: 'float',
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
    uEmissiveIntensity: 'float',
    uMaterialAtlas: 'sampler2D',
    uMaterialAtlasTexel: 'vec2',
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
    uPracticalPosInvRangeSq4: 'vec4',
    uPracticalColorPower4: 'vec4',
    uPracticalPosInvRangeSq5: 'vec4',
    uPracticalColorPower5: 'vec4',
    uPracticalPosInvRangeSq6: 'vec4',
    uPracticalColorPower6: 'vec4',
    uPracticalPosInvRangeSq7: 'vec4',
    uPracticalColorPower7: 'vec4',
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
    vWorld: 'vec3',
    vNormal: 'vec3',
    vBaseColor: 'vec3',
    vMaterial: 'vec2',
    vMaterialId: 'float',
    vLocalAo: 'float',
    vEmissive: 'float',
    vDepth: 'float',
  },

  vertex(
    { aPosition, aNormal, aBaseColor, aMaterial, aMaterialId, aLocalAo, aEmissive },
    { uViewProj, uCamPos },
    v,
  ) {
    v.vWorld = aPosition;
    v.vNormal = aNormal;
    v.vBaseColor = aBaseColor;
    v.vMaterial = aMaterial;
    v.vMaterialId = aMaterialId;
    v.vLocalAo = aLocalAo;
    v.vEmissive = aEmissive;
    v.vDepth = length(aPosition.sub(uCamPos));
    return uViewProj.mul(vec4(aPosition, 1));
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
      uEmissiveIntensity,
      uMaterialAtlas,
      uMaterialAtlasTexel,
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
      uPracticalPosInvRangeSq4,
      uPracticalColorPower4,
      uPracticalPosInvRangeSq5,
      uPracticalColorPower5,
      uPracticalPosInvRangeSq6,
      uPracticalColorPower6,
      uPracticalPosInvRangeSq7,
      uPracticalColorPower7,
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
    { vWorld, vNormal, vBaseColor, vMaterial, vMaterialId, vLocalAo, vEmissive, vDepth },
  ) {
    const normal = normalize(vNormal);
    const light = normalize(uLightDir);
    const view = normalize(uCamPos.sub(vWorld));
    const baseNdotL = max(dot(normal, light), 0);

    // Manual 3x3 PCF over the color depth map. BroMetal targets are nearest
    // sampled, so explicit taps are required for a stable penumbra.
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

    // Axis-aligned world projection keeps the atlas stable over merged voxel
    // quads without adding duplicated UV buffers. Material IDs select one of
    // twelve generated albedo families; authored vertex color stays the source
    // of palette identity while the texture supplies believable micro-surface.
    let surfaceUv = vec2(vWorld.x, vWorld.z);
    if (abs(normal.x) > 0.5) surfaceUv = vec2(vWorld.z, vWorld.y);
    if (abs(normal.z) > 0.5) surfaceUv = vec2(vWorld.x, vWorld.y);
    const tiledUv = surfaceUv.scale(0.82);
    const wrappedUv = vec2(fract(tiledUv.x), fract(tiledUv.y));
    surfaceUv = vec2(
      mix(0.02, 0.98, wrappedUv.x),
      mix(0.02, 0.98, wrappedUv.y),
    );

    const materialId = floor(vMaterialId + 0.5);
    let atlasTile = 0;
    if (materialId < 2) atlasTile = 6;
    else if (materialId < 3) atlasTile = 7;
    else if (materialId < 7) atlasTile = 1;
    else if (materialId < 10) atlasTile = 0;
    else if (materialId < 14) atlasTile = 2;
    else if (materialId < 15) atlasTile = 3;
    else if (materialId < 21) atlasTile = 4;
    else if (materialId < 24) atlasTile = 5;
    else if (materialId < 28) atlasTile = 8;
    else if (materialId < 31) atlasTile = 9;
    else if (materialId < 34) atlasTile = 10;
    else if (materialId < 36) atlasTile = 0;
    else if (materialId < 38) atlasTile = 6;
    else if (materialId < 39) atlasTile = 0;
    else if (materialId < 40) atlasTile = 10;
    else if (materialId < 41) atlasTile = 3;
    else if (materialId < 42) atlasTile = 4;
    else if (materialId < 43) atlasTile = 10;
    else if (materialId < 44) atlasTile = 11;
    else if (materialId < 47) atlasTile = 6;
    else if (materialId < 48) atlasTile = 4;
    else if (materialId < 49) atlasTile = 3;

    const atlasColumn = mod(atlasTile, 4);
    const atlasRow = floor(atlasTile / 4);
    const atlasUv = vec2(
      (atlasColumn + surfaceUv.x) / 4,
      (2 - atlasRow + surfaceUv.y) / 3,
    );
    const materialSample = texture(uMaterialAtlas, atlasUv).xyz;
    const sampleLuma = max(dot(materialSample, vec3(0.299, 0.587, 0.114)), 0.08);
    const microValue = clamp(1 + (sampleLuma - 0.5) * 0.82, 0.62, 1.4);
    const microChroma = materialSample.scale(1 / sampleLuma);
    const textureDetail = mix(vec3(microValue, microValue, microValue), microChroma.scale(microValue), 0.13);
    let textureStrength = 0.66;
    if (materialId >= 34 && materialId < 36) textureStrength = 0.12;
    if (materialId >= 49) textureStrength = 0;
    const texturedBase = vBaseColor.mul(mix(vec3(1, 1, 1), textureDetail, textureStrength));

    // Two forward height taps turn atlas value into a restrained world-space
    // micro-normal. This is real grazing-light depth on stone, timber, plaster,
    // shingles, and ground rather than a baked highlight in the albedo.
    const sampleU = texture(uMaterialAtlas, atlasUv.add(vec2(uMaterialAtlasTexel.x * 2, 0))).xyz;
    const sampleV = texture(uMaterialAtlas, atlasUv.add(vec2(0, uMaterialAtlasTexel.y * 2))).xyz;
    const heightU = dot(sampleU, vec3(0.299, 0.587, 0.114));
    const heightV = dot(sampleV, vec3(0.299, 0.587, 0.114));
    let tangentU = vec3(1, 0, 0);
    let tangentV = vec3(0, 0, 1);
    if (abs(normal.x) > 0.5) {
      tangentU = vec3(0, 0, 1);
      tangentV = vec3(0, 1, 0);
    }
    if (abs(normal.z) > 0.5) {
      tangentU = vec3(1, 0, 0);
      tangentV = vec3(0, 1, 0);
    }
    const bumpStrength = textureStrength * 0.72;
    const surfaceNormal = normalize(normal
      .add(tangentU.scale((sampleLuma - heightU) * bumpStrength))
      .add(tangentV.scale((sampleLuma - heightV) * bumpStrength)));
    const ndotl = max(dot(surfaceNormal, light), 0);

    const ao = clamp(vLocalAo, 0, 1);
    const cavity = 1 - ao;
    const roughness = clamp(vMaterial.x, 0.12, 1);
    const specularLevel = clamp(vMaterial.y, 0, 1);
    const up = surfaceNormal.y * 0.5 + 0.5;
    const sky = uSkyColor.scale(uSkyIntensity * (0.28 + up * 0.72));
    const ground = uGroundColor.scale(uGroundIntensity * (0.22 + (1 - up) * 0.78));
    // Preserve a cool, readable floor in shadow while retaining the authored
    // corner AO. Splitting AO between ambient and direct visibility prevents a
    // cavity from becoming an unlit black notch under the low sun.
    const ambientVisibility = 0.62 + ao * 0.38;
    const indirect = sky
      .add(ground)
      .add(vec3(0.055, 0.068, 0.1))
      .scale(ambientVisibility * 0.6);
    const directVisibility = 1 - cavity * (0.16 + roughness * 0.08);

    // The supplied sun color is deliberately saturated. Treat it as the warm
    // chromatic part of a broad-spectrum grazing key rather than multiplying
    // every lit albedo by raw orange.
    const warmKey = mix(vec3(1, 0.94, 0.84), uSunColor, 0.48);
    // Squaring the authored shadow transmission preserves the PCF penumbra
    // while restoring the reference's 1.8-2.5:1 display-space key/fill split.
    // The 0.55 energy trim keeps the broader-spectrum key below ACES clipping.
    const keyShadow = shadow * shadow;
    const direct = warmKey.scale(
      uSunIntensity * 0.55 * ndotl * keyShadow * directVisibility,
    );
    let practical = vec3(0, 0, 0);
    if (uPracticalCount > 0.5) practical = practical.add(practicalRadiance(
      vWorld, surfaceNormal, ao, uPracticalPosInvRangeSq0, uPracticalColorPower0, 1,
    ));
    if (uPracticalCount > 1.5) practical = practical.add(practicalRadiance(
      vWorld, surfaceNormal, ao, uPracticalPosInvRangeSq1, uPracticalColorPower1, 1,
    ));
    if (uPracticalCount > 2.5) practical = practical.add(practicalRadiance(
      vWorld, surfaceNormal, ao, uPracticalPosInvRangeSq2, uPracticalColorPower2, 1,
    ));
    if (uPracticalCount > 3.5) practical = practical.add(practicalRadiance(
      vWorld, surfaceNormal, ao, uPracticalPosInvRangeSq3, uPracticalColorPower3, 1,
    ));
    if (uPracticalCount > 4.5) practical = practical.add(practicalRadiance(
      vWorld, surfaceNormal, ao, uPracticalPosInvRangeSq4, uPracticalColorPower4, 1,
    ));
    if (uPracticalCount > 5.5) practical = practical.add(practicalRadiance(
      vWorld, surfaceNormal, ao, uPracticalPosInvRangeSq5, uPracticalColorPower5, 1,
    ));
    if (uPracticalCount > 6.5) {
      const windowLobe = smoothstep(
        -0.1,
        0.55,
        normalize(vWorld.sub(uPracticalPosInvRangeSq6.xyz)).z,
      );
      practical = practical.add(practicalRadiance(
        vWorld, surfaceNormal, ao, uPracticalPosInvRangeSq6, uPracticalColorPower6, windowLobe,
      ));
    }
    if (uPracticalCount > 7.5) {
      const windowLobe = smoothstep(
        -0.1,
        0.55,
        normalize(vWorld.sub(uPracticalPosInvRangeSq7.xyz)).z,
      );
      practical = practical.add(practicalRadiance(
        vWorld, surfaceNormal, ao, uPracticalPosInvRangeSq7, uPracticalColorPower7, windowLobe,
      ));
    }
    const diffuseEnergy = 1 - specularLevel * 0.22;
    let color = texturedBase.scale(diffuseEnergy).mul(
      indirect.add(direct).add(practical.scale(uPracticalStrength)),
    );
    const cavityTint = mix(vec3(0.78, 0.86, 1), vec3(1, 1, 1), ao);
    color = color.mul(cavityTint);

    // A bounded GGX lobe separates plaster, stone, timber and cloth without
    // turning low-poly faces into glossy plastic.
    const sunSpecular = min(specGGX(surfaceNormal, light, view, roughness), 1.8) *
      specularLevel * uSunIntensity * 0.55 * keyShadow * (1 - cavity * 0.28);
    const ndotv = max(dot(surfaceNormal, view), 0);
    const fresnel = pow(1 - ndotv, 5);
    const smoothness = 1 - roughness;
    const edgeReflectance = (0.035 + specularLevel * 0.28) *
      (0.28 + smoothness * 0.72);
    const edgeSheen = fresnel * edgeReflectance * (0.72 + ao * 0.28);
    const environment = mix(uGroundColor, uSkyColor, up);
    const roughBackscatter = pow(1 - ndotv, 3) * roughness * ndotl *
      keyShadow * 0.035;
    color = color
      .add(warmKey.scale(sunSpecular))
      .add(environment.scale(edgeSheen))
      .add(texturedBase.mul(warmKey).scale(roughBackscatter));
    const emissiveStrength = max(vEmissive, 0) * uEmissiveIntensity;
    color = color
      .add(vBaseColor.scale(emissiveStrength))
      .add(uSunColor.scale(emissiveStrength * 0.12));

    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(vec3(max(color.x, 0), max(color.y, 0), max(color.z, 0)), vDepth);
  },
});
