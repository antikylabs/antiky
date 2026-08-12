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
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { specGGX, tonemapACES } from 'brometal/shader-functions';

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
): Vec3 {
  const toLight = lightPosition.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq / (lightRadius * lightRadius), 0, 1);
  const attenuation = range * range;
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  const specular = min(specGGX(normal, light, view, roughness), 2.4)
    * (0.16 + metalness * 0.84);
  return lightColor.scale(lightPower * attenuation * (diffuse + specular));
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
  }, { vWorld, vNormal, vBaseColor, vMaterial }) {
    const normal = normalize(vNormal);
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
    );
    const radiance = ember.add(ion).add(violet).scale(uRelayLightStrength);
    const hemisphere = 0.78 + normal.y * 0.2;
    const ambient = uAmbientColor.scale(uAmbientStrength * hemisphere);
    const lit = vBaseColor.mul(ambient.add(radiance))
      .add(radiance.scale(metalness * 0.2));
    const pulse = 0.92 + sin(uTime * 2.4 + vWorld.x * 0.5) * 0.08;
    const emissive = vBaseColor.scale(vMaterial.z * pulse);
    const fog = smoothstep(uFogStart, uFogEnd, length(uCameraPosition.sub(vWorld)));
    const color = mix(
      lit.add(emissive).scale(uExposure),
      uFogColor,
      fog * uFogMaximumMix,
    );
    return vec4(tonemapACES(color), 1);
  },
});
