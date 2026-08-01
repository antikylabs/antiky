import {
  shader,
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
} from 'brometal';
import { specGGX } from 'brometal/shader-functions';

function waterNormal(x: number, z: number, time: number): Vec3 {
  const dx = cos(x * 0.72 + time * 0.7) * 0.09 +
    cos((x + z) * 1.1 - time * 0.82) * 0.045;
  const dz = cos(z * 0.58 - time * 0.58) * 0.075 +
    cos((x + z) * 1.1 - time * 0.82) * 0.045;
  return normalize(vec3(-dx, 1, -dz));
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
      const x = mod(i, 2) - 0.5;
      const y = floor(i / 2) - 0.5;
      const stored = texture(uShadowMap, shadowUv.add(uShadowTexel.mul(vec2(x, y))));
      const nearestDepth = stored.x + stored.y / 255;
      occluded = occluded + step(nearestDepth + uShadowBias, receiverDepth);
    }
    const shadow = 1 - insideShadow * clamp(uShadowStrength, 0, 1) * occluded * 0.25;

    const ndotv = max(dot(normal, view), 0);
    const fresnel = 0.025 + 0.975 * pow(1 - ndotv, 5);
    const bodyMix = 0.18 + smoothstep(-0.72, 0.82, vRipple) * 0.18;
    const body = mix(uDeepColor, uShallowColor, bodyMix);
    let color = mix(body, uSkyColor, fresnel * 0.72);

    const sunSpecular = min(specGGX(normal, light, view, clamp(uRoughness, 0.08, 1)), 3) *
      uSunIntensity * shadow;
    const diffuseGlint = ndotl * shadow * 0.06;
    const crest = smoothstep(0.72, 0.98, vRipple) * clamp(uCrestStrength, 0, 1);
    color = color
      .add(uSunColor.scale(sunSpecular + diffuseGlint))
      .add(uShallowColor.scale(crest * 0.22));

    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(max(color, vec3(0, 0, 0)), vDepth);
  },
});
