import {
  step,
  pow,
  abs,
  clamp,
  dot,
  length,
  max,
  mix,
  normalize,
  shader,
  smoothstep,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { specGGX, tonemapACES } from 'brometal/shader-functions';

function materialPresentationFloorLight(
  world: Vec3,
  normal: Vec3,
  view: Vec3,
  lightPosition: Vec3,
  lightColor: Vec3,
  lightPower: number,
  lightRadius: number,
  roughness: number,
): Vec3 {
  const toLight = lightPosition.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq / (lightRadius * lightRadius), 0, 1);
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  const specular = specGGX(normal, light, view, roughness) * 0.12;
  return lightColor.scale(lightPower * range * range * (diffuse + specular));
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
    aUv: 'vec2',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uDiffuse: 'sampler2D',
    uAo: 'sampler2D',
    uRoughness: 'sampler2D',
    uDiffuseTint: 'vec3',
    uTextureContrast: 'float',
    uAmbientColor: 'vec3',
    uAmbientStrength: 'float',
    uExposure: 'float',
    uRelayLightStrength: 'float',
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
    vUv: 'vec2',
  },

  vertex({ aPosition, aUv }, { uViewProj }, v) {
    const world = vec3(aPosition.x, -0.42, -aPosition.y);
    v.vWorld = world;
    v.vUv = aUv.mul(vec2(2.65, 1.9));
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({
    uCameraPosition,
    uDiffuse,
    uAo,
    uRoughness,
    uDiffuseTint,
    uTextureContrast,
    uAmbientColor,
    uAmbientStrength,
    uExposure,
    uRelayLightStrength,
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
  }, { vWorld, vUv }) {
    const sourceDiffuse = decodeSrgb(texture(uDiffuse, vUv).xyz);
    const diffuseSample = mix(vec3(0.38, 0.36, 0.31), sourceDiffuse, uTextureContrast);
    const ao = mix(0.64, 1, texture(uAo, vUv).x);
    const roughness = clamp(texture(uRoughness, vUv).x, 0.2, 0.98);
    const normal = vec3(0, 1, 0);
    const view = normalize(uCameraPosition.sub(vWorld));
    const amber = materialPresentationFloorLight(vWorld, normal, view, uEmberPosition, uEmberColor, uEmberPower, uEmberRadius, roughness);
    const blue = materialPresentationFloorLight(vWorld, normal, view, uIonPosition, uIonColor, uIonPower, uIonRadius, roughness);
    const plum = materialPresentationFloorLight(vWorld, normal, view, uVioletPosition, uVioletColor, uVioletPower, uVioletRadius, roughness);
    const irradiance = amber.add(blue).add(plum).scale(uRelayLightStrength);
    const dampEarth = diffuseSample.mul(uDiffuseTint);
    const ambient = uAmbientColor.scale(uAmbientStrength * ao);
    const lit = dampEarth.mul(ambient.add(irradiance));
    const stonePath = smoothstep(0.44, 0.5, max(0.6 - abs(vWorld.x) * 0.12, 0.6 - abs(vWorld.z) * 0.12));
    const pathTint = mix(vec3(1, 1, 1), vec3(0.74, 0.78, 0.72), stonePath * 0.18);
    const materialColor = lit.mul(pathTint).add(irradiance.scale(0.035)).scale(uExposure);
    const fog = smoothstep(uFogStart, uFogEnd, length(uCameraPosition.sub(vWorld)));
    return vec4(tonemapACES(mix(
      materialColor,
      uFogColor,
      fog * uFogMaximumMix,
    )), 1);
  },
});
