import {
  clamp,
  cos,
  dot,
  length,
  max,
  min,
  mix,
  normalize,
  sin,
  shader,
  smoothstep,
  texture,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { specGGX, tonemapACES } from 'brometal/shader-functions';

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

function pointRadiance(
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
  const attenuation = range * range;
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  const specular = min(specGGX(normal, light, view, roughness), 1.5) * 0.12;
  return lightColor.scale(lightPower * attenuation * (diffuse + specular));
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
    uMaterialLayout: 'float',
    uDiffuseLift: 'float',
    uTextureContrast: 'float',
    uSaturation: 'float',
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
    vNormal: 'vec3',
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
    uDiffuseLift,
    uTextureContrast,
    uSaturation,
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
  }, { vWorld, vNormal, vUv, vTint, vMaterial }) {
    const normal = normalize(vNormal);
    const view = normalize(uCameraPosition.sub(vWorld));
    const materialMap = texture(uArm, vUv).xyz;
    const roughness = clamp(mix(materialMap.y, materialMap.x, uMaterialLayout) + vMaterial.x, 0.18, 1);
    const occlusion = mix(0.58 + materialMap.x * 0.42, 1, uMaterialLayout);
    const sourceBase = texture(uDiffuse, vUv).xyz;
    const sourceLuminance = dot(sourceBase, vec3(0.2126, 0.7152, 0.0722));
    const saturated = mix(vec3(sourceLuminance, sourceLuminance, sourceLuminance), sourceBase, uSaturation);
    const lifted = mix(vec3(0.48, 0.48, 0.48), saturated, uTextureContrast)
      .add(vec3(uDiffuseLift, uDiffuseLift, uDiffuseLift));
    const base = clamp(lifted, 0, 1).mul(vTint);
    const relay = pointRadiance(
      vWorld, normal, view, uEmberPosition, uEmberColor, uEmberPower, uEmberRadius, roughness,
    ).add(pointRadiance(
      vWorld, normal, view, uIonPosition, uIonColor, uIonPower, uIonRadius, roughness,
    )).add(pointRadiance(
      vWorld, normal, view, uVioletPosition, uVioletColor, uVioletPower, uVioletRadius, roughness,
    )).scale(uRelayLightStrength);
    const ambient = uAmbientColor.scale(uAmbientStrength * (0.72 + normal.y * 0.2));
    const lit = base.mul(ambient.add(relay)).scale(occlusion);
    const pulse = 0.94 + sin(uTime * 2.1 + vWorld.y) * 0.06;
    const emissive = base.scale(vMaterial.y * pulse);
    const fog = smoothstep(uFogStart, uFogEnd, length(uCameraPosition.sub(vWorld)));
    return vec4(tonemapACES(mix(
      lit.add(emissive).scale(uExposure),
      uFogColor,
      fog * uFogMaximumMix,
    )), 1);
  },
});
