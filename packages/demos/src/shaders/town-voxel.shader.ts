import {
  shader,
  clamp,
  dot,
  floor,
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
} from 'brometal';
import { specGGX } from 'brometal/shader-functions';

/**
 * Forward-lit surface shader for the merged town mesh.
 *
 * Attribute contract (all values are world-space / linear unless noted):
 * - aPosition: final world position. No model matrix is applied here.
 * - aNormal: unit world normal.
 * - aBaseColor: linear RGB albedo; do not bake direct light into it.
 * - aMaterial.xy: perceptual roughness [0,1], neutral specular level [0,1].
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
    vLocalAo: 'float',
    vEmissive: 'float',
    vDepth: 'float',
  },

  vertex(
    { aPosition, aNormal, aBaseColor, aMaterial, aLocalAo, aEmissive },
    { uViewProj, uCamPos },
    v,
  ) {
    v.vWorld = aPosition;
    v.vNormal = aNormal;
    v.vBaseColor = aBaseColor;
    v.vMaterial = aMaterial;
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
    { vWorld, vNormal, vBaseColor, vMaterial, vLocalAo, vEmissive, vDepth },
  ) {
    const normal = normalize(vNormal);
    const light = normalize(uLightDir);
    const view = normalize(uCamPos.sub(vWorld));
    const ndotl = max(dot(normal, light), 0);

    // Manual 3x3 PCF over the color depth map. BroMetal targets are nearest
    // sampled, so explicit taps are required for a stable penumbra.
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
    for (let i = 0; i < 9; i += 1) {
      const x = mod(i, 3) - 1;
      const y = floor(i / 3) - 1;
      const stored = texture(uShadowMap, shadowUv.add(uShadowTexel.mul(vec2(x, y))));
      const nearestDepth = stored.x + stored.y / 255;
      occluded = occluded + step(nearestDepth + depthBias, receiverDepth);
    }
    const shadow = 1 - insideShadow * clamp(uShadowStrength, 0, 1) * occluded / 9;

    const ao = clamp(vLocalAo, 0, 1);
    const cavity = 1 - ao;
    const roughness = clamp(vMaterial.x, 0.12, 1);
    const specularLevel = clamp(vMaterial.y, 0, 1);
    const up = normal.y * 0.5 + 0.5;
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
    const diffuseEnergy = 1 - specularLevel * 0.22;
    let color = vBaseColor.scale(diffuseEnergy).mul(indirect.add(direct));
    const cavityTint = mix(vec3(0.78, 0.86, 1), vec3(1, 1, 1), ao);
    color = color.mul(cavityTint);

    // A bounded GGX lobe separates plaster, stone, timber and cloth without
    // turning low-poly faces into glossy plastic.
    const sunSpecular = min(specGGX(normal, light, view, roughness), 1.8) *
      specularLevel * uSunIntensity * 0.55 * keyShadow * (1 - cavity * 0.28);
    const ndotv = max(dot(normal, view), 0);
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
      .add(vBaseColor.mul(warmKey).scale(roughBackscatter));
    const emissiveStrength = max(vEmissive, 0) * uEmissiveIntensity;
    color = color
      .add(vBaseColor.scale(emissiveStrength))
      .add(uSunColor.scale(emissiveStrength * 0.12));

    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(max(color, vec3(0, 0, 0)), vDepth);
  },
});
